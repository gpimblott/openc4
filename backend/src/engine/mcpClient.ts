/**
 * MCP (Model Context Protocol) Client for communicating with Structurizr MCP servers.
 * Connects to local or remote MCP servers over HTTP JSON-RPC 2.0 to list tools
 * and execute DSL validation with structured response parsing.
 */

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpConnectionTestResult {
  connected: boolean;
  serverUrl: string;
  tools: McpToolDefinition[];
  validationTool?: string;
  error?: string;
}

export interface McpValidationError {
  message: string;
  line: number;
  column: number;
  file?: string;
}

export interface McpValidationResult {
  success: boolean;
  valid: boolean;
  serverUrl: string;
  toolUsed?: string;
  durationMs: number;
  workspaceName?: string;
  elementCount?: number;
  relationshipCount?: number;
  viewCount?: number;
  findings?: any[];
  error?: McpValidationError | null;
  raw?: any;
}

/**
 * Normalizes a user-provided server URL to generate prioritized candidate endpoints.
 * Handles missing protocol and auto-detection of '/mcp' path.
 */
export function getCandidateUrls(inputUrl: string): string[] {
  let clean = (inputUrl || '').trim();
  if (!clean) {
    clean = 'http://localhost:8000/mcp';
  }

  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }

  try {
    const parsed = new URL(clean);
    const pathname = parsed.pathname;
    const candidates: string[] = [];

    // If no path or just root slash, prefer /mcp then root
    if (!pathname || pathname === '/') {
      const base = `${parsed.protocol}//${parsed.host}`;
      candidates.push(`${base}/mcp`, base);
    } else if (pathname.endsWith('/mcp')) {
      // If explicit path ending with /mcp
      const base = `${parsed.protocol}//${parsed.host}`;
      candidates.push(clean, base);
    } else {
      // If custom path provided, try it first, then try appending /mcp
      const trimmed = clean.replace(/\/$/, '');
      candidates.push(trimmed, `${trimmed}/mcp`);
    }

    if (parsed.host === 'localhost:8080' || parsed.host === '127.0.0.1:8080') {
      candidates.push(
        'http://structurizr:8080/mcp',
        'http://structurizr:8080',
        'http://structurizr-local:8080/mcp',
        'http://structurizr-local:8080',
        'http://host.docker.internal:8080/mcp',
        'http://host.docker.internal:8080'
      );
    }

    return Array.from(new Set(candidates));
  } catch {
    return [clean];
  }
}

/**
 * Performs JSON-RPC call against an HTTP endpoint.
 */
async function sendJsonRpc(
  url: string,
  method: string,
  params: Record<string, any> = {},
  timeoutMs: number = 6000
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
        id: `openc4-${Date.now()}`,
        method,
        params
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText} ${text ? `- ${text.slice(0, 150)}` : ''}`.trim());
    }

    const data = await res.json();
    return data;
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
 * Tests connection to an MCP server by querying tools/list.
 */
export async function testMcpConnection(
  serverUrl: string,
  timeoutMs: number = 6000
): Promise<McpConnectionTestResult> {
  const candidates = getCandidateUrls(serverUrl);
  let lastError = 'Unknown connection error';

  for (const candidate of candidates) {
    try {
      const res = await sendJsonRpc(candidate, 'tools/list', {}, timeoutMs);

      if (res.error) {
        lastError = res.error.message || `MCP Error ${res.error.code}`;
        continue;
      }

      const tools: McpToolDefinition[] = res.result?.tools || [];
      const validationTool = findValidationTool(tools);

      return {
        connected: true,
        serverUrl: candidate,
        tools,
        validationTool: validationTool?.name
      };
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  return {
    connected: false,
    serverUrl: candidates[0] || serverUrl,
    tools: [],
    error: lastError
  };
}

/**
 * Finds the most suitable tool for validating Structurizr DSL from a tool list.
 */
export function findValidationTool(tools: McpToolDefinition[]): McpToolDefinition | null {
  if (!tools || tools.length === 0) return null;

  // 1. Exact match 'validate_dsl'
  const exact = tools.find((t) => t.name.toLowerCase() === 'validate_dsl');
  if (exact) return exact;

  // 2. Contains validate and dsl
  const matchBoth = tools.find(
    (t) => t.name.toLowerCase().includes('validate') && t.name.toLowerCase().includes('dsl')
  );
  if (matchBoth) return matchBoth;

  // 3. Named 'validate' or contains 'validate'
  const matchValidate = tools.find((t) => t.name.toLowerCase().includes('validate'));
  if (matchValidate) return matchValidate;

  // 4. Inspection tool fallback
  const matchInspect = tools.find((t) => t.name.toLowerCase().includes('inspect'));
  if (matchInspect) return matchInspect;

  return null;
}

/**
 * Extracts the appropriate parameter name for the DSL source code from inputSchema.
 */
function getDslParamName(tool?: McpToolDefinition | null): string {
  if (!tool?.inputSchema?.properties) return 'dsl';

  const props = Object.keys(tool.inputSchema.properties);
  if (props.includes('dsl')) return 'dsl';
  if (props.includes('source')) return 'source';
  if (props.includes('code')) return 'code';
  if (props.includes('content')) return 'content';
  return props[0] || 'dsl';
}

/**
 * Validates Structurizr DSL source code using an external/local MCP server.
 */
export async function validateDslWithMcp(options: {
  serverUrl: string;
  dsl: string;
  timeoutMs?: number;
}): Promise<McpValidationResult> {
  const startTime = Date.now();
  const { serverUrl, dsl, timeoutMs = 8000 } = options;
  const candidates = getCandidateUrls(serverUrl);

  let activeUrl = candidates[0];
  let selectedToolName = 'validate_dsl';
  let paramName = 'dsl';
  let rpcResponse: any = null;
  let lastError: any = null;

  // Attempt discovery or direct call across candidates
  for (const candidate of candidates) {
    activeUrl = candidate;
    try {
      // Step 1: Discover tools
      try {
        const listRes = await sendJsonRpc(candidate, 'tools/list', {}, Math.min(timeoutMs, 3000));
        if (listRes.result?.tools) {
          const matched = findValidationTool(listRes.result.tools);
          if (matched) {
            selectedToolName = matched.name;
            paramName = getDslParamName(matched);
          }
        }
      } catch {
        // Some MCP servers might not implement tools/list or only support tools/call
      }

      // Step 2: Call the validation tool
      rpcResponse = await sendJsonRpc(
        candidate,
        'tools/call',
        {
          name: selectedToolName,
          arguments: {
            [paramName]: dsl
          }
        },
        timeoutMs
      );

      // If we got here, server responded
      break;
    } catch (err: any) {
      lastError = err;
    }
  }

  const durationMs = Date.now() - startTime;

  if (!rpcResponse) {
    return {
      success: false,
      valid: false,
      serverUrl: activeUrl,
      durationMs,
      error: {
        message: `Failed to connect to MCP server: ${lastError?.message || 'Connection refused'}`,
        line: 1,
        column: 1
      }
    };
  }

  // Handle JSON-RPC protocol error
  if (rpcResponse.error) {
    return {
      success: false,
      valid: false,
      serverUrl: activeUrl,
      toolUsed: selectedToolName,
      durationMs,
      error: {
        message: `MCP Server Error (${rpcResponse.error.code}): ${rpcResponse.error.message}`,
        line: 1,
        column: 1
      },
      raw: rpcResponse
    };
  }

  const result = rpcResponse.result || {};
  let parsedContent: any = null;

  // Standard MCP tools/call returns: { content: [{ type: 'text', text: '...' }], isError?: boolean }
  if (Array.isArray(result.content) && result.content.length > 0) {
    const textItem = result.content.find((c: any) => c.type === 'text') || result.content[0];
    const rawText = textItem?.text || '';

    try {
      parsedContent = JSON.parse(rawText);
    } catch {
      parsedContent = rawText;
    }
  } else {
    parsedContent = result;
  }

  // Evaluate validity and extract metrics
  let isValid = true;
  let validationError: McpValidationError | null = null;
  let workspaceName: string | undefined;
  let elementCount: number | undefined;
  let relationshipCount: number | undefined;
  let viewCount: number | undefined;
  let findings: any[] | undefined;

  if (result.isError === true) {
    isValid = false;
  }

  if (parsedContent && typeof parsedContent === 'object') {
    if (parsedContent.valid !== undefined) {
      isValid = Boolean(parsedContent.valid);
    }

    workspaceName = parsedContent.workspaceName || parsedContent.workspace?.name || parsedContent.workspace;
    elementCount = parsedContent.elementCount ?? parsedContent.elements?.length;
    relationshipCount = parsedContent.relationshipCount ?? parsedContent.relationships?.length;
    viewCount = parsedContent.viewCount ?? parsedContent.views?.length;
    findings = parsedContent.findings;

    if (!isValid || parsedContent.error) {
      const errObj = parsedContent.error || parsedContent;
      validationError = {
        message: errObj.message || (typeof errObj === 'string' ? errObj : 'DSL validation failed'),
        line: typeof errObj.line === 'number' ? errObj.line : 1,
        column: typeof errObj.column === 'number' ? errObj.column : 1,
        file: errObj.file
      };
    }
  } else if (typeof parsedContent === 'string') {
    // Text output parsing
    const hasErrorWord = /\b(error|failed|exception|invalid|syntax)\b/i.test(parsedContent);
    const hasCleanWord = /\b(valid|clean|passed|success)\b/i.test(parsedContent);

    if (hasErrorWord && !hasCleanWord) {
      isValid = false;
      const lineMatch = parsedContent.match(/(?:line|Line)\s*(\d+)/);
      const colMatch = parsedContent.match(/(?:col|column|Column)\s*(\d+)/);
      validationError = {
        message: parsedContent.slice(0, 300),
        line: lineMatch ? parseInt(lineMatch[1], 10) : 1,
        column: colMatch ? parseInt(colMatch[1], 10) : 1
      };
    } else {
      isValid = true;
    }
  }

  return {
    success: true,
    valid: isValid,
    serverUrl: activeUrl,
    toolUsed: selectedToolName,
    durationMs,
    workspaceName: typeof workspaceName === 'string' ? workspaceName : undefined,
    elementCount,
    relationshipCount,
    viewCount,
    findings,
    error: validationError,
    raw: rpcResponse
  };
}
