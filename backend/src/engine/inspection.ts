/**
 * Architecture Inspection & Quality Engine (equivalent to structurizr-inspection).
 * Enforces architectural rules, completeness, and best practices on C4 models.
 */

import { Workspace } from './ast.js';

export interface InspectionFinding {
  ruleId: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  elementId?: string | null;
  elementType?: string | null;
  elementName?: string | null;
}

export function inspectWorkspace(ws: Workspace): InspectionFinding[] {
  const findings: InspectionFinding[] = [];

  // Build element lookup and ancestor map
  interface ElementMeta {
    id: string;
    name: string;
    type: string;
    ancestors: string[];
  }
  const elementMap = new Map<string, ElementMeta>();

  for (const p of ws.model.people) {
    elementMap.set(p.id, { id: p.id, name: p.name, type: 'Person', ancestors: [] });
  }

  for (const s of ws.model.softwareSystems) {
    elementMap.set(s.id, { id: s.id, name: s.name, type: 'SoftwareSystem', ancestors: [] });
    for (const c of s.containers) {
      elementMap.set(c.id, { id: c.id, name: c.name, type: 'Container', ancestors: [s.id] });
      for (const comp of c.components) {
        elementMap.set(comp.id, { id: comp.id, name: comp.name, type: 'Component', ancestors: [c.id, s.id] });
      }
    }
  }

  // Map relationships for orphan detection and compatibility checks
  const connectedElementIds = new Set<string>();
  const seenRels = new Map<string, string>(); // sourceId:destId:desc -> rel.id

  for (const rel of ws.model.relationships) {
    connectedElementIds.add(rel.sourceId);
    connectedElementIds.add(rel.destinationId);

    const srcMeta = elementMap.get(rel.sourceId);
    const destMeta = elementMap.get(rel.destinationId);
    const srcName = srcMeta ? srcMeta.name : rel.sourceId;
    const destName = destMeta ? destMeta.name : rel.destinationId;

    // Rule: Exact duplicate relationship
    const relKey = `${rel.sourceId}:::${rel.destinationId}:::${(rel.description || '').trim().toLowerCase()}`;
    if (seenRels.has(relKey)) {
      findings.push({
        ruleId: 'DUPLICATE_RELATIONSHIP',
        severity: 'WARNING',
        message: `Duplicate relationship between '${srcName}' and '${destName}'. Official Structurizr does not allow duplicate relationships.`,
        elementId: rel.id,
        elementType: 'Relationship'
      });
    } else {
      seenRels.set(relKey, rel.id);
    }

    // Rule: Structurizr Implied Relationship Conflict
    // If an explicit higher-level relationship exists between A and B, but lower-level child components/containers
    // also have relationships that imply A -> B, official Structurizr throws an error when '!impliedRelationships false' is not set.
    for (const otherRel of ws.model.relationships) {
      if (otherRel.id === rel.id) continue;
      const otherSrc = elementMap.get(otherRel.sourceId);
      const otherDest = elementMap.get(otherRel.destinationId);
      if (!otherSrc || !otherDest) continue;

      const srcIsHigher = otherSrc.ancestors.includes(rel.sourceId);
      const srcIsSame = otherRel.sourceId === rel.sourceId;
      const destIsHigher = otherDest.ancestors.includes(rel.destinationId);
      const destIsSame = otherRel.destinationId === rel.destinationId;

      // Both source and dest must match or be ancestors, with at least one being a strict ancestor
      if ((srcIsHigher || srcIsSame) && (destIsHigher || destIsSame) && (srcIsHigher || destIsHigher)) {
        findings.push({
          ruleId: 'STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT',
          severity: 'WARNING',
          message: `Relationship between '${srcName}' and '${destName}' conflicts with implied relationship from '${otherSrc.name}' -> '${otherDest.name}'. Official Structurizr treats this as a duplicate unless '!impliedRelationships false' is configured.`,
          elementId: rel.id,
          elementType: 'Relationship'
        });
        break;
      }
    }

    // Rule: Relationship missing description
    if (!rel.description || !rel.description.trim()) {
      findings.push({
        ruleId: 'RELATIONSHIP_MISSING_DESCRIPTION',
        severity: 'WARNING',
        message: `Relationship between '${srcName}' and '${destName}' is missing a description.`,
        elementId: rel.id,
        elementType: 'Relationship'
      });
    }
  }

  // Inspect People
  for (const p of ws.model.people) {
    if (!p.description || !p.description.trim()) {
      findings.push({
        ruleId: 'ELEMENT_MISSING_DESCRIPTION',
        severity: 'INFO',
        message: `Person '${p.name}' is missing a description.`,
        elementId: p.id,
        elementType: 'Person',
        elementName: p.name
      });
    }
    if (!connectedElementIds.has(p.id)) {
      findings.push({
        ruleId: 'ORPHAN_ELEMENT',
        severity: 'WARNING',
        message: `Person '${p.name}' is disconnected with no relationships.`,
        elementId: p.id,
        elementType: 'Person',
        elementName: p.name
      });
    }
  }

  // Inspect Software Systems
  for (const s of ws.model.softwareSystems) {
    if (!s.description || !s.description.trim()) {
      findings.push({
        ruleId: 'ELEMENT_MISSING_DESCRIPTION',
        severity: 'WARNING',
        message: `Software System '${s.name}' is missing a description.`,
        elementId: s.id,
        elementType: 'SoftwareSystem',
        elementName: s.name
      });
    }

    if (!connectedElementIds.has(s.id) && (!s.containers || s.containers.length === 0)) {
      findings.push({
        ruleId: 'ORPHAN_ELEMENT',
        severity: 'WARNING',
        message: `Software System '${s.name}' is disconnected with no relationships.`,
        elementId: s.id,
        elementType: 'SoftwareSystem',
        elementName: s.name
      });
    }

    // Inspect Containers
    for (const c of s.containers) {
      if (!c.description || !c.description.trim()) {
        findings.push({
          ruleId: 'ELEMENT_MISSING_DESCRIPTION',
          severity: 'INFO',
          message: `Container '${c.name}' in '${s.name}' is missing a description.`,
          elementId: c.id,
          elementType: 'Container',
          elementName: c.name
        });
      }

      if (!c.technology || !c.technology.trim()) {
        findings.push({
          ruleId: 'CONTAINER_MISSING_TECHNOLOGY',
          severity: 'WARNING',
          message: `Container '${c.name}' in '${s.name}' has no technology specified.`,
          elementId: c.id,
          elementType: 'Container',
          elementName: c.name
        });
      }

      // Inspect Components
      for (const comp of c.components) {
        if (!comp.description || !comp.description.trim()) {
          findings.push({
            ruleId: 'ELEMENT_MISSING_DESCRIPTION',
            severity: 'INFO',
            message: `Component '${comp.name}' in '${c.name}' is missing a description.`,
            elementId: comp.id,
            elementType: 'Component',
            elementName: comp.name
          });
        }
        if (!comp.technology || !comp.technology.trim()) {
          findings.push({
            ruleId: 'COMPONENT_MISSING_TECHNOLOGY',
            severity: 'WARNING',
            message: `Component '${comp.name}' has no technology specified.`,
            elementId: comp.id,
            elementType: 'Component',
            elementName: comp.name
          });
        }
      }
    }
  }

  // Inspect Views
  if (!ws.views || ws.views.length === 0) {
    findings.push({
      ruleId: 'WORKSPACE_NO_VIEWS',
      severity: 'WARNING',
      message: 'The workspace defines no views (diagrams will not render without at least one view defined).',
      elementId: null,
      elementType: 'Workspace'
    });
  }

  return findings;
}
