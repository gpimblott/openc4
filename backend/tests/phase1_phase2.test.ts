import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import { compileViewToCanvas, exportToMermaid, exportToPlantUML } from '../src/engine/compiler.js';

describe('Structurizr DSL Phase 1 & Phase 2 Features', () => {
  describe('Phase 1: High-Impact Compatibility & Extensions', () => {
    it('parses properties on workspace, elements, relationships, and views', () => {
      const dsl = `
      workspace "Properties Test" {
        properties {
          "org" "Acme Corp"
          environment "Production"
        }

        model {
          u = person "User" {
            properties {
              "role" "Admin"
              clearance "TopSecret"
            }
          }
          s = softwareSystem "Core System" {
            properties {
              tier "1"
              sla "99.99%"
            }
            c = container "Backend" {
              properties {
                framework "FastAPI"
              }
            }
          }

          rel = u -> s "Logs into" {
            properties {
              auth "OAuth2"
            }
          }
        }

        views {
          systemContext s "CoreContext" {
            include *
            properties {
              reviewed "true"
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.properties['org']).toBe('Acme Corp');
      expect(ws.properties['environment']).toBe('Production');

      const user = ws.model.people[0];
      expect(user.properties['role']).toBe('Admin');
      expect(user.properties['clearance']).toBe('TopSecret');

      const sys = ws.model.softwareSystems[0];
      expect(sys.properties['tier']).toBe('1');
      expect(sys.properties['sla']).toBe('99.99%');
      expect(sys.containers[0].properties['framework']).toBe('FastAPI');

      expect(ws.model.relationships[0].properties['auth']).toBe('OAuth2');
      expect(ws.views[0].properties['reviewed']).toBe('true');
    });

    it('supports block-style attributes: tag, tags, description, technology, url', () => {
      const dsl = `
      workspace "Attributes Test" {
        model {
          u = person "User" {
            description "End user of the banking app"
            tag "VIP"
            tags "Internal,Staff"
            url "https://auth.acme.com"
          }
          s = softwareSystem "Banking" {
            description "Core banking system"
            tag "Core"
            url "https://bank.acme.com"
            c = container "API" {
              description "JSON API"
              technology "Go"
              tag "Microservice"
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const user = ws.model.people[0];
      expect(user.description).toBe('End user of the banking app');
      expect(user.tags).toContain('VIP');
      expect(user.tags).toContain('Internal');
      expect(user.tags).toContain('Staff');
      expect(user.url).toBe('https://auth.acme.com');

      const sys = ws.model.softwareSystems[0];
      expect(sys.description).toBe('Core banking system');
      expect(sys.tags).toContain('Core');

      const cont = sys.containers[0];
      expect(cont.description).toBe('JSON API');
      expect(cont.technology).toBe('Go');
      expect(cont.tags).toContain('Microservice');
    });

    it('supports !element extension across models and files', () => {
      const dsl = `
      workspace "Extension Test" {
        model {
          u = person "User"
          s = softwareSystem "System"

          // Re-open element to augment it
          !element s {
            description "Updated description"
            tag "Critical"
            properties {
              owner "Architecture Team"
            }
            c = container "ExtApp" "Added via extension" "Node"
            -> u "Sends alerts to"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const sys = ws.model.softwareSystems[0];
      expect(sys.description).toBe('Updated description');
      expect(sys.tags).toContain('Critical');
      expect(sys.properties['owner']).toBe('Architecture Team');
      expect(sys.containers.length).toBe(1);
      expect(sys.containers[0].name).toBe('ExtApp');

      const alertRel = ws.model.relationships.find((r) => r.description === 'Sends alerts to');
      expect(alertRel).toBeDefined();
    });

    it('supports relationship removal with -/>', () => {
      const dsl = `
      workspace "Removal Test" {
        model {
          u = person "User"
          s1 = softwareSystem "System 1"
          s2 = softwareSystem "System 2"

          u -> s1 "Uses"
          u -> s2 "Uses"

          // Explicitly remove relationship between u and s2
          u -/> s2 "Uses"
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.model.relationships.length).toBe(1);
      expect(ws.model.relationships[0].destinationIdentifier).toBe('s1');
    });

    it('supports default keyword on views and honors default view in canvas', () => {
      const dsl = `
      workspace "Default View Test" {
        model {
          u = person "User"
          s = softwareSystem "System"
          u -> s "Uses"
        }
        views {
          systemLandscape "LandscapeView" {
            include *
          }
          systemContext s "ContextView" {
            include *
            default
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.defaultView).toBe('ContextView');
      const ctxView = ws.views.find((v) => v.key === 'ContextView');
      expect(ctxView?.isDefault).toBe(true);

      const canvas = compileViewToCanvas(ws); // No view key passed
      expect(canvas.viewKey).toBe('ContextView');
    });
  });

  describe('Phase 2: Deployment Views & Modeling', () => {
    it('parses and compiles full deployment environments, nodes, infrastructure nodes, and container instances', () => {
      const dsl = `
      workspace "Deployment Test" {
        model {
          user = person "Customer"
          sys = softwareSystem "Shop" {
            web = container "Web App" "Storefront" "React"
            api = container "API" "Backend API" "Spring Boot"
            db = container "Database" "Relational DB" "PostgreSQL"
          }

          user -> sys.web "Visits"
          sys.web -> sys.api "Calls" "HTTPS"
          sys.api -> sys.db "Reads/Writes" "JDBC"

          deploymentEnvironment "Production" {
            deploymentNode "AWS" "Cloud Provider" "AWS" {
              deploymentNode "us-east-1" "Region" "AWS Region" {
                route53 = infrastructureNode "Route 53" "DNS" "AWS Route 53"
                alb = infrastructureNode "Application Load Balancer" "Traffic distribution" "AWS ALB"

                deploymentNode "ECS Cluster" "App cluster" "Fargate" 4 {
                  containerInstance sys.web
                  containerInstance sys.api
                }

                deploymentNode "RDS" "Managed DB" "Aurora PostgreSQL" {
                  instances 2
                  containerInstance sys.db
                }
              }
            }
          }
        }

        views {
          deployment sys "Production" "ProdDeployment" "Production deployment view" {
            include *
            autoLayout lr
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.model.deploymentNodes.length).toBe(1);

      const aws = ws.model.deploymentNodes[0];
      expect(aws.name).toBe('AWS');
      expect(aws.children.length).toBe(1);

      const region = aws.children[0];
      expect(region.name).toBe('us-east-1');
      expect(region.infrastructureNodes?.length).toBe(2);
      expect(region.children.length).toBe(2);

      const ecs = region.children.find((c) => c.name === 'ECS Cluster');
      expect(ecs).toBeDefined();
      expect(ecs?.typedContainerInstances?.length).toBe(2);

      // Compile deployment view to canvas
      const canvas = compileViewToCanvas(ws, 'ProdDeployment');
      expect(canvas.viewType).toBe('deployment');

      // Verify boundaries generated for deployment nodes
      const boundaryNames = canvas.boundaries.map((b: any) => b.name);
      expect(boundaryNames).toContain('AWS');
      expect(boundaryNames).toContain('us-east-1');
      expect(boundaryNames).toContain('ECS Cluster');
      expect(boundaryNames).toContain('RDS');

      // Verify nodes on canvas: infrastructure nodes and container instances
      const nodeNames = canvas.nodes.map((n: any) => n.data.name);
      expect(nodeNames).toContain('Route 53');
      expect(nodeNames).toContain('Application Load Balancer');
      expect(nodeNames).toContain('Web App');
      expect(nodeNames).toContain('API');
      expect(nodeNames).toContain('Database');

      // Verify inter-instance replicated relationships (web -> api, api -> db)
      expect(canvas.edges.length).toBeGreaterThanOrEqual(2);

      // Verify Mermaid and PlantUML export
      const mermaid = exportToMermaid(ws, 'ProdDeployment');
      expect(mermaid).toContain('subgraph boundary_');
      expect(mermaid).toContain('Application Load Balancer');

      const puml = exportToPlantUML(ws, 'ProdDeployment');
      expect(puml).toContain('C4_Deployment.puml');
      expect(puml).toContain('Deployment_Node');
    });
  });

  describe('Phase 2: Dynamic Views', () => {
    it('parses and compiles dynamic interaction steps with sequence numbers and animated edges', () => {
      const dsl = `
      workspace "Dynamic Test" {
        model {
          customer = person "Customer"
          spa = container "Single Page App" "Frontend" "React"
          api = container "Backend API" "API" "NodeJS"
          db = container "Database" "Storage" "PostgreSQL"
        }

        views {
          dynamic * "CheckoutFlow" "Customer checkout interaction flow" {
            customer -> spa "1. Clicks checkout" "HTTPS"
            spa -> api "2. Submits order payload" "JSON/HTTPS"
            api -> db "3. Inserts order record" "SQL/TCP"
            api -> spa "4. Returns 201 Created confirmation" "JSON"
            spa -> customer "5. Displays order receipt"
            autoLayout lr
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const dynamicView = ws.views.find((v) => v.key === 'CheckoutFlow');
      expect(dynamicView).toBeDefined();
      expect(dynamicView?.dynamicSteps?.length).toBe(5);
      expect(dynamicView?.dynamicSteps?.[0].description).toBe('1. Clicks checkout');

      // Compile canvas
      const canvas = compileViewToCanvas(ws, 'CheckoutFlow');
      expect(canvas.viewType).toBe('dynamic');

      // All 4 participating elements should be present
      expect(canvas.nodes.length).toBe(4);
      expect(canvas.edges.length).toBe(5);

      // Verify dynamic edge numbering and labels
      expect(canvas.edges[0].label).toContain('1. Clicks checkout');
      expect(canvas.edges[0].animated).toBe(true);
      expect(canvas.edges[1].label).toContain('2. Submits order payload');

      // Verify export
      const mermaid = exportToMermaid(ws, 'CheckoutFlow');
      expect(mermaid).toContain('1. Clicks checkout');

      const puml = exportToPlantUML(ws, 'CheckoutFlow');
      expect(puml).toContain('C4_Dynamic.puml');
      expect(puml).toContain('1. Clicks checkout');
    });
  });

  describe('Phase 2: Expression-based include and exclude', () => {
    it('supports ->target (incoming) and target-> (outgoing) expressions', () => {
      const dsl = `
      workspace "Expression Test" {
        model {
          u = person "User"
          spa = softwareSystem "Web App"
          api = softwareSystem "API Service"
          db = softwareSystem "Database"
          thirdParty = softwareSystem "Stripe"

          u -> spa "Visits"
          spa -> api "Calls"
          api -> db "Writes"
          api -> thirdParty "Charges card"
        }

        views {
          systemContext api "ApiIncomingOutgoing" {
            include ->api
            include api->
          }

          systemContext api "ApiExclusion" {
            include *
            exclude ->thirdParty
          }
        }
      }
      `;

      const ws = parseDsl(dsl);

      // In ApiIncomingOutgoing: incoming to api (spa), api itself, outgoing from api (db, thirdParty). u should NOT be included.
      const canvas1 = compileViewToCanvas(ws, 'ApiIncomingOutgoing');
      const names1 = canvas1.nodes.map((n: any) => n.data.name);
      expect(names1).toContain('API Service');
      expect(names1).toContain('Web App');
      expect(names1).toContain('Database');
      expect(names1).toContain('Stripe');
      expect(names1).not.toContain('User');

      // In ApiExclusion: thirdParty excluded
      const canvas2 = compileViewToCanvas(ws, 'ApiExclusion');
      const names2 = canvas2.nodes.map((n: any) => n.data.name);
      expect(names2).not.toContain('Stripe');
    });

    it('supports element.tag == Tag and element.tag != Tag expressions', () => {
      const dsl = `
      workspace "Tag Expression Test" {
        model {
          u = person "User" "User" "Internal"
          extUser = person "Partner" "Partner" "External"
          sys1 = softwareSystem "Internal System" "" "Internal"
          sys2 = softwareSystem "External SaaS" "" "External"
        }

        views {
          systemLandscape "InternalOnly" {
            include "element.tag == Internal"
          }

          systemLandscape "NoExternal" {
            include *
            exclude "element.tag == External"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);

      const canvas1 = compileViewToCanvas(ws, 'InternalOnly');
      const names1 = canvas1.nodes.map((n: any) => n.data.name);
      expect(names1).toContain('User');
      expect(names1).toContain('Internal System');
      expect(names1).not.toContain('Partner');
      expect(names1).not.toContain('External SaaS');

      const canvas2 = compileViewToCanvas(ws, 'NoExternal');
      const names2 = canvas2.nodes.map((n: any) => n.data.name);
      expect(names2).toContain('User');
      expect(names2).toContain('Internal System');
      expect(names2).not.toContain('Partner');
      expect(names2).not.toContain('External SaaS');
    });
  });
});
