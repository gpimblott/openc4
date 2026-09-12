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

import { computeBoundaryNodes, type BoundaryInfo } from './boundary';

/**
 * Updates all edges with optimal sourceHandle and targetHandle based on current node positions.
 */
export const updateEdgesClosestHandles = (nodes: Node[], edges: Edge[]): Edge[] => {
  const nodeMap = new Map<string, Node>(
    nodes.filter((n) => n.type !== 'c4Boundary').map((n) => [n.id, n])
  );

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

/**
 * Resolves any residual bounding-box collisions between boundary groups or standalone nodes.
 */
function resolveBoundaryAndNodeCollisions(
  leafNodes: Node[],
  boundaries: BoundaryInfo[] | null | undefined,
  direction: 'TB' | 'LR'
): Node[] {
  if (!boundaries || boundaries.length === 0) {
    return leafNodes;
  }

  const boundaryMap = new Map(boundaries.map((b) => [b.id, b]));

  // Find all leaf node IDs inside a boundary (including nested child boundaries)
  const getAllDescendantLeafIds = (boundaryId: string): Set<string> => {
    const ids = new Set<string>();
    const b = boundaryMap.get(boundaryId);
    if (!b) return ids;
    b.childIds.forEach((id) => ids.add(id));
    boundaries
      .filter((other) => other.parentBoundaryId === boundaryId)
      .forEach((childB) => {
        getAllDescendantLeafIds(childB.id).forEach((id) => ids.add(id));
      });
    return ids;
  };

  let currentNodes = [...leafNodes];
  const minGap = 45;

  for (let pass = 0; pass < 5; pass++) {
    const boundaryNodes = computeBoundaryNodes(currentNodes, boundaries);
    const boundaryNodeMap = new Map(boundaryNodes.map((bn) => [(bn.data as any).id, bn]));

    // Root items: root boundaries and standalone leaf nodes not in any boundary
    const rootBoundaries = boundaries.filter(
      (b) => !b.parentBoundaryId || !boundaryMap.has(b.parentBoundaryId)
    );
    const assignedLeafIds = new Set<string>();
    boundaries.forEach((b) => b.childIds.forEach((id) => assignedLeafIds.add(id)));
    const standaloneNodes = currentNodes.filter((n) => !assignedLeafIds.has(n.id));

    interface LayoutBox {
      type: 'boundary' | 'node';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      leafIds: Set<string>;
    }

    const items: LayoutBox[] = [];
    for (const rb of rootBoundaries) {
      const bn = boundaryNodeMap.get(rb.id);
      if (bn) {
        items.push({
          type: 'boundary',
          id: rb.id,
          x: bn.position.x,
          y: bn.position.y,
          width: (bn.style?.width as number) || DEFAULT_NODE_WIDTH,
          height: (bn.style?.height as number) || DEFAULT_NODE_HEIGHT,
          leafIds: getAllDescendantLeafIds(rb.id),
        });
      }
    }
    for (const sn of standaloneNodes) {
      items.push({
        type: 'node',
        id: sn.id,
        x: sn.position.x,
        y: sn.position.y,
        width: sn.measured?.width ?? (sn.width as number) ?? DEFAULT_NODE_WIDTH,
        height: sn.measured?.height ?? (sn.height as number) ?? DEFAULT_NODE_HEIGHT,
        leafIds: new Set([sn.id]),
      });
    }

    let shifted = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        const aRight = a.x + a.width;
        const aBottom = a.y + a.height;
        const bRight = b.x + b.width;
        const bBottom = b.y + b.height;

        const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x);
        const overlapY = Math.min(aBottom, bBottom) - Math.max(a.y, b.y);

        if (overlapX > -minGap && overlapY > -minGap) {
          shifted = true;
          let dx = 0;
          let dy = 0;

          if (direction === 'LR') {
            const centerAY = a.y + a.height / 2;
            const centerBY = b.y + b.height / 2;
            const centerAX = a.x + a.width / 2;
            const centerBX = b.x + b.width / 2;

            if (Math.abs(centerAY - centerBY) > 40 || overlapX > overlapY) {
              if (centerAY < centerBY) {
                dy = aBottom + minGap - b.y;
                if (dy > 0) {
                  currentNodes = currentNodes.map((n) =>
                    b.leafIds.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + dy } } : n
                  );
                  b.y += dy;
                }
              } else {
                dy = bBottom + minGap - a.y;
                if (dy > 0) {
                  currentNodes = currentNodes.map((n) =>
                    a.leafIds.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + dy } } : n
                  );
                  a.y += dy;
                }
              }
            } else {
              if (centerAX < centerBX) {
                dx = aRight + minGap - b.x;
                if (dx > 0) {
                  currentNodes = currentNodes.map((n) =>
                    b.leafIds.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + dx } } : n
                  );
                  b.x += dx;
                }
              } else {
                dx = bRight + minGap - a.x;
                if (dx > 0) {
                  currentNodes = currentNodes.map((n) =>
                    a.leafIds.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + dx } } : n
                  );
                  a.x += dx;
                }
              }
            }
          } else {
            // TB
            const centerAX = a.x + a.width / 2;
            const centerBX = b.x + b.width / 2;
            const centerAY = a.y + a.height / 2;
            const centerBY = b.y + b.height / 2;

            if (Math.abs(centerAX - centerBX) > 40 || overlapY > overlapX) {
              if (centerAX < centerBX) {
                dx = aRight + minGap - b.x;
                if (dx > 0) {
                  currentNodes = currentNodes.map((n) =>
                    b.leafIds.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + dx } } : n
                  );
                  b.x += dx;
                }
              } else {
                dx = bRight + minGap - a.x;
                if (dx > 0) {
                  currentNodes = currentNodes.map((n) =>
                    a.leafIds.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + dx } } : n
                  );
                  a.x += dx;
                }
              }
            } else {
              if (centerAY < centerBY) {
                dy = aBottom + minGap - b.y;
                if (dy > 0) {
                  currentNodes = currentNodes.map((n) =>
                    b.leafIds.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + dy } } : n
                  );
                  b.y += dy;
                }
              } else {
                dy = bBottom + minGap - a.y;
                if (dy > 0) {
                  currentNodes = currentNodes.map((n) =>
                    a.leafIds.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + dy } } : n
                  );
                  a.y += dy;
                }
              }
            }
          }
        }
      }
    }

    if (!shifted) break;
  }

  // Normalize all coordinates so diagram starts near (50, 50)
  const finalBoundaries = computeBoundaryNodes(currentNodes, boundaries);
  let minX = Infinity;
  let minY = Infinity;
  for (const n of currentNodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
  }
  for (const bn of finalBoundaries) {
    minX = Math.min(minX, bn.position.x);
    minY = Math.min(minY, bn.position.y);
  }

  if (minX !== Infinity && minY !== Infinity) {
    const shiftX = 50 - minX;
    const shiftY = 50 - minY;
    return currentNodes.map((n) => ({
      ...n,
      position: {
        x: Math.round(n.position.x + shiftX),
        y: Math.round(n.position.y + shiftY),
      },
    }));
  }

  return currentNodes;
}

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  boundaries?: BoundaryInfo[] | null
) => {
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 100 : 90,
    ranksep: isHorizontal ? 140 : 120,
    edgesep: isHorizontal ? 100 : 80,
    marginx: 40,
    marginy: 40,
  });

  const nonBoundaryNodes = nodes.filter((node) => node.type !== 'c4Boundary');
  const nodeMap = new Map(nonBoundaryNodes.map((n) => [n.id, n]));

  nonBoundaryNodes.forEach((node) => {
    const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
    dagreGraph.setNode(node.id, { width, height });
  });

  if (boundaries && boundaries.length > 0) {
    const boundaryMap = new Map<string, BoundaryInfo>(boundaries.map((b) => [b.id, b]));

    const getDepth = (b: BoundaryInfo): number => {
      let d = 0;
      let curr = b;
      const visited = new Set<string>([b.id]);
      while (curr.parentBoundaryId && boundaryMap.has(curr.parentBoundaryId)) {
        if (visited.has(curr.parentBoundaryId)) break;
        d += 1;
        visited.add(curr.parentBoundaryId);
        curr = boundaryMap.get(curr.parentBoundaryId)!;
      }
      return d;
    };

    const boundaryHasNodes = (b: BoundaryInfo, visited = new Set<string>()): boolean => {
      if (visited.has(b.id)) return false;
      visited.add(b.id);
      if (b.childIds.some((cid) => nodeMap.has(cid))) return true;
      return boundaries.some((other) => other.parentBoundaryId === b.id && boundaryHasNodes(other, visited));
    };

    const validBoundaries = boundaries.filter((b) => boundaryHasNodes(b));

    // Register all valid boundaries as cluster nodes in Dagre
    for (const b of validBoundaries) {
      dagreGraph.setNode(b.id, {});
    }

    // Set parent-child relationship between nested boundaries
    for (const b of validBoundaries) {
      if (b.parentBoundaryId && validBoundaries.some((p) => p.id === b.parentBoundaryId)) {
        try {
          dagreGraph.setParent(b.id, b.parentBoundaryId);
        } catch (err) {
          console.warn(`[AutoLayout] Failed to set boundary parent:`, err);
        }
      }
    }

    // Map each leaf node to its innermost containing boundary
    for (const node of nonBoundaryNodes) {
      const containingBoundaries = validBoundaries.filter((b) => b.childIds.includes(node.id));
      if (containingBoundaries.length > 0) {
        containingBoundaries.sort((a, b) => getDepth(b) - getDepth(a));
        try {
          dagreGraph.setParent(node.id, containingBoundaries[0].id);
        } catch (err) {
          console.warn(`[AutoLayout] Failed to set node parent:`, err);
        }
      }
    }
  }

  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  try {
    dagre.layout(dagreGraph);
  } catch (layoutErr) {
    console.warn('[AutoLayout] Compound Dagre layout failed, falling back to simple layout:', layoutErr);
    const fallbackGraph = new dagre.graphlib.Graph();
    fallbackGraph.setDefaultEdgeLabel(() => ({}));
    fallbackGraph.setGraph({
      rankdir: direction,
      nodesep: isHorizontal ? 80 : 70,
      ranksep: isHorizontal ? 120 : 100,
    });
    nonBoundaryNodes.forEach((node) => {
      const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
      const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
      fallbackGraph.setNode(node.id, { width, height });
    });
    edges.forEach((edge) => {
      if (fallbackGraph.hasNode(edge.source) && fallbackGraph.hasNode(edge.target)) {
        fallbackGraph.setEdge(edge.source, edge.target);
      }
    });
    dagre.layout(fallbackGraph);

    // Extract fallback positions
    const fallbackElements = nonBoundaryNodes.map((node) => {
      const nodeWithPosition = fallbackGraph.node(node.id);
      const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
      const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
      return {
        ...node,
        position: {
          x: (nodeWithPosition?.x ?? 0) - width / 2,
          y: (nodeWithPosition?.y ?? 0) - height / 2,
        },
      };
    });

    const bNodes = computeBoundaryNodes(fallbackElements, boundaries);
    const lNodes = bNodes.length > 0 ? [...bNodes, ...fallbackElements] : fallbackElements;
    return { nodes: lNodes, edges: updateEdgesClosestHandles(lNodes, edges) };
  }

  const initialLayoutedElements = nonBoundaryNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.measured?.width ?? (node.width as number) ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? (node.height as number) ?? DEFAULT_NODE_HEIGHT;
    return {
      ...node,
      position: {
        x: (nodeWithPosition?.x ?? 0) - width / 2,
        y: (nodeWithPosition?.y ?? 0) - height / 2,
      },
    };
  });

  // Resolve residual collisions with boundaries and normalize coordinates
  const layoutedElements = resolveBoundaryAndNodeCollisions(
    initialLayoutedElements,
    boundaries,
    direction
  );

  const boundaryNodes = computeBoundaryNodes(layoutedElements, boundaries);
  const layoutedNodes = boundaryNodes.length > 0 ? [...boundaryNodes, ...layoutedElements] : layoutedElements;

  const layoutedEdges = updateEdgesClosestHandles(layoutedNodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
