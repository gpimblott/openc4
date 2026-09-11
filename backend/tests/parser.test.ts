import { describe, it, expect } from 'vitest';
import { parseDsl, ParseError } from '../src/engine/parser.js';
import { compileViewToCanvas } from '../src/engine/compiler.js';

const SAMPLE_DSL = `
workspace "Big Bank plc" "Internet Banking System architecture model" {

    model {
        customer = person "Personal Banking Customer" "A customer of the bank, with personal bank accounts." "Customer"
        
        internetBankingSystem = softwareSystem "Internet Banking System" "Allows customers to view information about their bank accounts, and make payments." "TargetSystem" {
            singlePageApplication = container "Single-Page Application" "Delivers all the Internet banking functionality via their web browser." "TypeScript / React" "WebBrowser"
            apiApplication = container "API Application" "Provides Internet banking functionality via a JSON/HTTPS API." "Java / Spring Boot" {
                signinController = component "Sign In Controller" "Allows users to sign in to the Internet Banking System." "Spring MVC Rest Controller"
                accountsSummaryController = component "Accounts Summary Controller" "Provides customers with a summary of their bank accounts." "Spring MVC Rest Controller"
                securityComponent = component "Security Component" "Provides functionality related to signing in, changing passwords, etc." "Spring Security"
            }
            database = container "Database" "Stores user registration information, hashed authentication credentials, access logs, etc." "Oracle Database Server" "Database"
        }

        mainframeBankingSystem = softwareSystem "Mainframe Banking System" "Stores all of the core banking information about customers, accounts, transactions, etc." "Existing System"
        emailSystem = softwareSystem "E-mail System" "The internal Microsoft Exchange e-mail system." "Existing System"

        customer -> internetBankingSystem "Views account balances, and makes payments using"
        customer -> singlePageApplication "Uses" "HTTPS"
        singlePageApplication -> apiApplication "Makes API calls to" "JSON/HTTPS"
        apiApplication -> database "Reads from and writes to" "JDBC"
        apiApplication -> mainframeBankingSystem "Makes API calls to" "XML/HTTPS"
        apiApplication -> emailSystem "Sends e-mail using" "SMTP"
    }

    views {
        systemContext internetBankingSystem "SystemContext" {
            include *
            autoLayout lr
        }

        container internetBankingSystem "Containers" {
            include *
            autoLayout tb
        }

        component apiApplication "Components" {
            include *
            autoLayout tb
        }

        styles {
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Database" {
                shape Cylinder
            }
        }
    }
}
`;

describe('DSL Parser', () => {
  it('parses sample DSL accurately', () => {
    const ws = parseDsl(SAMPLE_DSL);
    expect(ws.name).toBe('Big Bank plc');
    expect(ws.description).toBe('Internet Banking System architecture model');

    // Verify model elements
    expect(ws.model.people.length).toBe(1);
    expect(ws.model.people[0].name).toBe('Personal Banking Customer');

    expect(ws.model.softwareSystems.length).toBe(3);
    const targetSys = ws.model.softwareSystems.find((s) => s.name === 'Internet Banking System');
    expect(targetSys).toBeDefined();
    expect(targetSys!.containers.length).toBe(3);

    const apiApp = targetSys!.containers.find((c) => c.name === 'API Application');
    expect(apiApp).toBeDefined();
    expect(apiApp!.components.length).toBe(3);

    // Verify relationships
    expect(ws.model.relationships.length).toBe(6);

    // Verify views
    expect(ws.views.length).toBe(3);
    const scView = ws.views.find((v) => v.key === 'SystemContext');
    expect(scView).toBeDefined();
    expect(scView!.viewType).toBe('systemcontext');
    expect(scView!.includeAll).toBe(true);
    expect(scView!.autoLayout).toBe('lr');

    // Verify styles
    expect(ws.elementStyles.length).toBe(5);
    const dbStyle = ws.elementStyles.find((s) => s.tag === 'Database');
    expect(dbStyle).toBeDefined();
    expect(dbStyle!.shape).toBe('Cylinder');

    const compStyle = ws.elementStyles.find((s) => s.tag === 'Component');
    expect(compStyle).toBeDefined();
    expect(compStyle!.background).toBe('#85bbf0');
    expect(compStyle!.color).toBe('#000000');

    const contStyle = ws.elementStyles.find((s) => s.tag === 'Container');
    expect(contStyle).toBeDefined();
    expect(contStyle!.background).toBe('#438dd5');
    expect(contStyle!.color).toBe('#ffffff');
  });

  it('detects invalid syntax and throws ParseError', () => {
    expect(() => {
      parseDsl('workspace { unterminated string "hello }');
    }).toThrow(ParseError);
  });

  it('tolerates Structurizr directives like !impliedRelationships', () => {
    const dslWithDirective = `
    workspace "Test" {
      !impliedRelationships false
      model {
        user = person "User"
        sys = softwareSystem "System"
        user -> sys "Uses"
      }
    }
    `;
    const ws = parseDsl(dslWithDirective);
    expect(ws.name).toBe('Test');
    expect(ws.model.people.length).toBe(1);
    expect(ws.model.softwareSystems.length).toBe(1);
  });

  it('supports !identifiers hierarchical and resolves scoped container relationships', () => {
    const hierarchicalDsl = `
    workspace "Name" "Description" {
        !identifiers hierarchical

        model {
            u = person "User"
            ss = softwareSystem "Software System" {
                wa = container "Web Application"
                db = container "Database Schema" {
                    tags "Database"
                }
            }

            u -> ss.wa "Uses"
            ss.wa -> ss.db "Reads from and writes to"
        }

        views {
            systemContext ss "Diagram1" {
                include *
            }

            container ss "Diagram2" {
                include *
            }
        }
    }
    `;
    const ws = parseDsl(hierarchicalDsl);
    expect(ws.model.people.length).toBe(1);
    expect(ws.model.softwareSystems.length).toBe(1);
    const ss = ws.model.softwareSystems[0];
    expect(ss.containers.length).toBe(2);
    expect(ss.containers[0].identifier).toBe('ss.wa');
    expect(ss.containers[1].identifier).toBe('ss.db');

    // Both relationships should have resolved IDs (not raw 'ss.wa' or 'ss.db' string)
    expect(ws.model.relationships).toHaveLength(2);
    const uRel = ws.model.relationships.find((r) => r.description === 'Uses');
    expect(uRel).toBeDefined();
    expect(uRel!.sourceId).toBe(ws.model.people[0].id);
    expect(uRel!.destinationId).toBe(ss.containers[0].id);

    const dbRel = ws.model.relationships.find((r) => r.description === 'Reads from and writes to');
    expect(dbRel).toBeDefined();
    expect(dbRel!.sourceId).toBe(ss.containers[0].id);
    expect(dbRel!.destinationId).toBe(ss.containers[1].id);

    // Verify systemContext diagram includes user and rolled-up edge
    const scCanvas = compileViewToCanvas(ws, 'Diagram1');
    const scNodeNames = scCanvas.nodes.map((n: any) => n.data.name);
    expect(scNodeNames).toContain('Software System');
    expect(scNodeNames).toContain('User');
    expect(scCanvas.edges.length).toBe(1);
    expect(scCanvas.edges[0].label).toBe('Uses');

    // Verify container diagram includes containers, external user, and both edges
    const contCanvas = compileViewToCanvas(ws, 'Diagram2');
    const contNodeNames = contCanvas.nodes.map((n: any) => n.data.name);
    expect(contNodeNames).toContain('Web Application');
    expect(contNodeNames).toContain('Database Schema');
    expect(contNodeNames).toContain('User');
    expect(contCanvas.edges.length).toBe(2);
  });

  it('supports qualified dot notation for components (system.container.component)', () => {
    const compDsl = `
    workspace "Component Test" {
        !identifiers hierarchical
        model {
            u = person "User"
            s = softwareSystem "System" {
                c = container "App" {
                    comp = component "Controller"
                }
            }
            u -> s.c.comp "Calls"
        }
    }
    `;
    const ws = parseDsl(compDsl);
    const user = ws.model.people[0];
    const comp = ws.model.softwareSystems[0].containers[0].components[0];
    expect(comp.identifier).toBe('s.c.comp');
    expect(ws.model.relationships).toHaveLength(1);
    expect(ws.model.relationships[0].destinationId).toBe(comp.id);
  });

  it('correctly compiles shape, stroke, strokeWidth, and boundary styles with tag precedence', () => {
    const styledDsl = `
    workspace "Styled Workspace" {
        model {
            u = person "User"
            ss = softwareSystem "Software System" {
                wa = container "Web Application"
                db = container "Database Schema" {
                    tags "Database"
                }
            }
            u -> wa "Uses"
            wa -> db "Reads from"
        }
        views {
            container ss "Containers" {
                include *
            }
            styles {
                element "Element" {
                    color #f88728
                    stroke #f88728
                    strokeWidth 7
                    shape roundedbox
                }
                element "Person" {
                    shape person
                }
                element "Database" {
                    shape cylinder
                }
                element "Boundary" {
                    strokeWidth 5
                }
                relationship "Relationship" {
                    thickness 4
                }
            }
        }
    }
    `;
    const ws = parseDsl(styledDsl);
    const canvas = compileViewToCanvas(ws, 'Containers');

    const userNode = canvas.nodes.find((n: any) => n.data.name === 'User');
    expect(userNode).toBeDefined();
    expect(userNode.data.shape).toBe('person');
    expect(userNode.data.stroke).toBe('#f88728');
    expect(userNode.data.strokeWidth).toBe(7);
    expect(userNode.data.color).toBe('#f88728');

    const dbNode = canvas.nodes.find((n: any) => n.data.name === 'Database Schema');
    expect(dbNode).toBeDefined();
    expect(dbNode.data.shape).toBe('cylinder');
    expect(dbNode.data.stroke).toBe('#f88728');
    expect(dbNode.data.strokeWidth).toBe(7);

    const waNode = canvas.nodes.find((n: any) => n.data.name === 'Web Application');
    expect(waNode).toBeDefined();
    expect(waNode.data.shape).toBe('roundedbox');
    expect(waNode.data.strokeWidth).toBe(7);

    expect(canvas.boundary).toBeDefined();
    expect(canvas.boundary.strokeWidth).toBe(5);

    expect(canvas.edges.length).toBe(2);
    expect(canvas.edges[0].style.strokeWidth).toBe(4);
    expect(canvas.edges[1].style.strokeWidth).toBe(4);
  });

  it('parses group blocks in model, systems, and containers without truncating views', () => {
    const dslWithGroups = `
    workspace "Group Test" "Testing group blocks" {
        !identifiers hierarchical

        model {
            user = person "User" "A user"

            group "External SaaS" {
                extSystem = softwareSystem "External Service" "Third party service"
            }

            group "Core Platform" {
                coreSystem = softwareSystem "Core System" "Main system" {
                    group "Data Tier" {
                        db = container "Database" "PostgreSQL" "PostgreSQL"
                    }
                    group "API Tier" {
                        api = container "Backend API" "NodeJS" "NodeJS" {
                            group "Services" {
                                authService = component "Auth Service" "Handles auth" "TypeScript"
                            }
                        }
                    }
                }
            }

            user -> coreSystem "Uses"
            user -> coreSystem.api "Uses API"
            coreSystem.api.authService -> coreSystem.db "Queries"
            coreSystem -> extSystem "Integrates with"
        }

        views {
            systemContext coreSystem "SystemContext" {
                include *
                autoLayout lr
            }
            container coreSystem "CoreContainers" {
                include *
            }
            component coreSystem.api "ApiComponents" {
                include *
            }
        }
    }
    `;

    const ws = parseDsl(dslWithGroups);

    // Verify elements and their groups
    const extSys = ws.model.softwareSystems.find((s) => s.name === 'External Service');
    expect(extSys).toBeDefined();
    expect(extSys!.group).toBe('External SaaS');

    const coreSys = ws.model.softwareSystems.find((s) => s.name === 'Core System');
    expect(coreSys).toBeDefined();
    expect(coreSys!.group).toBe('Core Platform');

    const db = coreSys!.containers.find((c) => c.name === 'Database');
    expect(db).toBeDefined();
    expect(db!.group).toBe('Core Platform/Data Tier');

    const api = coreSys!.containers.find((c) => c.name === 'Backend API');
    expect(api).toBeDefined();
    expect(api!.group).toBe('Core Platform/API Tier');

    const authComp = api!.components.find((c) => c.name === 'Auth Service');
    expect(authComp).toBeDefined();
    expect(authComp!.group).toBe('Core Platform/API Tier/Services');

    // Verify relationships were not truncated
    expect(ws.model.relationships.length).toBe(4);

    // Verify views were not truncated
    expect(ws.views.length).toBe(3);
    expect(ws.views.map((v) => v.key)).toEqual(['SystemContext', 'CoreContainers', 'ApiComponents']);

    // Verify canvas compilation for views
    const canvas = compileViewToCanvas(ws, 'SystemContext');
    expect(canvas.availableViews.length).toBe(3);
    expect(canvas.availableViews.map((v: any) => v.key)).toEqual(['SystemContext', 'CoreContainers', 'ApiComponents']);
    expect(canvas.nodes.length).toBeGreaterThan(0);
    expect(canvas.edges.length).toBeGreaterThan(0);
  });
});
