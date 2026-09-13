/**
 * Structurizr Client for communicating with local or remote Structurizr instances.
 * Supports publishing current DSL architecture models via:
 * 1. Structurizr Web API (HTTP REST PUT /api/workspace/{id} with official Structurizr JSON)
 * 2. Structurizr MCP Server (JSON-RPC tools/call using 'updateWorkspace' / 'publish_workspace')
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseDsl, ParseError } from './parser.js';
import { workspaceToStructurizrJson } from './compiler.js';
import { testMcpConnection, getCandidateUrls } from './mcpClient.js';

export interface StructurizrConnectionTestResult {
  connected: boolean;
  serverUrl: string;
  mode: 'rest' | 'mcp' | 'unknown';
  workspaceId?: number;
  workspaceName?: string;
  tools?: string[];
  publishTool?: string;
  error?: string;
}

export interface StructurizrPublishResult {
  success: boolean;
  serverUrl: string;
  mode: 'rest' | 'mcp';
  workspaceId: number;
  durationMs: number;
  workspaceName?: string;
  elementCount?: number;
  relationshipCount?: number;
  viewCount?: number;
  openUrl?: string;
  toolUsed?: string;
  error?: {
    message: string;
    line?: number;
    column?: number;
    file?: string;
  } | null;
  raw?: any;
}

export interface PublishToStructurizrOptions {
  serverUrl: string;
  workspaceId?: number;
  apiKey?: string;
  apiSecret?: string;
  dsl: string;
  format?: 'json' | 'dsl';
  branch?: string;
  mode?: 'auto' | 'rest' | 'mcp';
  timeoutMs?: number;
}

/**
 * Cleans and normalizes a user-provided Structurizr URL to a clean base URL.
 */
export function getCleanBaseUrl(inputUrl: string): string {
  let clean = (inputUrl || '').trim();
  if (!clean) {
    clean = 'http://localhost:8080';
  }
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  clean = clean.replace(/\/+$/, '');
  clean = clean.replace(/\/api\/workspace(?:\/\d+)?$/i, '');
  clean = clean.replace(/\/workspace(?:\/\d+)?$/i, '');
  clean = clean.replace(/\/mcp$/i, '');
  return clean;
}

/**
 * Returns prioritized candidate base URLs for connecting to Structurizr.
 * If inputUrl specifies localhost:8080 or 127.0.0.1:8080, and the backend is running
 * in a containerized environment (e.g. Docker Compose), localhost:8080 will fail.
 * We automatically include Docker network hostnames (structurizr, structurizr-local, host.docker.internal).
 */
export function getCandidateBaseUrls(inputUrl: string): string[] {
  const base = getCleanBaseUrl(inputUrl);
  const candidates: string[] = [base];

  if (base.includes('localhost:8080') || base.includes('127.0.0.1:8080')) {
    candidates.push(
      base.replace(/localhost:8080|127\.0\.0\.1:8080/, 'structurizr:8080'),
      base.replace(/localhost:8080|127\.0\.0\.1:8080/, 'structurizr-local:8080'),
      base.replace(/localhost:8080|127\.0\.0\.1:8080/, 'host.docker.internal:8080')
    );
  }

  if (process.env.STRUCTURIZR_URL) {
    const envBase = getCleanBaseUrl(process.env.STRUCTURIZR_URL);
    if (!candidates.includes(envBase)) {
      candidates.unshift(envBase);
    }
  }

  return Array.from(new Set(candidates));
}

/**
 * Returns prioritized REST API candidate endpoints for a given base URL and workspace ID.
 */
export function getRestCandidateEndpoints(inputUrl: string, workspaceId: number = 1): string[] {
  const baseUrls = getCandidateBaseUrls(inputUrl);
  const endpoints: string[] = [];
  for (const b of baseUrls) {
    endpoints.push(`${b}/api/workspace/${workspaceId}`);
    endpoints.push(`${b}/workspace/${workspaceId}`);
  }
  return endpoints;
}

/**
 * Helper to send JSON-RPC calls for MCP endpoints.
 */
async function sendJsonRpc(
  url: string,
  method: string,
  params: Record<string, any> = {},
  timeoutMs: number = 5000
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `openc4-publish-${Date.now()}`,
        method,
        params
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText} ${text ? `- ${text.slice(0, 100)}` : ''}`.trim());
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Connection timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tests connection to a Structurizr server (checks MCP first, then REST).
 */
export async function testStructurizrConnection(options: {
  serverUrl: string;
  workspaceId?: number;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<StructurizrConnectionTestResult> {
  const { serverUrl, workspaceId = 1, apiKey, timeoutMs = 5000 } = options;

  // 1. Check MCP endpoint first using mcpClient's candidate resolution
  // This guarantees that any server passing MCP validation test connection also passes here.
  try {
    const mcpTest = await testMcpConnection(serverUrl, Math.min(timeoutMs, 4000));
    if (mcpTest.connected) {
      const toolList = (mcpTest.tools || []).map((t: any) =>
        typeof t === 'string' ? t : t.name
      );
      const publishTool = toolList.find((name: string) =>
        ['updateworkspace', 'publish_workspace', 'set_workspace', 'update_workspace', 'import_dsl'].includes(
          name.toLowerCase()
        )
      );
      return {
        connected: true,
        serverUrl: mcpTest.serverUrl,
        mode: 'mcp',
        workspaceId,
        tools: toolList,
        publishTool: publishTool || 'updateWorkspace'
      };
    }
  } catch {
    // Continue to REST check
  }

  // 2. Test REST API candidate endpoints
  const base = getCleanBaseUrl(serverUrl);
  const restCandidates = getRestCandidateEndpoints(serverUrl, workspaceId);
  let lastRestError = 'Connection refused';

  for (const endpoint of restCandidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 2500));

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json, text/html, */*',
        'User-Agent': 'openc4'
      };
      if (apiKey) {
        headers['X-Authorization'] = apiKey;
      }

      const res = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      // Any HTTP response (2xx, 3xx, 4xx) indicates the server is alive and responding
      if (res.status < 500) {
        let wsName: string | undefined;
        if (res.status === 200) {
          try {
            const data = await res.json();
            if (data.name) wsName = data.name;
          } catch {
            // ignore non-json response
          }
        }
        return {
          connected: true,
          serverUrl: endpoint,
          mode: 'rest',
          workspaceId,
          workspaceName: wsName
        };
      } else {
        lastRestError = `Server returned HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      lastRestError = err.message || String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    connected: false,
    serverUrl,
    mode: 'unknown',
    workspaceId,
    error: lastRestError
  };
}

/**
 * Normalizes containerInstance identifiers in DSL if '!identifiers hierarchical' is present,
 * ensuring Structurizr Java parser can resolve container instances without throwing
 * 'The container "x" does not exist'.
 */
export function normalizeDslForStructurizr(dsl: string, parsedWs: any): string {
  if (!dsl) return dsl;

  let normalized = dsl;

  // 1. Missing space before quote on declarations (e.g. businessApplicationContainer"Business Application Containers")
  normalized = normalized.replace(
    /(container|component|softwareSystem|deploymentNode|person)\s+([a-zA-Z0-9_.]+)\s+([a-zA-Z0-9_]+)"/g,
    '$1 $2 $3 "'
  );

  // 2. Fix systemLandscape view keys with spaces or special characters
  // In Structurizr DSL: systemLandscape [key] [description] {
  // If user wrote systemLandscape "Company ecosystem" {, Structurizr rejects because key has spaces.
  normalized = normalized.replace(/systemLandscape\s+"([^"\n]+)"\s*\{/g, (_m, title) => {
    const key = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `systemLandscape ${key} "${title}" {`;
  });

  // 3. Normalizes containerInstance identifiers in DSL if '!identifiers hierarchical' is present
  if (normalized.includes('!identifiers hierarchical') && parsedWs?.model) {
    const shortToHierarchical: Record<string, string> = {};
    for (const sys of parsedWs.model.softwareSystems || []) {
      const sysIdent = sys.identifier;
      for (const cont of sys.containers || []) {
        const contIdent = cont.identifier;
        if (sysIdent && contIdent) {
          shortToHierarchical[contIdent] = `${sysIdent}.${contIdent}`;
        }
      }
    }

    for (const [short, full] of Object.entries(shortToHierarchical)) {
      const regex = new RegExp(`\\bcontainerInstance\\s+${short}\\b`, 'g');
      normalized = normalized.replace(regex, `containerInstance ${full}`);
    }
  }

  // 4. Upgrade autolayout statements with rank/node separation (300 300) so Graphviz doesn't collapse ranks
  normalized = normalized.replace(/\bautolayout\s+(lr|rl|tb|bt)(?!\s+\d+)/gi, 'autolayout $1 300 300');
  normalized = normalized.replace(/\bautolayout(?!\s+(?:lr|rl|tb|bt|\d+))/gi, 'autolayout tb 300 300');

  // 5. Ensure views without autolayout get autolayout injected to prevent overlapping elements
  normalized = normalized.replace(
    /(\b(?:container|component|systemContext|systemLandscape|deployment)\b[^{]*\{)([\s\S]*?)(\})/gi,
    (match, header, body, footer) => {
      if (/autolayout/i.test(body)) {
        return match;
      }
      const isTb = /deployment|component/i.test(header);
      const defaultLayout = isTb ? 'autolayout tb 300 300' : 'autolayout lr 300 300';
      return `${header}${body}            ${defaultLayout}\n        ${footer}`;
    }
  );

  return normalized;
}

/**
 * Publishes DSL / Structurizr JSON to a Structurizr server or MCP instance.
 */
export async function publishToStructurizr(
  options: PublishToStructurizrOptions
): Promise<StructurizrPublishResult> {
  const startTime = Date.now();
  const {
    serverUrl,
    workspaceId = 1,
    apiKey,
    dsl,
    format = 'json',
    branch = 'main',
    mode = 'auto',
    timeoutMs = 8000
  } = options;

  const base = getCleanBaseUrl(serverUrl);
  const openUrl = serverUrl.includes(':8000')
    ? `${base}/?workspaceId=${workspaceId}`
    : `${base}/workspace/${workspaceId}/diagrams`;

  // Step 1: Parse DSL to validate and extract metrics
  let parsedWs: any;
  try {
    parsedWs = parseDsl(dsl);
  } catch (err: any) {
    const dur = Date.now() - startTime;
    if (err instanceof ParseError) {
      const jsonErr = err.toJSON();
      return {
        success: false,
        serverUrl,
        mode: mode === 'mcp' ? 'mcp' : 'rest',
        workspaceId,
        durationMs: dur,
        error: {
          message: jsonErr.message,
          line: jsonErr.line,
          column: jsonErr.column
        }
      };
    }
    return {
      success: false,
      serverUrl,
      mode: mode === 'mcp' ? 'mcp' : 'rest',
      workspaceId,
      durationMs: dur,
      error: { message: err.message || 'DSL Parse Error', line: 1, column: 1 }
    };
  }

  const elementCount = parsedWs.model.people.length + parsedWs.model.softwareSystems.length;
  const relationshipCount = parsedWs.model.relationships.length;
  const viewCount = parsedWs.views.length;
  const workspaceName = parsedWs.name || `Workspace ${workspaceId}`;

  const candidates = getCandidateUrls(serverUrl);
  const isMcpPreferred =
    mode === 'mcp' ||
    (mode === 'auto' && (serverUrl.toLowerCase().includes('/mcp') || candidates[0]?.endsWith('/mcp')));

  // ==========================================================================
  // Mode A: Structurizr MCP Server (JSON-RPC tools/call updateWorkspace)
  // ==========================================================================
  if (isMcpPreferred || mode === 'auto') {
    for (const mcpEndpoint of candidates) {
      try {
        let toolName = 'updateWorkspace';
        try {
          const listRes = await sendJsonRpc(mcpEndpoint, 'tools/list', {}, Math.min(timeoutMs, 2500));
          const tools = listRes.result?.tools || listRes.tools;
          if (Array.isArray(tools)) {
            const matched = tools.find((t: any) => {
              const n = typeof t === 'string' ? t : t.name;
              return ['updateworkspace', 'publish_workspace', 'set_workspace', 'import_dsl'].includes(
                (n || '').toLowerCase()
              );
            });
            if (matched) toolName = typeof matched === 'string' ? matched : matched.name;
          }
        } catch {
          // Fall back to default toolName
        }

        const rpcRes = await sendJsonRpc(
          mcpEndpoint,
          'tools/call',
          {
            name: toolName,
            arguments: {
              url: base,
              workspaceId,
              apiKey: apiKey || '',
              dsl
            }
          },
          timeoutMs
        );

        const dur = Date.now() - startTime;
        if (rpcRes.error) {
          if (mode === 'mcp') {
            return {
              success: false,
              serverUrl: mcpEndpoint,
              mode: 'mcp',
              workspaceId,
              durationMs: dur,
              toolUsed: toolName,
              error: {
                message: `MCP Server Error (${rpcRes.error.code}): ${rpcRes.error.message}`
              },
              raw: rpcRes
            };
          }
          continue; // Try next candidate or REST if auto mode
        }

        return {
          success: true,
          serverUrl: mcpEndpoint,
          mode: 'mcp',
          workspaceId,
          durationMs: dur,
          workspaceName,
          elementCount,
          relationshipCount,
          viewCount,
          openUrl,
          toolUsed: toolName,
          raw: rpcRes.result
        };
      } catch (err: any) {
        if (mode === 'mcp') {
          const dur = Date.now() - startTime;
          return {
            success: false,
            serverUrl: mcpEndpoint,
            mode: 'mcp',
            workspaceId,
            durationMs: dur,
            error: { message: `Failed to publish via MCP: ${err.message}` }
          };
        }
      }
    }
  }

  const structurizrJson = workspaceToStructurizrJson(parsedWs);
  structurizrJson.id = workspaceId;
  structurizrJson.name = workspaceName;
  if (parsedWs.description) {
    structurizrJson.description = parsedWs.description;
  }
  structurizrJson.lastModifiedDate = new Date().toISOString();
  structurizrJson.lastModifiedAgent = 'openc4';

  const effectiveDsl = normalizeDslForStructurizr(dsl, parsedWs);
  structurizrJson.properties = structurizrJson.properties || {};
  structurizrJson.properties['structurizr.dsl'] = Buffer.from(effectiveDsl, 'utf-8').toString('base64');

  // If local or volume-mounted structurizr directory exists, keep workspace.dsl in sync
  // so Structurizr Lite immediately serves the formatted DSL
  const possibleDirs = [
    '/structurizr-data',
    '/usr/local/structurizr',
    './structurizr-data',
    path.resolve(process.cwd(), 'structurizr-data'),
    path.resolve(process.cwd(), '../structurizr-data')
  ];
  if (effectiveDsl && effectiveDsl.trim().length > 0) {
    for (const dir of possibleDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.writeFileSync(path.join(dir, 'workspace.dsl'), effectiveDsl, 'utf-8');
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  const bodyContent = JSON.stringify(structurizrJson, null, 2);
  const contentType = 'application/json; charset=UTF-8';

  const candidateBases = getCandidateBaseUrls(serverUrl);
  const endpoints: string[] = [];
  for (const b of candidateBases) {
    endpoints.push(`${b}/api/workspace/${workspaceId}`);
    endpoints.push(`${b}/workspace/${workspaceId}`);
  }

  let lastRestError = 'Connection failed';
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'openc4'
      };
      if (apiKey) {
        headers['X-Authorization'] = apiKey;
      }
      if (branch && branch.toLowerCase() !== 'main') {
        headers['X-Branch'] = branch;
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: bodyContent,
        signal: controller.signal
      });

      const dur = Date.now() - startTime;

      if (res.ok) {
        let rawData: any;
        try {
          rawData = await res.json();
        } catch {
          rawData = await res.text().catch(() => '');
        }

        return {
          success: true,
          serverUrl: endpoint,
          mode: 'rest',
          workspaceId,
          durationMs: dur,
          workspaceName,
          elementCount,
          relationshipCount,
          viewCount,
          openUrl,
          raw: rawData
        };
      } else {
        const errText = await res.text().catch(() => '');
        lastRestError = `Server returned HTTP ${res.status}: ${res.statusText} ${errText ? `- ${errText.slice(0, 150)}` : ''}`.trim();

        // If Structurizr Lite rejects with "Workspace ID must be 1", automatically retry targeting ID 1
        if (
          res.status === 400 &&
          workspaceId !== 1 &&
          (errText.includes('Workspace ID must be 1') || lastRestError.includes('Workspace ID must be 1'))
        ) {
          return await publishToStructurizr({
            ...options,
            workspaceId: 1
          });
        }

        if (res.status === 401 || res.status === 403 || res.status === 400) {
          return {
            success: false,
            serverUrl: endpoint,
            mode: 'rest',
            workspaceId,
            durationMs: dur,
            error: { message: lastRestError }
          };
        }
      }
    } catch (err: any) {
      lastRestError = err.message || String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  const finalDur = Date.now() - startTime;
  return {
    success: false,
    serverUrl: endpoints[0],
    mode: 'rest',
    workspaceId,
    durationMs: finalDur,
    error: {
      message: `Failed to publish to Structurizr server: ${lastRestError}`
    }
  };
}
