import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import { inspectWorkspace } from '../src/engine/inspection.js';
import { compileViewToCanvas, workspaceToStructurizrJson } from '../src/engine/compiler.js';

describe('!impliedRelationships Directive & Strategies', () => {
  describe('Parsing & Configuration', () => {
    it('parses !impliedRelationships false at workspace level', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships false
        model {
          s1 = softwareSystem "Sys1"
          s2 = softwareSystem "Sys2"
          s1 -> s2 "Calls"
        }
      }
      `;
      const ws = parseDsl(dsl);
      expect(ws.impliedRelationships).toBe(false);
      expect(ws.model.impliedRelationships).toBe(false);
      expect(ws.model.relationships).toHaveLength(1);
    });

    it('parses !impliedRelationships true at model level', () => {
      const dsl = `
      workspace "Test" {
        model {
          !impliedRelationships true
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs"
        }
      }
      `;
      const ws = parseDsl(dsl);
      expect(ws.impliedRelationships).toBe(true);
      // Original c1 -> c2 plus implied s1 -> s2
      expect(ws.model.relationships.length).toBeGreaterThan(1);
    });

    it('parses !impliedRelationships inside configuration block', () => {
      const dsl = `
      workspace "Test" {
        configuration {
          !impliedRelationships CreateImpliedRelationshipsUnlessAnyRelationshipExistsStrategy
        }
        model {
          s1 = softwareSystem "Sys1"
          s2 = softwareSystem "Sys2"
        }
      }
      `;
      const ws = parseDsl(dsl);
      expect(ws.impliedRelationships).toBe('CreateImpliedRelationshipsUnlessAnyRelationshipExistsStrategy');
    });

    it('leaves impliedRelationships undefined when omitted (backwards compatibility)', () => {
      const dsl = `
      workspace "Test" {
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs"
        }
      }
      `;
      const ws = parseDsl(dsl);
      expect(ws.impliedRelationships).toBeUndefined();
      expect(ws.model.relationships).toHaveLength(1);
    });
  });

  describe('Implied Relationship Generation', () => {
    it('generates implied ancestor relationships (Component -> Component implies Container -> Container and System -> System)', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Backend1" {
              comp1 = component "AuthComponent"
            }
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Backend2" {
              comp2 = component "UserComponent"
            }
          }
          comp1 -> comp2 "Validates token" "HTTPS"
        }
      }
      `;
      const ws = parseDsl(dsl);
      // 1 explicit: comp1 -> comp2
      // Implied:
      // - comp1 -> c2
      // - comp1 -> s2
      // - c1 -> comp2
      // - c1 -> c2
      // - c1 -> s2
      // - s1 -> comp2
      // - s1 -> c2
      // - s1 -> s2
      const comp1ToComp2 = ws.model.relationships.find(
        r => r.sourceIdentifier === 'comp1' && r.destinationIdentifier === 'comp2'
      );
      expect(comp1ToComp2).toBeDefined();
      expect(comp1ToComp2?.implied).toBeUndefined();

      const c1ToC2 = ws.model.relationships.find(
        r => r.sourceIdentifier === 'c1' && r.destinationIdentifier === 'c2'
      );
      expect(c1ToC2).toBeDefined();
      expect(c1ToC2?.implied).toBe(true);
      expect(c1ToC2?.linkedRelationshipId).toBe(comp1ToComp2?.id);
      expect(c1ToC2?.description).toBe('Validates token');
      expect(c1ToC2?.technology).toBe('HTTPS');

      const s1ToS2 = ws.model.relationships.find(
        r => r.sourceIdentifier === 's1' && r.destinationIdentifier === 's2'
      );
      expect(s1ToS2).toBeDefined();
      expect(s1ToS2?.implied).toBe(true);
      expect(s1ToS2?.linkedRelationshipId).toBe(comp1ToComp2?.id);
    });

    it('does not generate self-relationships when elements share ancestors', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s = softwareSystem "System" {
            c = container "Backend" {
              comp1 = component "Component1"
              comp2 = component "Component2"
            }
          }
          comp1 -> comp2 "Calls internal"
        }
      }
      `;
      const ws = parseDsl(dsl);
      // comp1 and comp2 share container c and softwareSystem s
      // It should NOT imply c -> c or s -> s
      const selfContainerRel = ws.model.relationships.find(
        r => r.sourceIdentifier === 'c' && r.destinationIdentifier === 'c'
      );
      expect(selfContainerRel).toBeUndefined();

      const selfSystemRel = ws.model.relationships.find(
        r => r.sourceIdentifier === 's' && r.destinationIdentifier === 's'
      );
      expect(selfSystemRel).toBeUndefined();
    });

    it('does not generate self-relationships when element points to its own ancestor', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s = softwareSystem "System" {
            c = container "Backend" {
              comp = component "Worker"
            }
          }
          comp -> c "Registers with"
        }
      }
      `;
      const ws = parseDsl(dsl);
      // comp is inside c, so it shouldn't imply c -> c or s -> s
      const selfRels = ws.model.relationships.filter(r => r.sourceId === r.destinationId);
      expect(selfRels).toHaveLength(0);
    });
  });

  describe('Strategies', () => {
    it('CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy respects identical explicit relationship', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs data"
          // Explicit system relationship with SAME description
          s1 -> s2 "Syncs data"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const s1ToS2Rels = ws.model.relationships.filter(
        r => r.sourceIdentifier === 's1' && r.destinationIdentifier === 's2'
      );
      // Should NOT duplicate s1 -> s2 because identical description exists
      expect(s1ToS2Rels).toHaveLength(1);
      expect(s1ToS2Rels[0].implied).toBeUndefined();
    });

    it('CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy creates implied if description differs', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs data"
          // Explicit system relationship with DIFFERENT description
          s1 -> s2 "Reports health"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const s1ToS2Rels = ws.model.relationships.filter(
        r => r.sourceIdentifier === 's1' && r.destinationIdentifier === 's2'
      );
      // Both explicit and implied should exist
      expect(s1ToS2Rels).toHaveLength(2);
      expect(s1ToS2Rels.some(r => r.description === 'Reports health' && !r.implied)).toBe(true);
      expect(s1ToS2Rels.some(r => r.description === 'Syncs data' && r.implied)).toBe(true);
    });

    it('CreateImpliedRelationshipsUnlessAnyRelationshipExistsStrategy suppresses if ANY relationship exists', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships CreateImpliedRelationshipsUnlessAnyRelationshipExistsStrategy
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs data"
          // Explicit system relationship with different description
          s1 -> s2 "Reports health"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const s1ToS2Rels = ws.model.relationships.filter(
        r => r.sourceIdentifier === 's1' && r.destinationIdentifier === 's2'
      );
      // With UnlessAnyRelationshipExistsStrategy, s1 -> s2 should NOT be implied because a relationship already exists
      expect(s1ToS2Rels).toHaveLength(1);
      expect(s1ToS2Rels[0].description).toBe('Reports health');
    });

    it('DefaultImpliedRelationshipStrategy always creates implied relationship regardless of duplicates', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships DefaultImpliedRelationshipStrategy
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs data"
          s1 -> s2 "Syncs data"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const s1ToS2Rels = ws.model.relationships.filter(
        r => r.sourceIdentifier === 's1' && r.destinationIdentifier === 's2'
      );
      // Default strategy creates it even when exact same relationship exists
      expect(s1ToS2Rels).toHaveLength(2);
    });
  });

  describe('Inspection Integration', () => {
    it('suppresses STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT when !impliedRelationships false', () => {
      const dsl = `
      workspace "Bank" {
        !impliedRelationships false
        model {
          system = softwareSystem "System" {
            api = container "API Application" {
              controller = component "Sign In Controller"
            }
            db = container "Database"
          }
          api -> db "Reads from and writes to" "TCP 5432"
          controller -> db "Reads from and writes to" "TCP 5432"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const findings = inspectWorkspace(ws);
      const conflict = findings.find(f => f.ruleId === 'STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT');
      expect(conflict).toBeUndefined();
    });

    it('flags STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT when implied relationships are not disabled', () => {
      const dsl = `
      workspace "Bank" {
        model {
          system = softwareSystem "System" {
            api = container "API Application" {
              controller = component "Sign In Controller"
            }
            db = container "Database"
          }
          api -> db "Reads from and writes to" "TCP 5432"
          controller -> db "Reads from and writes to" "TCP 5432"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const findings = inspectWorkspace(ws);
      const conflict = findings.find(f => f.ruleId === 'STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT');
      expect(conflict).toBeDefined();
    });
  });

  describe('Compiler & Serialization Integration', () => {
    it('serializes linkedRelationshipId and strategy in Structurizr JSON export', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs"
        }
      }
      `;
      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);
      expect(json.views.configuration.impliedRelationshipsStrategy).toBe(
        'CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy'
      );
      // Check that implied relationship has linkedRelationshipId
      const s1 = json.model.softwareSystems.find((s: any) => s.name === 'Sys1');
      expect(s1.relationships).toBeDefined();
      expect(s1.relationships[0].linkedRelationshipId).toBeDefined();
    });

    it('compiler suppresses roll-up edges when !impliedRelationships false', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships false
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs"
        }
        views {
          systemContext s1 "Context" {
            include *
          }
        }
      }
      `;
      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Context');
      // In Context view, s1 and s2 are visible, but relationship was c1 -> c2.
      // Since !impliedRelationships false, c1 and c2 do NOT roll up to s1 and s2.
      expect(canvas.edges).toHaveLength(0);
    });

    it('compiler includes edge data with implied metadata when enabled', () => {
      const dsl = `
      workspace "Test" {
        !impliedRelationships true
        model {
          s1 = softwareSystem "Sys1" {
            c1 = container "Cont1"
          }
          s2 = softwareSystem "Sys2" {
            c2 = container "Cont2"
          }
          c1 -> c2 "Syncs"
        }
        views {
          systemContext s1 "Context" {
            include *
          }
        }
      }
      `;
      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Context');
      expect(canvas.edges.length).toBeGreaterThan(0);
      const impliedEdge = canvas.edges.find(e => e.data.implied);
      expect(impliedEdge).toBeDefined();
      expect(impliedEdge?.data.linkedRelationshipId).toBeDefined();
    });
  });
});
