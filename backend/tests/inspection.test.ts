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
});
