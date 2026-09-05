/**
 * Main Hono Application in TypeScript:
 * - Official Structurizr REST API endpoints (/api/workspace/:id)
 * - Modern Web Studio REST endpoints
 * - Enterprise Model Catalog & Publishing endpoints
 * - Model Context Protocol (MCP) JSON-RPC handler
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import fs from 'node:fs';
import path from 'node:path';

import { parseDsl, ParseError } from '../engine/parser.js';
import {
  workspaceToStructurizrJson,
  compileViewToCanvas,
  exportToMermaid,
  exportToPlantUML
} from '../engine/compiler.js';
import { inspectWorkspace } from '../engine/inspection.js';
import { diffWorkspaces } from '../engine/diff.js';
import { StructurizrMCP } from '../engine/mcp.js';
import { WorkspaceRepository } from '../storage/repository.js';
import { deleteFromDsl } from '../engine/modifier.js';

export const DEFAULT_SAMPLE_DSL = `workspace "Big Bank plc" "Internet Banking System architecture model" {

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
        singlePageApplication -> signinController "Makes sign in requests to" "JSON/HTTPS"
        singlePageApplication -> accountsController "Makes account requests to" "JSON/HTTPS"
        signinController -> database "Reads from and writes to" "TCP 5432"
        accountsController -> database "Reads from and writes to" "TCP 5432"
        accountsController -> paymentService "Coordinates account transfers via"
        paymentService -> database "Reads from and writes to" "TCP 5432"
        paymentService -> mainframeBankingSystem "Executes transactions via" "XML/HTTPS"
        paymentService -> emailSystem "Sends customer alerts using" "SMTP"
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
}`;

export function createApp(repo: WorkspaceRepository = new WorkspaceRepository()): Hono {
  const app = new Hono();

  // CORS middleware
  app.use('*', cors());

  // Ensure seed workspace
  function ensureSeedWorkspace() {
    const workspaces = repo.listWorkspaces();
    if (workspaces.length === 0) {
      const wsInfo = repo.createWorkspace('Big Bank plc', 'Internet Banking System architecture model', DEFAULT_SAMPLE_DSL);
      try {
        const parsed = parseDsl(DEFAULT_SAMPLE_DSL);
        const jsonCache = workspaceToStructurizrJson(parsed);
        repo.updateWorkspace(wsInfo.id, { jsonCache, state: 'PUBLISHED' });
        repo.publishWorkspaceVersion(wsInfo.id, '1.0.0', 'Initial seed architecture');
      } catch {
        // ignore
      }
    }
  }

  ensureSeedWorkspace();

  // ============================================================================
  // Official Structurizr REST API Compatible Endpoints
  // ============================================================================

  app.get('/api/workspace/:id', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    if (ws.jsonCache && Object.keys(ws.jsonCache).length > 0) {
      return c.json(ws.jsonCache);
    }

    try {
      const parsed = parseDsl(ws.dslSource);
      const jsonData = workspaceToStructurizrJson(parsed);
      repo.updateWorkspace(workspaceId, { jsonCache: jsonData });
      return c.json(jsonData);
    } catch (err: any) {
      return c.json({ detail: `Failed to compile workspace: ${err.message}` }, 500);
    }
  });

  app.put('/api/workspace/:id', async (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    try {
      const jsonData = await c.req.json();
      repo.updateWorkspace(workspaceId, { jsonCache: jsonData });
      return c.json({ success: true, message: 'Workspace updated successfully' });
    } catch (err: any) {
      return c.json({ detail: `Invalid JSON payload: ${err.message}` }, 400);
    }
  });

  app.post('/api/workspace/:id/apikey/regenerate', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const keys = repo.regenerateApiKey(workspaceId);
    if (!keys) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }
    return c.json({ success: true, ...keys });
  });

  app.post('/api/workspace/:id/lock', (c) => {
    return c.json({ success: true, message: 'Workspace locked' });
  });

  app.delete('/api/workspace/:id/lock', (c) => {
    return c.json({ success: true, message: 'Workspace unlocked' });
  });

  // ============================================================================
  // Modern Web Studio Endpoints
  // ============================================================================

  app.get('/api/workspaces', (c) => {
    return c.json(repo.listWorkspaces());
  });

  app.post('/api/workspaces', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = body.name || 'Untitled Workspace';
    const description = body.description || '';
    const dsl =
      body.dsl ||
      `workspace "${name}" "${description}" {\n    model {\n        user = person "User" "A user of the system."\n        system = softwareSystem "${name}" "${description || 'Software system architecture.'}"\n        user -> system "Uses"\n    }\n    views {\n        systemContext system "SystemContext" {\n            include *\n            autoLayout lr\n        }\n    }\n}`;

    const ws = repo.createWorkspace(name, description, dsl);
    try {
      const parsed = parseDsl(dsl);
      const jsonData = workspaceToStructurizrJson(parsed);
      repo.updateWorkspace(ws.id, { jsonCache: jsonData });
    } catch {
      // ignore
    }
    return c.json(ws);
  });

  app.get('/api/workspaces/:id/studio', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const viewKey = c.req.query('viewKey') || null;

    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    const dsl = ws.dslSource;
    let parseError: any = null;
    let canvasData: any = null;
    let findings: any[] = [];

    let currentName = ws.name;
    let currentDesc = ws.description;

    try {
      const parsed = parseDsl(dsl);
      if (parsed.name && parsed.name !== ws.name) {
        currentName = parsed.name;
        currentDesc = parsed.description || ws.description;
        repo.updateWorkspace(workspaceId, { name: currentName, description: currentDesc });
      }

      const layoutCache = ws.layoutCache || {};
      for (const v of parsed.views) {
        if (layoutCache[v.key]) {
          v.layoutCoordinates = layoutCache[v.key];
        }
      }

      canvasData = compileViewToCanvas(parsed, viewKey);
      findings = inspectWorkspace(parsed);
    } catch (pe: any) {
      if (pe instanceof ParseError) {
        parseError = pe.toJSON();
      } else {
        parseError = { message: pe.message, line: 1, column: 1 };
      }
    }

    const versions = repo.listVersions(workspaceId);

    return c.json({
      workspace: {
        id: ws.id,
        name: currentName,
        description: currentDesc,
        version: ws.version,
        state: ws.state,
        apiKey: ws.apiKey,
        updatedAt: ws.updatedAt
      },
      dsl,
      parseError,
      canvas: canvasData,
      findings,
      versions
    });
  });

  app.post('/api/workspaces/:id/compile', async (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const dsl = body.dsl || '';
    const viewKey = body.viewKey || null;

    const ws = repo.getWorkspace(workspaceId);
    const layoutCache = ws?.layoutCache || {};

    try {
      const parsed = parseDsl(dsl);
      for (const v of parsed.views) {
        if (layoutCache[v.key]) {
          v.layoutCoordinates = layoutCache[v.key];
        }
      }

      const canvasData = compileViewToCanvas(parsed, viewKey);
      const findings = inspectWorkspace(parsed);

      return c.json({
        success: true,
        canvas: canvasData,
        findings,
        workspaceName: parsed.name,
        workspaceDescription: parsed.description,
        parseError: null
      });
    } catch (pe: any) {
      const errDict = pe instanceof ParseError ? pe.toJSON() : { message: pe.message, line: 1, column: 1 };
      return c.json({
        success: false,
        parseError: errDict,
        canvas: null,
        findings: []
      });
    }
  });

  app.post('/api/workspaces/:id/delete', async (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json().catch(() => ({}));
    const dsl = body.dsl || '';
    const nodeIds = body.nodeIds || [];
    const edgeIds = body.edgeIds || [];
    const viewKey = body.viewKey || null;

    const ws = repo.getWorkspace(workspaceId);
    const layoutCache = ws?.layoutCache || {};

    try {
      const deleteResult = deleteFromDsl(dsl, { nodeIds, edgeIds });
      const parsed = parseDsl(deleteResult.dsl);

      for (const v of parsed.views) {
        if (layoutCache[v.key]) {
          v.layoutCoordinates = layoutCache[v.key];
        }
      }

      const canvasData = compileViewToCanvas(parsed, viewKey);
      const findings = inspectWorkspace(parsed);

      return c.json({
        success: true,
        dsl: deleteResult.dsl,
        deletedNodeIds: deleteResult.deletedNodeIds,
        deletedEdgeIds: deleteResult.deletedEdgeIds,
        canvas: canvasData,
        findings
      });
    } catch (err: any) {
      return c.json({
        success: false,
        detail: err.message
      }, 400);
    }
  });

  app.post('/api/workspaces/:id/save', async (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    const body = await c.req.json();
    const layoutCache = ws.layoutCache || {};
    if (body.layoutCoordinates) {
      Object.assign(layoutCache, body.layoutCoordinates);
    }

    let jsonData = ws.jsonCache;
    let wsName = body.name || ws.name;
    let wsDesc = body.description || ws.description;
    try {
      const parsed = parseDsl(body.dsl);
      jsonData = workspaceToStructurizrJson(parsed);
      if (parsed.name) wsName = parsed.name;
      if (parsed.description) wsDesc = parsed.description;
    } catch {
      // ignore
    }

    const updated = repo.updateWorkspace(workspaceId, {
      dslSource: body.dsl,
      jsonCache: jsonData,
      layoutCache,
      name: wsName,
      description: wsDesc,
      state: body.state !== undefined ? body.state : 'DRAFT'
    });

    return c.json({ success: true, workspace: updated });
  });

  app.post('/api/workspaces/:id/publish', async (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }
    const body = await c.req.json();
    try {
      if (body.dsl) {
        let jsonData = ws.jsonCache;
        let wsName = ws.name;
        let wsDesc = ws.description;
        try {
          const parsed = parseDsl(body.dsl);
          jsonData = workspaceToStructurizrJson(parsed);
          if (parsed.name) wsName = parsed.name;
          if (parsed.description) wsDesc = parsed.description;
        } catch {
          // ignore
        }
        repo.updateWorkspace(workspaceId, {
          dslSource: body.dsl,
          jsonCache: jsonData,
          name: wsName,
          description: wsDesc,
          state: 'PUBLISHED'
        });
      }
      const result = repo.publishWorkspaceVersion(workspaceId, body.version, body.commitMessage || '');
      return c.json({ success: true, published: result });
    } catch (err: any) {
      return c.json({ detail: err.message }, 400);
    }
  });

  app.get('/api/workspaces/:id/versions', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    return c.json(repo.listVersions(workspaceId));
  });

  app.get('/api/workspaces/:id/versions/:version', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const version = c.req.param('version');
    const snap = repo.getVersionSnapshot(workspaceId, version);
    if (!snap) {
      return c.json({ detail: `Version ${version} not found` }, 404);
    }
    return c.json(snap);
  });

  app.post('/api/workspaces/:id/versions/:version/load', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const version = c.req.param('version');
    const updated = repo.restoreWorkspaceVersion(workspaceId, version);
    if (!updated) {
      return c.json({ detail: `Version ${version} not found` }, 404);
    }
    return c.json({ success: true, workspace: updated });
  });

  app.get('/api/workspaces/:id/diff', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    const versions = repo.listVersions(workspaceId);
    const latestPublished = versions.length > 0 ? versions[0].version : null;

    const v1 = c.req.query('v1');
    const v2 = c.req.query('v2');

    let oldJson = {};
    let baseLabel = '';

    if (v1) {
      const snap1 = repo.getVersionSnapshot(workspaceId, v1);
      if (snap1) {
        oldJson = snap1.jsonCache;
        baseLabel = `v${v1}`;
      } else {
        baseLabel = v1;
      }
    } else if (latestPublished) {
      const snap1 = repo.getVersionSnapshot(workspaceId, latestPublished);
      if (snap1) {
        oldJson = snap1.jsonCache;
        baseLabel = `Published (v${latestPublished})`;
      }
    }

    let newJson = ws.jsonCache;
    let targetLabel = ws.state === 'PUBLISHED' ? `Published (v${ws.version})` : `Current Draft`;

    if (v2) {
      if (v2 === 'current' || v2 === 'draft') {
        newJson = ws.jsonCache;
        targetLabel = ws.state === 'PUBLISHED' ? `Published (v${ws.version})` : `Current Draft`;
      } else {
        const snap2 = repo.getVersionSnapshot(workspaceId, v2);
        if (snap2) {
          newJson = snap2.jsonCache;
          targetLabel = `v${v2}`;
        }
      }
    }

    const diffResult = diffWorkspaces(oldJson, newJson);
    return c.json({
      ...diffResult,
      baseVersion: baseLabel || 'Initial',
      targetVersion: targetLabel,
      availableVersions: versions.map((v) => v.version)
    });
  });

  app.get('/api/workspaces/:id/export', (c) => {
    const workspaceId = parseInt(c.req.param('id'), 10);
    const ws = repo.getWorkspace(workspaceId);
    if (!ws) {
      return c.json({ detail: 'Workspace not found' }, 404);
    }

    const format = (c.req.query('format') || 'mermaid').toLowerCase();
    const viewKey = c.req.query('viewKey') || null;

    try {
      const parsed = parseDsl(ws.dslSource);
      if (format === 'mermaid') {
        const content = exportToMermaid(parsed, viewKey);
        return c.text(content, 200, { 'Content-Type': 'text/plain' });
      } else if (format === 'plantuml') {
        const content = exportToPlantUML(parsed, viewKey);
        return c.text(content, 200, { 'Content-Type': 'text/plain' });
      } else if (format === 'json') {
        const jsonData = workspaceToStructurizrJson(parsed);
        return c.text(JSON.stringify(jsonData, null, 2), 200, { 'Content-Type': 'application/json' });
      } else if (format === 'dsl') {
        return c.text(ws.dslSource, 200, { 'Content-Type': 'text/plain' });
      } else {
        return c.json({ detail: `Unsupported format '${format}'` }, 400);
      }
    } catch (err: any) {
      return c.json({ detail: err.message }, 500);
    }
  });

  app.get('/api/enterprise/catalog', (c) => {
    const latestOnly = c.req.query('latest') === 'true';
    const wsIdParam = c.req.query('workspaceId');
    const workspaceId = wsIdParam ? parseInt(wsIdParam, 10) : undefined;
    return c.json(repo.getEnterpriseCatalog({ latestOnly, workspaceId }));
  });

  // ============================================================================
  // Model Context Protocol (MCP) JSON-RPC Endpoint
  // ============================================================================

  app.post('/mcp', async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ detail: 'Invalid JSON' }, 400);
    }

    const method = body.method;
    const params = body.params || {};
    const reqId = body.id;

    if (method === 'tools/list') {
      return c.json({
        jsonrpc: '2.0',
        id: reqId,
        result: {
          tools: StructurizrMCP.getToolDefinitions()
        }
      });
    } else if (method === 'tools/call') {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      const result = StructurizrMCP.executeTool(toolName, toolArgs);
      return c.json({
        jsonrpc: '2.0',
        id: reqId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      });
    } else {
      return c.json({
        jsonrpc: '2.0',
        id: reqId,
        error: { code: -32601, message: `Method '${method}' not found` }
      });
    }
  });

  // Frontend static assets fallback
  const frontendDist = path.resolve('../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.get('*', async (c, next) => {
      const filePath = path.join(frontendDist, c.req.path === '/' ? 'index.html' : c.req.path);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png'
        };
        return c.body(content, 200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      }
      // Fallback for SPA routing
      const indexHtml = path.join(frontendDist, 'index.html');
      if (fs.existsSync(indexHtml)) {
        return c.html(fs.readFileSync(indexHtml, 'utf-8'));
      }
      return next();
    });
  }

  return app;
}

export const app = createApp();
