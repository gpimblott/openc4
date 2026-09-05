/**
 * Visual and semantic diff engine for C4 architecture workspaces.
 * Compares two versions of a workspace to identify added, modified, and removed elements and relationships.
 */

export interface ElementDiff {
  key: string;
  name: string;
  type: string;
  changeType: 'ADDED' | 'MODIFIED' | 'REMOVED';
  changes?: string[];
  details: Record<string, any>;
}

export interface DiffResult {
  summary: {
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
  };
  addedElements: ElementDiff[];
  modifiedElements: ElementDiff[];
  removedElements: ElementDiff[];
}

export function diffWorkspaces(
  oldWs: Record<string, any> = {},
  newWs: Record<string, any> = {}
): DiffResult {
  const oldModel = oldWs.model || {};
  const newModel = newWs.model || {};

  function extractElements(model: Record<string, any>): Record<string, Record<string, any>> {
    const elems: Record<string, Record<string, any>> = {};
    for (const p of model.people || []) {
      elems[`person:${p.name}`] = { ...p, type: 'person' };
    }
    for (const s of model.softwareSystems || []) {
      elems[`system:${s.name}`] = { ...s, type: 'softwareSystem' };
      for (const c of s.containers || []) {
        elems[`container:${s.name}.${c.name}`] = { ...c, type: 'container', system: s.name };
        for (const comp of c.components || []) {
          elems[`component:${s.name}.${c.name}.${comp.name}`] = { ...comp, type: 'component' };
        }
      }
    }
    return elems;
  }

  const oldElems = extractElements(oldModel);
  const newElems = extractElements(newModel);

  const addedElements: ElementDiff[] = [];
  const removedElements: ElementDiff[] = [];
  const modifiedElements: ElementDiff[] = [];

  for (const [key, elem] of Object.entries(newElems)) {
    if (!oldElems[key]) {
      addedElements.push({
        key,
        name: elem.name,
        type: elem.type,
        changeType: 'ADDED',
        details: elem
      });
    } else {
      const oldItem = oldElems[key];
      const changes: string[] = [];
      if (oldItem.description !== elem.description) {
        changes.push(`Description changed: '${oldItem.description || ''}' -> '${elem.description || ''}'`);
      }
      if (oldItem.technology !== elem.technology) {
        changes.push(`Technology changed: '${oldItem.technology || ''}' -> '${elem.technology || ''}'`);
      }

      if (changes.length > 0) {
        modifiedElements.push({
          key,
          name: elem.name,
          type: elem.type,
          changeType: 'MODIFIED',
          changes,
          details: elem
        });
      }
    }
  }

  for (const [key, elem] of Object.entries(oldElems)) {
    if (!newElems[key]) {
      removedElements.push({
        key,
        name: elem.name,
        type: elem.type,
        changeType: 'REMOVED',
        details: elem
      });
    }
  }

  return {
    summary: {
      addedCount: addedElements.length,
      modifiedCount: modifiedElements.length,
      removedCount: removedElements.length
    },
    addedElements,
    modifiedElements,
    removedElements
  };
}
