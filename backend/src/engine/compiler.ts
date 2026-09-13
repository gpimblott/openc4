/**
 * Compiler for Structurizr AST:
 * 1. To Structurizr official JSON schema (for CLI / API interoperability)
 * 2. To React Flow diagram graph format (for live modern web canvas)
 * 3. To Mermaid and PlantUML (for export)
 */

import { Workspace, View, Relationship, DeploymentNode } from './ast.js';
import { resolveThemesSync } from './themes.js';

function deploymentNodeToStructurizrJson(
  node: DeploymentNode,
  relsBySource: Record<string, any[]>
): Record<string, any> {
  const dJson: Record<string, any> = {
    id: node.id,
    name: node.name,
    description: node.description || '',
    technology: node.technology || '',
    environment: node.environment || 'Default',
    instances: typeof node.instances === 'number' ? node.instances : (parseInt(String(node.instances), 10) || 1),
    tags: node.tags && node.tags.length > 0 ? node.tags.join(',') : 'Element,Deployment Node'
  };

  if (node.children && node.children.length > 0) {
    dJson.children = node.children.map((child) => deploymentNodeToStructurizrJson(child, relsBySource));
  }

  if (node.typedContainerInstances && node.typedContainerInstances.length > 0) {
    dJson.containerInstances = node.typedContainerInstances.map((ci) => {
      const ciData: Record<string, any> = {
        id: ci.id,
        containerId: ci.containerId,
        instanceId: ci.instanceId || 1,
        environment: ci.environment || node.environment || 'Default',
        tags: ci.tags && ci.tags.length > 0 ? ci.tags.join(',') : 'Element,Container Instance'
      };
      if (relsBySource[ci.id]) {
        ciData.relationships = relsBySource[ci.id];
      }
      return ciData;
    });
  }

  if (node.typedSoftwareSystemInstances && node.typedSoftwareSystemInstances.length > 0) {
    dJson.softwareSystemInstances = node.typedSoftwareSystemInstances.map((si) => {
      const siData: Record<string, any> = {
        id: si.id,
        softwareSystemId: si.softwareSystemId,
        instanceId: si.instanceId || 1,
        environment: si.environment || node.environment || 'Default',
        tags: si.tags && si.tags.length > 0 ? si.tags.join(',') : 'Element,Software System Instance'
      };
      if (relsBySource[si.id]) {
        siData.relationships = relsBySource[si.id];
      }
      return siData;
    });
  }

  if (node.infrastructureNodes && node.infrastructureNodes.length > 0) {
    dJson.infrastructureNodes = node.infrastructureNodes.map((infra) => {
      const infData: Record<string, any> = {
        id: infra.id,
        name: infra.name,
        description: infra.description || '',
        technology: infra.technology || '',
        environment: infra.environment || node.environment || 'Default',
        tags: infra.tags && infra.tags.length > 0 ? infra.tags.join(',') : 'Element,Infrastructure Node'
      };
      if (relsBySource[infra.id]) {
        infData.relationships = relsBySource[infra.id];
      }
      return infData;
    });
  }

  if (relsBySource[node.id]) {
    dJson.relationships = relsBySource[node.id];
  }

  return dJson;
}

export function workspaceToStructurizrJson(ws: Workspace): Record<string, any> {
  // Build relationships lookup by source ID
  const relsBySource: Record<string, any[]> = {};
  for (const rel of ws.model.relationships) {
    const rJson: Record<string, any> = {
      id: rel.id,
      sourceId: rel.sourceId,
      destinationId: rel.destinationId,
      description: rel.description,
      technology: rel.technology,
      interactionStyle: rel.interactionStyle,
      tags: rel.tags.length > 0 ? rel.tags.join(',') : 'Relationship'
    };
    if (rel.archetype) {
      rJson.archetype = rel.archetype;
    }
    if (rel.linkedRelationshipId) {
      rJson.linkedRelationshipId = rel.linkedRelationshipId;
    }
    if (rel.perspectives && rel.perspectives.length > 0) {
      rJson.perspectives = rel.perspectives;
    }
    if (!relsBySource[rel.sourceId]) {
      relsBySource[rel.sourceId] = [];
    }
    relsBySource[rel.sourceId].push(rJson);
  }

  // People
  const peopleJson: any[] = [];
  for (const p of ws.model.people) {
    const pData: Record<string, any> = {
      id: p.id,
      name: p.name,
      description: p.description,
      location: p.location,
      tags: p.tags.length > 0 ? p.tags.join(',') : 'Element,Person'
    };
    if (p.archetype) {
      pData.archetype = p.archetype;
    }
    if (relsBySource[p.id]) {
      pData.relationships = relsBySource[p.id];
    }
    if (p.url) {
      pData.url = p.url;
    }
    if (p.group) {
      pData.group = p.group;
    }
    if (p.perspectives && p.perspectives.length > 0) {
      pData.perspectives = p.perspectives;
    }
    peopleJson.push(pData);
  }

  // Software Systems
  const systemsJson: any[] = [];
  for (const s of ws.model.softwareSystems) {
    const containersJson: any[] = [];
    for (const c of s.containers) {
      const componentsJson: any[] = [];
      for (const comp of c.components) {
        const compData: Record<string, any> = {
          id: comp.id,
          name: comp.name,
          description: comp.description,
          technology: comp.technology,
          tags: comp.tags.length > 0 ? comp.tags.join(',') : 'Element,Component'
        };
        if (comp.archetype) {
          compData.archetype = comp.archetype;
        }
        if (relsBySource[comp.id]) {
          compData.relationships = relsBySource[comp.id];
        }
        if (comp.group) {
          compData.group = comp.group;
        }
        if (comp.perspectives && comp.perspectives.length > 0) {
          compData.perspectives = comp.perspectives;
        }
        componentsJson.push(compData);
      }

      const cData: Record<string, any> = {
        id: c.id,
        name: c.name,
        description: c.description,
        technology: c.technology,
        tags: c.tags.length > 0 ? c.tags.join(',') : 'Element,Container',
        components: componentsJson
      };
      if (c.archetype) {
        cData.archetype = c.archetype;
      }
      if (relsBySource[c.id]) {
        cData.relationships = relsBySource[c.id];
      }
      if (c.group) {
        cData.group = c.group;
      }
      if (c.perspectives && c.perspectives.length > 0) {
        cData.perspectives = c.perspectives;
      }
      containersJson.push(cData);
    }

    const sData: Record<string, any> = {
      id: s.id,
      name: s.name,
      description: s.description,
      location: s.location,
      tags: s.tags.length > 0 ? s.tags.join(',') : 'Element,Software System',
      containers: containersJson
    };
    if (s.archetype) {
      sData.archetype = s.archetype;
    }
    if (s.group) {
      sData.group = s.group;
    }
    if (relsBySource[s.id]) {
      sData.relationships = relsBySource[s.id];
    }
    if (s.perspectives && s.perspectives.length > 0) {
      sData.perspectives = s.perspectives;
    }
    systemsJson.push(sData);
  }

  // Custom Elements
  const customElementsJson: any[] = [];
  for (const e of ws.model.customElements || []) {
    const eData: Record<string, any> = {
      id: e.id,
      name: e.name,
      description: e.description,
      tags: e.tags.length > 0 ? e.tags.join(',') : 'Element'
    };
    if (e.metadata) eData.metadata = e.metadata;
    if (e.archetype) eData.archetype = e.archetype;
    if (e.url) eData.url = e.url;
    if (e.properties && Object.keys(e.properties).length > 0) eData.properties = e.properties;
    if (relsBySource[e.id]) eData.relationships = relsBySource[e.id];
    customElementsJson.push(eData);
  }

  // Views
  const systemContextViews: any[] = [];
  const containerViews: any[] = [];
  const componentViews: any[] = [];
  const systemLandscapeViews: any[] = [];
  const deploymentViews: any[] = [];
  const dynamicViews: any[] = [];
  const filteredViewsJson: any[] = [];

  for (const v of ws.views) {
    if (v.viewType === 'filtered') {
      const fData: Record<string, any> = {
        key: v.key,
        baseViewKey: v.baseViewKey,
        description: v.description,
        title: v.title,
        mode: (v.filterMode || 'include').toLowerCase() === 'exclude' ? 'Exclude' : 'Include',
        tags: v.filterTags || []
      };
      filteredViewsJson.push(fData);
      continue;
    }

    let canvas: any = null;
    try {
      canvas = compileViewToCanvas(ws, v.key);
    } catch {
      // fallback
    }

    const elements = canvas && Array.isArray(canvas.nodes)
      ? canvas.nodes.map((n: any) => ({
          id: n.id,
          x: Math.round(n.position?.x ?? 0),
          y: Math.round(n.position?.y ?? 0)
        }))
      : v.includedElementIds
          .filter((eid) => eid !== '*' && !eid.includes('->') && !eid.includes('==') && !eid.includes('!='))
          .map((eid) => ({
            id: eid,
            x: v.layoutCoordinates[eid]?.x ?? 0,
            y: v.layoutCoordinates[eid]?.y ?? 0
          }));

    const modelRelIds = new Set(ws.model.relationships.map((r) => r.id));
    const seenRels = new Set<string>();
    const relationships: Array<{ id: string }> = [];

    if (canvas && Array.isArray(canvas.edges)) {
      for (const e of canvas.edges) {
        const relId = e.data?.relationshipId || e.data?.id || e.id.replace(/^edge_/, '');
        if (modelRelIds.has(relId) && !seenRels.has(relId)) {
          seenRels.add(relId);
          relationships.push({ id: relId });
        }
      }
    }

    const vData: Record<string, any> = {
      key: v.key,
      description: v.description,
      title: v.title,
      elements,
      relationships
    };

    const directionMap: Record<string, string> = {
      tb: 'TopBottom',
      lr: 'LeftRight',
      bt: 'BottomTop',
      rl: 'RightLeft'
    };

    const hasExplicitLayout = v.layoutCoordinates && Object.keys(v.layoutCoordinates).length > 0;

    // Provide automaticLayout if specified in DSL or if no manual coordinates are saved
    if (v.autoLayout || !hasExplicitLayout) {
      const defaultDir =
        v.viewType === 'deployment' || v.viewType === 'component' ? 'TopBottom' : 'LeftRight';
      const rankDir = v.autoLayout
        ? directionMap[v.autoLayout.toLowerCase()] || 'TopBottom'
        : defaultDir;

      vData.automaticLayout = {
        implementation: 'Graphviz',
        rankDirection: rankDir,
        rankSeparation: v.rankSeparation ?? 300,
        nodeSeparation: v.nodeSeparation ?? 300,
        edgeSeparation: 200,
        vertices: false
      };
    }

    if (v.viewType === 'systemcontext') {
      vData.softwareSystemId = v.softwareSystemId;
      systemContextViews.push(vData);
    } else if (v.viewType === 'container') {
      vData.softwareSystemId = v.softwareSystemId;
      containerViews.push(vData);
    } else if (v.viewType === 'component') {
      vData.containerId = v.containerId;
      componentViews.push(vData);
    } else if (v.viewType === 'systemlandscape') {
      systemLandscapeViews.push(vData);
    } else if (v.viewType === 'deployment') {
      vData.environment = v.environment;
      vData.softwareSystemId = v.softwareSystemId;
      deploymentViews.push(vData);
    } else if (v.viewType === 'dynamic') {
      vData.elementId = v.softwareSystemId || v.containerId;
      dynamicViews.push(vData);
    }
  }

  // Styles
  const elementStylesJson: any[] = [];
  for (const es of ws.elementStyles) {
    const sDict: Record<string, any> = { tag: es.tag };
    if (es.shape) sDict.shape = es.shape;
    if (es.background) sDict.background = es.background;
    if (es.color) sDict.color = es.color;
    if (es.stroke) sDict.stroke = es.stroke;
    if (es.strokeWidth !== undefined && es.strokeWidth !== null) sDict.strokeWidth = es.strokeWidth;
    if (es.fontSize) sDict.fontSize = es.fontSize;
    if (es.width !== undefined && es.width !== null) sDict.width = es.width;
    if (es.height !== undefined && es.height !== null) sDict.height = es.height;
    if (es.border) sDict.border = es.border;
    if (es.opacity !== undefined && es.opacity !== null) sDict.opacity = es.opacity;
    if (es.icon) sDict.icon = es.icon;
    if (es.mode) sDict.mode = es.mode;
    elementStylesJson.push(sDict);
  }

  const relStylesJson: any[] = [];
  for (const rs of ws.relationshipStyles) {
    const rDict: Record<string, any> = { tag: rs.tag };
    if (rs.thickness) rDict.thickness = rs.thickness;
    if (rs.color) rDict.color = rs.color;
    if (rs.style) rDict.style = rs.style;
    if (rs.routing) rDict.routing = rs.routing;
    if (rs.dashed !== undefined && rs.dashed !== null) rDict.dashed = rs.dashed;
    if (rs.opacity !== undefined && rs.opacity !== null) rDict.opacity = rs.opacity;
    if (rs.mode) rDict.mode = rs.mode;
    relStylesJson.push(rDict);
  }

  const nowIso = new Date().toISOString();

  return {
    id: ws.id,
    name: ws.name,
    description: ws.description,
    version: ws.version,
    lastModifiedDate: nowIso,
    model: {
      people: peopleJson,
      softwareSystems: systemsJson,
      deploymentNodes: (ws.model.deploymentNodes || []).map((dn) =>
        deploymentNodeToStructurizrJson(dn, relsBySource)
      ),
      ...(ws.model.archetypes && (Object.keys(ws.model.archetypes.elements).length > 0 || Object.keys(ws.model.archetypes.relationships).length > 0)
        ? { archetypes: ws.model.archetypes }
        : ws.archetypes && (Object.keys(ws.archetypes.elements).length > 0 || Object.keys(ws.archetypes.relationships).length > 0)
        ? { archetypes: ws.archetypes }
        : {}),
      ...(customElementsJson.length > 0 ? { customElements: customElementsJson } : {})
    },
    views: {
      systemLandscapeViews,
      systemContextViews,
      containerViews,
      componentViews,
      deploymentViews,
      dynamicViews,
      filteredViews: filteredViewsJson,
      configuration: {
        styles: {
          elements: elementStylesJson,
          relationships: relStylesJson
        },
        themes: ws.themes,
        ...(ws.terminology ? { terminology: ws.terminology } : {}),
        ...(ws.impliedRelationships !== undefined && ws.impliedRelationships !== false
          ? {
              impliedRelationshipsStrategy:
                typeof ws.impliedRelationships === 'string'
                  ? ws.impliedRelationships
                  : 'CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy'
            }
          : {})
      }
    }
  };
}

function evaluateInclusionExpressions(
  items: string[],
  allElements: Record<string, any>,
  relationships: Relationship[],
  naturalScopeIds: Set<string>
): Set<string> {
  const result = new Set<string>();
  const findElem = (ref: string): any => {
    if (allElements[ref]) return allElements[ref];
    return (
      Object.values(allElements).find(
        (e: any) =>
          e.identifier === ref ||
          e.name === ref ||
          (e.identifier && e.identifier.toLowerCase() === ref.toLowerCase())
      ) || null
    );
  };

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed === '*') {
      for (const id of naturalScopeIds) result.add(id);
      continue;
    }

    // Tag expression: element.tag == X or element.tag != X
    const tagEqualMatch = trimmed.match(/^element\.tag\s*==\s*['"]?([^'"]+)['"]?$/i);
    if (tagEqualMatch) {
      const tag = tagEqualMatch[1].trim();
      for (const [id, elem] of Object.entries(allElements)) {
        if (elem.tags && elem.tags.includes(tag)) {
          result.add(id);
        }
      }
      continue;
    }

    const tagNotEqualMatch = trimmed.match(/^element\.tag\s*!=\s*['"]?([^'"]+)['"]?$/i);
    if (tagNotEqualMatch) {
      const tag = tagNotEqualMatch[1].trim();
      for (const [id, elem] of Object.entries(allElements)) {
        if (elem.tags && !elem.tags.includes(tag)) {
          result.add(id);
        }
      }
      continue;
    }

    // Incoming expression: ->target
    if (trimmed.startsWith('->')) {
      const target = trimmed.slice(2).trim();
      const targetElem = findElem(target);
      if (targetElem) result.add(targetElem.id);
      for (const rel of relationships) {
        if (
          rel.destinationId === target ||
          rel.destinationIdentifier === target ||
          (targetElem && rel.destinationId === targetElem.id)
        ) {
          result.add(rel.sourceId);
        }
      }
      continue;
    }

    // Outgoing expression: target->
    if (trimmed.endsWith('->') && !trimmed.startsWith('->')) {
      const source = trimmed.slice(0, -2).trim();
      const sourceElem = findElem(source);
      if (sourceElem) result.add(sourceElem.id);
      for (const rel of relationships) {
        if (
          rel.sourceId === source ||
          rel.sourceIdentifier === source ||
          (sourceElem && rel.sourceId === sourceElem.id)
        ) {
          result.add(rel.destinationId);
        }
      }
      continue;
    }

    // Specific relationship: source->dest or source -> dest
    if (trimmed.includes('->')) {
      const parts = trimmed.split('->').map((p) => p.trim());
      if (parts.length === 2) {
        const sElem = findElem(parts[0]);
        const dElem = findElem(parts[1]);
        if (sElem) result.add(sElem.id);
        if (dElem) result.add(dElem.id);
        continue;
      }
    }

    // Direct element ID / identifier
    const directElem = findElem(trimmed);
    if (directElem) {
      result.add(directElem.id);
    }
  }

  return result;
}

function applyExclusionExpressions(
  items: string[],
  visibleElementIds: Set<string>,
  allElements: Record<string, any>,
  relationships: Relationship[]
) {
  const findElem = (ref: string): any => {
    if (allElements[ref]) return allElements[ref];
    return (
      Object.values(allElements).find(
        (e: any) =>
          e.identifier === ref ||
          e.name === ref ||
          (e.identifier && e.identifier.toLowerCase() === ref.toLowerCase())
      ) || null
    );
  };

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Tag expression: element.tag == X or element.tag != X
    const tagEqualMatch = trimmed.match(/^element\.tag\s*==\s*['"]?([^'"]+)['"]?$/i);
    if (tagEqualMatch) {
      const tag = tagEqualMatch[1].trim();
      for (const id of Array.from(visibleElementIds)) {
        const elem = allElements[id];
        if (elem?.tags?.includes(tag)) {
          visibleElementIds.delete(id);
        }
      }
      continue;
    }

    const tagNotEqualMatch = trimmed.match(/^element\.tag\s*!=\s*['"]?([^'"]+)['"]?$/i);
    if (tagNotEqualMatch) {
      const tag = tagNotEqualMatch[1].trim();
      for (const id of Array.from(visibleElementIds)) {
        const elem = allElements[id];
        if (elem?.tags && !elem.tags.includes(tag)) {
          visibleElementIds.delete(id);
        }
      }
      continue;
    }

    // Incoming expression: ->target
    if (trimmed.startsWith('->')) {
      const target = trimmed.slice(2).trim();
      const targetElem = findElem(target);
      if (targetElem) visibleElementIds.delete(targetElem.id);
      for (const rel of relationships) {
        if (
          rel.destinationId === target ||
          rel.destinationIdentifier === target ||
          (targetElem && rel.destinationId === targetElem.id)
        ) {
          visibleElementIds.delete(rel.sourceId);
        }
      }
      continue;
    }

    // Outgoing expression: target->
    if (trimmed.endsWith('->') && !trimmed.startsWith('->')) {
      const source = trimmed.slice(0, -2).trim();
      const sourceElem = findElem(source);
      if (sourceElem) visibleElementIds.delete(sourceElem.id);
      for (const rel of relationships) {
        if (
          rel.sourceId === source ||
          rel.sourceIdentifier === source ||
          (sourceElem && rel.sourceId === sourceElem.id)
        ) {
          visibleElementIds.delete(rel.destinationId);
        }
      }
      continue;
    }

    // Specific relationship: source->dest or source -> dest
    if (trimmed.includes('->')) {
      const parts = trimmed.split('->').map((p) => p.trim());
      if (parts.length === 2) {
        const sElem = findElem(parts[0]);
        const dElem = findElem(parts[1]);
        if (sElem) visibleElementIds.delete(sElem.id);
        if (dElem) visibleElementIds.delete(dElem.id);
        continue;
      }
    }

    // Direct element ID / identifier
    const directElem = findElem(trimmed);
    if (directElem) {
      visibleElementIds.delete(directElem.id);
    }
  }
}

export function compileViewToCanvas(ws: Workspace, viewKey?: string | null): Record<string, any> {
  // Synchronously resolve offline / cached themes
  resolveThemesSync(ws);

  let view: View | undefined;
  if (viewKey) {
    view = ws.views.find((v) => v.key === viewKey);
  }
  if (!view && ws.defaultView) {
    view = ws.views.find((v) => v.key === ws.defaultView);
  }
  if (!view && ws.views.length > 0) {
    view = ws.views.find((v) => v.isDefault) || ws.views[0];
  }

  const isFilteredView = view?.viewType === 'filtered';
  let effectiveBaseView = view;
  if (isFilteredView && view?.baseViewKey) {
    const base = ws.views.find((v) => v.key === view.baseViewKey);
    if (base) {
      effectiveBaseView = base;
    }
  }

  // Map all elements by ID
  const allElements: Record<string, any> = {};
  const parentMap: Record<string, string> = {};

  for (const p of ws.model.people) {
    allElements[p.id] = {
      id: p.id,
      identifier: p.identifier,
      type: 'person',
      name: p.name,
      description: p.description,
      technology: '',
      tags: p.tags,
      parentId: null,
      group: p.group || null,
      perspectives: p.perspectives || []
    };
  }

  for (const s of ws.model.softwareSystems) {
    allElements[s.id] = {
      id: s.id,
      identifier: s.identifier,
      type: 'softwareSystem',
      name: s.name,
      description: s.description,
      technology: '',
      tags: s.tags,
      parentId: null,
      group: s.group || null,
      perspectives: s.perspectives || []
    };
    for (const c of s.containers) {
      allElements[c.id] = {
        id: c.id,
        identifier: c.identifier,
        type: 'container',
        name: c.name,
        description: c.description,
        technology: c.technology,
        tags: c.tags,
        parentId: s.id,
        group: c.group || null,
        perspectives: c.perspectives || []
      };
      parentMap[c.id] = s.id;
      for (const comp of c.components) {
        allElements[comp.id] = {
          id: comp.id,
          identifier: comp.identifier,
          type: 'component',
          name: comp.name,
          description: comp.description,
          technology: comp.technology,
          tags: comp.tags,
          parentId: c.id,
          group: comp.group || null,
          perspectives: comp.perspectives || []
        };
        parentMap[comp.id] = c.id;
      }
    }
  }

  if (ws.model.customElements) {
    for (const e of ws.model.customElements) {
      allElements[e.id] = {
        id: e.id,
        identifier: e.identifier,
        type: 'element',
        name: e.name,
        description: e.description,
        technology: '',
        metadata: e.metadata || '',
        tags: e.tags,
        parentId: null,
        group: e.group || null,
        perspectives: e.perspectives || []
      };
    }
  }

  // Helper to find element by ID, identifier, or name
  const findElement = (idOrIdent?: string | null): any => {
    if (!idOrIdent) return null;
    if (allElements[idOrIdent]) return allElements[idOrIdent];
    return (
      Object.values(allElements).find(
        (e: any) =>
          e.identifier === idOrIdent ||
          e.name === idOrIdent ||
          (e.identifier && e.identifier.toLowerCase() === idOrIdent.toLowerCase())
      ) || null
    );
  };

  // Helper to get root software system ID for any element
  const getSystemId = (id: string): string | null => {
    const elem = allElements[id];
    if (!elem) return null;
    if (elem.type === 'softwareSystem') return id;
    if (elem.type === 'container') return elem.parentId;
    if (elem.type === 'component') {
      const contId = elem.parentId;
      return contId ? parentMap[contId] || null : null;
    }
    return null;
  };

  // Helper to get container ID for any element
  const getContainerId = (id: string): string | null => {
    const elem = allElements[id];
    if (!elem) return null;
    if (elem.type === 'container') return id;
    if (elem.type === 'component') return elem.parentId;
    return null;
  };

  // If view is deployment, register deployment nodes, infrastructure nodes, and instances
  const isDeploymentView = effectiveBaseView?.viewType === 'deployment';
  const targetEnvironment = effectiveBaseView?.environment?.toLowerCase() || '';

  if (isDeploymentView) {
    const registerDeploymentNodeElements = (node: DeploymentNode, parentNodeId: string | null) => {
      // Register infrastructure nodes
      for (const infra of node.infrastructureNodes || []) {
        allElements[infra.id] = {
          id: infra.id,
          identifier: infra.identifier,
          type: 'infrastructureNode',
          name: infra.name,
          description: infra.description,
          technology: infra.technology,
          tags: infra.tags,
          parentId: node.id,
          group: infra.group || null,
          perspectives: infra.perspectives || []
        };
      }

      // Register typed container instances
      for (const inst of node.typedContainerInstances || []) {
        const targetCont = findElement(inst.containerId);
        allElements[inst.id] = {
          id: inst.id,
          identifier: inst.identifier,
          type: 'containerInstance',
          name: targetCont ? targetCont.name : inst.name,
          description: targetCont ? targetCont.description : inst.description,
          technology: targetCont ? targetCont.technology : '',
          tags: inst.tags,
          parentId: node.id,
          group: null,
          underlyingElementId: targetCont ? targetCont.id : inst.containerId,
          perspectives: inst.perspectives || []
        };
      }

      // Register typed software system instances
      for (const inst of node.typedSoftwareSystemInstances || []) {
        const targetSys = findElement(inst.softwareSystemId);
        allElements[inst.id] = {
          id: inst.id,
          identifier: inst.identifier,
          type: 'softwareSystemInstance',
          name: targetSys ? targetSys.name : inst.name,
          description: targetSys ? targetSys.description : inst.description,
          technology: '',
          tags: inst.tags,
          parentId: node.id,
          group: null,
          underlyingElementId: targetSys ? targetSys.id : inst.softwareSystemId,
          perspectives: inst.perspectives || []
        };
      }

      // Handle raw string containerInstances if not already typed
      for (const cTarget of node.containerInstances || []) {
        const alreadyTyped = (node.typedContainerInstances || []).some((ci) => ci.containerId === cTarget);
        if (!alreadyTyped) {
          const targetCont = findElement(cTarget);
          const genId = `${node.id}_${cTarget}`;
          if (!allElements[genId]) {
            allElements[genId] = {
              id: genId,
              identifier: `${cTarget}_instance`,
              type: 'containerInstance',
              name: targetCont ? targetCont.name : cTarget,
              description: targetCont ? targetCont.description : '',
              technology: targetCont ? targetCont.technology : '',
              tags: ['Container Instance', 'Element'],
              parentId: node.id,
              group: null,
              underlyingElementId: targetCont ? targetCont.id : cTarget
            };
          }
        }
      }

      // Recurse children
      for (const child of node.children) {
        registerDeploymentNodeElements(child, node.id);
      }
    };

    for (const dNode of ws.model.deploymentNodes) {
      if (!targetEnvironment || !dNode.environment || dNode.environment.toLowerCase() === targetEnvironment) {
        registerDeploymentNodeElements(dNode, null);
      }
    }
  }

  // Determine natural scope IDs based on view type
  const naturalScopeIds = new Set<string>();
  if (!effectiveBaseView || effectiveBaseView.viewType === 'systemlandscape') {
    for (const p of ws.model.people) naturalScopeIds.add(p.id);
    for (const s of ws.model.softwareSystems) naturalScopeIds.add(s.id);
    for (const e of ws.model.customElements || []) naturalScopeIds.add(e.id);
  } else if (effectiveBaseView.viewType === 'systemcontext') {
    const targetSys = findElement(effectiveBaseView.softwareSystemId);
    const targetSysId = targetSys ? targetSys.id : effectiveBaseView.softwareSystemId;
    if (targetSysId && allElements[targetSysId]) {
      naturalScopeIds.add(targetSysId);
      for (const rel of ws.model.relationships) {
        const sSys = getSystemId(rel.sourceId);
        const dSys = getSystemId(rel.destinationId);
        const sElem = allElements[rel.sourceId];
        const dElem = allElements[rel.destinationId];

        if (rel.sourceId === targetSysId || sSys === targetSysId) {
          if (dElem?.type === 'person') naturalScopeIds.add(dElem.id);
          else if (dSys && dSys !== targetSysId) naturalScopeIds.add(dSys);
        }
        if (rel.destinationId === targetSysId || dSys === targetSysId) {
          if (sElem?.type === 'person') naturalScopeIds.add(sElem.id);
          else if (sSys && sSys !== targetSysId) naturalScopeIds.add(sSys);
        }
      }
    } else {
      for (const p of ws.model.people) naturalScopeIds.add(p.id);
      for (const s of ws.model.softwareSystems) naturalScopeIds.add(s.id);
    }
  } else if (effectiveBaseView.viewType === 'container') {
    const targetSys = findElement(effectiveBaseView.softwareSystemId);
    const targetSysId = targetSys ? targetSys.id : effectiveBaseView.softwareSystemId;
    if (targetSys) {
      for (const [cid, elem] of Object.entries(allElements)) {
        if (elem.type === 'container' && elem.parentId === targetSysId) {
          naturalScopeIds.add(cid);
        }
      }
      for (const rel of ws.model.relationships) {
        const sSys = getSystemId(rel.sourceId);
        const dSys = getSystemId(rel.destinationId);
        const sElem = allElements[rel.sourceId];
        const dElem = allElements[rel.destinationId];

        if (rel.sourceId === targetSysId || sSys === targetSysId) {
          if (dElem?.type === 'person') naturalScopeIds.add(dElem.id);
          else if (dSys && dSys !== targetSysId) naturalScopeIds.add(dSys);
        }
        if (rel.destinationId === targetSysId || dSys === targetSysId) {
          if (sElem?.type === 'person') naturalScopeIds.add(sElem.id);
          else if (sSys && sSys !== targetSysId) naturalScopeIds.add(sSys);
        }
      }
    }
  } else if (effectiveBaseView.viewType === 'component') {
    const targetCont = findElement(effectiveBaseView.containerId);
    if (targetCont) {
      const actualContId = targetCont.id;
      const parentSysId = targetCont.parentId;
      for (const [compId, comp] of Object.entries(allElements)) {
        if (comp.parentId === actualContId) naturalScopeIds.add(compId);
      }
      for (const rel of ws.model.relationships) {
        const sCont = getContainerId(rel.sourceId);
        const dCont = getContainerId(rel.destinationId);
        const sSys = getSystemId(rel.sourceId);
        const dSys = getSystemId(rel.destinationId);
        const sElem = allElements[rel.sourceId];
        const dElem = allElements[rel.destinationId];

        const sourceIsInside = rel.sourceId === actualContId || sCont === actualContId;
        const destIsInside = rel.destinationId === actualContId || dCont === actualContId;

        if (sourceIsInside && !destIsInside) {
          if (dCont && dCont !== actualContId && dSys === parentSysId) naturalScopeIds.add(dCont);
          else if (dElem?.type === 'person') naturalScopeIds.add(dElem.id);
          else if (dSys && dSys !== parentSysId) naturalScopeIds.add(dSys);
        } else if (destIsInside && !sourceIsInside) {
          if (sCont && sCont !== actualContId && sSys === parentSysId) naturalScopeIds.add(sCont);
          else if (sElem?.type === 'person') naturalScopeIds.add(sElem.id);
          else if (sSys && sSys !== parentSysId) naturalScopeIds.add(sSys);
        }
      }
    }
  } else if (effectiveBaseView.viewType === 'deployment') {
    for (const [eid, elem] of Object.entries(allElements)) {
      if (['infrastructureNode', 'containerInstance', 'softwareSystemInstance'].includes(elem.type)) {
        naturalScopeIds.add(eid);
      }
    }
  } else if (effectiveBaseView.viewType === 'dynamic') {
    for (const step of effectiveBaseView.dynamicSteps || []) {
      if (allElements[step.sourceId]) naturalScopeIds.add(step.sourceId);
      if (allElements[step.destinationId]) naturalScopeIds.add(step.destinationId);
    }
  }

  // Determine visible elements: include / exclude expressions
  let visibleElementIds = new Set<string>();
  if (!effectiveBaseView || effectiveBaseView.includeAll || effectiveBaseView.includedElementIds.length === 0) {
    visibleElementIds = new Set<string>(naturalScopeIds);
  } else {
    visibleElementIds = evaluateInclusionExpressions(
      effectiveBaseView.includedElementIds,
      allElements,
      ws.model.relationships,
      naturalScopeIds
    );
  }

  // If dynamic view, always ensure participating dynamic steps are visible
  if (effectiveBaseView?.viewType === 'dynamic') {
    for (const step of effectiveBaseView.dynamicSteps || []) {
      if (allElements[step.sourceId]) visibleElementIds.add(step.sourceId);
      if (allElements[step.destinationId]) visibleElementIds.add(step.destinationId);
    }
  }

  // Apply exclusion expressions
  if (effectiveBaseView && effectiveBaseView.excludedElementIds.length > 0) {
    applyExclusionExpressions(effectiveBaseView.excludedElementIds, visibleElementIds, allElements, ws.model.relationships);
  }

  // If this is a filtered view, apply the tag filter to visible elements
  if (isFilteredView && view) {
    const filterTags = (view.filterTags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
    const mode = (view.filterMode || 'include').toLowerCase();

    for (const id of Array.from(visibleElementIds)) {
      const elem = allElements[id];
      const elemTags = (elem?.tags || []).map((t: string) => t.toLowerCase());
      const hasMatchingTag = filterTags.some((ft) => elemTags.includes(ft));

      if (mode === 'include' && !hasMatchingTag) {
        visibleElementIds.delete(id);
      } else if (mode === 'exclude' && hasMatchingTag) {
        visibleElementIds.delete(id);
      }
    }
  }

  // Determine parent boundaries
  const boundaries: Array<{
    id: string;
    name: string;
    type: string;
    technology?: string;
    description?: string;
    childIds: string[];
    parentBoundaryId?: string | null;
    stroke?: string | null;
    strokeWidth?: number | null;
  }> = [];

  const styleMap = new Map<string, any>();
  for (const s of ws.elementStyles) {
    styleMap.set(s.tag.toLowerCase(), s);
  }

  const relStyleMap = new Map<string, any>();
  for (const rs of ws.relationshipStyles) {
    relStyleMap.set(rs.tag.toLowerCase(), rs);
  }

  const boundaryStyle = styleMap.get('boundary');
  const bStroke = boundaryStyle?.stroke || null;
  const bStrokeWidth = boundaryStyle?.strokeWidth || null;

  if (effectiveBaseView) {
    if (effectiveBaseView.viewType === 'deployment') {
      const buildDeploymentBoundaries = (node: DeploymentNode, parentBoundaryId: string | null) => {
        const childNodeIds: string[] = [];

        for (const child of node.children) {
          buildDeploymentBoundaries(child, node.id);
          childNodeIds.push(child.id);
        }

        for (const infra of node.infrastructureNodes || []) {
          if (visibleElementIds.has(infra.id)) {
            childNodeIds.push(infra.id);
          }
        }

        for (const inst of node.typedContainerInstances || []) {
          if (visibleElementIds.has(inst.id)) {
            childNodeIds.push(inst.id);
          }
        }

        for (const inst of node.typedSoftwareSystemInstances || []) {
          if (visibleElementIds.has(inst.id)) {
            childNodeIds.push(inst.id);
          }
        }

        for (const cTarget of node.containerInstances || []) {
          const genId = `${node.id}_${cTarget}`;
          if (visibleElementIds.has(genId) && !childNodeIds.includes(genId)) {
            childNodeIds.push(genId);
          }
        }

        const instCount = node.instances && node.instances !== 1 ? ` (x${node.instances})` : '';
        boundaries.push({
          id: node.id,
          name: node.name,
          type: 'deploymentNode',
          technology: node.technology ? `${node.technology}${instCount}` : instCount,
          description: node.description,
          childIds: childNodeIds,
          parentBoundaryId,
          stroke: '#059669',
          strokeWidth: 2
        });
      };

      for (const dNode of ws.model.deploymentNodes) {
        if (!targetEnvironment || !dNode.environment || dNode.environment.toLowerCase() === targetEnvironment) {
          buildDeploymentBoundaries(dNode, null);
        }
      }
    } else if (effectiveBaseView.viewType === 'container' && effectiveBaseView.softwareSystemId) {
      const targetSys = findElement(effectiveBaseView.softwareSystemId);
      if (targetSys) {
        const childIds = Object.values(allElements)
          .filter((e: any) => e.type === 'container' && e.parentId === targetSys.id)
          .map((c: any) => c.id)
          .filter((id) => visibleElementIds.has(id));
        if (childIds.length > 0) {
          boundaries.push({
            id: targetSys.id,
            name: targetSys.name,
            type: 'softwareSystem',
            technology: '',
            description: targetSys.description,
            childIds,
            parentBoundaryId: null,
            stroke: bStroke,
            strokeWidth: bStrokeWidth
          });
        }
      }
    } else if (effectiveBaseView.viewType === 'component' && effectiveBaseView.containerId) {
      const targetCont = findElement(effectiveBaseView.containerId);
      if (targetCont) {
        const actualContId = targetCont.id;
        const parentSysId = targetCont.parentId;
        const targetSys = parentSysId ? allElements[parentSysId] : null;

        if (targetSys) {
          const sysChildIds = Array.from(visibleElementIds).filter(
            (id) => getSystemId(id) === targetSys.id
          );
          if (sysChildIds.length > 0) {
            boundaries.push({
              id: targetSys.id,
              name: targetSys.name,
              type: 'softwareSystem',
              technology: '',
              description: targetSys.description,
              childIds: sysChildIds,
              parentBoundaryId: null,
              stroke: bStroke,
              strokeWidth: bStrokeWidth
            });
          }
        }

        const compChildIds = Object.keys(allElements).filter(
          (id) => allElements[id]?.parentId === actualContId && visibleElementIds.has(id)
        );
        if (compChildIds.length > 0) {
          boundaries.push({
            id: targetCont.id,
            name: targetCont.name,
            type: 'container',
            technology: targetCont.technology || '',
            description: targetCont.description,
            childIds: compChildIds,
            parentBoundaryId: targetSys?.id || null,
            stroke: bStroke,
            strokeWidth: bStrokeWidth
          });
        }
      }
    }
  }

  // Group boundaries for elements with group defined
  const groupMap = new Map<
    string,
    { name: string; parentBoundaryId: string | null; childIds: string[] }
  >();

  for (const eid of visibleElementIds) {
    const elem = allElements[eid];
    if (elem && elem.group) {
      let parentBoundaryId: string | null = null;
      if (elem.type === 'component') {
        if (boundaries.some((b) => b.id === elem.parentId)) {
          parentBoundaryId = elem.parentId;
        } else {
          const cont = allElements[elem.parentId];
          if (cont && boundaries.some((b) => b.id === cont.parentId)) {
            parentBoundaryId = cont.parentId;
          }
        }
      } else if (elem.type === 'container') {
        if (boundaries.some((b) => b.id === elem.parentId)) {
          parentBoundaryId = elem.parentId;
        }
      }

      const groupKey = `${parentBoundaryId || 'root'}:::${elem.group}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          name: elem.group,
          parentBoundaryId,
          childIds: []
        });
      }
      groupMap.get(groupKey)!.childIds.push(eid);
    }
  }

  for (const [, grp] of groupMap.entries()) {
    if (grp.childIds.length > 0) {
      const safeId = `group_${grp.parentBoundaryId || 'model'}_${grp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      boundaries.push({
        id: safeId,
        name: grp.name,
        type: 'group',
        childIds: grp.childIds,
        parentBoundaryId: grp.parentBoundaryId,
        stroke: bStroke,
        strokeWidth: bStrokeWidth
      });
    }
  }

  const primaryBoundary = boundaries.slice().reverse().find((b) => b.type !== 'group') || boundaries[0] || null;
  const boundary = primaryBoundary;

  // Generate React Flow nodes
  const nodes: any[] = [];
  let idx = 0;
  const cols = 3;
  const spacingX = 480;
  const spacingY = 320;

  for (const eid of visibleElementIds) {
    const elem = allElements[eid];
    if (!elem) continue;

    let bgColor =
      elem.type === 'softwareSystem'
        ? '#1168bd'
        : elem.type === 'person'
        ? '#08427b'
        : elem.type === 'container'
        ? '#438dd5'
        : elem.type === 'component'
        ? '#85bbf0'
        : elem.type === 'infrastructureNode'
        ? '#0284c7'
        : elem.type === 'containerInstance'
        ? '#38bdf8'
        : elem.type === 'softwareSystemInstance'
        ? '#1e40af'
        : '#438dd5';

    let textColor = ['#85bbf0', '#38bdf8'].includes(bgColor) ? '#000000' : '#ffffff';
    let shape = elem.type === 'person' ? 'Person' : elem.type === 'container' ? 'RoundedBox' : 'Box';
    let stroke = '#ffffff';
    let strokeWidth = 1;
    let fontSize = 14;
    let border: 'solid' | 'dashed' | 'dotted' = 'solid';
    let opacity: number | undefined = undefined;
    let width: number | undefined = undefined;
    let height: number | undefined = undefined;
    let icon: string | undefined = undefined;

    // Sort tags so generic "Element" is applied first, allowing specific tags (Person, Database, etc.) to override
    const sortedTags = [...(elem.tags || [])].sort((a, b) => {
      const aIsElem = a.toLowerCase() === 'element';
      const bIsElem = b.toLowerCase() === 'element';
      if (aIsElem && !bIsElem) return -1;
      if (!aIsElem && bIsElem) return 1;
      return 0;
    });

    for (const tag of sortedTags) {
      const s = styleMap.get(tag.toLowerCase());
      if (s) {
        if (s.background) bgColor = s.background;
        if (s.color) textColor = s.color;
        if (s.shape) shape = s.shape;
        if (s.stroke) stroke = s.stroke;
        if (s.strokeWidth !== undefined && s.strokeWidth !== null) strokeWidth = s.strokeWidth;
        if (s.fontSize) fontSize = s.fontSize;
        if (s.border) border = s.border;
        if (s.opacity !== undefined && s.opacity !== null) opacity = s.opacity;
        if (s.width !== undefined && s.width !== null) width = s.width;
        if (s.height !== undefined && s.height !== null) height = s.height;
        if (s.icon) icon = s.icon;
      }
    }

    let badgeLabelOverride: string | undefined = undefined;
    if (ws.terminology) {
      if (elem.type === 'person' && ws.terminology.person) {
        badgeLabelOverride = ws.terminology.person;
      } else if (elem.type === 'softwareSystem' && ws.terminology.softwareSystem) {
        badgeLabelOverride = ws.terminology.softwareSystem;
      } else if (elem.type === 'container' && ws.terminology.container) {
        badgeLabelOverride = ws.terminology.container;
      } else if (elem.type === 'component' && ws.terminology.component) {
        badgeLabelOverride = ws.terminology.component;
      } else if (elem.type === 'deploymentNode' && ws.terminology.deploymentNode) {
        badgeLabelOverride = ws.terminology.deploymentNode;
      } else if (elem.type === 'infrastructureNode' && ws.terminology.infrastructureNode) {
        badgeLabelOverride = ws.terminology.infrastructureNode;
      }
    }

    const savedPos = view?.layoutCoordinates?.[eid] || effectiveBaseView?.layoutCoordinates?.[eid];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const position = savedPos ? { x: savedPos.x, y: savedPos.y } : { x: 50 + col * spacingX, y: 50 + row * spacingY };

    nodes.push({
      id: eid,
      type: 'c4Node',
      position,
      data: {
        id: eid,
        identifier: elem.identifier || null,
        name: elem.name,
        type: elem.type,
        description: elem.description,
        technology: elem.technology,
        shape,
        backgroundColor: bgColor,
        textColor,
        color: textColor,
        stroke,
        strokeWidth,
        fontSize,
        border,
        opacity,
        width,
        height,
        icon,
        badgeLabelOverride,
        perspectives: elem.perspectives || [],
        tags: elem.tags,
        group: elem.group || null,
        underlyingElementId: elem.underlyingElementId || null
      }
    });
    idx++;
  }

  // Generate Edges
  const edges: any[] = [];

  if (effectiveBaseView?.viewType === 'dynamic') {
    // Dynamic sequence edges
    let sIdx = 1;
    for (const step of effectiveBaseView.dynamicSteps || []) {
      const sElem = allElements[step.sourceId];
      const dElem = allElements[step.destinationId];
      if (!sElem || !dElem) continue;

      const stepNum = step.order || sIdx;
      const techBadge = step.technology ? ` [${step.technology}]` : '';
      const cleanDesc = step.description.replace(/^\d+[\.:\s-]+\s*/, '');
      const label = `${stepNum}. ${cleanDesc || step.description}${techBadge}`;

      edges.push({
        id: `dynamic_step_${sIdx}_${step.sourceId}_${step.destinationId}`,
        source: step.sourceId,
        target: step.destinationId,
        label,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#38bdf8',
          strokeWidth: 2
        },
        labelStyle: {
          fill: '#38bdf8',
          fontWeight: 600,
          fontSize: 12
        },
        data: {
          stepOrder: stepNum,
          description: step.description,
          technology: step.technology || '',
          interactionStyle: 'Dynamic',
          perspectives: []
        }
      });
      sIdx++;
    }
  } else if (effectiveBaseView?.viewType === 'deployment') {
    // Deployment view edges
    // 1. Direct relationships on infrastructure nodes or instances
    // 2. Implied relationships between deployed container instances
    const instanceLookup = new Map<string, string[]>(); // underlyingId -> array of instanceIds
    for (const [eid, elem] of Object.entries(allElements)) {
      if (elem.underlyingElementId && visibleElementIds.has(eid)) {
        if (!instanceLookup.has(elem.underlyingElementId)) instanceLookup.set(elem.underlyingElementId, []);
        instanceLookup.get(elem.underlyingElementId)!.push(eid);
      }
    }

    const edgeSeen = new Set<string>();

    for (const rel of ws.model.relationships) {
      if (isFilteredView && view) {
        const filterTags = (view.filterTags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
        const mode = (view.filterMode || 'include').toLowerCase();
        const relTags = (rel.tags || []).map((t: string) => t.toLowerCase());
        const hasMatchingTag = filterTags.some((ft) => relTags.includes(ft));

        if (mode === 'include') {
          const anyModelRelMatches = ws.model.relationships.some((r) =>
            (r.tags || []).some((rt) => filterTags.includes(rt.toLowerCase()))
          );
          if (filterTags.includes('relationship') || anyModelRelMatches) {
            if (!hasMatchingTag) continue;
          }
        } else if (mode === 'exclude') {
          if (hasMatchingTag) continue;
        }
      }

      let edgeColor = '#64748b';
      let edgeThickness = 2;
      let isDashed = false;
      let edgeOpacity: number | undefined = undefined;

      for (const tag of rel.tags || []) {
        const rs = relStyleMap.get(tag.toLowerCase());
        if (rs) {
          if (rs.color) edgeColor = rs.color;
          if (rs.thickness) edgeThickness = rs.thickness;
          if (rs.dashed !== undefined) isDashed = rs.dashed;
          if (rs.opacity !== undefined) edgeOpacity = rs.opacity;
        }
      }

      const relStyle = {
        stroke: edgeColor,
        strokeWidth: edgeThickness,
        strokeDasharray: isDashed ? '5,5' : undefined,
        opacity: edgeOpacity !== undefined ? edgeOpacity / 100 : undefined
      };

      // Check direct
      if (visibleElementIds.has(rel.sourceId) && visibleElementIds.has(rel.destinationId)) {
        const edgeKey = `${rel.sourceId}->${rel.destinationId}`;
        if (!edgeSeen.has(edgeKey)) {
          edgeSeen.add(edgeKey);
          edges.push({
            id: `edge_${rel.id}`,
            source: rel.sourceId,
            target: rel.destinationId,
            label: rel.description,
            type: 'smoothstep',
            style: relStyle,
            data: {
              id: rel.id,
              relationshipId: rel.id,
              sourceId: rel.sourceId,
              destinationId: rel.destinationId,
              sourceIdentifier: rel.sourceIdentifier,
              destinationIdentifier: rel.destinationIdentifier,
              description: rel.description,
              technology: rel.technology,
              interactionStyle: rel.interactionStyle,
              perspectives: rel.perspectives || []
            }
          });
        }
      }

      // Check instance-to-instance mapping
      const srcInstances = instanceLookup.get(rel.sourceId) || [];
      const dstInstances = instanceLookup.get(rel.destinationId) || [];
      for (const sInst of srcInstances) {
        for (const dInst of dstInstances) {
          const edgeKey = `${sInst}->${dInst}`;
          if (!edgeSeen.has(edgeKey)) {
            edgeSeen.add(edgeKey);
            edges.push({
              id: `edge_dep_${rel.id}_${sInst}_${dInst}`,
              source: sInst,
              target: dInst,
              label: rel.description,
              type: 'smoothstep',
              style: relStyle,
              data: {
                id: rel.id,
                relationshipId: rel.id,
                sourceId: rel.sourceId,
                destinationId: rel.destinationId,
                sourceIdentifier: rel.sourceIdentifier,
                destinationIdentifier: rel.destinationIdentifier,
                description: rel.description,
                technology: rel.technology,
                interactionStyle: rel.interactionStyle,
                perspectives: rel.perspectives || []
              }
            });
          }
        }
      }
    }
  } else {
    // Standard views: context, container, component, landscape
    const findVisibleRepresentative = (elemId: string): string | null => {
      if (visibleElementIds.has(elemId)) return elemId;

      if (ws.impliedRelationships === false) {
        return null;
      }

      // In container or component views, components roll up to container
      const contId = getContainerId(elemId);
      if (contId && visibleElementIds.has(contId)) return contId;

      // Then roll up to software system
      const sysId = getSystemId(elemId);
      if (sysId && visibleElementIds.has(sysId)) return sysId;

      return null;
    };

    const edgeSeen = new Set<string>();

    // Sort so direct relationships between visible elements come before rolled-up ones
    const sortedRels = [...ws.model.relationships].sort((a, b) => {
      const aDirect = visibleElementIds.has(a.sourceId) && visibleElementIds.has(a.destinationId) ? 1 : 0;
      const bDirect = visibleElementIds.has(b.sourceId) && visibleElementIds.has(b.destinationId) ? 1 : 0;
      return bDirect - aDirect;
    });

    for (const rel of sortedRels) {
      if (isFilteredView && view) {
        const filterTags = (view.filterTags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
        const mode = (view.filterMode || 'include').toLowerCase();
        const relTags = (rel.tags || []).map((t: string) => t.toLowerCase());
        const hasMatchingTag = filterTags.some((ft) => relTags.includes(ft));

        if (mode === 'include') {
          const anyModelRelMatches = ws.model.relationships.some((r) =>
            (r.tags || []).some((rt) => filterTags.includes(rt.toLowerCase()))
          );
          if (filterTags.includes('relationship') || anyModelRelMatches) {
            if (!hasMatchingTag) continue;
          }
        } else if (mode === 'exclude') {
          if (hasMatchingTag) continue;
        }
      }

      const src = findVisibleRepresentative(rel.sourceId);
      const dst = findVisibleRepresentative(rel.destinationId);

      if (src && dst && src !== dst) {
        const edgeKey = `${src}->${dst}:${rel.description}`;
        if (edgeSeen.has(edgeKey)) continue;
        edgeSeen.add(edgeKey);
        let edgeColor = '#64748b';
        let edgeThickness = 2;
        let isDashed = false;
        let edgeOpacity: number | undefined = undefined;

        for (const tag of rel.tags || []) {
          const rs = relStyleMap.get(tag.toLowerCase());
          if (rs) {
            if (rs.color) edgeColor = rs.color;
            if (rs.thickness) edgeThickness = rs.thickness;
            if (rs.dashed !== undefined) isDashed = rs.dashed;
            if (rs.opacity !== undefined) edgeOpacity = rs.opacity;
          }
        }

        const isDirect = rel.sourceId === src && rel.destinationId === dst;
        const isImplied = Boolean(rel.implied || !isDirect);
        const linkedId = rel.linkedRelationshipId || (!isDirect ? rel.id : undefined);

        edges.push({
          id: `edge_${rel.id}`,
          source: src,
          target: dst,
          label: rel.description,
          type: 'smoothstep',
          animated: rel.interactionStyle?.toLowerCase() === 'asynchronous',
          style: {
            stroke: edgeColor,
            strokeWidth: edgeThickness,
            strokeDasharray: isDashed ? '5,5' : undefined,
            opacity: edgeOpacity !== undefined ? edgeOpacity / 100 : undefined
          },
          data: {
            id: rel.id,
            relationshipId: rel.id,
            sourceId: rel.sourceId,
            destinationId: rel.destinationId,
            sourceIdentifier: rel.sourceIdentifier,
            destinationIdentifier: rel.destinationIdentifier,
            description: rel.description,
            technology: rel.technology,
            interactionStyle: rel.interactionStyle,
            implied: isImplied,
            linkedRelationshipId: linkedId,
            perspectives: rel.perspectives || []
          }
        });
      }
    }
  }

  return {
    viewKey: view ? view.key : 'Default',
    viewType: view ? view.viewType : 'systemContext',
    title: view?.title || (isFilteredView && effectiveBaseView ? `${effectiveBaseView.title || effectiveBaseView.key} - Filtered` : view?.key || ws.name),
    description: view?.description || effectiveBaseView?.description || ws.description,
    autoLayout: view?.autoLayout || effectiveBaseView?.autoLayout || 'tb',
    defaultView: ws.defaultView || ws.views.find((v) => v.isDefault)?.key || ws.views[0]?.key || 'Default',
    boundary,
    boundaries,
    nodes,
    edges,
    hasLayout: Boolean((view && Object.keys(view.layoutCoordinates || {}).length > 0) || (effectiveBaseView && Object.keys(effectiveBaseView.layoutCoordinates || {}).length > 0)),
    terminology: ws.terminology,
    availableViews: ws.views.map((v) => ({
      key: v.key,
      type: v.viewType,
      title: v.title,
      description: v.description,
      softwareSystemId: v.softwareSystemId,
      containerId: v.containerId,
      environment: v.environment,
      baseViewKey: v.baseViewKey,
      filterMode: v.filterMode,
      filterTags: v.filterTags,
      isDefault: v.isDefault || v.key === ws.defaultView
    }))
  };
}

export function exportToMermaid(ws: Workspace, viewKey?: string | null): string {
  const canvasData = compileViewToCanvas(ws, viewKey);
  const lines = ['flowchart TB'];

  const boundaries = canvasData.boundaries || (canvasData.boundary ? [canvasData.boundary] : []);
  const nodeMap = new Map<string, any>(canvasData.nodes.map((n: any) => [n.id, n]));

  const renderNode = (node: any, indent: string) => {
    const nid = node.id;
    const data = node.data;
    const name = data.name;
    const desc = data.description;
    const tech = data.technology ? ` [${data.technology}]` : '';
    const ntype = data.type.toUpperCase();

    const label = `<b>${name}</b><br/>${ntype}${tech}<br/><i>${desc}</i>`;
    return `${indent}node_${nid}["${label}"]`;
  };

  const renderedNodeIds = new Set<string>();

  const boundaryMap = new Map<string, any>(boundaries.map((b: any) => [b.id, b]));
  const childBoundariesMap = new Map<string, any[]>();
  for (const b of boundaries) {
    if (b.parentBoundaryId && boundaryMap.has(b.parentBoundaryId)) {
      if (!childBoundariesMap.has(b.parentBoundaryId)) childBoundariesMap.set(b.parentBoundaryId, []);
      childBoundariesMap.get(b.parentBoundaryId)!.push(b);
    }
  }

  const renderBoundaryMermaid = (b: any, indent: string) => {
    const tech = b.technology ? ` [${b.technology}]` : '';
    lines.push(`${indent}subgraph boundary_${b.id} ["<b>${b.name}</b><br/>[${b.type.toUpperCase()}${tech}]"]`);

    const nested = childBoundariesMap.get(b.id) || [];
    for (const nb of nested) {
      renderBoundaryMermaid(nb, indent + '    ');
    }

    for (const cid of b.childIds) {
      if (!renderedNodeIds.has(cid)) {
        const node = nodeMap.get(cid);
        if (node) {
          lines.push(renderNode(node, indent + '    '));
          renderedNodeIds.add(cid);
        }
      }
    }
    lines.push(`${indent}end`);
  };

  const rootBoundaries = boundaries.filter((b: any) => !b.parentBoundaryId || !boundaryMap.has(b.parentBoundaryId));
  for (const rb of rootBoundaries) {
    renderBoundaryMermaid(rb, '    ');
  }

  for (const node of canvasData.nodes) {
    if (!renderedNodeIds.has(node.id)) {
      lines.push(renderNode(node, '    '));
    }
  }

  for (const edge of canvasData.edges) {
    const sid = edge.source;
    const tid = edge.target;
    const label = edge.label || '';
    const tech = edge.data?.technology || '';
    const edgeLabel = tech && !label.includes(tech) ? `${label} [${tech}]` : label;
    lines.push(`    node_${sid} -->|"${edgeLabel}"| node_${tid}`);
  }

  return lines.join('\n');
}

export function exportToPlantUML(ws: Workspace, viewKey?: string | null): string {
  const canvasData = compileViewToCanvas(ws, viewKey);
  const includeUrl =
    canvasData.viewType === 'dynamic'
      ? 'https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Dynamic.puml'
      : canvasData.viewType === 'deployment'
      ? 'https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml'
      : 'https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml';

  const lines = [
    '@startuml',
    `!include ${includeUrl}`,
    `title ${canvasData.title || 'Architecture Diagram'}`,
    ''
  ];

  const boundaries = canvasData.boundaries || (canvasData.boundary ? [canvasData.boundary] : []);
  const nodeMap = new Map<string, any>(canvasData.nodes.map((n: any) => [n.id, n]));

  const renderNode = (node: any, indent = '') => {
    const nid = node.id;
    const d = node.data;
    const ntype = d.type;
    const name = d.name;
    const desc = d.description;
    const tech = d.technology || '';

    if (ntype === 'person') {
      return `${indent}Person(p_${nid}, "${name}", "${desc}")`;
    } else if (ntype === 'softwareSystem') {
      return `${indent}System(s_${nid}, "${name}", "${desc}")`;
    } else if (ntype === 'container') {
      return `${indent}Container(c_${nid}, "${name}", "${tech}", "${desc}")`;
    } else if (ntype === 'component') {
      return `${indent}Component(comp_${nid}, "${name}", "${tech}", "${desc}")`;
    } else if (ntype === 'infrastructureNode') {
      return `${indent}Node(infra_${nid}, "${name}", "${tech}", "${desc}")`;
    } else if (ntype === 'containerInstance') {
      return `${indent}Container(ci_${nid}, "${name}", "${tech}", "${desc}")`;
    } else if (ntype === 'softwareSystemInstance') {
      return `${indent}System(si_${nid}, "${name}", "${desc}")`;
    } else {
      return `${indent}System(n_${nid}, "${name}", "${desc}")`;
    }
  };

  const renderedNodeIds = new Set<string>();

  const pumlBoundaryMap = new Map<string, any>(boundaries.map((b: any) => [b.id, b]));
  const pumlChildBoundariesMap = new Map<string, any[]>();
  for (const b of boundaries) {
    if (b.parentBoundaryId && pumlBoundaryMap.has(b.parentBoundaryId)) {
      if (!pumlChildBoundariesMap.has(b.parentBoundaryId)) pumlChildBoundariesMap.set(b.parentBoundaryId, []);
      pumlChildBoundariesMap.get(b.parentBoundaryId)!.push(b);
    }
  }

  const renderBoundaryPlantUML = (b: any, indent: string) => {
    const macro =
      b.type === 'deploymentNode'
        ? 'Deployment_Node'
        : b.type === 'container'
        ? 'Container_Boundary'
        : b.type === 'group'
        ? 'Boundary'
        : 'System_Boundary';
    lines.push(`${indent}${macro}(b_${b.id}, "${b.name}") {`);

    const nested = pumlChildBoundariesMap.get(b.id) || [];
    for (const nb of nested) {
      renderBoundaryPlantUML(nb, indent + '  ');
    }

    for (const cid of b.childIds) {
      if (!renderedNodeIds.has(cid)) {
        const node = nodeMap.get(cid);
        if (node) {
          lines.push(renderNode(node, indent + '  '));
          renderedNodeIds.add(cid);
        }
      }
    }
    lines.push(`${indent}}`);
  };

  const pumlRootBoundaries = boundaries.filter((b: any) => !b.parentBoundaryId || !pumlBoundaryMap.has(b.parentBoundaryId));
  for (const rb of pumlRootBoundaries) {
    renderBoundaryPlantUML(rb, '');
  }

  for (const node of canvasData.nodes) {
    if (!renderedNodeIds.has(node.id)) {
      lines.push(renderNode(node));
    }
  }

  lines.push('');
  for (const edge of canvasData.edges) {
    const sid = edge.source;
    const tid = edge.target;
    const desc = edge.label || '';
    const tech = edge.data?.technology || '';
    lines.push(`Rel(${sid}, ${tid}, "${desc}", "${tech}")`);
  }

  lines.push('@enduml');
  return lines.join('\n');
}
