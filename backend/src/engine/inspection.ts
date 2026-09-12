/**
 * Architecture Inspection & Quality Engine (equivalent to structurizr-inspection).
 * Enforces architectural rules, completeness, and best practices on C4 models.
 */

import { Workspace, DeploymentNode } from './ast.js';

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
  const identifierMap = new Map<string, ElementMeta>();

  // Helper to register an element in both ID and Identifier maps
  const registerElement = (id: string, identifier: string | undefined, name: string, type: string, ancestors: string[] = []) => {
    const meta: ElementMeta = { id, name, type, ancestors };
    elementMap.set(id, meta);
    if (identifier) {
      identifierMap.set(identifier, meta);
    }
    return meta;
  };

  for (const p of ws.model.people) {
    registerElement(p.id, p.identifier, p.name, 'Person', []);
  }

  for (const s of ws.model.softwareSystems) {
    registerElement(s.id, s.identifier, s.name, 'SoftwareSystem', []);
    for (const c of s.containers) {
      const cMeta = registerElement(c.id, c.identifier, c.name, 'Container', [s.id]);
      if (s.identifier && c.identifier) {
        identifierMap.set(`${s.identifier}.${c.identifier}`, cMeta);
      }
      for (const comp of c.components) {
        const compMeta = registerElement(comp.id, comp.identifier, comp.name, 'Component', [c.id, s.id]);
        if (c.identifier && comp.identifier) {
          identifierMap.set(`${c.identifier}.${comp.identifier}`, compMeta);
        }
        if (s.identifier && c.identifier && comp.identifier) {
          identifierMap.set(`${s.identifier}.${c.identifier}.${comp.identifier}`, compMeta);
        }
      }
    }
  }

  const registerDeploymentNode = (node: DeploymentNode, ancestors: string[] = []) => {
    registerElement(node.id, node.identifier, node.name, 'DeploymentNode', ancestors);
    const childAncestors = [...ancestors, node.id];
    if (node.typedContainerInstances) {
      for (const ci of node.typedContainerInstances) {
        registerElement(ci.id, ci.identifier, ci.name, 'ContainerInstance', childAncestors);
      }
    }
    if (node.typedSoftwareSystemInstances) {
      for (const si of node.typedSoftwareSystemInstances) {
        registerElement(si.id, si.identifier, si.name, 'SoftwareSystemInstance', childAncestors);
      }
    }
    if (node.infrastructureNodes) {
      for (const inf of node.infrastructureNodes) {
        registerElement(inf.id, inf.identifier, inf.name, 'InfrastructureNode', childAncestors);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        registerDeploymentNode(child, childAncestors);
      }
    }
  };

  if (ws.model.deploymentNodes) {
    for (const d of ws.model.deploymentNodes) {
      registerDeploymentNode(d);
    }
  }

  // Rule: Duplicate Element Identifiers in Model
  const seenTopLevelIdentifiers = new Map<string, { id: string; name: string; type: string }>();
  const checkTopLevel = (elem: { id: string; identifier?: string; name: string }, type: string) => {
    if (!elem.identifier) return;
    const existing = seenTopLevelIdentifiers.get(elem.identifier);
    if (existing) {
      findings.push({
        ruleId: 'DUPLICATE_IDENTIFIER',
        severity: 'ERROR',
        message: `Duplicate element identifier '${elem.identifier}' used for both ${existing.type} '${existing.name}' and ${type} '${elem.name}'. Element identifiers must be unique.`,
        elementId: elem.id,
        elementType: type,
        elementName: elem.name
      });
    } else {
      seenTopLevelIdentifiers.set(elem.identifier, { id: elem.id, name: elem.name, type });
    }
  };

  for (const p of ws.model.people) {
    checkTopLevel(p, 'Person');
  }

  for (const s of ws.model.softwareSystems) {
    checkTopLevel(s, 'SoftwareSystem');

    const seenContainerIdents = new Map<string, { id: string; name: string }>();
    for (const c of s.containers) {
      if (c.identifier) {
        const existing = seenContainerIdents.get(c.identifier);
        if (existing) {
          findings.push({
            ruleId: 'DUPLICATE_IDENTIFIER',
            severity: 'ERROR',
            message: `Duplicate container identifier '${c.identifier}' in software system '${s.name}' (used by '${existing.name}' and '${c.name}'). Container identifiers must be unique.`,
            elementId: c.id,
            elementType: 'Container',
            elementName: c.name
          });
        } else {
          seenContainerIdents.set(c.identifier, { id: c.id, name: c.name });
        }
      }

      const seenCompIdents = new Map<string, { id: string; name: string }>();
      for (const comp of c.components) {
        if (comp.identifier) {
          const existing = seenCompIdents.get(comp.identifier);
          if (existing) {
            findings.push({
              ruleId: 'DUPLICATE_IDENTIFIER',
              severity: 'ERROR',
              message: `Duplicate component identifier '${comp.identifier}' in container '${c.name}' (used by '${existing.name}' and '${comp.name}'). Component identifiers must be unique.`,
              elementId: comp.id,
              elementType: 'Component',
              elementName: comp.name
            });
          } else {
            seenCompIdents.set(comp.identifier, { id: comp.id, name: comp.name });
          }
        }
      }
    }
  }

  if (ws.model.deploymentNodes) {
    for (const d of ws.model.deploymentNodes) {
      checkTopLevel(d, 'DeploymentNode');
    }
  }

  // Map relationships for orphan detection, compatibility, and unknown elements
  const connectedElementIds = new Set<string>();
  const seenRels = new Map<string, string>(); // sourceId:destId:desc -> rel.id

  for (const rel of ws.model.relationships) {
    const srcMeta =
      elementMap.get(rel.sourceId) ||
      (rel.sourceIdentifier ? identifierMap.get(rel.sourceIdentifier) : undefined) ||
      identifierMap.get(rel.sourceId);
    const destMeta =
      elementMap.get(rel.destinationId) ||
      (rel.destinationIdentifier ? identifierMap.get(rel.destinationIdentifier) : undefined) ||
      identifierMap.get(rel.destinationId);

    const srcIdent = rel.sourceIdentifier || rel.sourceId;
    const destIdent = rel.destinationIdentifier || rel.destinationId;

    // Rule: Unknown items in relationships
    if (!srcMeta) {
      findings.push({
        ruleId: 'UNKNOWN_RELATIONSHIP_ELEMENT',
        severity: 'ERROR',
        message: `Relationship references unknown source element '${srcIdent}'. Ensure this element is defined in the model.`,
        elementId: rel.id,
        elementType: 'Relationship'
      });
    } else {
      connectedElementIds.add(srcMeta.id);
    }

    if (!destMeta) {
      findings.push({
        ruleId: 'UNKNOWN_RELATIONSHIP_ELEMENT',
        severity: 'ERROR',
        message: `Relationship references unknown destination element '${destIdent}'. Ensure this element is defined in the model.`,
        elementId: rel.id,
        elementType: 'Relationship'
      });
    } else {
      connectedElementIds.add(destMeta.id);
    }

    if (!rel.description || !rel.description.trim()) {
      findings.push({
        ruleId: 'RELATIONSHIP_MISSING_DESCRIPTION',
        severity: 'WARNING',
        message: `Relationship between '${srcIdent}' and '${destIdent}' is missing a description.`,
        elementId: rel.id,
        elementType: 'Relationship'
      });
    }

    if (!srcMeta || !destMeta) {
      continue;
    }

    const srcName = srcMeta.name;
    const destName = destMeta.name;

    // Rule: Exact duplicate relationship
    const relKey = `${srcMeta.id}:::${destMeta.id}:::${(rel.description || '').trim().toLowerCase()}`;
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
      const otherSrc = elementMap.get(otherRel.sourceId) || (otherRel.sourceIdentifier ? identifierMap.get(otherRel.sourceIdentifier) : undefined);
      const otherDest = elementMap.get(otherRel.destinationId) || (otherRel.destinationIdentifier ? identifierMap.get(otherRel.destinationIdentifier) : undefined);
      if (!otherSrc || !otherDest) continue;

      const srcIsHigher = otherSrc.ancestors.includes(srcMeta.id);
      const srcIsSame = otherSrc.id === srcMeta.id;
      const destIsHigher = otherDest.ancestors.includes(destMeta.id);
      const destIsSame = otherDest.id === destMeta.id;

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
  } else {
    const seenViewKeys = new Set<string>();
    for (const v of ws.views) {
      if (seenViewKeys.has(v.key)) {
        findings.push({
          ruleId: 'DUPLICATE_IDENTIFIER',
          severity: 'ERROR',
          message: `Duplicate view identifier '${v.key}'. Each view must have a unique identifier.`,
          elementId: v.key,
          elementType: 'View',
          elementName: v.title || v.key
        });
      } else {
        seenViewKeys.add(v.key);
      }

      if (['systemcontext', 'container', 'deployment'].includes(v.viewType) && v.softwareSystemId) {
        const found = elementMap.get(v.softwareSystemId) || identifierMap.get(v.softwareSystemId);
        if (!found || found.type !== 'SoftwareSystem') {
          findings.push({
            ruleId: 'VIEW_TARGET_NOT_FOUND',
            severity: 'ERROR',
            message: `View '${v.key}' (${v.viewType}) specifies unknown software system '${v.softwareSystemId}'. Expected syntax: ${v.viewType} <softwareSystemIdentifier> [key] [description]`,
            elementId: v.key,
            elementType: 'View',
            elementName: v.title || v.key
          });
        }
      }
      if (v.viewType === 'component' && v.containerId) {
        const found = elementMap.get(v.containerId) || identifierMap.get(v.containerId);
        if (!found || found.type !== 'Container') {
          findings.push({
            ruleId: 'VIEW_TARGET_NOT_FOUND',
            severity: 'ERROR',
            message: `Component view '${v.key}' specifies unknown container '${v.containerId}'. Expected syntax: component <containerIdentifier> [key] [description]`,
            elementId: v.key,
            elementType: 'View',
            elementName: v.title || v.key
          });
        }
      }
    }
  }

  return findings;
}
