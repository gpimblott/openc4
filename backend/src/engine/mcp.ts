/**
 * Model Context Protocol (MCP) server implementation for Structurizr C4 Architecture.
 * Allows AI assistants and agents to validate, inspect, query, and export C4 models.
 */

import { parseDsl, ParseError } from './parser.js';
import { inspectWorkspace } from './inspection.js';
import {
  workspaceToStructurizrJson,
  exportToMermaid,
  exportToPlantUML
} from './compiler.js';

export class StructurizrMCP {
  static getToolDefinitions(): any[] {
    return [
      {
        name: 'validate_dsl',
        description: 'Validates Structurizr DSL syntax and returns parsing status and error details.',
        inputSchema: {
          type: 'object',
          properties: {
            dsl: { type: 'string', description: 'The Structurizr DSL source code to validate' }
          },
          required: ['dsl']
        }
      },
      {
        name: 'inspect_workspace',
        description:
          'Performs architectural health checks, identifying missing descriptions, missing technologies, and orphaned elements.',
        inputSchema: {
          type: 'object',
          properties: {
            dsl: { type: 'string', description: 'The Structurizr DSL source code' }
          },
          required: ['dsl']
        }
      },
      {
        name: 'export_diagram',
        description: 'Exports a diagram view to Mermaid, C4-PlantUML, or Structurizr JSON format.',
        inputSchema: {
          type: 'object',
          properties: {
            dsl: { type: 'string', description: 'The Structurizr DSL source code' },
            format: {
              type: 'string',
              enum: ['mermaid', 'plantuml', 'json'],
              description: 'Export format'
            },
            view_key: { type: 'string', description: 'Optional view key to export' }
          },
          required: ['dsl', 'format']
        }
      },
      {
        name: 'query_model',
        description: 'Queries elements, relationships, and dependencies within an architecture model.',
        inputSchema: {
          type: 'object',
          properties: {
            dsl: { type: 'string', description: 'The Structurizr DSL source code' },
            element_name: {
              type: 'string',
              description: 'Optional name or identifier of an element to query'
            }
          },
          required: ['dsl']
        }
      }
    ];
  }

  static executeTool(name: string, args: Record<string, any> = {}): Record<string, any> {
    const dsl = args.dsl || '';

    if (name === 'validate_dsl') {
      try {
        const ws = parseDsl(dsl);
        return {
          valid: true,
          workspaceName: ws.name,
          elementCount: ws.model.people.length + ws.model.softwareSystems.length,
          relationshipCount: ws.model.relationships.length,
          viewCount: ws.views.length
        };
      } catch (err: any) {
        if (err instanceof ParseError) {
          return { valid: false, error: err.toJSON() };
        }
        return { valid: false, error: { message: err.message, line: 1, column: 1 } };
      }
    } else if (name === 'inspect_workspace') {
      try {
        const ws = parseDsl(dsl);
        const findings = inspectWorkspace(ws);
        return {
          valid: true,
          findingCount: findings.length,
          findings
        };
      } catch (err: any) {
        if (err instanceof ParseError) {
          return { valid: false, error: err.toJSON() };
        }
        return { valid: false, error: { message: err.message, line: 1, column: 1 } };
      }
    } else if (name === 'export_diagram') {
      try {
        const ws = parseDsl(dsl);
        const fmt = (args.format || 'mermaid').toLowerCase();
        const viewKey = args.view_key;

        let content = '';
        if (fmt === 'mermaid') {
          content = exportToMermaid(ws, viewKey);
        } else if (fmt === 'plantuml') {
          content = exportToPlantUML(ws, viewKey);
        } else if (fmt === 'json') {
          content = JSON.stringify(workspaceToStructurizrJson(ws), null, 2);
        } else {
          return { error: `Unsupported format '${fmt}'` };
        }

        return { format: fmt, content };
      } catch (err: any) {
        if (err instanceof ParseError) {
          return { valid: false, error: err.toJSON() };
        }
        return { valid: false, error: { message: err.message, line: 1, column: 1 } };
      }
    } else if (name === 'query_model') {
      try {
        const ws = parseDsl(dsl);
        const systems = ws.model.softwareSystems.map((s) => ({
          name: s.name,
          id: s.id,
          containers: s.containers.map((c) => c.name)
        }));
        const people = ws.model.people.map((p) => ({
          name: p.name,
          id: p.id
        }));
        const relationships = ws.model.relationships.map((r) => ({
          source: r.sourceId,
          destination: r.destinationId,
          description: r.description
        }));

        return {
          workspace: ws.name,
          people,
          softwareSystems: systems,
          relationships
        };
      } catch (err: any) {
        if (err instanceof ParseError) {
          return { valid: false, error: err.toJSON() };
        }
        return { valid: false, error: { message: err.message, line: 1, column: 1 } };
      }
    }

    return { error: `Unknown tool: ${name}` };
  }
}
