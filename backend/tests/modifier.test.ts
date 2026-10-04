import { describe, it, expect } from 'vitest';
import { deleteFromDsl, addRelationshipToDsl, updateRelationshipInDsl, addElementToDsl, addViewToDsl, includeElementInView } from '../src/engine/modifier.js';
import { parseDsl } from '../src/engine/parser.js';
import { compileViewToCanvas } from '../src/engine/compiler.js';

const SAMPLE_DSL = `workspace "Big Bank plc" "Internet Banking System architecture model" {

    model {
        customer = person "Personal Banking Customer" "A customer of the bank, with personal bank accounts." "Customer"
        
        internetBankingSystem = softwareSystem "Internet Banking System" "Allows customers to view account info and make payments." "TargetSystem" {
            singlePageApplication = container "Single-Page Application" "Delivers Internet banking functionality via web browser." "TypeScript / React" "WebBrowser"
            apiApplication = container "API Application" "Provides Internet banking functionality via JSON/HTTPS API." "TypeScript / Hono" {
                signinController = component "Sign In Controller" "Handles login & auth credentials." "Hono Router"
                accountsController = component "Accounts Controller" "Provides summary of bank accounts." "Hono Router"
                paymentService = component "Payment Service" "Coordinates account transfers and payment execution." "TypeScript Service"
            }
            database = container "Database" "Stores customer records and hashed credentials." "PostgreSQL" "Database"
        }

        mainframeBankingSystem = softwareSystem "Mainframe Banking System" "Stores core banking information about accounts and transactions." "Existing System"
        emailSystem = softwareSystem "E-mail System" "Internal email system for notification delivery." "Existing System"

        customer -> internetBankingSystem "Views account balances and makes payments"
        customer -> singlePageApplication "Uses" "HTTPS"
        singlePageApplication -> apiApplication "Makes API calls to" "JSON/HTTPS"
        apiApplication -> database "Reads from and writes to" "TCP 5432"
        apiApplication -> mainframeBankingSystem "Executes transactions via" "XML/HTTPS"
        apiApplication -> emailSystem "Sends customer alerts using" "SMTP"
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
    }
}`;

describe('deleteFromDsl', () => {
  it('deletes an edge (relationship) from DSL', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    // Find the relationship singlePageApplication -> apiApplication
    const rel = parsed.model.relationships.find(
      (r) => r.description === 'Makes API calls to'
    );
    expect(rel).toBeDefined();

    const result = deleteFromDsl(SAMPLE_DSL, { edgeIds: [rel!.id] });
    expect(result.dsl).not.toContain('Makes API calls to');
    expect(result.dsl).toContain('singlePageApplication = container');
    expect(result.dsl).toContain('apiApplication = container');

    const newParsed = parseDsl(result.dsl);
    expect(newParsed.model.relationships.length).toBe(parsed.model.relationships.length - 1);
  });

  it('deletes a component and its connected relationships', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const comp = parsed.model.softwareSystems[0].containers[1].components[0];
    expect(comp).toBeDefined();

    const result = deleteFromDsl(SAMPLE_DSL, { nodeIds: [comp.id] });
    expect(result.dsl).not.toContain('signinController');
    expect(result.dsl).toContain('accountsController');
    expect(result.dsl).toContain('paymentService');
    expect(result.dsl).toContain('apiApplication = container');

    const newParsed = parseDsl(result.dsl);
    const apiApp = newParsed.model.softwareSystems[0].containers.find((c) => c.name === 'API Application');
    expect(apiApp?.components.length).toBe(2);
  });

  it('deletes a container, its nested components, connected relationships, and view', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const dbContainer = parsed.model.softwareSystems[0].containers.find((c) => c.name === 'Database');
    expect(dbContainer).toBeDefined();

    const result = deleteFromDsl(SAMPLE_DSL, { nodeIds: [dbContainer!.id] });
    expect(result.dsl).not.toContain('database = container');
    expect(result.dsl).not.toContain('Reads from and writes to');

    const newParsed = parseDsl(result.dsl);
    expect(newParsed.model.softwareSystems[0].containers.length).toBe(2);
  });

  it('deletes a container with components and cleans up component view', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const apiApp = parsed.model.softwareSystems[0].containers.find((c) => c.name === 'API Application');
    expect(apiApp).toBeDefined();

    const result = deleteFromDsl(SAMPLE_DSL, { nodeIds: [apiApp!.id] });
    expect(result.dsl).not.toContain('apiApplication = container');
    expect(result.dsl).not.toContain('signinController');
    expect(result.dsl).not.toContain('component apiApplication "Components"');

    const newParsed = parseDsl(result.dsl);
    expect(newParsed.views.some((v) => v.key === 'Components')).toBe(false);
  });

  it('deletes a software system, all children, relationships, and associated views', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const targetSys = parsed.model.softwareSystems.find((s) => s.name === 'Internet Banking System');
    expect(targetSys).toBeDefined();

    const result = deleteFromDsl(SAMPLE_DSL, { nodeIds: [targetSys!.id] });
    expect(result.dsl).not.toContain('internetBankingSystem = softwareSystem');
    expect(result.dsl).not.toContain('singlePageApplication');
    expect(result.dsl).not.toContain('apiApplication');
    expect(result.dsl).not.toContain('database');
    expect(result.dsl).not.toContain('systemContext internetBankingSystem');
    expect(result.dsl).not.toContain('container internetBankingSystem');

    const newParsed = parseDsl(result.dsl);
    expect(newParsed.model.softwareSystems.length).toBe(2);
    expect(newParsed.views.length).toBe(0);
  });
});

describe('addRelationshipToDsl', () => {
  it('adds a relationship between elements with description and technology', () => {
    const result = addRelationshipToDsl(SAMPLE_DSL, {
      sourceId: 'singlePageApplication',
      targetId: 'mainframeBankingSystem',
      description: 'Queries status directly',
      technology: 'HTTPS'
    });

    expect(result.dsl).toContain('singlePageApplication -> mainframeBankingSystem "Queries status directly" "HTTPS"');
    const newParsed = parseDsl(result.dsl);
    const addedRel = newParsed.model.relationships.find(
      (r) => r.description === 'Queries status directly'
    );
    expect(addedRel).toBeDefined();
    expect(addedRel?.technology).toBe('HTTPS');
  });

  it('adds a relationship when no relationships exist in model', () => {
    const NO_REL_DSL = `workspace "Test" {
    model {
        user = person "User"
        app = softwareSystem "App"
    }
    views {
        systemContext app "SystemContext" {
            include *
        }
    }
}`;

    const result = addRelationshipToDsl(NO_REL_DSL, {
      sourceId: 'user',
      targetId: 'app',
      description: 'Interacts with',
      technology: 'HTTPS'
    });

    expect(result.dsl).toContain('user -> app "Interacts with" "HTTPS"');
    const parsed = parseDsl(result.dsl);
    expect(parsed.model.relationships.length).toBe(1);
    expect(parsed.model.relationships[0].description).toBe('Interacts with');
  });

  it('resolves elements by name or id', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const customer = parsed.model.people.find((p) => p.name === 'Personal Banking Customer');
    const db = parsed.model.softwareSystems[0].containers.find((c) => c.name === 'Database');

    const result = addRelationshipToDsl(SAMPLE_DSL, {
      sourceId: customer!.id,
      targetId: db!.id,
      description: 'Inspects directly'
    });

    expect(result.dsl).toContain('customer -> database "Inspects directly"');
    const newParsed = parseDsl(result.dsl);
    expect(newParsed.model.relationships.some((r) => r.description === 'Inspects directly')).toBe(true);
  });
});

describe('updateRelationshipInDsl', () => {
  it('reconnects an edge to a new target destination', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const rel = parsed.model.relationships.find(
      (r) => r.description === 'Makes API calls to'
    );
    expect(rel).toBeDefined();

    // Reconnect singlePageApplication from apiApplication to mainframeBankingSystem
    const result = updateRelationshipInDsl(SAMPLE_DSL, {
      edgeId: rel!.id,
      targetId: 'mainframeBankingSystem'
    });

    expect(result.dsl).toContain('singlePageApplication -> mainframeBankingSystem "Makes API calls to" "JSON/HTTPS"');
    expect(result.dsl).not.toContain('singlePageApplication -> apiApplication "Makes API calls to" "JSON/HTTPS"');

    const newParsed = parseDsl(result.dsl);
    const updated = newParsed.model.relationships.find(
      (r) => r.description === 'Makes API calls to'
    );
    expect(updated).toBeDefined();
    expect(updated?.destinationIdentifier).toBe('mainframeBankingSystem');
  });

  it('updates description and technology of an existing relationship', () => {
    const parsed = parseDsl(SAMPLE_DSL);
    const rel = parsed.model.relationships.find(
      (r) => r.description === 'Reads from and writes to'
    );
    expect(rel).toBeDefined();

    const result = updateRelationshipInDsl(SAMPLE_DSL, {
      edgeId: rel!.id,
      description: 'Executes SQL transactions on',
      technology: 'PostgreSQL Protocol'
    });

    expect(result.dsl).toContain('apiApplication -> database "Executes SQL transactions on" "PostgreSQL Protocol"');
    expect(result.dsl).not.toContain('Reads from and writes to');

    const newParsed = parseDsl(result.dsl);
    const updated = newParsed.model.relationships.find(
      (r) => r.description === 'Executes SQL transactions on'
    );
    expect(updated?.technology).toBe('PostgreSQL Protocol');
  });
});

describe('addElementToDsl', () => {
  it('adds a person to DSL model', () => {
    const result = addElementToDsl(SAMPLE_DSL, {
      type: 'person',
      name: 'Branch Manager',
      description: 'Manages branch operations',
      tags: 'Staff'
    });

    expect(result.identifier).toBe('branchManager');
    expect(result.dsl).toContain('branchManager = person "Branch Manager" "Manages branch operations" "Staff"');
    const parsed = parseDsl(result.dsl);
    const addedPerson = parsed.model.people.find((p) => p.name === 'Branch Manager');
    expect(addedPerson).toBeDefined();
    expect(addedPerson?.identifier).toBe('branchManager');
  });

  it('adds a software system to DSL model', () => {
    const result = addElementToDsl(SAMPLE_DSL, {
      type: 'softwareSystem',
      name: 'Notification Gateway',
      description: 'Sends SMS and push alerts'
    });

    expect(result.identifier).toBe('notificationGateway');
    expect(result.dsl).toContain('notificationGateway = softwareSystem "Notification Gateway" "Sends SMS and push alerts"');
    const parsed = parseDsl(result.dsl);
    const addedSys = parsed.model.softwareSystems.find((s) => s.name === 'Notification Gateway');
    expect(addedSys).toBeDefined();
  });

  it('adds a container to a software system that already has child blocks', () => {
    const result = addElementToDsl(SAMPLE_DSL, {
      type: 'container',
      name: 'Redis Cache',
      parentId: 'internetBankingSystem',
      description: 'In-memory session cache',
      technology: 'Redis',
      tags: 'Database'
    });

    expect(result.identifier).toBe('redisCache');
    expect(result.dsl).toContain('redisCache = container "Redis Cache" "In-memory session cache" "Redis" "Database"');
    const parsed = parseDsl(result.dsl);
    const targetSys = parsed.model.softwareSystems.find((s) => s.identifier === 'internetBankingSystem');
    const addedCont = targetSys?.containers.find((c) => c.name === 'Redis Cache');
    expect(addedCont).toBeDefined();
    expect(addedCont?.technology).toBe('Redis');
  });

  it('adds a container to a single-line software system (expands it to block)', () => {
    const result = addElementToDsl(SAMPLE_DSL, {
      type: 'container',
      name: 'Core Ledger',
      parentId: 'mainframeBankingSystem',
      description: 'Mainframe accounts ledger',
      technology: 'COBOL / CICS'
    });

    expect(result.identifier).toBe('coreLedger');
    expect(result.dsl).toContain('mainframeBankingSystem = softwareSystem "Mainframe Banking System" "Stores core banking information about accounts and transactions." "Existing System" {');
    expect(result.dsl).toContain('coreLedger = container "Core Ledger" "Mainframe accounts ledger" "COBOL / CICS"');
    const parsed = parseDsl(result.dsl);
    const targetSys = parsed.model.softwareSystems.find((s) => s.identifier === 'mainframeBankingSystem');
    expect(targetSys?.containers.length).toBe(1);
    expect(targetSys?.containers[0].name).toBe('Core Ledger');
  });

  it('adds a component to a container block', () => {
    const result = addElementToDsl(SAMPLE_DSL, {
      type: 'component',
      name: 'Audit Logger',
      parentId: 'apiApplication',
      description: 'Logs sensitive user actions',
      technology: 'TypeScript Service'
    });

    expect(result.identifier).toBe('auditLogger');
    expect(result.dsl).toContain('auditLogger = component "Audit Logger" "Logs sensitive user actions" "TypeScript Service"');
    const parsed = parseDsl(result.dsl);
    const apiApp = parsed.model.softwareSystems[0].containers.find((c) => c.identifier === 'apiApplication');
    expect(apiApp?.components.find((comp) => comp.name === 'Audit Logger')).toBeDefined();
  });
});

describe('addViewToDsl', () => {
  it('adds a container view for a software system', () => {
    const result = addViewToDsl(SAMPLE_DSL, {
      viewType: 'container',
      targetId: 'mainframeBankingSystem',
      key: 'MainframeContainers',
      description: 'Containers within Mainframe system',
      autoLayout: 'lr'
    });

    expect(result.viewKey).toBe('MainframeContainers');
    expect(result.dsl).toContain('container mainframeBankingSystem "MainframeContainers" "Containers within Mainframe system"');
    expect(result.dsl).toContain('autoLayout lr');
    const parsed = parseDsl(result.dsl);
    const addedView = parsed.views.find((v) => v.key === 'MainframeContainers');
    expect(addedView).toBeDefined();
    expect(addedView?.viewType).toBe('container');
  });

  it('adds a component view for a container', () => {
    const result = addViewToDsl(SAMPLE_DSL, {
      viewType: 'component',
      targetId: 'apiApplication',
      key: 'ApiAppDetails',
      description: 'Component architecture of API Application',
      autoLayout: 'tb'
    });

    expect(result.viewKey).toBe('ApiAppDetails');
    expect(result.dsl).toContain('component apiApplication "ApiAppDetails" "Component architecture of API Application"');
    const parsed = parseDsl(result.dsl);
    const addedView = parsed.views.find((v) => v.key === 'ApiAppDetails');
    expect(addedView).toBeDefined();
    expect(addedView?.viewType).toBe('component');
  });
});

describe('includeElementInView', () => {
  it('adds an include statement for an element into an existing view', () => {
    const result = includeElementInView(SAMPLE_DSL, {
      viewKey: 'SystemContext',
      elementIdentifier: 'emailSystem'
    });

    expect(result.dsl).toContain('include emailSystem');
    const parsed = parseDsl(result.dsl);
    const view = parsed.views.find((v) => v.key === 'SystemContext');
    expect(view).toBeDefined();
    expect(view?.includedElementIds.length).toBeGreaterThanOrEqual(1);
  });

  it('removes exclude statement when including an excluded element', () => {
    const EXCLUDED_DSL = `workspace "Test" {
    model {
        user = person "User"
        sys = softwareSystem "Sys"
    }
    views {
        systemLandscape "Landscape" {
            include *
            exclude user
        }
    }
}`;

    const result = includeElementInView(EXCLUDED_DSL, {
      viewKey: 'Landscape',
      elementIdentifier: 'user'
    });

    expect(result.dsl).not.toContain('exclude user');
    const parsed = parseDsl(result.dsl);
    const view = parsed.views.find((v) => v.key === 'Landscape');
    expect(view?.excludedElementIds.includes('user')).toBe(false);
  });

  it('ensures included unlinked element is compiled into canvas nodes even when view has include *', () => {
    const UNLINKED_DSL = `workspace "Test" {
    model {
        user = person "User"
        sysA = softwareSystem "System A"
        sysB = softwareSystem "System B"
    }
    views {
        systemContext sysA "ContextA" {
            include *
        }
    }
}`;

    // Before include: ContextA only has sysA (user and sysB are not linked)
    const initParsed = parseDsl(UNLINKED_DSL);
    const initCanvas = compileViewToCanvas(initParsed, 'ContextA');
    expect(initCanvas.nodes.map((n: any) => n.data.name)).toEqual(['System A']);

    // Include sysB in ContextA
    const res = includeElementInView(UNLINKED_DSL, {
      viewKey: 'ContextA',
      elementIdentifier: 'sysB'
    });

    expect(res.dsl).toContain('include sysB');
    const updatedParsed = parseDsl(res.dsl);
    const updatedCanvas = compileViewToCanvas(updatedParsed, 'ContextA');
    const nodeNames = updatedCanvas.nodes.map((n: any) => n.data.name);
    expect(nodeNames).toContain('System A');
    expect(nodeNames).toContain('System B');
  });
});
