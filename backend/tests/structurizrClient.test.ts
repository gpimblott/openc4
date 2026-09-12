import { describe, it, expect } from 'vitest';
import {
  getCleanBaseUrl,
  getRestCandidateEndpoints,
  testStructurizrConnection,
  publishToStructurizr
} from '../src/engine/structurizrClient.js';

describe('Structurizr Client Module', () => {
  it('normalizes server URLs and extracts clean base URL', () => {
    expect(getCleanBaseUrl('localhost:8080')).toBe('http://localhost:8080');
    expect(getCleanBaseUrl('http://localhost:8080/')).toBe('http://localhost:8080');
    expect(getCleanBaseUrl('http://localhost:8080/api/workspace/1')).toBe('http://localhost:8080');
    expect(getCleanBaseUrl('http://localhost:8080/mcp')).toBe('http://localhost:8080');
    expect(getCleanBaseUrl('https://structurizr.company.internal:8080/workspace/42')).toBe(
      'https://structurizr.company.internal:8080'
    );
    expect(getCleanBaseUrl('')).toBe('http://localhost:8080');
  });

  it('generates prioritized candidate REST endpoints for workspace ID', () => {
    const endpoints = getRestCandidateEndpoints('http://localhost:8080', 5);
    expect(endpoints).toContain('http://localhost:8080/api/workspace/5');
    expect(endpoints).toContain('http://localhost:8080/workspace/5');
  });

  it('handles connection failures gracefully for unreachable server', async () => {
    const res = await testStructurizrConnection({
      serverUrl: 'http://127.0.0.1:59998',
      workspaceId: 1,
      timeoutMs: 250
    });
    expect(res.connected).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('rejects publishing when DSL has syntax errors', async () => {
    const invalidDsl = `workspace "Broken" {
      model {
        system = softwareSystem "Unterminated
      }
    }`;
    const res = await publishToStructurizr({
      serverUrl: 'http://localhost:8080',
      workspaceId: 1,
      dsl: invalidDsl,
      timeoutMs: 300
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error?.message).toBeDefined();
  });

  it('handles unreachable server gracefully during publish attempt', async () => {
    const validDsl = `workspace "Test" {
      model {
        user = person "User"
      }
      views {
        systemContext user "Context" {
          include *
          autolayout lr
        }
      }
    }`;
    const res = await publishToStructurizr({
      serverUrl: 'http://127.0.0.1:59998',
      workspaceId: 1,
      dsl: validDsl,
      timeoutMs: 250
    });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('Failed to publish');
  });
});
