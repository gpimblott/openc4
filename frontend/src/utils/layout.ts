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

/**
 * Positions incoming view nodes by preserving current node coordinates for existing elements
 * and finding clean, collision-free locations for newly added elements.
 */
export const positionIncrementalNodes = (
  currentPlacedNodes: Node[],
  incomingNodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  boundaries?: BoundaryInfo[] | null
): { nodes: Node[]; edges: Edge[] } => {
  const incomingNonBoundary = incomingNodes.filter((n) => n.type !== 'c4Boundary');
  if (incomingNonBoundary.length === 0) {
    return { nodes: [], edges: [] };
  }

  const currentMap = new Map<string, Node>(
    currentPlacedNodes.filter((n) => n.type !== 'c4Boundary').map((n) => [n.id, n])
  );

  // If no existing placed nodes match incoming nodes, run full auto-layout
  const matchingExistingCount = incomingNonBoundary.filter((n) => currentMap.has(n.id)).length;
  if (matchingExistingCount === 0) {
    return getLayoutedElements(incomingNodes, edges, direction, boundaries);
  }

  const isHorizontal = direction === 'LR';
  const placedList: Node[] = [];
  const unplacedList: Node[] = [];

  for (const node of incomingNonBoundary) {
    const existing = currentMap.get(node.id);
    if (existing) {
      placedList.push({
        ...node,
        position: { ...existing.position },
      });
    } else {
      unplacedList.push(node);
    }
  }

  if (unplacedList.length === 0) {
    const bNodes = computeBoundaryNodes(placedList, boundaries);
    const allNodes = bNodes.length > 0 ? [...bNodes, ...placedList] : placedList;
    return { nodes: allNodes, edges: updateEdgesClosestHandles(allNodes, edges) };
  }

  const minGap = 50;

  const isColliding = (x: number, y: number, w: number, h: number, currentList: Node[]): boolean => {
    const boundaryNodes = computeBoundaryNodes(currentList, boundaries);
    const obstacles: Array<{ x: number; y: number; w: number; h: number }> = [
      ...currentList.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? (n.width as number) ?? DEFAULT_NODE_WIDTH,
        h: n.measured?.height ?? (n.height as number) ?? DEFAULT_NODE_HEIGHT,
      })),
      ...boundaryNodes.map((bn) => ({
        x: bn.position.x,
        y: bn.position.y,
        w: (bn.style?.width as number) || DEFAULT_NODE_WIDTH,
        h: (bn.style?.height as number) || DEFAULT_NODE_HEIGHT,
      })),
    ];

    for (const obs of obstacles) {
      const overlapX = Math.min(x + w, obs.x + obs.w) - Math.max(x, obs.x);
      const overlapY = Math.min(y + h, obs.y + obs.h) - Math.max(y, obs.y);
      if (overlapX > -minGap && overlapY > -minGap) {
        return true;
      }
    }
    return false;
  };

  // Build connection lookups for fast neighbor resolution
  const outgoingNeighbors = new Map<string, string[]>();
  const incomingNeighbors = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoingNeighbors.has(edge.source)) outgoingNeighbors.set(edge.source, []);
    outgoingNeighbors.get(edge.source)!.push(edge.target);

    if (!incomingNeighbors.has(edge.target)) incomingNeighbors.set(edge.target, []);
    incomingNeighbors.get(edge.target)!.push(edge.source);
  }

  // Boundary sibling map
  const boundaryMap = new Map<string, BoundaryInfo>((boundaries || []).map((b) => [b.id, b]));
  const nodeToBoundary = new Map<string, string>();
  (boundaries || []).forEach((b) => {
    b.childIds.forEach((cid) => nodeToBoundary.set(cid, b.id));
  });

  for (const unplaced of unplacedList) {
    const w = unplaced.measured?.width ?? (unplaced.width as number) ?? DEFAULT_NODE_WIDTH;
    const h = unplaced.measured?.height ?? (unplaced.height as number) ?? DEFAULT_NODE_HEIGHT;

    // Calculate current bounds of all placed items
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of placedList) {
      const pw = p.measured?.width ?? (p.width as number) ?? DEFAULT_NODE_WIDTH;
      const ph = p.measured?.height ?? (p.height as number) ?? DEFAULT_NODE_HEIGHT;
      if (p.position.x < minX) minX = p.position.x;
      if (p.position.y < minY) minY = p.position.y;
      if (p.position.x + pw > maxX) maxX = p.position.x + pw;
      if (p.position.y + ph > maxY) maxY = p.position.y + ph;
    }

    if (minX === Infinity) {
      minX = 50;
      minY = 50;
      maxX = 300;
      maxY = 200;
    }

    let candX = 50;
    let candY = 50;
    let foundStrategy = false;

    // Strategy 1: Check for sibling nodes in the same boundary
    const bId = nodeToBoundary.get(unplaced.id);
    if (bId) {
      const bInfo = boundaryMap.get(bId);
      const placedSiblings = placedList.filter((p) => bInfo?.childIds.includes(p.id));
      if (placedSiblings.length > 0) {
        const lastSib = placedSiblings[placedSiblings.length - 1];
        const lastW = lastSib.measured?.width ?? (lastSib.width as number) ?? DEFAULT_NODE_WIDTH;
        const lastH = lastSib.measured?.height ?? (lastSib.height as number) ?? DEFAULT_NODE_HEIGHT;
        if (isHorizontal) {
          candX = lastSib.position.x;
          candY = lastSib.position.y + lastH + 60;
        } else {
          candX = lastSib.position.x + lastW + 60;
          candY = lastSib.position.y;
        }
        foundStrategy = true;
      }
    }

    // Strategy 2: Place downstream/upstream of connected nodes
    if (!foundStrategy) {
      const sourceOfUnplaced = (incomingNeighbors.get(unplaced.id) || [])
        .map((srcId) => placedList.find((p) => p.id === srcId))
        .filter((p): p is Node => p !== undefined);

      const targetOfUnplaced = (outgoingNeighbors.get(unplaced.id) || [])
        .map((tgtId) => placedList.find((p) => p.id === tgtId))
        .filter((p): p is Node => p !== undefined);

      if (sourceOfUnplaced.length > 0) {
        const src = sourceOfUnplaced[0];
        const srcW = src.measured?.width ?? (src.width as number) ?? DEFAULT_NODE_WIDTH;
        const srcH = src.measured?.height ?? (src.height as number) ?? DEFAULT_NODE_HEIGHT;
        candX = isHorizontal ? src.position.x + srcW + 120 : src.position.x;
        candY = isHorizontal ? src.position.y : src.position.y + srcH + 100;
        foundStrategy = true;
      } else if (targetOfUnplaced.length > 0) {
        const tgt = targetOfUnplaced[0];
        candX = isHorizontal ? Math.max(50, tgt.position.x - w - 120) : tgt.position.x;
        candY = isHorizontal ? tgt.position.y : Math.max(50, tgt.position.y - h - 100);
        foundStrategy = true;
      }
    }

    // Strategy 3: Place neatly at the end of the diagram
    if (!foundStrategy) {
      if (isHorizontal) {
        candX = maxX + 100;
        candY = minY;
      } else {
        candX = minX;
        candY = maxY + 100;
      }
    }

    // Collision resolution loop: shift until a clear spot is found
    let attempts = 0;
    const stepX = w + 60;
    const stepY = h + 60;

    while (isColliding(candX, candY, w, h, placedList) && attempts < 100) {
      attempts++;
      if (isHorizontal) {
        candY += stepY;
        if (candY > maxY + 300) {
          candY = minY;
          candX += stepX;
        }
      } else {
        candX += stepX;
        if (candX > maxX + 400) {
          candX = minX;
          candY += stepY;
        }
      }
    }

    placedList.push({
      ...unplaced,
      position: { x: Math.max(50, Math.round(candX)), y: Math.max(50, Math.round(candY)) },
    });
  }

  // Resolve residual collisions with boundaries and normalize
  const finalNodes = resolveBoundaryAndNodeCollisions(placedList, boundaries, direction);
  const boundaryNodes = computeBoundaryNodes(finalNodes, boundaries);
  const layoutedNodes = boundaryNodes.length > 0 ? [...boundaryNodes, ...finalNodes] : finalNodes;
  const layoutedEdges = updateEdgesClosestHandles(layoutedNodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

