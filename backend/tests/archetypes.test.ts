import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import { workspaceToStructurizrJson, compileViewToCanvas } from '../src/engine/compiler.js';
import { addRelationshipToDsl, updateRelationshipInDsl } from '../src/engine/modifier.js';
import { inspectWorkspace } from '../src/engine/inspection.js';

describe('Structurizr DSL Archetypes', () => {
  describe('Element Archetypes', () => {
    it('parses basic alias archetypes without blocks', () => {
      const dsl = `
      workspace "Test" {
        archetypes {
          user = person
          microservice = container
        }
        model {
          customer = user "Customer" "A retail customer"
          ss = softwareSystem "System" {
            api = microservice "Order Service" "Handles orders"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.archetypes.elements['user']).toBeDefined();
      expect(ws.archetypes.elements['user'].resolvedBaseType).toBe('person');
      expect(ws.archetypes.elements['microservice']).toBeDefined();
      expect(ws.archetypes.elements['microservice'].resolvedBaseType).toBe('container');

      expect(ws.model.people.length).toBe(1);
      expect(ws.model.people[0].name).toBe('Customer');
      expect(ws.model.people[0].archetype).toBe('user');

      expect(ws.model.softwareSystems[0].containers.length).toBe(1);
      const c = ws.model.softwareSystems[0].containers[0];
      expect(c.name).toBe('Order Service');
      expect(c.archetype).toBe('microservice');
    });

    it('parses element archetypes with defaults: technology, description, tags, properties, perspectives', () => {
      const dsl = `
      workspace "Test" {
        model {
          archetypes {
            springBoot = container {
              technology "Java and Spring Boot"
              description "Default backend service"
              tag "Backend"
              tags "Microservice, JVM"
              properties {
                "framework" "spring-boot"
                "java.version" "21"
              }
              perspectives {
                "Security" "OAuth2 protected" "Tier-1"
              }
            }
          }
          ss = softwareSystem "E-Commerce" {
            svc1 = springBoot "Payment Service"
            svc2 = springBoot "Inventory Service" "Custom inventory desc" "Kotlin and Spring Boot" "InventoryTag"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const arch = ws.model.archetypes?.elements['springBoot'];
      expect(arch).toBeDefined();
      expect(arch?.technology).toBe('Java and Spring Boot');
      expect(arch?.description).toBe('Default backend service');
      expect(arch?.tags).toContain('Backend');
      expect(arch?.tags).toContain('Microservice');
      expect(arch?.tags).toContain('JVM');
      expect(arch?.properties?.['framework']).toBe('spring-boot');

      const containers = ws.model.softwareSystems[0].containers;
      expect(containers.length).toBe(2);

      // svc1 uses archetype defaults
      expect(containers[0].name).toBe('Payment Service');
      expect(containers[0].description).toBe('Default backend service');
      expect(containers[0].technology).toBe('Java and Spring Boot');
      expect(containers[0].tags).toContain('Backend');
      expect(containers[0].tags).toContain('Microservice');
      expect(containers[0].tags).toContain('JVM');
      expect(containers[0].properties['framework']).toBe('spring-boot');
      expect(containers[0].perspectives?.[0].name).toBe('Security');
      expect(containers[0].archetype).toBe('springBoot');

      // svc2 overrides description and technology, and adds tags
      expect(containers[1].name).toBe('Inventory Service');
      expect(containers[1].description).toBe('Custom inventory desc');
      expect(containers[1].technology).toBe('Kotlin and Spring Boot');
      expect(containers[1].tags).toContain('InventoryTag');
      expect(containers[1].tags).toContain('Backend');
      expect(containers[1].properties['framework']).toBe('spring-boot');
    });

    it('supports element archetype inheritance', () => {
      const dsl = `
      workspace "Test" {
        archetypes {
          application = container {
            tag "App"
            properties {
              "layer" "application"
            }
          }
          springBoot = application {
            technology "Spring Boot 3"
            tag "Spring"
            properties {
              "runtime" "JVM"
            }
          }
        }
        model {
          ss = softwareSystem "System" {
            backend = springBoot "API Gateway"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const springArch = ws.archetypes.elements['springBoot'];
      expect(springArch.resolvedBaseType).toBe('container');
      expect(springArch.technology).toBe('Spring Boot 3');
      expect(springArch.tags).toContain('App');
      expect(springArch.tags).toContain('Spring');
      expect(springArch.properties?.['layer']).toBe('application');
      expect(springArch.properties?.['runtime']).toBe('JVM');

      const cont = ws.model.softwareSystems[0].containers[0];
      expect(cont.name).toBe('API Gateway');
      expect(cont.technology).toBe('Spring Boot 3');
      expect(cont.tags).toContain('App');
      expect(cont.tags).toContain('Spring');
      expect(cont.properties['layer']).toBe('application');
      expect(cont.properties['runtime']).toBe('JVM');
    });

    it('supports all valid base types: person, softwareSystem, container, component, deploymentNode, infrastructureNode, group, element', () => {
      const dsl = `
      workspace "All Base Types" {
        archetypes {
          employee = person
          platform = softwareSystem
          service = container
          controller = component
          cluster = deploymentNode
          gateway = infrastructureNode
          domain = group
          externalService = element {
            metadata "SaaS"
            description "Third-party external SaaS service"
          }
        }
        model {
          domain "Core Banking" {
            p = employee "Banker"
            sys = platform "Core Engine" {
              svc = service "Core API" {
                ctrl = controller "Account Controller"
              }
            }
            ext = externalService "Stripe"
          }
          live = deploymentEnvironment "Production" {
            k8s = cluster "EKS Cluster" {
              gw = gateway "Envoy Gateway"
            }
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.model.people[0].archetype).toBe('employee');
      expect(ws.model.softwareSystems[0].archetype).toBe('platform');
      expect(ws.model.softwareSystems[0].containers[0].archetype).toBe('service');
      expect(ws.model.softwareSystems[0].containers[0].components[0].archetype).toBe('controller');
      expect(ws.model.deploymentNodes[0].archetype).toBe('cluster');
      expect(ws.model.deploymentNodes[0].infrastructureNodes[0].archetype).toBe('gateway');

      // Custom element
      expect(ws.model.customElements).toBeDefined();
      expect(ws.model.customElements?.length).toBe(1);
      const ext = ws.model.customElements![0];
      expect(ext.name).toBe('Stripe');
      expect(ext.metadata).toBe('SaaS');
      expect(ext.description).toBe('Third-party external SaaS service');
      expect(ext.archetype).toBe('externalService');
    });
  });

  describe('Relationship Archetypes', () => {
    it('parses basic relationship archetypes and extended relationship archetypes', () => {
      const dsl = `
      workspace "Rel Archetypes" {
        archetypes {
          sync = -> {
            tags "Synchronous"
            properties {
              "sync" "true"
            }
          }
          https = --sync-> {
            technology "HTTPS"
            tags "Encrypted"
            properties {
              "port" "443"
            }
          }
        }
        model {
          user = person "User"
          sys = softwareSystem "System"
          user --https-> sys "Uses"
        }
      }
      `;

      const ws = parseDsl(dsl);
      const relArch = ws.archetypes.relationships['https'];
      expect(relArch).toBeDefined();
      expect(relArch.technology).toBe('HTTPS');
      expect(relArch.tags).toContain('Synchronous');
      expect(relArch.tags).toContain('Encrypted');
      expect(relArch.properties?.['sync']).toBe('true');
      expect(relArch.properties?.['port']).toBe('443');

      expect(ws.model.relationships.length).toBe(1);
      const rel = ws.model.relationships[0];
      expect(rel.sourceIdentifier).toBe('user');
      expect(rel.destinationIdentifier).toBe('sys');
      expect(rel.description).toBe('Uses');
      expect(rel.technology).toBe('HTTPS');
      expect(rel.archetype).toBe('https');
      expect(rel.tags).toContain('Relationship');
      expect(rel.tags).toContain('Synchronous');
      expect(rel.tags).toContain('Encrypted');
      expect(rel.properties['port']).toBe('443');
    });

    it('applies default description and technology from relationship archetype if omitted on relationship', () => {
      const dsl = `
      workspace "Default Rel Props" {
        archetypes {
          grpc = -> {
            description "Calls RPC service"
            technology "gRPC/HTTP2"
            tag "RPC"
          }
        }
        model {
          frontend = softwareSystem "Frontend"
          backend = softwareSystem "Backend"
          frontend --grpc-> backend
        }
      }
      `;

      const ws = parseDsl(dsl);
      const rel = ws.model.relationships[0];
      expect(rel.archetype).toBe('grpc');
      expect(rel.description).toBe('Calls RPC service');
      expect(rel.technology).toBe('gRPC/HTTP2');
      expect(rel.tags).toContain('RPC');
    });

    it('supports archetype arrows inside container and component blocks', () => {
      const dsl = `
      workspace "Container Rel Arch" {
        archetypes {
          async = -> {
            tags "Asynchronous"
            technology "Kafka"
          }
        }
        model {
          sys = softwareSystem "System" {
            c1 = container "Producer" {
              --async-> c2 "Publishes event"
            }
            c2 = container "Consumer"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      expect(ws.model.relationships.length).toBe(1);
      const rel = ws.model.relationships[0];
      expect(rel.sourceIdentifier).toBe('c1');
      expect(rel.destinationIdentifier).toBe('c2');
      expect(rel.description).toBe('Publishes event');
      expect(rel.technology).toBe('Kafka');
      expect(rel.tags).toContain('Asynchronous');
      expect(rel.archetype).toBe('async');
    });
  });

  describe('Modifiers with Archetypes', () => {
    it('adds an archetyped relationship to DSL with addRelationshipToDsl', () => {
      const dsl = `workspace "Test" {
    archetypes {
        rpc = ->
    }
    model {
        a = softwareSystem "A"
        b = softwareSystem "B"
    }
}`;

      const res = addRelationshipToDsl(dsl, {
        sourceId: 'a',
        targetId: 'b',
        description: 'Sends command',
        technology: 'gRPC',
        archetype: 'rpc'
      });

      expect(res.dsl).toContain('a --rpc-> b "Sends command" "gRPC"');
    });

    it('preserves existing archetype when updating relationship in updateRelationshipInDsl', () => {
      const dsl = `workspace "Test" {
    archetypes {
        https = ->
    }
    model {
        a = softwareSystem "A"
        b = softwareSystem "B"
        a --https-> b "Old Desc" "HTTPS"
    }
}`;

      const res = updateRelationshipInDsl(dsl, {
        edgeId: 'edge_1',
        sourceId: 'a',
        targetId: 'b',
        description: 'New Desc',
        technology: 'TLS/HTTPS'
      });

      expect(res.dsl).toContain('a --https-> b "New Desc" "TLS/HTTPS"');
    });

    it('allows changing the archetype when updating relationship in updateRelationshipInDsl', () => {
      const dsl = `workspace "Test" {
    archetypes {
        http = ->
        https = ->
    }
    model {
        a = softwareSystem "A"
        b = softwareSystem "B"
        a --http-> b "Calls" "HTTP"
    }
}`;

      const res = updateRelationshipInDsl(dsl, {
        edgeId: 'edge_1',
        sourceId: 'a',
        targetId: 'b',
        archetype: 'https'
      });

      expect(res.dsl).toContain('a --https-> b');
    });
  });

  describe('Compiler & Serialization', () => {
    it('serializes archetypes and archetype references in workspaceToStructurizrJson', () => {
      const dsl = `
      workspace "Export Test" {
        archetypes {
          microservice = container {
            technology "Go"
          }
          grpc = -> {
            technology "gRPC"
          }
        }
        model {
          sys = softwareSystem "System" {
            api = microservice "API"
            worker = microservice "Worker"
            api --grpc-> worker "Delegates task"
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const json = workspaceToStructurizrJson(ws);

      expect(json.model.archetypes).toBeDefined();
      expect(json.model.archetypes.elements['microservice']).toBeDefined();
      expect(json.model.archetypes.relationships['grpc']).toBeDefined();

      const containerJson = json.model.softwareSystems[0].containers[0];
      expect(containerJson.archetype).toBe('microservice');

      const relJson = containerJson.relationships[0];
      expect(relJson.archetype).toBe('grpc');
    });

    it('compiles canvas view with archetyped elements and custom elements', () => {
      const dsl = `
      workspace "Canvas Test" {
        archetypes {
          saas = element {
            metadata "External SaaS"
            description "Third party cloud"
          }
        }
        model {
          user = person "User"
          auth0 = saas "Auth0"
          user -> auth0 "Authenticates via"
        }
        views {
          systemLandscape "Landscape" "Overview" {
            include *
            autoLayout lr
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const canvas = compileViewToCanvas(ws, 'Landscape');

      expect(canvas.nodes.length).toBe(2);
      const auth0Node = canvas.nodes.find((n) => n.data.name === 'Auth0');
      expect(auth0Node).toBeDefined();
      expect(auth0Node?.data.description).toBe('Third party cloud');
      expect(canvas.edges.length).toBe(1);
    });
  });

  describe('Inspection Engine', () => {
    it('does not flag missing description when archetype provides default description', () => {
      const dsl = `
      workspace "Inspection Test" {
        archetypes {
          documentedContainer = container {
            description "Default container description"
          }
        }
        model {
          sys = softwareSystem "System" "Has desc" {
            api = documentedContainer "API"
          }
        }
        views {
          systemContext sys "Context" {
            include *
          }
        }
      }
      `;

      const ws = parseDsl(dsl);
      const findings = inspectWorkspace(ws);
      const missingDesc = findings.filter(
        (f) => f.ruleId === 'ELEMENT_MISSING_DESCRIPTION' && f.elementName === 'API'
      );
      expect(missingDesc.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('throws ParseError on unknown archetype base type', () => {
      const dsl = `
      workspace "Error Test" {
        archetypes {
          bad = invalidBaseType
        }
        model {}
      }
      `;

      expect(() => parseDsl(dsl)).toThrow(/Unknown archetype base type 'invalidBaseType'/i);
    });

    it('throws ParseError on unknown relationship archetype base', () => {
      const dsl = `
      workspace "Error Test" {
        archetypes {
          badRel = --nonexistent->
        }
        model {}
      }
      `;

      expect(() => parseDsl(dsl)).toThrow(/Unknown relationship archetype base 'nonexistent'/i);
    });

    it('throws ParseError when using undefined relationship archetype', () => {
      const dsl = `
      workspace "Error Test" {
        model {
          a = person "A"
          b = person "B"
          a --undefinedArchetype-> b
        }
      }
      `;

      expect(() => parseDsl(dsl)).toThrow(/Unknown relationship archetype 'undefinedArchetype'/i);
    });
  });
});
