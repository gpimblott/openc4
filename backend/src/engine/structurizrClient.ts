/**
 * Structurizr Client for communicating with local or remote Structurizr instances.
 * Supports publishing current DSL architecture models via:
 * 1. Structurizr Web API (HTTP REST PUT /api/workspace/{id} with official Structurizr JSON)
 * 2. Structurizr MCP Server (JSON-RPC tools/call using 'updateWorkspace' / 'publish_workspace')
 */

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
 * Returns prioritized REST API candidate endpoints for a given base URL and workspace ID.
 */
export function getRestCandidateEndpoints(inputUrl: string, workspaceId: number = 1): string[] {
  const base = getCleanBaseUrl(inputUrl);
  return [
    `${base}/api/workspace/${workspaceId}`,
    `${base}/workspace/${workspaceId}`,
    `${base}/api/workspace`,
    base
  ];
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
  const openUrl = `${base}/workspace/${workspaceId}`;

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

  // ==========================================================================
  // Mode B: Structurizr Web API (HTTP REST PUT /api/workspace/{id})
  // ==========================================================================
  const structurizrJson = workspaceToStructurizrJson(parsedWs);
  structurizrJson.id = workspaceId;
  structurizrJson.name = workspaceName;
  if (parsedWs.description) {
    structurizrJson.description = parsedWs.description;
  }
  structurizrJson.lastModifiedDate = new Date().toISOString();
  structurizrJson.lastModifiedAgent = 'openc4';

  const bodyContent =
    format === 'dsl' ? dsl : JSON.stringify(structurizrJson, null, 2);
  const contentType =
    format === 'dsl' ? 'text/plain; charset=UTF-8' : 'application/json; charset=UTF-8';

  const endpoints = [
    `${base}/api/workspace/${workspaceId}`,
    `${base}/workspace/${workspaceId}`
  ];

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
