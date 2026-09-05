import { describe, it, expect } from 'vitest';
import { parseDsl, ParseError } from '../src/engine/parser.js';

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
});
