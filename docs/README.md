# OpenC4 GitHub Pages Website

> [!WARNING]
> ### 🚧 Prototype — Work in Progress
> OpenC4 is currently an early-stage prototype under active development.

This directory (`/docs`) contains the static documentation and showcase website for **OpenC4** — the open-source C4 architecture tool — published via GitHub Pages to [openc4.bitwrangler.uk](https://openc4.bitwrangler.uk).

## Features of this Website

- **Zero-Build Static Architecture**: Runs natively on any static web host, specifically optimized for **GitHub Pages**.
- **Live Application Showcase**: High-resolution screenshot and visual tour of the real OpenC4 Web Studio in `docs/assets/openc4-studio-screenshot.png`.
- **Complete Architecture Lifecycle Pipeline**: Step-by-step breakdown from Structurizr DSL modeling to interactive React Flow canvas rendering, automated quality inspection, and universal multi-format export.
- **Latest Feature Showcases**:
  - **Authentication & RBAC**: CASL-based permissions, Admin/Architect/Viewer seeded roles, and 1-click Quick Role Switcher.
  - **Modular Multi-File Workspaces & Drag-and-Drop**: `!include <file>` and `!include <dir/>` resolution, sidebar folder explorer, automatic AST refactoring, tab state preservation, and 1-to-1 error line mapping.
  - **Structurizr DSL Phase 3**: Archetypes with inheritance, architectural Perspectives (Security, Performance), custom Terminology overrides, extended node styles (`border`, `opacity`, `icon`), and Themes (AWS, Azure, default).
  - **Implied Relationships Engine**: Configurable strategies for automatic ancestor relationship derivation.
  - **Canvas Relationship Editor**: Create, edit, reconnect, reverse, and delete relationships with real-time bidirectional DSL sync.
  - **Local & Remote Structurizr MCP Validation**: In-studio diagnostics to test and validate models against any MCP server.
  - **Direct Structurizr Publishing & CLI**: Direct publish from Web Studio and drop-in REST API replacement for `structurizr-cli`.
  - **Architecture Quality Linter**: Dual-tab inspection drawer for rule violations and perspective auditing.
  - **Multi-Format Export**: One-click export to Mermaid (Git READMEs), C4-PlantUML, Structurizr JSON, SVG, PNG, and DSL.
- **Comprehensive Step-by-Step Guides**:
  - Quickstart with Node.js (`./run.sh`), Docker Compose, and seeded accounts.
  - C4 DSL & Phase 3 Modeling Guide.
  - Modular multi-file architecture with `!include`.
  - Authentication and CASL permission matrix.
  - CI/CD integration with `structurizr-cli`.
  - AI & Model Context Protocol (MCP) configuration.
  - Mermaid markdown export for GitHub/GitLab READMEs.
- **Full Compatibility Matrix**:
  - Comparing OpenC4 with legacy Structurizr on-premises, manual drawing tools, and raw text diagrams.
- **Dark / Light Mode**:
  - Accessible theme toggling with smooth transitions, OS preference detection, and `localStorage` persistence.
- **Modern Developer Design System**:
  - Clean, accessible typographic hierarchy using CSS custom properties, native `<details>` accordion, and keyboard navigation.

---

## Testing Locally

You can preview the website locally using any static HTTP server:

```bash
# Using Python
cd docs
python3 -m http.server 8080

# Or using npx serve
npx serve docs
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Deploying to GitHub Pages

### Method 1: Built-in GitHub Pages `/docs` Folder (Simplest)

GitHub Pages natively supports serving directly from the `/docs` folder on your default branch:

1. Go to your repository on GitHub.
2. Navigate to **Settings** &rarr; **Pages**.
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` (or default branch) and choose the `/docs` folder from the dropdown.
4. Click **Save**. Your site will be published at `https://<username>.github.io/<repo>/` in under a minute!

### Method 2: Using GitHub Actions

If you prefer automated GitHub Actions deployment, create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy OpenC4 Showcase to GitHub Pages

on:
  push:
    branches: [ "main" ]
    paths:
      - 'docs/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './docs'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
