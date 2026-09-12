import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import { inspectWorkspace } from '../src/engine/inspection.js';

describe('Architecture Inspection & Structurizr Compatibility', () => {
  it('detects Structurizr implied relationship conflict when container relationship duplicates component relationship', () => {
    const conflictingDsl = `
    workspace "Bank" {
      model {
        system = softwareSystem "System" {
          api = container "API Application" {
            controller = component "Sign In Controller"
          }
          db = container "Database"
        }
        
        // Redundant container relationship that Structurizr rejects when child relationship exists
        api -> db "Reads from and writes to" "TCP 5432"
        controller -> db "Reads from and writes to" "TCP 5432"
      }
      views {
        systemContext system "SystemContext" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(conflictingDsl);
    const findings = inspectWorkspace(ws);
    const conflict = findings.find(f => f.ruleId === 'STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict?.message).toContain('conflicts with implied relationship');
  });

  it('detects duplicate relationships between the same elements', () => {
    const dupDsl = `
    workspace "Test" {
      model {
        u = person "User"
        s = softwareSystem "App"
        u -> s "Uses"
        u -> s "Uses"
      }
      views {
        systemContext s "Context" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(dupDsl);
    const findings = inspectWorkspace(ws);
    const dup = findings.find(f => f.ruleId === 'DUPLICATE_RELATIONSHIP');
    expect(dup).toBeDefined();
    expect(dup?.message).toContain('Duplicate relationship');
  });

  it('passes cleanly without relationship conflicts on clean C4 model', () => {
    const cleanDsl = `
    workspace "Bank" {
      model {
        user = person "Customer" "Bank customer"
        sys = softwareSystem "System" "Core banking system" {
          api = container "API Application" "Provides API" "Node.js" {
            controller = component "Controller" "Handles auth" "Router"
          }
          db = container "Database" "Stores customer records" "PostgreSQL"
        }
        
        user -> controller "Calls" "HTTPS"
        controller -> db "Reads and writes" "TCP 5432"
      }
      views {
        systemContext sys "Context" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(cleanDsl);
    const findings = inspectWorkspace(ws);
    const conflicts = findings.filter(f => f.ruleId === 'STRUCTURIZR_IMPLIED_RELATIONSHIP_CONFLICT' || f.ruleId === 'DUPLICATE_RELATIONSHIP');
    expect(conflicts.length).toBe(0);
  });

  it('detects unknown elements in relationships', () => {
    const dsl = `
    workspace "Test" {
      model {
        user = person "User" "A user"
        system = softwareSystem "System" "A system"
        
        user -> unknownSystem "Calls unknown destination"
        ghostPerson -> system "Calls from unknown source"
      }
      views {
        systemContext system "Context" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(dsl);
    const findings = inspectWorkspace(ws);
    const unknownErrors = findings.filter(f => f.ruleId === 'UNKNOWN_RELATIONSHIP_ELEMENT');
    expect(unknownErrors.length).toBe(2);
    expect(unknownErrors.some(f => f.message.includes("unknown destination element 'unknownSystem'"))).toBe(true);
    expect(unknownErrors.some(f => f.message.includes("unknown source element 'ghostPerson'"))).toBe(true);
  });

  it('detects duplicate element identifiers in model', () => {
    const dsl = `
    workspace "Test" {
      model {
        app = softwareSystem "App One" "Description 1"
        app = softwareSystem "App Two" "Description 2"
      }
      views {
        systemContext app "Context" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(dsl);
    const findings = inspectWorkspace(ws);
    const dupIdents = findings.filter(f => f.ruleId === 'DUPLICATE_IDENTIFIER');
    expect(dupIdents.length).toBeGreaterThanOrEqual(1);
    expect(dupIdents.some(f => f.message.includes("Duplicate element identifier 'app'"))).toBe(true);
  });

  it('detects duplicate view identifiers/keys', () => {
    const dsl = `
    workspace "Test" {
      model {
        sys = softwareSystem "System" "Description"
      }
      views {
        systemContext sys "Overview" {
          include *
        }
        systemLandscape "Overview" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(dsl);
    const findings = inspectWorkspace(ws);
    const dupViews = findings.filter(f => f.ruleId === 'DUPLICATE_IDENTIFIER' && f.elementType === 'View');
    expect(dupViews.length).toBe(1);
    expect(dupViews[0].message).toContain("Duplicate view identifier 'Overview'");
  });

  it('correctly catches duplicate view keys, unknown relationship items, and orphaned elements on the reported user DSL', () => {
    const userDsl = `
    workspace "test architecture" "some words" {
      !identifiers hierarchical

      model {
        user = person "User" "A user of the userApplication."
        enginner = person "Engineer" "Responsible for maintaining the system"
         
        userApplication = softwareSystem "Business Application" "Software Application"  "Saas" {
          database = container "App Database" "To store data" "PostgreSQL" "database" {}
          application = container "User Application" "React User interface" "NodeJS" "application" {}
        }

        user -> userApplication.application "Uses"
        userApplication.application -> userApplication.database "Stores user data in"

        monitorApp = softwareSystem "Monitoring Application" "System Audit" {
          logInterface = container "Log visualitation" "Visualiation" "NodeJS" "Viusation" {}
          group "Monitoring backend" {
            logConnector = container "Log connector" "Data Store" "Go" "Data collector" {}
            logCache = container "Data Cache" "In-memory DB" "Redis" "Cache" {}
          }
        }

        engineer -> monitorApp "Uses"
        monitorApp.logInterface -> monitorApp.logCache "Queries logs"
        monitorApp.logConnector -> monitorApp.logCache "Stores logs"
        monitorApp -> system1 "Collects logs"
      }

      views {
        systemLandscape "Company ecosystem" {
          include *
          autolayout lr
        }
        systemContext userApplication "Business Application" {
          include *
          autoLayout lr
        }
        systemContext monitorApp "Monitoring" {
          include *
          autoLayout lr
        }
        container userApplication "Business Application" {
          include *
        }
        container monitorApp "Monitoring" {
          include *
        }
      }
    }
    `;

    const ws = parseDsl(userDsl);
    const findings = inspectWorkspace(ws);

    // 1. Unknown items in relationships
    const unknownEndpoints = findings.filter(f => f.ruleId === 'UNKNOWN_RELATIONSHIP_ELEMENT');
    expect(unknownEndpoints.some(f => f.message.includes("'engineer'"))).toBe(true);
    expect(unknownEndpoints.some(f => f.message.includes("'system1'"))).toBe(true);

    // 2. Duplicate view identifiers
    const dupViewKeys = findings.filter(f => f.ruleId === 'DUPLICATE_IDENTIFIER' && f.elementType === 'View');
    expect(dupViewKeys.some(f => f.message.includes("'Business Application'"))).toBe(true);
    expect(dupViewKeys.some(f => f.message.includes("'Monitoring'"))).toBe(true);

    // 3. Orphaned element (person 'Engineer' disconnected because relationship used 'engineer' typo)
    const orphan = findings.find(f => f.ruleId === 'ORPHAN_ELEMENT' && f.elementName === 'Engineer');
    expect(orphan).toBeDefined();
  });

  it('detects unknown software systems and containers in view declarations', () => {
    const dsl = `
    workspace "Test" {
      model {
        app = softwareSystem "App"
      }
      views {
        systemContext app-context "AppContext" {
          include *
        }
        container app-container "AppContainer" {
          include *
        }
        component unknownCont "CompView" {
          include *
        }
      }
    }
    `;
    const ws = parseDsl(dsl);
    const findings = inspectWorkspace(ws);
    const viewErrors = findings.filter(f => f.ruleId === 'VIEW_TARGET_NOT_FOUND');
    expect(viewErrors.length).toBe(3);
    expect(viewErrors.some(f => f.message.includes("'app-context'"))).toBe(true);
    expect(viewErrors.some(f => f.message.includes("'app-container'"))).toBe(true);
    expect(viewErrors.some(f => f.message.includes("'unknownCont'"))).toBe(true);
  });
});
