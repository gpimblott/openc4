import { describe, it, expect } from 'vitest';
import {
  getCandidateUrls,
  findValidationTool,
  validateDslWithMcp,
  testMcpConnection
} from '../src/engine/mcpClient.js';

describe('MCP Client Module', () => {
  it('normalizes server URLs and generates candidate endpoints', () => {
    const urls1 = getCandidateUrls('localhost:8000');
    expect(urls1).toContain('http://localhost:8000/mcp');
    expect(urls1).toContain('http://localhost:8000');

    const urls2 = getCandidateUrls('http://127.0.0.1:8080/mcp');
    expect(urls2[0]).toBe('http://127.0.0.1:8080/mcp');

    const urls3 = getCandidateUrls('https://remote-mcp.internal:9000/api');
    expect(urls3).toContain('https://remote-mcp.internal:9000/api');
    expect(urls3).toContain('https://remote-mcp.internal:9000/api/mcp');

    const defaultUrls = getCandidateUrls('');
    expect(defaultUrls).toContain('http://localhost:8000/mcp');
  });

  it('identifies validation tools by priority', () => {
    const tools1 = [
      { name: 'other_tool' },
      { name: 'validate_dsl', description: 'Validate DSL' },
      { name: 'validate' }
    ];
    expect(findValidationTool(tools1)?.name).toBe('validate_dsl');

    const tools2 = [
      { name: 'other_tool' },
      { name: 'structurizr_validate_dsl' }
    ];
    expect(findValidationTool(tools2)?.name).toBe('structurizr_validate_dsl');

    const tools3 = [
      { name: 'inspect_workspace' }
    ];
    expect(findValidationTool(tools3)?.name).toBe('inspect_workspace');

    expect(findValidationTool([])).toBeNull();
  });

  it('reports connection failures gracefully for unreachable servers', async () => {
    const res = await testMcpConnection('http://127.0.0.1:59999/mcp', 300);
    expect(res.connected).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('handles validation failure on unreachable server', async () => {
    const res = await validateDslWithMcp({
      serverUrl: 'http://127.0.0.1:59999/mcp',
      dsl: 'workspace {}',
      timeoutMs: 300
    });
    expect(res.success).toBe(false);
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('Failed to connect');
  });
});
