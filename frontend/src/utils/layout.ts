import dagre from 'dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_HEIGHT = 140;

/**
 * Calculates the connection points on the closest sides between two connected nodes.
 */
export const getClosestConnectionHandles = (
  sourceNode: Node,
  targetNode: Node
): { sourceHandle: HandleSide; targetHandle: HandleSide } => {
  // Gracefully handle self-referencing loops
  if (sourceNode.id === targetNode.id) {
    return { sourceHandle: 'right', targetHandle: 'top' };
  }

  const sw = sourceNode.measured?.width ?? (sourceNode.width as number) ?? DEFAULT_NODE_WIDTH;
  const sh = sourceNode.measured?.height ?? (sourceNode.height as number) ?? DEFAULT_NODE_HEIGHT;
  const tw = targetNode.measured?.width ?? (targetNode.width as number) ?? DEFAULT_NODE_WIDTH;
  const th = targetNode.measured?.height ?? (targetNode.height as number) ?? DEFAULT_NODE_HEIGHT;

  const sourcePoints: Record<HandleSide, { x: number; y: number }> = {
    top: { x: sourceNode.position.x + sw / 2, y: sourceNode.position.y },
    right: { x: sourceNode.position.x + sw, y: sourceNode.position.y + sh / 2 },
    bottom: { x: sourceNode.position.x + sw / 2, y: sourceNode.position.y + sh },
    left: { x: sourceNode.position.x, y: sourceNode.position.y + sh / 2 },
  };

  const targetPoints: Record<HandleSide, { x: number; y: number }> = {
    top: { x: targetNode.position.x + tw / 2, y: targetNode.position.y },
    right: { x: targetNode.position.x + tw, y: targetNode.position.y + th / 2 },
    bottom: { x: targetNode.position.x + tw / 2, y: targetNode.position.y + th },
    left: { x: targetNode.position.x, y: targetNode.position.y + th / 2 },
  };

  const sides: HandleSide[] = ['top', 'right', 'bottom', 'left'];
  let minDistance = Infinity;
  let bestSource: HandleSide = 'bottom';
  let bestTarget: HandleSide = 'top';

  for (const sSide of sides) {
    const sPt = sourcePoints[sSide];
    for (const tSide of sides) {
      const tPt = targetPoints[tSide];
      const dist = Math.hypot(sPt.x - tPt.x, sPt.y - tPt.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestSource = sSide;
        bestTarget = tSide;
      }
    }
  }

  return { sourceHandle: bestSource, targetHandle: bestTarget };
};

/**
 * Updates all edges with optimal sourceHandle and targetHandle based on current node positions.
 */
export const updateEdgesClosestHandles = (nodes: Node[], edges: Edge[]): Edge[] => {
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      return edge;
    }

    const { sourceHandle, targetHandle } = getClosestConnectionHandles(sourceNode, targetNode);
    const edgeColor = (edge.style?.stroke as string) || '#94a3b8';

    return {
      ...edge,
      sourceHandle,
      targetHandle,
      markerEnd: edge.markerEnd || {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
        width: 18,
        height: 18,
      },
    };
  });
};

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 80 : 70,
    ranksep: isHorizontal ? 120 : 100,
  });

  nodes.forEach((node) => {
    const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  const layoutedEdges = updateEdgesClosestHandles(layoutedNodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
