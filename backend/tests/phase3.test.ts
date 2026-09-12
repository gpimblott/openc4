import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import {
  compileViewToCanvas,
  workspaceToStructurizrJson
} from '../src/engine/compiler.js';
import {
  resolveThemesSync,
  resolveThemes,
  ThemeResolver
} from '../src/engine/themes.js';

describe('Structurizr DSL Phase 3 Features', () => {
  describe('Filtered Views', () => {
    it('parses filtered views with include and exclude modes', () => {
      const dsl = `
      workspace "Filtered View Test" {
        model {
          u = person "User" "End user" "v1"
          admin = person "Admin" "Administrator" "v2"
          sys = softwareSystem "Core System" "Main system" "v1"
          legacy = softwareSystem "Legacy System" "Older system" "v2"

          u -> sys "Uses" "v1"
          admin -> legacy "Manages" "v2"
        }

        views {
          systemLandscape "Landscape" {
            include *
          }

          filtered "Landscape" include "v1" "V1Only" "Displays only v1 elements"
          filtered "Landscape" exclude "v2" "NoV2" "Excludes v2 elements"
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.views.length).toBe(3);

      const v1View = ws.views.find((v) => v.key === 'V1Only');
      expect(v1View).toBeDefined();
      expect(v1View?.viewType).toBe('filtered');
      expect(v1View?.baseViewKey).toBe('Landscape');
      expect(v1View?.filterMode).toBe('include');
      expect(v1View?.filterTags).toEqual(['v1']);
      expect(v1View?.description).toBe('Displays only v1 elements');

      const noV2View = ws.views.find((v) => v.key === 'NoV2');
      expect(noV2View).toBeDefined();
      expect(noV2View?.filterMode).toBe('exclude');
      expect(noV2View?.filterTags).toEqual(['v2']);
    });

    it('compiles canvas for filtered include view', () => {
      const dsl = `
      workspace "Filtered Canvas Test" {
        model {
          u = person "User" "End user" "v1"
          admin = person "Admin" "Administrator" "v2"
          sys = softwareSystem "Core System" "Main system" "v1"
          legacy = softwareSystem "Legacy System" "Older system" "v2"

          u -> sys "Uses" "v1"
          admin -> legacy "Manages" "v2"
        }

        views {
          systemLandscape "Landscape" {
            include *
          }

          filtered "Landscape" include "v1" "V1Only" "Only V1"
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'V1Only');

      expect(canvas.viewKey).toBe('V1Only');
      expect(canvas.viewType).toBe('filtered');
      // Only u and sys should be present in nodes
      const nodeNames = canvas.nodes.map((n: any) => n.data.name);
      expect(nodeNames).toContain('User');
      expect(nodeNames).toContain('Core System');
      expect(nodeNames).not.toContain('Admin');
      expect(nodeNames).not.toContain('Legacy System');

      // Only u -> sys edge should be present
      expect(canvas.edges.length).toBe(1);
      expect(canvas.edges[0].label).toBe('Uses');
    });

    it('compiles canvas for filtered exclude view', () => {
      const dsl = `
      workspace "Filtered Exclude Canvas Test" {
        model {
          u = person "User" "End user" "v1"
          admin = person "Admin" "Administrator" "v2"
          sys = softwareSystem "Core System" "Main system" "v1"

          u -> sys "Uses"
          admin -> sys "Administers"
        }

        views {
          systemLandscape "Landscape" {
            include *
          }

          filtered "Landscape" exclude "v2" "NoV2" "Excludes v2"
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'NoV2');

      const nodeNames = canvas.nodes.map((n: any) => n.data.name);
      expect(nodeNames).toContain('User');
      expect(nodeNames).toContain('Core System');
      expect(nodeNames).not.toContain('Admin');
    });

    it('exports filtered views in Structurizr JSON format', () => {
      const dsl = `
      workspace "JSON Export Filtered" {
        model {
          s = softwareSystem "System"
        }
        views {
          systemContext s "Context" {
            include *
          }
          filtered "Context" include "v1,v2" "FilteredContext" "Filtered by v1 and v2"
        }
      }
      `;

      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);

      expect(json.views.filteredViews).toBeDefined();
      expect(json.views.filteredViews.length).toBe(1);
      const fView = json.views.filteredViews[0];
      expect(fView.key).toBe('FilteredContext');
      expect(fView.baseViewKey).toBe('Context');
      expect(fView.mode).toBe('Include');
      expect(fView.tags).toEqual(['v1', 'v2']);
      expect(fView.description).toBe('Filtered by v1 and v2');
    });
  });

  describe('Perspectives', () => {
    it('parses perspectives using single-line syntax on elements and relationships', () => {
      const dsl = `
      workspace "Perspectives Test 1" {
        model {
          u = person "User" {
            perspectives {
              "Security" "Multi-factor authentication enabled" "MFA"
              Performance "P99 < 50ms"
            }
          }

          s = softwareSystem "Payment Service" {
            perspectives {
              "PCI-DSS" "Compliant with Level 1" "Tier 1"
            }
          }

          rel = u -> s "Sends Payment" {
            perspectives {
              "Encryption" "TLS 1.3 in transit" "Strong"
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const user = ws.model.people[0];
      expect(user.perspectives).toBeDefined();
      expect(user.perspectives?.length).toBe(2);
      expect(user.perspectives?.[0]).toEqual({
        name: 'Security',
        description: 'Multi-factor authentication enabled',
        value: 'MFA'
      });
      expect(user.perspectives?.[1]).toEqual({
        name: 'Performance',
        description: 'P99 < 50ms',
        value: undefined
      });

      const sys = ws.model.softwareSystems[0];
      expect(sys.perspectives?.[0]).toEqual({
        name: 'PCI-DSS',
        description: 'Compliant with Level 1',
        value: 'Tier 1'
      });

      const rel = ws.model.relationships[0];
      expect(rel.perspectives?.[0]).toEqual({
        name: 'Encryption',
        description: 'TLS 1.3 in transit',
        value: 'Strong'
      });
    });

    it('parses perspectives using block syntax', () => {
      const dsl = `
      workspace "Perspectives Block Test" {
        model {
          s = softwareSystem "Banking System" {
            perspectives {
              perspective "Reliability" {
                description "99.999% uptime availability"
                value "Tier-0"
              }
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const sys = ws.model.softwareSystems[0];
      expect(sys.perspectives?.length).toBe(1);
      expect(sys.perspectives?.[0]).toEqual({
        name: 'Reliability',
        description: '99.999% uptime availability',
        value: 'Tier-0'
      });
    });

    it('propagates perspectives into canvas node and edge data', () => {
      const dsl = `
      workspace "Perspectives Canvas Test" {
        model {
          u = person "Customer" {
            perspectives {
              "KYC" "Verified Customer" "Tier 2"
            }
          }
          s = softwareSystem "Core System"

          u -> s "Transacts" {
            perspectives {
              "Audit" "Logged to SIEM"
            }
          }
        }
        views {
          systemLandscape "Landscape" {
            include *
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Landscape');

      const userNode = canvas.nodes.find((n: any) => n.data.name === 'Customer');
      expect(userNode.data.perspectives).toBeDefined();
      expect(userNode.data.perspectives[0].name).toBe('KYC');
      expect(userNode.data.perspectives[0].value).toBe('Tier 2');

      expect(canvas.edges.length).toBe(1);
      expect(canvas.edges[0].data.perspectives[0].name).toBe('Audit');
    });

    it('serializes perspectives in Structurizr JSON', () => {
      const dsl = `
      workspace "Perspectives JSON Test" {
        model {
          u = person "User" {
            perspectives {
              "Role" "Staff Member" "Staff"
            }
          }
          s = softwareSystem "Portal"
          u -> s "Visits" {
            perspectives {
              "Channel" "Web UI" "Browser"
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);

      const personJson = json.model.people[0];
      expect(personJson.perspectives).toBeDefined();
      expect(personJson.perspectives[0].name).toBe('Role');

      const relJson = personJson.relationships[0];
      expect(relJson.perspectives).toBeDefined();
      expect(relJson.perspectives[0].name).toBe('Channel');
    });
  });

  describe('Terminology', () => {
    it('parses terminology overrides at workspace level', () => {
      const dsl = `
      workspace "Terminology Test" {
        terminology {
          person "Actor"
          softwareSystem "Platform"
          container "Microservice"
          component "Module"
          relationship "Communicates with"
        }
        model {
          u = person "Buyer"
          s = softwareSystem "Shop"
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.terminology).toBeDefined();
      expect(ws.terminology?.person).toBe('Actor');
      expect(ws.terminology?.softwareSystem).toBe('Platform');
      expect(ws.terminology?.container).toBe('Microservice');
      expect(ws.terminology?.component).toBe('Module');
      expect(ws.terminology?.relationship).toBe('Communicates with');
    });

    it('applies badgeLabelOverride in canvas node data', () => {
      const dsl = `
      workspace "Terminology Canvas" {
        terminology {
          person "Customer Role"
          container "Worker"
        }
        model {
          u = person "User"
          s = softwareSystem "App" {
            c = container "Job Processor" "" "Node.js"
          }
        }
        views {
          container s "Containers" {
            include *
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Containers');

      const containerNode = canvas.nodes.find((n: any) => n.data.name === 'Job Processor');
      expect(containerNode.data.badgeLabelOverride).toBe('Worker');

      expect(canvas.terminology?.person).toBe('Customer Role');
      expect(canvas.terminology?.container).toBe('Worker');
    });

    it('serializes terminology in Structurizr JSON configuration', () => {
      const dsl = `
      workspace "Terminology JSON" {
        terminology {
          person "Actor"
          softwareSystem "Solution"
        }
        model {
          u = person "User"
        }
      }
      `;

      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);

      expect(json.views.configuration.terminology).toBeDefined();
      expect(json.views.configuration.terminology.person).toBe('Actor');
      expect(json.views.configuration.terminology.softwareSystem).toBe('Solution');
    });
  });

  describe('Extended Styles', () => {
    it('parses border, opacity, icon, width, height, colour, and mode blocks', () => {
      const dsl = `
      workspace "Styles Test" {
        model {
          u = person "User"
          s = softwareSystem "System"
          u -> s "Uses"
        }
        views {
          styles {
            element "Person" {
              border dashed
              opacity 80
              width 350
              height 250
              icon "https://example.com/icon.png"
              colour #ff0000
            }

            relationship "Relationship" {
              opacity 60
            }

            dark {
              element "System" {
                background #1e293b
                color #ffffff
              }
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const pStyle = ws.elementStyles.find((s) => s.tag === 'Person');
      expect(pStyle).toBeDefined();
      expect(pStyle?.border).toBe('dashed');
      expect(pStyle?.opacity).toBe(80);
      expect(pStyle?.width).toBe(350);
      expect(pStyle?.height).toBe(250);
      expect(pStyle?.icon).toBe('https://example.com/icon.png');
      expect(pStyle?.color).toBe('#ff0000');

      const rStyle = ws.relationshipStyles.find((s) => s.tag === 'Relationship');
      expect(rStyle).toBeDefined();
      expect(rStyle?.opacity).toBe(60);

      const darkStyle = ws.elementStyles.find((s) => s.tag === 'System' && s.mode === 'dark');
      expect(darkStyle).toBeDefined();
      expect(darkStyle?.background).toBe('#1e293b');
    });

    it('attaches extended styles to canvas nodes and edges', () => {
      const dsl = `
      workspace "Canvas Styles Test" {
        model {
          u = person "User"
          s = softwareSystem "System"
          u -> s "Calls"
        }
        views {
          systemLandscape "Landscape" {
            include *
          }
          styles {
            element "Person" {
              border dotted
              opacity 75
              icon "data:image/svg+xml;utf8,<svg></svg>"
              width 300
              height 180
            }
            relationship "Relationship" {
              opacity 50
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Landscape');

      const userNode = canvas.nodes.find((n: any) => n.data.name === 'User');
      expect(userNode.data.border).toBe('dotted');
      expect(userNode.data.opacity).toBe(75);
      expect(userNode.data.icon).toBe('data:image/svg+xml;utf8,<svg></svg>');
      expect(userNode.data.width).toBe(300);
      expect(userNode.data.height).toBe(180);

      expect(canvas.edges.length).toBe(1);
      expect(canvas.edges[0].style.opacity).toBe(0.5);
    });

    it('exports extended styles in Structurizr JSON', () => {
      const dsl = `
      workspace "JSON Styles Test" {
        model {
          s = softwareSystem "System"
        }
        views {
          styles {
            element "Element" {
              border dashed
              opacity 90
              icon "https://cdn.example.com/logo.png"
              width 400
              height 300
            }
            relationship "Relationship" {
              opacity 70
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);

      const elemStyle = json.views.configuration.styles.elements[0];
      expect(elemStyle.border).toBe('dashed');
      expect(elemStyle.opacity).toBe(90);
      expect(elemStyle.icon).toBe('https://cdn.example.com/logo.png');
      expect(elemStyle.width).toBe(400);
      expect(elemStyle.height).toBe(300);

      const relStyle = json.views.configuration.styles.relationships[0];
      expect(relStyle.opacity).toBe(70);
    });
  });

  describe('Theme Resolution', () => {
    it('resolves built-in theme aliases synchronously', () => {
      const dsl = `
      workspace "Built-in Themes" {
        model {
          u = person "User"
          s = softwareSystem "System"
        }
        views {
          theme default
          themes aws azure
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.themes).toContain('default');
      expect(ws.themes).toContain('aws');
      expect(ws.themes).toContain('azure');

      // Resolve themes synchronously
      resolveThemesSync(ws);

      // Verify built-in styles got merged
      const personStyle = ws.elementStyles.find((s) => s.tag.toLowerCase() === 'person');
      expect(personStyle).toBeDefined();
      expect(personStyle?.shape).toBe('Person');
      expect(personStyle?.background).toBe('#08427b');

      const systemStyle = ws.elementStyles.find((s) => s.tag.toLowerCase() === 'software system');
      expect(systemStyle).toBeDefined();
      expect(systemStyle?.background).toBe('#1168bd');
    });

    it('ensures user explicit styles take precedence over theme styles', () => {
      const dsl = `
      workspace "Theme Precedence Test" {
        model {
          u = person "User"
        }
        views {
          theme default
          styles {
            element "Person" {
              background #e11d48
              color #ffffff
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      resolveThemesSync(ws);

      // Person background should remain #e11d48 (user precedence), but shape 'Person' from theme fills in
      const personStyle = ws.elementStyles.find((s) => s.tag.toLowerCase() === 'person');
      expect(personStyle?.background).toBe('#e11d48');
      expect(personStyle?.shape).toBe('Person');
    });

    it('resolves themes asynchronously without failing on remote mock URLs', async () => {
      const dsl = `
      workspace "Async Themes" {
        model {
          u = person "User"
        }
        views {
          theme "https://example.com/nonexistent-theme.json"
        }
      }
      `;

      const ws = parseDsl(dsl);
      // Should gracefully handle network or 404 without throwing
      await expect(resolveThemes(ws)).resolves.not.toThrow();
    });

    it('automatically resolves themes in compileViewToCanvas', () => {
      const dsl = `
      workspace "Compile Auto Theme" {
        model {
          u = person "User"
          s = softwareSystem "System"
        }
        views {
          systemLandscape "Landscape" {
            include *
          }
          theme default
        }
      }
      `;

      const ws = parseDsl(dsl);
      // Even without calling resolveThemes explicitly beforehand:
      const canvas = compileViewToCanvas(ws, 'Landscape');

      const userNode = canvas.nodes.find((n: any) => n.data.name === 'User');
      expect(userNode.data.shape).toBe('Person');
      expect(userNode.data.backgroundColor).toBe('#08427b');
    });
  });
});
