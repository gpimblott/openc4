/**
 * DSL Modifier:
 * Safely removes elements and relationships from Structurizr DSL code
 * with full cascade handling (nested children, connected relationships, dependent views).
 */

import { parseDsl } from './parser.js';
import { Workspace, Relationship } from './ast.js';

export interface DeleteOptions {
  nodeIds?: string[]; // Element IDs to delete (e.g. "1", "2", or identifier strings)
  edgeIds?: string[]; // Relationship IDs to delete (e.g. "1", "e-1")
}

export interface DeleteResult {
  dsl: string;
  deletedNodeIds: string[];
  deletedEdgeIds: string[];
}

export interface ElementIndex {
  elementMap: Map<string, any>;
  idToIdent: Map<string, string>;
  identToId: Map<string, string>;
}

export function buildElementIndex(ws: Workspace): ElementIndex {
  const elementMap = new Map<string, any>();
  const idToIdent = new Map<string, string>();
  const identToId = new Map<string, string>();

  function registerElem(e: any, parentId: string | null = null) {
    elementMap.set(e.id, { ...e, parentId });
    if (e.identifier) {
      idToIdent.set(e.id, e.identifier);
      identToId.set(e.identifier, e.id);
    }
    if (e.name) {
      identToId.set(e.name, e.id);
    }
  }

  for (const p of ws.model.people) {
    registerElem(p);
  }

  for (const s of ws.model.softwareSystems) {
    registerElem(s);
    for (const c of s.containers) {
      registerElem(c, s.id);
      if (s.identifier && c.identifier) {
        const qualified = c.identifier.startsWith(`${s.identifier}.`) ? c.identifier : `${s.identifier}.${c.identifier}`;
        identToId.set(qualified, c.id);
      }
      for (const comp of c.components) {
        registerElem(comp, c.id);
        if (c.identifier && comp.identifier) {
          const qualified = comp.identifier.startsWith(`${c.identifier}.`) ? comp.identifier : `${c.identifier}.${comp.identifier}`;
          identToId.set(qualified, comp.id);
        }
        if (s.identifier && c.identifier && comp.identifier) {
          const cShort = c.identifier.replace(`${s.identifier}.`, '');
          identToId.set(`${s.identifier}.${cShort}.${comp.identifier}`, comp.id);
        }
      }
    }
  }

  for (const d of ws.model.deploymentNodes) {
    registerElem(d);
  }

  return { elementMap, idToIdent, identToId };
}

export function resolveElementIdent(idOrIdent: string, index: ElementIndex): { element: any; identifier: string } | null {
  const raw = String(idOrIdent || '').trim();
  if (!raw) return null;
  let elem = index.elementMap.get(raw);
  if (!elem && index.identToId.has(raw)) {
    elem = index.elementMap.get(index.identToId.get(raw)!);
  }
  if (!elem) {
    for (const item of index.elementMap.values()) {
      if (item.id === raw || item.identifier === raw || item.name === raw) {
        elem = item;
        break;
      }
    }
  }
  if (!elem) return null;
  const ident = index.idToIdent.get(elem.id) || elem.identifier || elem.id;
  return { element: elem, identifier: ident };
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
  const { elementMap, idToIdent, identToId } = buildElementIndex(ws);

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
  for (const [qid, mappedId] of identToId.entries()) {
    if (allDeletedNodeIds.has(mappedId)) {
      deletedIdents.add(qid);
    }
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

export interface AddRelationshipOptions {
  sourceId: string;
  targetId: string;
  description?: string;
  technology?: string;
  archetype?: string;
}

export interface AddRelationshipResult {
  dsl: string;
  relationship: Relationship;
}

export function addRelationshipToDsl(dslCode: string, options: AddRelationshipOptions): AddRelationshipResult {
  const ws = parseDsl(dslCode);
  const index = buildElementIndex(ws);

  const sourceResolved = resolveElementIdent(options.sourceId, index);
  const targetResolved = resolveElementIdent(options.targetId, index);

  if (!sourceResolved) {
    throw new Error(`Source element "${options.sourceId}" not found in model`);
  }
  if (!targetResolved) {
    throw new Error(`Target element "${options.targetId}" not found in model`);
  }

  const sourceIdent = sourceResolved.identifier;
  const targetIdent = targetResolved.identifier;
  const desc = (options.description || '').trim();
  const tech = (options.technology || '').trim();
  const arrow = options.archetype ? `--${options.archetype}->` : '->';

  let relLine = `${sourceIdent} ${arrow} ${targetIdent}`;
  if (desc && tech) {
    relLine += ` "${desc}" "${tech}"`;
  } else if (desc) {
    relLine += ` "${desc}"`;
  } else if (tech) {
    relLine += ` "" "${tech}"`;
  }

  const lines = dslCode.split('\n');

  // Find insertion point
  // 1. If existing relationships with lineRange exist, insert right after the last one
  const relsWithRange = ws.model.relationships.filter((r) => r.lineRange);
  let insertLineIdx = -1;
  let indent = '        ';

  if (relsWithRange.length > 0) {
    const lastRel = relsWithRange[relsWithRange.length - 1];
    insertLineIdx = lastRel.lineRange!.endLine; // insert after last relationship line
    const prevLine = lines[lastRel.lineRange!.startLine - 1];
    const match = prevLine?.match(/^(\s*)/);
    if (match) indent = match[1];
  } else if (ws.model.lineRange?.endLine) {
    // Insert before closing brace of model
    insertLineIdx = ws.model.lineRange.endLine - 1;
    const prevLine = lines[insertLineIdx - 1];
    const match = prevLine?.match(/^(\s*)/);
    if (match && match[1].length > 0) {
      indent = match[1];
    } else {
      indent = '        ';
    }
  } else {
    // Fallback: search for closing brace of model block
    let modelStart = -1;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (modelStart === -1 && /\bmodel\s*\{/.test(line)) {
        modelStart = i;
        braceDepth = 1;
        continue;
      }
      if (modelStart !== -1) {
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              insertLineIdx = i;
              const prev = lines[i - 1];
              const match = prev?.match(/^(\s*)/);
              if (match) indent = match[1];
              break;
            }
          }
        }
        if (insertLineIdx !== -1) break;
      }
    }
  }

  if (insertLineIdx === -1) {
    throw new Error('Could not find model block in DSL to insert relationship');
  }

  lines.splice(insertLineIdx, 0, `${indent}${relLine}`);
  const updatedDsl = lines.join('\n');

  // Verify and parse
  const newWs = parseDsl(updatedDsl);
  const createdRel = newWs.model.relationships.find(
    (r) =>
      (r.sourceId === sourceResolved.element.id || r.sourceIdentifier === sourceIdent) &&
      (r.destinationId === targetResolved.element.id || r.destinationIdentifier === targetIdent) &&
      r.description === desc
  ) || newWs.model.relationships[newWs.model.relationships.length - 1];

  return {
    dsl: updatedDsl,
    relationship: createdRel
  };
}

export interface UpdateRelationshipOptions {
  edgeId: string;
  sourceId?: string;
  targetId?: string;
  description?: string;
  technology?: string;
  archetype?: string;
}

export interface UpdateRelationshipResult {
  dsl: string;
  relationship: Relationship;
}

export function updateRelationshipInDsl(dslCode: string, options: UpdateRelationshipOptions): UpdateRelationshipResult {
  const rawId = String(options.edgeId).replace(/^(edge_|e-)/, '').trim();
  const ws = parseDsl(dslCode);
  const index = buildElementIndex(ws);

  // Find relationship by id or matching edge string
  let targetRel = ws.model.relationships.find((r) => String(r.id) === rawId);
  if (!targetRel) {
    const depMatch = rawId.match(/^dep_(\d+)_/);
    if (depMatch) {
      targetRel = ws.model.relationships.find((r) => String(r.id) === depMatch[1]);
    }
  }
  if (!targetRel && options.sourceId && options.targetId) {
    const sElem = resolveElementIdent(options.sourceId, index);
    const dElem = resolveElementIdent(options.targetId, index);
    if (sElem && dElem) {
      targetRel = ws.model.relationships.find(
        (r) =>
          (r.sourceId === sElem.element.id || r.sourceIdentifier === sElem.identifier) &&
          (r.destinationId === dElem.element.id || r.destinationIdentifier === dElem.identifier)
      );
    }
  }

  if (!targetRel) {
    throw new Error(`Relationship "${options.edgeId}" not found in DSL`);
  }

  if (!targetRel.lineRange) {
    throw new Error(`Cannot update relationship "${options.edgeId}": line range not tracked`);
  }

  // Resolve source identifier
  let sourceIdent = targetRel.sourceIdentifier || targetRel.sourceId;
  let sElemId = targetRel.sourceId;
  if (options.sourceId) {
    const sRes = resolveElementIdent(options.sourceId, index);
    if (sRes) {
      sourceIdent = sRes.identifier;
      sElemId = sRes.element.id;
    }
  }

  // Resolve target identifier
  let targetIdent = targetRel.destinationIdentifier || targetRel.destinationId;
  let dElemId = targetRel.destinationId;
  if (options.targetId) {
    const dRes = resolveElementIdent(options.targetId, index);
    if (dRes) {
      targetIdent = dRes.identifier;
      dElemId = dRes.element.id;
    }
  }

  const desc = options.description !== undefined ? options.description.trim() : targetRel.description;
  const tech = options.technology !== undefined ? options.technology.trim() : targetRel.technology;

  const lines = dslCode.split('\n');
  const startIdx = Math.max(0, targetRel.lineRange.startLine - 1);
  const deleteCount = Math.max(1, targetRel.lineRange.endLine - targetRel.lineRange.startLine + 1);
  const origLine = lines[startIdx] || '';
  const indentMatch = origLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '        ';

  // Determine arrow: check options.archetype or preserve existing
  let arrow = '->';
  if (options.archetype !== undefined) {
    arrow = options.archetype ? `--${options.archetype}->` : '->';
  } else if (targetRel.archetype) {
    arrow = `--${targetRel.archetype}->`;
  } else {
    const archMatch = origLine.match(/--([a-zA-Z0-9_\-]+)->/);
    if (archMatch) {
      arrow = `--${archMatch[1]}->`;
    }
  }

  let newRelLine = `${indent}${sourceIdent} ${arrow} ${targetIdent}`;
  if (desc && tech) {
    newRelLine += ` "${desc}" "${tech}"`;
  } else if (desc) {
    newRelLine += ` "${desc}"`;
  } else if (tech) {
    newRelLine += ` "" "${tech}"`;
  }

  // Preserve properties block if original had properties
  if (targetRel.properties && Object.keys(targetRel.properties).length > 0) {
    newRelLine += ' {\n';
    newRelLine += `${indent}    properties {\n`;
    for (const [k, v] of Object.entries(targetRel.properties)) {
      newRelLine += `${indent}        "${k}" "${v}"\n`;
    }
    newRelLine += `${indent}    }\n`;
    newRelLine += `${indent}}`;
  }

  lines.splice(startIdx, deleteCount, newRelLine);
  const updatedDsl = lines.join('\n');

  // Verify and parse
  const newWs = parseDsl(updatedDsl);
  const updatedRel = newWs.model.relationships.find(
    (r) =>
      (r.sourceId === sElemId || r.sourceIdentifier === sourceIdent) &&
      (r.destinationId === dElemId || r.destinationIdentifier === targetIdent) &&
      r.description === desc
  ) || newWs.model.relationships.find((r) => String(r.id) === String(targetRel?.id)) || targetRel;

  return {
    dsl: updatedDsl,
    relationship: updatedRel
  };
}

export function sanitizeIdentifier(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_\s]/g, '').trim();
  if (!cleaned) return 'element';
  const parts = cleaned.split(/\s+/);
  let ident = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.length > 0) {
      ident += p.charAt(0).toUpperCase() + p.slice(1);
    }
  }
  if (/^[0-9]/.test(ident)) {
    ident = 'el_' + ident;
  }
  return ident;
}

export interface AddElementOptions {
  type: 'person' | 'softwareSystem' | 'container' | 'component' | 'deploymentNode' | 'infrastructureNode';
  name: string;
  identifier?: string;
  description?: string;
  technology?: string;
  tags?: string | string[];
  parentId?: string; // software system id/ident for container; container id/ident for component
  location?: string; // 'Internal' | 'External'
}

export interface AddElementResult {
  dsl: string;
  element: any;
  identifier: string;
}

export function addElementToDsl(dslCode: string, options: AddElementOptions): AddElementResult {
  const ws = parseDsl(dslCode);
  const index = buildElementIndex(ws);

  const name = (options.name || '').trim();
  if (!name) {
    throw new Error('Element name is required');
  }

  let ident = (options.identifier || '').trim();
  if (!ident) {
    ident = sanitizeIdentifier(name);
  }

  // Ensure unique identifier
  let finalIdent = ident;
  let counter = 1;
  while (index.identToId.has(finalIdent)) {
    finalIdent = `${ident}_${counter++}`;
  }
  ident = finalIdent;

  const desc = (options.description || '').trim();
  const tech = (options.technology || '').trim();
  const rawTags = Array.isArray(options.tags) ? options.tags.join(', ') : (options.tags || '').trim();

  const lines = dslCode.split('\n');

  if (options.type === 'person' || options.type === 'softwareSystem') {
    // Construct element definition
    let elemLine = `${ident} = ${options.type} "${name}"`;
    if (desc || tech || rawTags) {
      elemLine += ` "${desc}"`;
      if (rawTags) {
        elemLine += ` "${rawTags}"`;
      }
    }

    // Determine insertion line in model block
    let insertLineIdx = -1;
    let indentStr = '        ';

    // Check if there are existing relationships; if so, insert before first relationship
    const relsWithRange = ws.model.relationships.filter((r) => r.lineRange);
    if (relsWithRange.length > 0) {
      const firstRel = relsWithRange[0];
      insertLineIdx = firstRel.lineRange!.startLine - 1;
      const prevLine = lines[insertLineIdx];
      const match = prevLine?.match(/^(\s*)/);
      if (match && match[1].length > 0) indentStr = match[1];
    } else if (ws.model.lineRange?.endLine) {
      insertLineIdx = ws.model.lineRange.endLine - 1;
      const prevLine = lines[insertLineIdx - 1];
      const match = prevLine?.match(/^(\s*)/);
      if (match && match[1].length > 0) indentStr = match[1];
    } else {
      // Fallback: search for model block closing brace
      for (let i = 0; i < lines.length; i++) {
        if (/\bmodel\s*\{/.test(lines[i])) {
          insertLineIdx = i + 1;
          indentStr = '        ';
          break;
        }
      }
    }

    if (insertLineIdx === -1) {
      throw new Error('Could not find model block in DSL');
    }

    lines.splice(insertLineIdx, 0, `${indentStr}${elemLine}`);
  } else if (options.type === 'container') {
    if (!options.parentId) {
      throw new Error('Parent Software System is required when adding a Container');
    }
    const parentResolved = resolveElementIdent(options.parentId, index);
    if (!parentResolved) {
      throw new Error(`Parent Software System "${options.parentId}" not found in model`);
    }

    const parent = parentResolved.element;
    if (!parent.lineRange) {
      throw new Error(`Cannot locate line range for software system "${options.parentId}"`);
    }

    let elemLine = `${ident} = container "${name}"`;
    if (desc || tech || rawTags) {
      elemLine += ` "${desc}"`;
      if (tech || rawTags) {
        elemLine += ` "${tech}"`;
        if (rawTags) {
          elemLine += ` "${rawTags}"`;
        }
      }
    }

    const startLine = parent.lineRange.startLine;
    const endLine = parent.lineRange.endLine;

    if (startLine === endLine) {
      // Single line declaration, expand to block
      const origLine = lines[startLine - 1];
      const indentMatch = origLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '        ';
      const childIndent = `${baseIndent}    `;

      lines[startLine - 1] = `${origLine} {`;
      lines.splice(startLine, 0, `${childIndent}${elemLine}`, `${baseIndent}}`);
    } else {
      // Multi-line block, insert before endLine
      const closingLine = lines[endLine - 1];
      const indentMatch = closingLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '        ';
      const childIndent = `${baseIndent}    `;

      lines.splice(endLine - 1, 0, `${childIndent}${elemLine}`);
    }
  } else if (options.type === 'component') {
    if (!options.parentId) {
      throw new Error('Parent Container is required when adding a Component');
    }
    const parentResolved = resolveElementIdent(options.parentId, index);
    if (!parentResolved) {
      throw new Error(`Parent Container "${options.parentId}" not found in model`);
    }

    const parent = parentResolved.element;
    if (!parent.lineRange) {
      throw new Error(`Cannot locate line range for container "${options.parentId}"`);
    }

    let elemLine = `${ident} = component "${name}"`;
    if (desc || tech || rawTags) {
      elemLine += ` "${desc}"`;
      if (tech || rawTags) {
        elemLine += ` "${tech}"`;
        if (rawTags) {
          elemLine += ` "${rawTags}"`;
        }
      }
    }

    const startLine = parent.lineRange.startLine;
    const endLine = parent.lineRange.endLine;

    if (startLine === endLine) {
      const origLine = lines[startLine - 1];
      const indentMatch = origLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '            ';
      const childIndent = `${baseIndent}    `;

      lines[startLine - 1] = `${origLine} {`;
      lines.splice(startLine, 0, `${childIndent}${elemLine}`, `${baseIndent}}`);
    } else {
      const closingLine = lines[endLine - 1];
      const indentMatch = closingLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '            ';
      const childIndent = `${baseIndent}    `;

      lines.splice(endLine - 1, 0, `${childIndent}${elemLine}`);
    }
  } else if (options.type === 'deploymentNode' || options.type === 'infrastructureNode') {
    let elemLine = `${ident} = ${options.type} "${name}"`;
    if (desc || tech || rawTags) {
      elemLine += ` "${desc}"`;
      if (tech || rawTags) {
        elemLine += ` "${tech}"`;
        if (rawTags) {
          elemLine += ` "${rawTags}"`;
        }
      }
    }

    let insertLineIdx = ws.model.lineRange?.endLine ? ws.model.lineRange.endLine - 1 : lines.length - 1;
    lines.splice(insertLineIdx, 0, `        ${elemLine}`);
  }

  const updatedDsl = lines.join('\n');
  const newWs = parseDsl(updatedDsl);
  const newIndex = buildElementIndex(newWs);
  const resolvedCreated = resolveElementIdent(ident, newIndex);

  return {
    dsl: updatedDsl,
    element: resolvedCreated?.element || { id: ident, identifier: ident, name },
    identifier: ident
  };
}

export interface AddViewOptions {
  viewType: 'systemLandscape' | 'systemContext' | 'container' | 'component' | 'deployment' | 'dynamic';
  targetId?: string; // software system id/ident or container id/ident
  key: string;
  title?: string;
  description?: string;
  autoLayout?: 'lr' | 'tb' | 'bt' | 'rl' | 'none';
}

export interface AddViewResult {
  dsl: string;
  viewKey: string;
}

export function addViewToDsl(dslCode: string, options: AddViewOptions): AddViewResult {
  const ws = parseDsl(dslCode);
  const index = buildElementIndex(ws);

  let key = (options.key || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (!key) {
    key = `View_${Date.now()}`;
  }

  // Check if view key already exists
  if (ws.views.some((v) => v.key === key)) {
    key = `${key}_${Date.now()}`;
  }

  const desc = (options.description || '').trim();
  const autoLayout = options.autoLayout || 'lr';

  let targetIdent = '';
  if (options.targetId) {
    const resolved = resolveElementIdent(options.targetId, index);
    targetIdent = resolved ? resolved.identifier : options.targetId;
  }

  let viewBlock = '';
  const alStmt = autoLayout !== 'none' ? `\n            autoLayout ${autoLayout}` : '';

  if (options.viewType === 'systemLandscape') {
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        systemLandscape "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  } else if (options.viewType === 'systemContext') {
    if (!targetIdent) {
      throw new Error('Target Software System is required for System Context view');
    }
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        systemContext ${targetIdent} "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  } else if (options.viewType === 'container') {
    if (!targetIdent) {
      throw new Error('Target Software System is required for Container view');
    }
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        container ${targetIdent} "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  } else if (options.viewType === 'component') {
    if (!targetIdent) {
      throw new Error('Target Container is required for Component view');
    }
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        component ${targetIdent} "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  } else if (options.viewType === 'deployment') {
    const target = targetIdent || '*';
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        deployment ${target} "Live" "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  } else {
    const targetArg = targetIdent ? ` ${targetIdent}` : '';
    const descArg = desc ? ` "${desc}"` : '';
    viewBlock = `        ${options.viewType}${targetArg} "${key}"${descArg} {\n            include *${alStmt}\n        }`;
  }

  const lines = dslCode.split('\n');

  // Find views block
  let viewsStart = -1;
  let viewsEnd = -1;
  let stylesStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/\bviews\s*\{/.test(lines[i])) {
      viewsStart = i;
      break;
    }
  }

  if (viewsStart !== -1) {
    let braceCount = 0;
    for (let i = viewsStart; i < lines.length; i++) {
      if (stylesStart === -1 && /\bstyles\s*\{/.test(lines[i])) {
        stylesStart = i;
      }
      for (const ch of lines[i]) {
        if (ch === '{') braceCount++;
        else if (ch === '}') {
          braceCount--;
          if (braceCount === 0) {
            viewsEnd = i;
            break;
          }
        }
      }
      if (viewsEnd !== -1) break;
    }
  }

  if (viewsStart !== -1 && viewsEnd !== -1) {
    // Insert before styles block if styles exists, or before closing brace of views
    const insertIdx = stylesStart !== -1 ? stylesStart : viewsEnd;
    lines.splice(insertIdx, 0, `${viewBlock}\n`);
  } else {
    // No views block, create views block before last closing brace of workspace
    let wsEnd = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('}')) {
        wsEnd = i;
        break;
      }
    }
    const newViewsBlock = `    views {\n${viewBlock}\n    }\n`;
    lines.splice(wsEnd, 0, newViewsBlock);
  }

  const updatedDsl = lines.join('\n');
  parseDsl(updatedDsl); // Validate syntax

  return {
    dsl: updatedDsl,
    viewKey: key
  };
}

export interface IncludeElementOptions {
  viewKey: string;
  elementIdentifier: string;
}

export interface IncludeElementResult {
  dsl: string;
}

export function includeElementInView(dslCode: string, options: IncludeElementOptions): IncludeElementResult {
  const ws = parseDsl(dslCode);
  const targetView = ws.views.find((v) => v.key === options.viewKey);
  if (!targetView) {
    throw new Error(`View "${options.viewKey}" not found in DSL`);
  }

  const ident = options.elementIdentifier.trim();
  if (!ident) {
    throw new Error('Element identifier is required');
  }

  const lines = dslCode.split('\n');

  if (targetView.lineRange) {
    const startIdx = targetView.lineRange.startLine - 1;
    const endIdx = targetView.lineRange.endLine - 1;

    // Check if view has an exclude statement for this identifier, remove it if so
    let removedExclude = false;
    for (let i = startIdx; i <= endIdx; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === `exclude ${ident}` || trimmed === `exclude "${ident}"`) {
        lines.splice(i, 1);
        removedExclude = true;
        break;
      }
    }

    if (!removedExclude) {
      // Check if already explicitly included
      let alreadyIncluded = false;
      for (let i = startIdx; i <= endIdx; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === `include ${ident}` || trimmed === `include "${ident}"`) {
          alreadyIncluded = true;
          break;
        }
      }

      if (!alreadyIncluded) {
        // Insert "include <ident>" before closing brace of view
        const closingLine = lines[endIdx];
        const match = closingLine.match(/^(\s*)/);
        const baseIndent = match ? match[1] : '        ';
        const childIndent = `${baseIndent}    `;

        lines.splice(endIdx, 0, `${childIndent}include ${ident}`);
      }
    }
  } else {
    // If no line range, find view block by regex
    let inView = false;
    let braceCount = 0;
    let insertIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!inView && (lines[i].includes(`"${options.viewKey}"`) || lines[i].includes(` ${options.viewKey} `))) {
        inView = true;
      }
      if (inView) {
        for (const ch of lines[i]) {
          if (ch === '{') braceCount++;
          else if (ch === '}') {
            braceCount--;
            if (braceCount === 0) {
              insertIdx = i;
              break;
            }
          }
        }
        if (insertIdx !== -1) break;
      }
    }

    if (insertIdx !== -1) {
      lines.splice(insertIdx, 0, `            include ${ident}`);
    }
  }

  const updatedDsl = lines.join('\n');
  parseDsl(updatedDsl); // Validate syntax

  return { dsl: updatedDsl };
}

