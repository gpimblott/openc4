import { describe, it, expect, beforeAll } from 'vitest';
import { createApp, DEFAULT_SAMPLE_DSL } from '../src/api/app.js';
import { WorkspaceRepository } from '../src/storage/repository.js';
import fs from 'node:fs';
import path from 'node:path';

describe('API Endpoints', () => {
  let app: ReturnType<typeof createApp>;
  const testDbPath = path.resolve('data/test_structurizr.db');

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const repo = new WorkspaceRepository(testDbPath);
    app = createApp(repo);
  });

  it('verifies startup workspace is created', async () => {
    const res = await app.request('/api/workspaces');
    expect(res.status).toBe(200);
    const workspaces = await res.json();
    expect(workspaces.length).toBeGreaterThanOrEqual(1);
    expect(workspaces.some((w: any) => w.name === 'Big Bank plc')).toBe(true);
  });

  it('retrieves official Structurizr workspace JSON', async () => {
    const res = await app.request('/api/workspace/1');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Big Bank plc');
    expect(data.model).toBeDefined();
    expect(data.model.people).toBeDefined();
    expect(data.model.softwareSystems).toBeDefined();
    expect(data.views).toBeDefined();
  });

  it('fetches studio data including canvas and findings', async () => {
    const res = await app.request('/api/workspaces/1/studio');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dsl).toBeDefined();
    expect(data.canvas).toBeDefined();
    expect(data.canvas.nodes.length).toBeGreaterThan(0);
    expect(data.canvas.edges.length).toBeGreaterThan(0);
    expect(data.findings).toBeDefined();
  });

  it('compiles DSL live for studio typing', async () => {
    const res = await app.request('/api/workspaces/1/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dsl: DEFAULT_SAMPLE_DSL,
        viewKey: 'SystemContext'
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.canvas.nodes.length).toBeGreaterThan(0);
    expect(data.parseError).toBeNull();
  });

  it('deletes elements via /api/workspaces/:id/delete and updates canvas and code', async () => {
    // Delete database container
    const res = await app.request('/api/workspaces/1/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dsl: DEFAULT_SAMPLE_DSL,
        nodeIds: ['database'],
        viewKey: 'Containers'
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.dsl).not.toContain('database = container');
    expect(data.canvas).toBeDefined();
    expect(data.canvas.nodes.some((n: any) => n.data.name === 'Database')).toBe(false);
  });

  it('handles MCP tools/list', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/list'
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeDefined();
    const toolNames = data.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('validate_dsl');
    expect(toolNames).toContain('inspect_workspace');
    expect(toolNames).toContain('export_diagram');
  });

  it('handles MCP tools/call for validate_dsl', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '2',
        method: 'tools/call',
        params: {
          name: 'validate_dsl',
          arguments: { dsl: DEFAULT_SAMPLE_DSL }
        }
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeDefined();
  });

  it('returns enterprise catalog with software systems', async () => {
    const res = await app.request('/api/enterprise/catalog');
    expect(res.status).toBe(200);
    const items = await res.json();
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((item: any) => item.name.includes('Internet Banking System'))).toBe(true);
  });

  it('exports diagrams to mermaid, plantuml, and json', async () => {
    // Mermaid
    const resMermaid = await app.request('/api/workspaces/1/export?format=mermaid');
    expect(resMermaid.status).toBe(200);
    const textMermaid = await resMermaid.text();
    expect(textMermaid).toContain('flowchart TB');

    // PlantUML
    const resPlantUML = await app.request('/api/workspaces/1/export?format=plantuml');
    expect(resPlantUML.status).toBe(200);
    const textPlantUML = await resPlantUML.text();
    expect(textPlantUML).toContain('@startuml');

    // JSON
    const resJson = await app.request('/api/workspaces/1/export?format=json');
    expect(resJson.status).toBe(200);
    const textJson = await resJson.text();
    expect(textJson).toContain('Big Bank plc');
  });
});
