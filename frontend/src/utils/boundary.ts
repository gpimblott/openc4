import type { Node } from '@xyflow/react';

export interface BoundaryInfo {
  id: string;
  name: string;
  type: string;
  technology?: string;
  description?: string;
  childIds: string[];
  parentBoundaryId?: string | null;
}

const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_HEIGHT = 140;

export function computeBoundaryNodes(
  nodes: Node[],
  boundaries: BoundaryInfo[] | null | undefined
): Node[] {
  if (!boundaries || boundaries.length === 0) {
    return [];
  }

  // Calculate hierarchy depth for each boundary
  const boundaryMap = new Map<string, BoundaryInfo>(boundaries.map((b) => [b.id, b]));
  const getDepth = (b: BoundaryInfo): number => {
    let d = 0;
    let curr = b;
    while (curr.parentBoundaryId && boundaryMap.has(curr.parentBoundaryId)) {
      d += 1;
      curr = boundaryMap.get(curr.parentBoundaryId)!;
    }
    return d;
  };

  const maxDepth = Math.max(...boundaries.map(getDepth));

  // Sort: inner boundaries (higher depth) first, so outer boundaries can enclose them
  const sortedBoundaries = [...boundaries].sort((a, b) => getDepth(b) - getDepth(a));

  const createdBoundaryNodesMap = new Map<string, Node>();
  const nonBoundaryNodes = nodes.filter((n) => n.type !== 'c4Boundary');

  for (const boundary of sortedBoundaries) {
    const childIdSet = new Set(boundary.childIds);
    // Direct child leaf nodes that belong to this boundary
    const leafChildren = nonBoundaryNodes.filter((n) => childIdSet.has(n.id));

    // Child boundary nodes that are nested inside this boundary
    const nestedBoundaryChildren = Array.from(createdBoundaryNodesMap.values()).filter(
      (bn) => (bn.data as any)?.parentBoundaryId === boundary.id
    );

    if (leafChildren.length === 0 && nestedBoundaryChildren.length === 0) {
      continue;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of leafChildren) {
      const x = child.position.x;
      const y = child.position.y;
      const w = child.measured?.width ?? (child.width as number) ?? DEFAULT_NODE_WIDTH;
      const h = child.measured?.height ?? (child.height as number) ?? DEFAULT_NODE_HEIGHT;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    for (const childB of nestedBoundaryChildren) {
      const bx = childB.position.x;
      const by = childB.position.y;
      const bw = (childB.style?.width as number) || 0;
      const bh = (childB.style?.height as number) || 0;

      if (bx < minX) minX = bx;
      if (by < minY) minY = by;
      if (bx + bw > maxX) maxX = bx + bw;
      if (by + bh > maxY) maxY = by + bh;
    }

    const depth = getDepth(boundary);
    const isOuter = depth === 0 && maxDepth > 0;
    const paddingX = isOuter ? 45 : 35;
    const paddingBottom = isOuter ? 45 : 35;
    const paddingTop = isOuter ? 70 : 60;

    const x = minX - paddingX;
    const y = minY - paddingTop;
    const width = maxX - minX + paddingX * 2;
    const height = maxY - minY + paddingTop + paddingBottom;

    // Outer boundary has lower zIndex so it sits behind inner boundary
    const zIndex = -10 + depth;

    const node: Node = {
      id: `boundary-${boundary.id}`,
      type: 'c4Boundary',
      position: { x, y },
      style: {
        width,
        height,
        zIndex,
      },
      selectable: false,
      draggable: false,
      deletable: false,
      data: {
        ...boundary,
      },
    };

    createdBoundaryNodesMap.set(boundary.id, node);
  }

  // Return in order from outer to inner (depth 0 first) so React Flow's array order renders outer behind inner
  return [...boundaries]
    .sort((a, b) => getDepth(a) - getDepth(b))
    .map((b) => createdBoundaryNodesMap.get(b.id))
    .filter((n): n is Node => n !== undefined);
}

// Single-boundary convenience wrapper
export function computeBoundaryNode(
  nodes: Node[],
  boundary: BoundaryInfo | null | undefined
): Node | null {
  if (!boundary) return null;
  const list = computeBoundaryNodes(nodes, [boundary]);
  return list.length > 0 ? list[0] : null;
}
