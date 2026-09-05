/**
 * DSL Modifier:
 * Safely removes elements and relationships from Structurizr DSL code
 * with full cascade handling (nested children, connected relationships, dependent views).
 */

import { parseDsl } from './parser.js';
import { Workspace } from './ast.js';

export interface DeleteOptions {
  nodeIds?: string[]; // Element IDs to delete (e.g. "1", "2", or identifier strings)
  edgeIds?: string[]; // Relationship IDs to delete (e.g. "1", "e-1")
}

export interface DeleteResult {
  dsl: string;
  deletedNodeIds: string[];
  deletedEdgeIds: string[];
}

export function deleteFromDsl(dslCode: string, options: DeleteOptions): DeleteResult {
  const nodeIdsToDelete = new Set<string>((options.nodeIds || []).map((id) => String(id).trim()));
  const edgeIdsToDelete = new Set<string>(
    (options.edgeIds || []).map((id) => String(id).replace(/^e-/, '').trim())
  );

  if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
    return { dsl: dslCode, deletedNodeIds: [], deletedEdgeIds: [] };
  }

  // Parse current DSL to extract AST with line ranges
  const ws = parseDsl(dslCode);

  // Map elements and identifiers
  const elementMap = new Map<string, any>();
  const idToIdent = new Map<string, string>();
  const identToId = new Map<string, string>();

  // Helper to register an element
  function registerElem(e: any, parentId: string | null = null) {
    elementMap.set(e.id, { ...e, parentId });
    idToIdent.set(e.id, e.identifier);
    identToId.set(e.identifier, e.id);
    identToId.set(e.name, e.id);
  }

  for (const p of ws.model.people) {
    registerElem(p);
  }

  for (const s of ws.model.softwareSystems) {
    registerElem(s);
    for (const c of s.containers) {
      registerElem(c, s.id);
      for (const comp of c.components) {
        registerElem(comp, c.id);
      }
    }
  }

  for (const d of ws.model.deploymentNodes) {
    registerElem(d);
  }

  // Resolve requested nodeIds: they might be IDs or identifiers
  const resolvedTargetNodeIds = new Set<string>();
  for (const rawId of nodeIdsToDelete) {
    if (elementMap.has(rawId)) {
      resolvedTargetNodeIds.add(rawId);
    } else if (identToId.has(rawId)) {
      resolvedTargetNodeIds.add(identToId.get(rawId)!);
    }
  }

  // Cascade: find all descendant elements
  const allDeletedNodeIds = new Set<string>(resolvedTargetNodeIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [eid, elem] of elementMap.entries()) {
      if (!allDeletedNodeIds.has(eid) && elem.parentId && allDeletedNodeIds.has(elem.parentId)) {
        allDeletedNodeIds.add(eid);
        grew = true;
      }
    }
  }

  // Set of deleted identifiers for finding references
  const deletedIdents = new Set<string>();
  for (const nid of allDeletedNodeIds) {
    const ident = idToIdent.get(nid);
    if (ident) deletedIdents.add(ident);
    const elem = elementMap.get(nid);
    if (elem?.name) deletedIdents.add(elem.name);
  }

  // Find relationships to delete:
  // 1. Explicitly requested in edgeIdsToDelete
  // 2. Any relationship where source or destination is in allDeletedNodeIds
  const allDeletedRelIds = new Set<string>();
  for (const rel of ws.model.relationships) {
    const relIdStr = String(rel.id);
    const isTargetRel = edgeIdsToDelete.has(relIdStr);
    const sourceIsDeleted = allDeletedNodeIds.has(rel.sourceId) || deletedIdents.has(rel.sourceIdentifier || '');
    const destIsDeleted = allDeletedNodeIds.has(rel.destinationId) || deletedIdents.has(rel.destinationIdentifier || '');

    if (isTargetRel || sourceIsDeleted || destIsDeleted) {
      allDeletedRelIds.add(relIdStr);
    }
  }

  // Collect line intervals [startLine, endLine] (1-indexed)
  interface LineInterval {
    startLine: number;
    endLine: number;
  }
  const intervals: LineInterval[] = [];

  // 1. Line ranges of deleted elements
  for (const nid of allDeletedNodeIds) {
    const elem = elementMap.get(nid);
    if (elem?.lineRange) {
      intervals.push({
        startLine: elem.lineRange.startLine,
        endLine: elem.lineRange.endLine
      });
    }
  }

  // 2. Line ranges of deleted relationships
  for (const rel of ws.model.relationships) {
    if (allDeletedRelIds.has(String(rel.id)) && rel.lineRange) {
      intervals.push({
        startLine: rel.lineRange.startLine,
        endLine: rel.lineRange.endLine
      });
    }
  }

  // 3. Line ranges of views scoped to deleted elements
  for (const v of ws.views) {
    const swDeleted = v.softwareSystemId && (allDeletedNodeIds.has(v.softwareSystemId) || deletedIdents.has(v.softwareSystemId));
    const contDeleted = v.containerId && (allDeletedNodeIds.has(v.containerId) || deletedIdents.has(v.containerId));

    if ((swDeleted || contDeleted) && v.lineRange) {
      intervals.push({
        startLine: v.lineRange.startLine,
        endLine: v.lineRange.endLine
      });
    }
  }

  // Merge overlapping or adjacent intervals
  intervals.sort((a, b) => a.startLine - b.startLine);
  const mergedIntervals: LineInterval[] = [];
  for (const iv of intervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push({ ...iv });
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (iv.startLine <= last.endLine + 1) {
        last.endLine = Math.max(last.endLine, iv.endLine);
      } else {
        mergedIntervals.push({ ...iv });
      }
    }
  }

  // Delete lines from bottom to top so line indices remain consistent
  const lines = dslCode.split('\n');

  // Process intervals in descending order
  for (let i = mergedIntervals.length - 1; i >= 0; i--) {
    const { startLine, endLine } = mergedIntervals[i];
    const startIndex = Math.max(0, startLine - 1);
    const deleteCount = Math.max(0, endLine - startLine + 1);
    lines.splice(startIndex, deleteCount);
  }

  // Clean up any remaining lines that explicitly include/exclude deleted identifiers in other views
  let cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('include ') || trimmed.startsWith('exclude ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2 && deletedIdents.has(parts[1])) {
        return false;
      }
    }
    return true;
  });

  // Collapse 3+ consecutive empty lines down to 2
  let updatedDsl = cleanedLines.join('\n');
  updatedDsl = updatedDsl.replace(/\n{3,}/g, '\n\n');

  // Verify that the modified DSL is valid
  try {
    parseDsl(updatedDsl);
  } catch (err: any) {
    console.error('Modified DSL validation failed:', err.message);
    throw new Error(`DSL update resulted in syntax error: ${err.message}`);
  }

  return {
    dsl: updatedDsl,
    deletedNodeIds: Array.from(allDeletedNodeIds),
    deletedEdgeIds: Array.from(allDeletedRelIds)
  };
}
