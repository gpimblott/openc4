# OpenC4 — Modern Enterprise Architecture & Structurizr Platform

**OpenC4** is a modern, high-performance, open-source enterprise architecture platform designed for the **C4 model**. It is **100% compatible** with the **Structurizr DSL**, the **official Structurizr Web API** (`structurizr-cli`), and official **Structurizr JSON** schemas, while replacing the legacy, clunky JSP interface with a fluid, reactive, developer-friendly Web Studio.

---

## Why OpenC4?

The legacy Structurizr on-premises application (`structurizr/onpremises`) was officially archived (End of Life in March 2026). While the new monorepo (`structurizr/structurizr`) brought useful modules like `structurizr-mcp` and `structurizr-inspection`, the web application **remained on an outdated JSP / Servlet web container** with no live in-browser DSL editor, rigid layouts, and no federated enterprise model catalog.

OpenC4 solves this by delivering:
1. **Live Split-Screen Studio**: Monaco DSL editor with syntax highlighting, autocomplete, and sub-50ms live diagram rendering.
2. **Interactive C4 Canvas**: Fluid React Flow canvas with pan, zoom, minimap, smart Dagre auto-layout, and non-destructive coordinate saving.
3. **Deep C4 Drill-Down**: Double-click a System to drill into Containers; double-click a Container to drill into Components.
4. **Enterprise Model Catalog**: Publish software systems to an organization-wide registry and import/reference them across team workspaces.
5. **Publishing & Visual Diffing**: Versioned release lifecycle (`Draft` $\rightarrow$ `Published`) with visual diffs highlighting added, modified, and removed components.
6. **100% Structurizr REST API Compatibility**: Works seamlessly with `structurizr-cli push` and `structurizr-cli pull`.
7. **Native Model Context Protocol (MCP)**: Built-in `/mcp` JSON-RPC endpoint for AI assistants (Gemini, Claude, ChatGPT) to validate, inspect, and generate architecture models.
8. **Architecture Inspection Linter**: Automated rule checker flagging missing descriptions, missing technologies, and orphaned elements.
9. **Multi-Format Export**: One-click export to Mermaid, C4-PlantUML, Structurizr JSON, and Structurizr DSL.

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Clients["Clients & Tools"]
        CLI["structurizr-cli / CI/CD"]
        AI["AI Assistants (via MCP)"]
        Browser["Modern Web Studio (Browser)"]
    end

    subgraph Server["OpenC4 Platform (TypeScript: Hono + React)"]
        direction TB
        subgraph Gateway["API Protocols"]
            REST["Structurizr REST API (/api/workspace/*)"]
            MCP["Model Context Protocol (/mcp)"]
            StudioAPI["Web Studio API (/api/*)"]
        end

        subgraph Core["C4 Engine"]
            Parser["DSL Lexer & AST Parser"]
            Compiler["Compiler (JSON, Canvas, Mermaid, PlantUML)"]
            Inspection["Architecture Quality Linter"]
            Diff["Visual & Semantic Diff Engine"]
            Catalog["Enterprise Model Catalog"]
        end

        subgraph Storage["Persistence"]
            DB[(SQLite)]
        end
    end

    CLI --> REST
    AI --> MCP
    Browser --> StudioAPI
    Browser --> REST

    REST --> Core
    MCP --> Core
    StudioAPI --> Core
    Core --> Storage
```

---

## Quick Start

### Option 1: Run Locally (Pure Node.js / TypeScript)

1. **Start the platform:**
   ```bash
   ./run.sh
   ```
   Open your browser to [http://localhost:8000](http://localhost:8000).

2. **Backend Development Mode:**
   ```bash
   npm --prefix backend run dev
   ```

### Option 2: Docker Compose

```bash
docker compose up --build
```

---

## Structurizr Ecosystem Compatibility

### Using `structurizr-cli`
OpenC4 implements the official Structurizr Web API specification. You can push or pull workspaces directly:

```bash
# Push an existing workspace.dsl
structurizr-cli push -url http://localhost:8000/api -id 1 -key <API_KEY> -secret <API_SECRET> -workspace workspace.dsl

# Pull a workspace JSON
structurizr-cli pull -url http://localhost:8000/api -id 1 -key <API_KEY> -secret <API_SECRET>
```

API keys and secrets can be viewed or regenerated in the Web Studio or via:
`POST /api/workspace/{id}/apikey/regenerate`

---

## Model Context Protocol (MCP) Integration

OpenC4 provides a built-in MCP server at `POST /mcp` compatible with the 2026 Structurizr MCP specification. AI agents can invoke:

* `validate_dsl`: Validates Structurizr DSL syntax and returns AST metrics or error locations.
* `inspect_workspace`: Runs automated quality checks and returns rule findings.
* `export_diagram`: Exports diagrams to Mermaid, C4-PlantUML, or Structurizr JSON.
* `query_model`: Searches systems, containers, components, and relationships.

---

## Verification & Testing

To run the automated test suite:

```bash
npm --prefix backend test
```
