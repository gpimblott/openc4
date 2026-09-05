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

  it('computes diff against published baseline with 0 differences when unmodified', async () => {
    const res = await app.request('/api/workspaces/1/diff');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.baseVersion).toContain('1.0.0');
    expect(data.targetVersion).toBeDefined();
    // Initially matching 1.0.0 baseline
    expect(data.summary.addedCount).toBe(0);
    expect(data.summary.modifiedCount).toBe(0);
    expect(data.summary.removedCount).toBe(0);
  });

  it('publishes a new version and registers multiple versions in the enterprise catalog', async () => {
    // Publish version 1.1.0
    const publishRes = await app.request('/api/workspaces/1/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1.1.0',
        commitMessage: 'Release 1.1.0 with payment service upgrade'
      })
    });
    expect(publishRes.status).toBe(200);
    const publishData = await publishRes.json();
    expect(publishData.success).toBe(true);
    expect(publishData.published.version).toBe('1.1.0');

    // Verify catalog has both 1.0.0 and 1.1.0 records
    const catRes = await app.request('/api/enterprise/catalog');
    const catItems = await catRes.json();
    const bankingItems = catItems.filter((item: any) => item.name === 'Internet Banking System');
    expect(bankingItems.length).toBeGreaterThanOrEqual(2);
    expect(bankingItems.some((i: any) => i.version === '1.0.0')).toBe(true);
    expect(bankingItems.some((i: any) => i.version === '1.1.0')).toBe(true);

    // Verify catalog with ?latest=true only returns the latest version
    const latestCatRes = await app.request('/api/enterprise/catalog?latest=true');
    const latestCatItems = await latestCatRes.json();
    const latestBankingItems = latestCatItems.filter((item: any) => item.name === 'Internet Banking System');
    expect(latestBankingItems.length).toBe(1);
    expect(latestBankingItems[0].version).toBe('1.1.0');

    // Verify catalog with workspaceId filter
    const ws1CatRes = await app.request('/api/enterprise/catalog?workspaceId=1');
    const ws1CatItems = await ws1CatRes.json();
    expect(ws1CatItems.every((item: any) => item.workspaceId === 1)).toBe(true);

    const ws999CatRes = await app.request('/api/enterprise/catalog?workspaceId=999');
    const ws999CatItems = await ws999CatRes.json();
    expect(ws999CatItems.length).toBe(0);

    // Verify version list and version snapshot retrieval
    const versionsRes = await app.request('/api/workspaces/1/versions');
    const versions = await versionsRes.json();
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const v1Res = await app.request('/api/workspaces/1/versions/1.0.0');
    expect(v1Res.status).toBe(200);
    const v1Data = await v1Res.json();
    expect(v1Data.dslSource).toBeDefined();

    // Verify restore/load past version
    const restoreRes = await app.request('/api/workspaces/1/versions/1.0.0/load', {
      method: 'POST'
    });
    expect(restoreRes.status).toBe(200);
    const restoreData = await restoreRes.json();
    expect(restoreData.success).toBe(true);
    expect(restoreData.workspace.version).toBe('1.0.0');
  });
});
