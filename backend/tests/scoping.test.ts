import { describe, it, expect } from 'vitest';
import { parseDsl } from '../src/engine/parser.js';
import { compileViewToCanvas, exportToMermaid, exportToPlantUML } from '../src/engine/compiler.js';
import { DEFAULT_SAMPLE_DSL } from '../src/api/app.js';

describe('C4 View Scoping', () => {
  const ws = parseDsl(DEFAULT_SAMPLE_DSL);

  it('correctly scopes SystemContext view', () => {
    const canvas = compileViewToCanvas(ws, 'SystemContext');
    expect(canvas.viewType).toBe('systemcontext');

    const nodeTypes = canvas.nodes.map((n: any) => n.data.type);
    const nodeNames = canvas.nodes.map((n: any) => n.data.name);

    // Only Software Systems and People
    expect(nodeTypes.every((t: string) => t === 'softwareSystem' || t === 'person')).toBe(true);
    expect(nodeNames).toContain('Internet Banking System');
    expect(nodeNames).toContain('Personal Banking Customer');
    expect(nodeNames).toContain('Mainframe Banking System');
    expect(nodeNames).toContain('E-mail System');

    // No containers or components
    expect(nodeTypes).not.toContain('container');
    expect(nodeTypes).not.toContain('component');

    // Edges roll up to SystemContext
    expect(canvas.edges.length).toBeGreaterThanOrEqual(3);
  });

  it('correctly scopes Containers view', () => {
    const canvas = compileViewToCanvas(ws, 'Containers');
    expect(canvas.viewType).toBe('container');

    const nodeTypes = canvas.nodes.map((n: any) => n.data.type);
    const nodeNames = canvas.nodes.map((n: any) => n.data.name);

    // Target software system should NOT be a node itself
    expect(nodeNames).not.toContain('Internet Banking System');

    // Target system containers are present
    expect(nodeNames).toContain('Single-Page Application');
    expect(nodeNames).toContain('API Application');
    expect(nodeNames).toContain('Database');

    // Interacting external people and systems
    expect(nodeNames).toContain('Personal Banking Customer');
    expect(nodeNames).toContain('Mainframe Banking System');
    expect(nodeNames).toContain('E-mail System');

    // No components
    expect(nodeTypes).not.toContain('component');

    // Edges between containers and external elements
    expect(canvas.edges.length).toBeGreaterThanOrEqual(4);

    // Parent software system boundary is provided
    expect(canvas.boundary).not.toBeNull();
    expect(canvas.boundary.name).toBe('Internet Banking System');
    expect(canvas.boundary.type).toBe('softwareSystem');
    expect(canvas.boundary.childIds.length).toBe(3);
  });

  it('correctly scopes Components view', () => {
    const canvas = compileViewToCanvas(ws, 'Components');
    expect(canvas.viewType).toBe('component');

    const nodeTypes = canvas.nodes.map((n: any) => n.data.type);
    const nodeNames = canvas.nodes.map((n: any) => n.data.name);

    // Neither parent software system nor target container should be nodes
    expect(nodeNames).not.toContain('Internet Banking System');
    expect(nodeNames).not.toContain('API Application');

    // Target container's components are present
    expect(nodeNames).toContain('Sign In Controller');
    expect(nodeNames).toContain('Accounts Controller');
    expect(nodeNames).toContain('Payment Service');

    // Sibling containers interacting with components
    expect(nodeNames).toContain('Single-Page Application');
    expect(nodeNames).toContain('Database');

    // External systems interacting with components
    expect(nodeNames).toContain('Mainframe Banking System');
    expect(nodeNames).toContain('E-mail System');

    // Personal Banking Customer only interacts with SPA, so not in API Application component view
    expect(nodeNames).not.toContain('Personal Banking Customer');

    // Edges connect to components
    expect(canvas.edges.length).toBeGreaterThanOrEqual(3);

    // Nested boundaries are provided: Software System -> Container
    expect(canvas.boundaries).toHaveLength(2);
    expect(canvas.boundaries[0].name).toBe('Internet Banking System');
    expect(canvas.boundaries[0].type).toBe('softwareSystem');
    expect(canvas.boundaries[1].name).toBe('API Application');
    expect(canvas.boundaries[1].type).toBe('container');
    expect(canvas.boundaries[1].technology).toBe('TypeScript / Hono');
    expect(canvas.boundaries[1].parentBoundaryId).toBe(canvas.boundaries[0].id);

    // Backward compatible boundary points to primary container
    expect(canvas.boundary).not.toBeNull();
    expect(canvas.boundary.name).toBe('API Application');
    expect(canvas.boundary.type).toBe('container');
  });

  it('exports Mermaid and PlantUML with nested parent boundary outline', () => {
    const mmd = exportToMermaid(ws, 'Components');
    expect(mmd).toContain('subgraph boundary_');
    expect(mmd).toContain('Internet Banking System');
    expect(mmd).toContain('API Application');

    const puml = exportToPlantUML(ws, 'Components');
    expect(puml).toContain('System_Boundary');
    expect(puml).toContain('Container_Boundary');
    expect(puml).toContain('Internet Banking System');
    expect(puml).toContain('API Application');
  });
});
