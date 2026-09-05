/**
 * Compiler for Structurizr AST:
 * 1. To Structurizr official JSON schema (for CLI / API interoperability)
 * 2. To React Flow diagram graph format (for live modern web canvas)
 * 3. To Mermaid and PlantUML (for export)
 */

import { Workspace, View } from './ast.js';

export function workspaceToStructurizrJson(ws: Workspace): Record<string, any> {
  // Build relationships lookup by source ID
  const relsBySource: Record<string, any[]> = {};
  for (const rel of ws.model.relationships) {
    const rJson = {
      id: rel.id,
      sourceId: rel.sourceId,
      destinationId: rel.destinationId,
      description: rel.description,
      technology: rel.technology,
      interactionStyle: rel.interactionStyle,
      tags: rel.tags.length > 0 ? rel.tags.join(',') : 'Relationship'
    };
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
    if (relsBySource[p.id]) {
      pData.relationships = relsBySource[p.id];
    }
    if (p.url) {
      pData.url = p.url;
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
        if (relsBySource[comp.id]) {
          compData.relationships = relsBySource[comp.id];
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
      if (relsBySource[c.id]) {
        cData.relationships = relsBySource[c.id];
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
    if (relsBySource[s.id]) {
      sData.relationships = relsBySource[s.id];
    }
    systemsJson.push(sData);
  }

  // Views
  const systemContextViews: any[] = [];
  const containerViews: any[] = [];
  const componentViews: any[] = [];
  const systemLandscapeViews: any[] = [];

  for (const v of ws.views) {
    const vData: Record<string, any> = {
      key: v.key,
      description: v.description,
      title: v.title,
      elements: v.includedElementIds
        .filter((eid) => eid !== '*')
        .map((eid) => ({
          id: eid,
          x: v.layoutCoordinates[eid]?.x ?? 0,
          y: v.layoutCoordinates[eid]?.y ?? 0
        })),
      relationships: []
    };

    if (v.autoLayout) {
      const directionMap: Record<string, string> = {
        tb: 'TopBottom',
        lr: 'LeftRight',
        bt: 'BottomTop',
        rl: 'RightLeft'
      };
      vData.automaticLayout = {
        implementation: 'Graphviz',
        rankDirection: directionMap[v.autoLayout.toLowerCase()] || 'TopBottom'
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
    if (es.fontSize) sDict.fontSize = es.fontSize;
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
      deploymentNodes: []
    },
    views: {
      systemLandscapeViews,
      systemContextViews,
      containerViews,
      componentViews,
      configuration: {
        styles: {
          elements: elementStylesJson,
          relationships: relStylesJson
        },
        themes: ws.themes
      }
    }
  };
}

export function compileViewToCanvas(ws: Workspace, viewKey?: string | null): Record<string, any> {
  let view: View | undefined;
  if (viewKey) {
    view = ws.views.find((v) => v.key === viewKey);
  }
  if (!view && ws.views.length > 0) {
    view = ws.views[0];
  }

  // Map all elements by ID
  const allElements: Record<string, any> = {};
  const parentMap: Record<string, string> = {};

  for (const p of ws.model.people) {
    allElements[p.id] = {
      id: p.id,
      type: 'person',
      name: p.name,
      description: p.description,
      technology: '',
      tags: p.tags,
      parentId: null
    };
  }

  for (const s of ws.model.softwareSystems) {
    allElements[s.id] = {
      id: s.id,
      type: 'softwareSystem',
      name: s.name,
      description: s.description,
      technology: '',
      tags: s.tags,
      parentId: null
    };
    for (const c of s.containers) {
      allElements[c.id] = {
        id: c.id,
        type: 'container',
        name: c.name,
        description: c.description,
        technology: c.technology,
        tags: c.tags,
        parentId: s.id
      };
      parentMap[c.id] = s.id;
      for (const comp of c.components) {
        allElements[comp.id] = {
          id: comp.id,
          type: 'component',
          name: comp.name,
          description: comp.description,
          technology: comp.technology,
          tags: comp.tags,
          parentId: c.id
        };
        parentMap[comp.id] = c.id;
      }
    }
  }

  // Helper hierarchy getters
  const getSystemId = (id: string): string | null => {
    const elem = allElements[id];
    if (!elem) return null;
    if (elem.type === 'softwareSystem') return id;
    if (elem.type === 'container') return elem.parentId;
    if (elem.type === 'component') {
      const cont = allElements[elem.parentId];
      return cont?.parentId || null;
    }
    return null;
  };

  const getContainerId = (id: string): string | null => {
    const elem = allElements[id];
    if (!elem) return null;
    if (elem.type === 'container') return id;
    if (elem.type === 'component') return elem.parentId;
    return null;
  };

  // Determine visible elements based on view
  const visibleElementIds = new Set<string>();
  if (!view || view.includeAll) {
    if (!view || view.viewType === 'systemlandscape') {
      for (const p of ws.model.people) visibleElementIds.add(p.id);
      for (const s of ws.model.softwareSystems) visibleElementIds.add(s.id);
    } else if (view.viewType === 'systemcontext') {
      const targetSysId = view.softwareSystemId;
      if (targetSysId && allElements[targetSysId]) {
        visibleElementIds.add(targetSysId);
        // Find people and software systems that have direct or implied relationships with targetSysId
        for (const rel of ws.model.relationships) {
          const sSys = getSystemId(rel.sourceId);
          const dSys = getSystemId(rel.destinationId);
          const sElem = allElements[rel.sourceId];
          const dElem = allElements[rel.destinationId];

          if (rel.sourceId === targetSysId || sSys === targetSysId) {
            if (dElem?.type === 'person') {
              visibleElementIds.add(dElem.id);
            } else if (dSys && dSys !== targetSysId) {
              visibleElementIds.add(dSys);
            }
          }
          if (rel.destinationId === targetSysId || dSys === targetSysId) {
            if (sElem?.type === 'person') {
              visibleElementIds.add(sElem.id);
            } else if (sSys && sSys !== targetSysId) {
              visibleElementIds.add(sSys);
            }
          }
        }
      } else {
        for (const p of ws.model.people) visibleElementIds.add(p.id);
        for (const s of ws.model.softwareSystems) visibleElementIds.add(s.id);
      }
    } else if (view.viewType === 'container') {
      const targetSysId = view.softwareSystemId;
      const targetSys = ws.model.softwareSystems.find((s) => s.id === targetSysId);
      if (targetSys) {
        // Add all containers of targetSys
        for (const c of targetSys.containers) {
          visibleElementIds.add(c.id);
        }
        // Add external people and software systems interacting with targetSys or its containers
        for (const rel of ws.model.relationships) {
          const sSys = getSystemId(rel.sourceId);
          const dSys = getSystemId(rel.destinationId);
          const sElem = allElements[rel.sourceId];
          const dElem = allElements[rel.destinationId];

          if (rel.sourceId === targetSysId || sSys === targetSysId) {
            if (dElem?.type === 'person') {
              visibleElementIds.add(dElem.id);
            } else if (dSys && dSys !== targetSysId) {
              visibleElementIds.add(dSys);
            }
          }
          if (rel.destinationId === targetSysId || dSys === targetSysId) {
            if (sElem?.type === 'person') {
              visibleElementIds.add(sElem.id);
            } else if (sSys && sSys !== targetSysId) {
              visibleElementIds.add(sSys);
            }
          }
        }
      }
    } else if (view.viewType === 'component') {
      const targetContId = view.containerId;
      const targetCont = allElements[targetContId || ''];
      if (targetCont) {
        const parentSysId = targetCont.parentId;
        // Add all components inside targetCont
        for (const [compId, comp] of Object.entries(allElements)) {
          if (comp.parentId === targetContId) {
            visibleElementIds.add(compId);
          }
        }
        // Add elements interacting with targetCont or its components
        for (const rel of ws.model.relationships) {
          const sCont = getContainerId(rel.sourceId);
          const dCont = getContainerId(rel.destinationId);
          const sSys = getSystemId(rel.sourceId);
          const dSys = getSystemId(rel.destinationId);
          const sElem = allElements[rel.sourceId];
          const dElem = allElements[rel.destinationId];

          const sourceIsInside = rel.sourceId === targetContId || sCont === targetContId;
          const destIsInside = rel.destinationId === targetContId || dCont === targetContId;

          if (sourceIsInside && !destIsInside) {
            if (dCont && dCont !== targetContId && dSys === parentSysId) {
              // Sibling container in same software system
              visibleElementIds.add(dCont);
            } else if (dElem?.type === 'person') {
              visibleElementIds.add(dElem.id);
            } else if (dSys && dSys !== parentSysId) {
              // External software system
              visibleElementIds.add(dSys);
            }
          } else if (destIsInside && !sourceIsInside) {
            if (sCont && sCont !== targetContId && sSys === parentSysId) {
              // Sibling container in same software system
              visibleElementIds.add(sCont);
            } else if (sElem?.type === 'person') {
              visibleElementIds.add(sElem.id);
            } else if (sSys && sSys !== parentSysId) {
              // External software system
              visibleElementIds.add(sSys);
            }
          }
        }
      }
    }
  } else {
    for (const eid of view.includedElementIds) {
      if (allElements[eid]) {
        visibleElementIds.add(eid);
      }
    }
  }

  if (view) {
    for (const eid of view.excludedElementIds) {
      visibleElementIds.delete(eid);
    }
  }

  // Determine parent boundary outlines for Container or Component views
  const boundaries: Array<{
    id: string;
    name: string;
    type: string;
    technology?: string;
    description?: string;
    childIds: string[];
    parentBoundaryId?: string | null;
  }> = [];

  if (view) {
    if (view.viewType === 'container' && view.softwareSystemId) {
      const targetSys = ws.model.softwareSystems.find((s) => s.id === view.softwareSystemId);
      if (targetSys) {
        const childIds = targetSys.containers
          .map((c) => c.id)
          .filter((id) => visibleElementIds.has(id));
        if (childIds.length > 0) {
          boundaries.push({
            id: targetSys.id,
            name: targetSys.name,
            type: 'softwareSystem',
            technology: '',
            description: targetSys.description,
            childIds,
            parentBoundaryId: null
          });
        }
      }
    } else if (view.viewType === 'component' && view.containerId) {
      const targetCont = allElements[view.containerId];
      if (targetCont) {
        const parentSysId = targetCont.parentId;
        const targetSys = parentSysId ? ws.model.softwareSystems.find((s) => s.id === parentSysId) : null;

        // Outer boundary: Software System
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
              parentBoundaryId: null
            });
          }
        }

        // Inner boundary: Container
        const compChildIds = Object.keys(allElements).filter(
          (id) => allElements[id]?.parentId === view.containerId && visibleElementIds.has(id)
        );
        if (compChildIds.length > 0) {
          boundaries.push({
            id: targetCont.id,
            name: targetCont.name,
            type: 'container',
            technology: targetCont.technology || '',
            description: targetCont.description,
            childIds: compChildIds,
            parentBoundaryId: targetSys?.id || null
          });
        }
      }
    }
  }

  const boundary = boundaries.length > 0 ? boundaries[boundaries.length - 1] : null;

  // Style mapping
  const styleMap = new Map<string, any>();
  for (const s of ws.elementStyles) {
    styleMap.set(s.tag.toLowerCase(), s);
  }

  // Generate React Flow nodes
  const nodes: any[] = [];
  let idx = 0;
  const cols = 3;
  const spacingX = 320;
  const spacingY = 220;

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
        : '#85bbf0';
    let textColor = elem.type !== 'component' ? '#ffffff' : '#000000';
    let shape = 'RoundedBox';

    for (const tag of elem.tags) {
      const tagLower = tag.toLowerCase();
      if (styleMap.has(tagLower)) {
        const st = styleMap.get(tagLower);
        if (st.background) bgColor = st.background;
        if (st.color) textColor = st.color;
        if (st.shape) shape = st.shape;
      }
    }

    const savedPos = view?.layoutCoordinates?.[eid];
    let xPos: number;
    let yPos: number;
    if (savedPos && savedPos.x !== undefined && savedPos.y !== undefined) {
      xPos = savedPos.x;
      yPos = savedPos.y;
    } else {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      xPos = 100 + col * spacingX;
      yPos = 100 + row * spacingY;
      idx += 1;
    }

    nodes.push({
      id: eid,
      type: 'c4Node',
      position: { x: xPos, y: yPos },
      data: {
        id: eid,
        identifier: elem.identifier || '',
        name: elem.name,
        description: elem.description,
        type: elem.type,
        technology: elem.technology,
        tags: elem.tags,
        backgroundColor: bgColor,
        color: textColor,
        shape
      }
    });
  }

  // Helper to map any element to its visible representative in the view
  const mapToVisible = (elemId: string, isSource: boolean): string | null => {
    if (visibleElementIds.has(elemId)) return elemId;

    const elem = allElements[elemId];
    if (!elem) return null;

    // In component view: if elemId is the target container itself
    if (view?.viewType === 'component' && elemId === view.containerId) {
      const compIds = Array.from(visibleElementIds).filter((id) => allElements[id]?.parentId === elemId);
      if (compIds.length > 0) {
        if (!isSource) {
          const controller = compIds.find(
            (id) => allElements[id]?.name.toLowerCase().includes('controller') || allElements[id]?.name.toLowerCase().includes('signin')
          );
          return controller || compIds[0];
        } else {
          const service = compIds.find((id) => allElements[id]?.name.toLowerCase().includes('service'));
          return service || compIds[compIds.length - 1];
        }
      }
    }

    // Try container
    const contId = getContainerId(elemId);
    if (contId && visibleElementIds.has(contId)) return contId;

    // Try software system
    const sysId = getSystemId(elemId);
    if (sysId && visibleElementIds.has(sysId)) return sysId;

    return null;
  };

  // Generate React Flow edges with roll-up and deduplication
  const edges: any[] = [];
  const edgeKeySet = new Set<string>();

  for (const rel of ws.model.relationships) {
    const sVis = mapToVisible(rel.sourceId, true);
    const dVis = mapToVisible(rel.destinationId, false);

    if (sVis && dVis && sVis !== dVis) {
      const dedupKey = `${sVis}->${dVis}:${rel.description || ''}`;
      if (!edgeKeySet.has(dedupKey)) {
        edgeKeySet.add(dedupKey);
        const relStyle = ws.relationshipStyles?.find((rs) => rel.tags.some((t: string) => t.toLowerCase() === rs.tag.toLowerCase()));
        const strokeColor = relStyle?.color || '#94a3b8';
        const strokeWidth = relStyle?.thickness || 2;
        const isDashed = relStyle?.dashed ?? false;

        edges.push({
          id: `e-${rel.id}`,
          source: sVis,
          target: dVis,
          label: rel.description,
          data: {
            id: rel.id,
            sourceId: sVis,
            destinationId: dVis,
            originalSourceId: rel.sourceId,
            originalDestinationId: rel.destinationId,
            description: rel.description,
            technology: rel.technology,
            tags: rel.tags
          },
          animated: rel.tags.map((t: string) => t.toLowerCase()).includes('asynchronous'),
          style: {
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: isDashed ? '5 5' : undefined
          },
          markerEnd: {
            type: 'arrowclosed',
            color: strokeColor,
            width: 18,
            height: 18
          }
        });
      }
    }
  }

  return {
    viewKey: view ? view.key : 'Default',
    viewType: view ? view.viewType : 'systemContext',
    title: view ? view.title : ws.name,
    description: view ? view.description : ws.description,
    autoLayout: view?.autoLayout || 'tb',
    boundary,
    boundaries,
    nodes,
    edges,
    availableViews: ws.views.map((v) => ({
      key: v.key,
      type: v.viewType,
      title: v.title,
      description: v.description
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

  if (boundaries.length === 2 && boundaries[1].parentBoundaryId === boundaries[0].id) {
    const sysB = boundaries[0];
    const contB = boundaries[1];
    const contChildSet = new Set(contB.childIds);

    lines.push(`    subgraph boundary_${sysB.id} ["<b>${sysB.name}</b><br/>[${sysB.type.toUpperCase()}]"]`);

    // Nested container subgraph
    const tech = contB.technology ? ` [${contB.technology}]` : '';
    lines.push(`        subgraph boundary_${contB.id} ["<b>${contB.name}</b><br/>[${contB.type.toUpperCase()}${tech}]"]`);
    for (const cid of contB.childIds) {
      const node = nodeMap.get(cid);
      if (node) {
        lines.push(renderNode(node, '            '));
        renderedNodeIds.add(cid);
      }
    }
    lines.push('        end');

    // Sibling elements inside system but outside container
    for (const cid of sysB.childIds) {
      if (!contChildSet.has(cid)) {
        const node = nodeMap.get(cid);
        if (node) {
          lines.push(renderNode(node, '        '));
          renderedNodeIds.add(cid);
        }
      }
    }

    lines.push('    end');
  } else {
    for (const b of boundaries) {
      const tech = b.technology ? ` [${b.technology}]` : '';
      lines.push(`    subgraph boundary_${b.id} ["<b>${b.name}</b><br/>[${b.type.toUpperCase()}${tech}]"]`);
      for (const cid of b.childIds) {
        const node = nodeMap.get(cid);
        if (node && !renderedNodeIds.has(cid)) {
          lines.push(renderNode(node, '        '));
          renderedNodeIds.add(cid);
        }
      }
      lines.push('    end');
    }
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
    const edgeLabel = tech ? `${label} [${tech}]` : label;
    lines.push(`    node_${sid} -->|"${edgeLabel}"| node_${tid}`);
  }

  return lines.join('\n');
}

export function exportToPlantUML(ws: Workspace, viewKey?: string | null): string {
  const canvasData = compileViewToCanvas(ws, viewKey);
  const lines = [
    '@startuml',
    '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml',
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
    } else {
      return `${indent}System(n_${nid}, "${name}", "${desc}")`;
    }
  };

  const renderedNodeIds = new Set<string>();

  if (boundaries.length === 2 && boundaries[1].parentBoundaryId === boundaries[0].id) {
    const sysB = boundaries[0];
    const contB = boundaries[1];
    const contChildSet = new Set(contB.childIds);

    lines.push(`System_Boundary(b_${sysB.id}, "${sysB.name}") {`);
    lines.push(`  Container_Boundary(b_${contB.id}, "${contB.name}") {`);
    for (const cid of contB.childIds) {
      const node = nodeMap.get(cid);
      if (node) {
        lines.push(renderNode(node, '    '));
        renderedNodeIds.add(cid);
      }
    }
    lines.push('  }');

    for (const cid of sysB.childIds) {
      if (!contChildSet.has(cid)) {
        const node = nodeMap.get(cid);
        if (node) {
          lines.push(renderNode(node, '  '));
          renderedNodeIds.add(cid);
        }
      }
    }
    lines.push('}');
  } else {
    for (const b of boundaries) {
      const macro = b.type === 'container' ? 'Container_Boundary' : 'System_Boundary';
      lines.push(`${macro}(b_${b.id}, "${b.name}") {`);
      for (const cid of b.childIds) {
        const node = nodeMap.get(cid);
        if (node && !renderedNodeIds.has(cid)) {
          lines.push(renderNode(node, '  '));
          renderedNodeIds.add(cid);
        }
      }
      lines.push('}');
    }
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
