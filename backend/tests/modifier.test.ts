import { describe, it, expect } from 'vitest';
import { deleteFromDsl } from '../src/engine/modifier.js';
import { parseDsl } from '../src/engine/parser.js';

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
