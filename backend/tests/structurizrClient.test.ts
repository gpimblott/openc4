import { describe, it, expect } from 'vitest';
import {
  getCleanBaseUrl,
  getRestCandidateEndpoints,
  testStructurizrConnection,
  publishToStructurizr,
  normalizeDslForStructurizr
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

  it('automatically retries targeting workspace 1 when Structurizr returns Workspace ID must be 1', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      calls.push(urlStr);
      if (urlStr.includes('/api/workspace/4')) {
        return new Response(JSON.stringify({ success: false, message: 'Workspace ID must be 1' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('/api/workspace/1')) {
        const body = JSON.parse(init?.body as string);
        expect(body.properties?.['structurizr.dsl']).toBeDefined();
        const decoded = Buffer.from(body.properties['structurizr.dsl'], 'base64').toString('utf-8');
        expect(decoded).toContain('Example');
        return new Response(JSON.stringify({ success: true, message: 'OK' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    try {
      const res = await publishToStructurizr({
        serverUrl: 'http://localhost:8080',
        workspaceId: 4,
        dsl: `workspace "Example" { model { u = person "User" } }`
      });
      expect(res.success).toBe(true);
      expect(res.workspaceId).toBe(1);
      expect(calls.some(c => c.includes('/api/workspace/4'))).toBe(true);
      expect(calls.some(c => c.includes('/api/workspace/1'))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('normalizes DSL view keys, spaces, and layout separations for Structurizr', () => {
    const inputDsl = `workspace "Test" {
      views {
        systemLandscape "Company ecosystem" {
          include *
          autolayout lr
        }
        container businessApplication businessApplicationContainer"Business Application Containers" {
          include *
        }
        deployment * production "ProductionEnvironment" "Production Environment" {
          include *
          autolayout
        }
      }
    }`;

    const normalized = normalizeDslForStructurizr(inputDsl, null);
    expect(normalized).toContain('systemLandscape Company_ecosystem "Company ecosystem"');
    expect(normalized).toContain('autolayout lr 300 300');
    expect(normalized).toContain('businessApplicationContainer "Business Application Containers"');
    expect(normalized).toContain('autolayout tb 300 300');
  });
});
