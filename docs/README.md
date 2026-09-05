# OpenC4 GitHub Pages Website

This directory (`/docs`) contains the static documentation and showcase website for **OpenC4** — the open-source C4 architecture tool.

## Features of this Website

- **Zero-Build Static Architecture**: Runs natively on any static web host, specifically optimized for **GitHub Pages**.
- **Live Application Visuals**:
  - High-resolution screenshot of the running OpenC4 Web Studio in `docs/assets/openc4-studio-screenshot.png`.
- **Complete OpenC4 Architecture Self-Model**:
  - System Context, Container, and Backend Component diagrams compiled with OpenC4's native MCP server.
- **Interactive Live Architecture Studio & Playground**:
  - Live split-screen showing C4 DSL on the left and an interactive C4 diagram on the right.
  - Interactive drill-down (Context &rarr; Container &rarr; Component &rarr; Deployment).
  - Preloaded architecture presets (OpenC4 Platform self-model, Internet Banking, E-Commerce Microservices).
  - Export modal showing live-compiled Mermaid, C4-PlantUML, and Structurizr JSON.
- **Comprehensive Step-by-Step Guides**:
  - Quickstart with Docker & local Node.js
  - C4 DSL Modeling Guide
  - CI/CD integration with `structurizr-cli`
  - AI & Model Context Protocol (MCP) configuration
  - Exporting diagrams to Mermaid for GitHub/GitLab markdown
- **Full Compatibility Matrix**:
  - Comparing OpenC4 with legacy Structurizr on-premises, manual drawing tools, and raw text diagrams.
- **Dark / Light Mode**:
  - Accessible theme toggling with smooth transitions and `localStorage` persistence.
- **Modern Accessibility & Performance**:
  - Responsive design using CSS custom properties, native `<dialog>` and `<details>` elements, and keyboard navigation.

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
