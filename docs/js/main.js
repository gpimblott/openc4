/**
 * OpenC4 Interactive Website Script
 * Provides theme toggling, interactive C4 diagram canvas simulator,
 * DSL preset switching, drill-down interaction, code copying, and tab switching.
 */

// Architectural Presets & Levels Data
const ARCHITECTURE_DATA = {
  banking: {
    name: "Internet Banking System",
    dsl: {
      context: `workspace "Internet Banking" "Enterprise C4 Architecture" {
    model {
        customer = person "Personal Banking Customer" "A customer of the bank with personal accounts."
        bankingSystem = softwareSystem "Internet Banking System" "Allows customers to view accounts and make payments." "MainSystem"
        coreBanking = softwareSystem "Core Banking System" "Stores core bank accounts and ledgers." "Existing"
        emailSystem = softwareSystem "E-mail System" "Internal Microsoft Exchange system." "Existing"

        customer -> bankingSystem "Uses"
        bankingSystem -> coreBanking "Sends payments & queries balances"
        bankingSystem -> emailSystem "Sends emails using SMTP"
        emailSystem -> customer "Delivers emails to"
    }
    views {
        systemContext bankingSystem "SystemContext" {
            include *
            autoLayout lr
        }
    }
}`,
      container: `workspace "Internet Banking" {
    model {
        customer = person "Personal Banking Customer"
        bankingSystem = softwareSystem "Internet Banking System" {
            spa = container "Single-Page App" "Delivers banking UI to customer browser" "React, TypeScript"
            mobileApp = container "Mobile App" "Provides banking via iOS & Android" "React Native"
            apiApp = container "API Application" "Handles business logic and security" "Node.js, Hono"
            db = container "Database" "Stores customer credentials, logs, and state" "PostgreSQL" "Database"
        }
        coreBanking = softwareSystem "Core Banking System"

        customer -> spa "Views accounts using browser"
        customer -> mobileApp "Views accounts on mobile"
        spa -> apiApp "Makes API calls" "JSON/HTTPS"
        mobileApp -> apiApp "Makes API calls" "JSON/HTTPS"
        apiApp -> db "Reads from and writes to" "JDBC"
        apiApp -> coreBanking "Sends payment instructions" "XML/HTTPS"
    }
    views {
        container bankingSystem "Containers" {
            include *
            autoLayout lr
        }
    }
}`,
      component: `workspace "Internet Banking" {
    model {
        bankingSystem = softwareSystem "Internet Banking System" {
            apiApp = container "API Application" {
                signController = component "Sign In Controller" "Allows users to sign in" "Hono Controller"
                accountsSummary = component "Accounts Summary Controller" "Provides account summaries" "Hono Controller"
                securityComponent = component "Security Component" "Validates sessions and tokens" "TypeScript Module"
                mainframeFacade = component "Mainframe Facade" "Adapter for Core Banking" "TypeScript Class"
            }
            db = container "Database"
        }
        coreBanking = softwareSystem "Core Banking System"

        signController -> securityComponent "Validates credentials"
        accountsSummary -> mainframeFacade "Fetches balances"
        securityComponent -> db "Reads credentials"
        mainframeFacade -> coreBanking "Queries mainframe"
    }
    views {
        component apiApp "Components" {
            include *
            autoLayout lr
        }
    }
}`,
      deployment: `workspace "Internet Banking" {
    model {
        prod = deploymentEnvironment "Production" {
            aws = deploymentNode "Amazon Web Services" {
                euWest = deploymentNode "eu-west-1 (Ireland)" {
                    k8s = deploymentNode "EKS Kubernetes Cluster" {
                        containerInstance apiApp
                    }
                    rds = deploymentNode "Amazon RDS Multi-AZ" {
                        containerInstance db
                    }
                }
            }
        }
    }
    views {
        deployment bankingSystem "prod" "LiveProduction" {
            include *
            autoLayout lr
        }
    }
}`
    },
    diagrams: {
      context: {
        title: "System Context View: Internet Banking System",
        elements: [
          { id: "customer", type: "person", name: "Personal Customer", tech: "[Person]", desc: "A customer of the bank with personal accounts.", x: 20, y: 150, canDrill: false },
          { id: "bankingSystem", type: "system", name: "Internet Banking", tech: "[Software System]", desc: "Allows customers to view accounts & payments.", x: 260, y: 150, canDrill: true },
          { id: "coreBanking", type: "system", name: "Core Banking", tech: "[Software System]", desc: "Stores accounts, balances, and ledger entries.", x: 500, y: 80, canDrill: false },
          { id: "emailSystem", type: "system", name: "E-mail System", tech: "[Software System]", desc: "Internal Microsoft Exchange mail system.", x: 500, y: 240, canDrill: false }
        ],
        relations: [
          { x1: 150, y1: 190, x2: 260, y2: 190, label: "Uses [HTTPS]" },
          { x1: 390, y1: 170, x2: 500, y2: 120, label: "Queries [XML]" },
          { x1: 390, y1: 210, x2: 500, y2: 260, label: "Sends mail" }
        ]
      },
      container: {
        title: "Container View: Internet Banking System",
        elements: [
          { id: "spa", type: "container-node", name: "Single-Page App", tech: "React, TypeScript", desc: "Delivers banking UI to modern browsers.", x: 30, y: 70, canDrill: false },
          { id: "mobileApp", type: "container-node", name: "Mobile App", tech: "React Native", desc: "Provides banking UI on iOS & Android.", x: 30, y: 250, canDrill: false },
          { id: "apiApp", type: "container-node", name: "API Application", tech: "Node.js, Hono", desc: "Handles business logic & auth.", x: 260, y: 160, canDrill: true },
          { id: "db", type: "database", name: "Database", tech: "PostgreSQL 16", desc: "Stores customer data, hashes, audit logs.", x: 490, y: 160, canDrill: false }
        ],
        relations: [
          { x1: 160, y1: 110, x2: 260, y2: 180, label: "JSON/HTTPS" },
          { x1: 160, y1: 280, x2: 260, y2: 200, label: "JSON/HTTPS" },
          { x1: 390, y1: 200, x2: 490, y2: 200, label: "JDBC / SQL" }
        ]
      },
      component: {
        title: "Component View: API Application",
        elements: [
          { id: "signController", type: "component-node", name: "Sign In Controller", tech: "Hono Controller", desc: "Handles customer sign in requests.", x: 30, y: 80, canDrill: false },
          { id: "accountsSummary", type: "component-node", name: "Accounts Controller", tech: "Hono Controller", desc: "Provides aggregated balances.", x: 30, y: 250, canDrill: false },
          { id: "securityComponent", type: "component-node", name: "Security Service", tech: "TypeScript Class", desc: "Validates JWT tokens and hashes.", x: 260, y: 80, canDrill: false },
          { id: "mainframeFacade", type: "component-node", name: "Mainframe Facade", tech: "TypeScript Class", desc: "Adapter for core banking XML/MQ.", x: 260, y: 250, canDrill: false },
          { id: "db", type: "database", name: "Database", tech: "PostgreSQL", desc: "Stored data.", x: 490, y: 160, canDrill: false }
        ],
        relations: [
          { x1: 160, y1: 110, x2: 260, y2: 110, label: "Validates" },
          { x1: 160, y1: 280, x2: 260, y2: 280, label: "Calls" },
          { x1: 390, y1: 110, x2: 490, y2: 170, label: "SQL Queries" }
        ]
      },
      deployment: {
        title: "Deployment View: Production Environment",
        elements: [
          { id: "k8s", type: "container-node", name: "Kubernetes Cluster", tech: "AWS EKS", desc: "Runs 4 replicas of API Application.", x: 80, y: 150, canDrill: false },
          { id: "rds", type: "database", name: "Amazon RDS Multi-AZ", tech: "PostgreSQL 16", desc: "Primary & Replica DB instances.", x: 380, y: 150, canDrill: false }
        ],
        relations: [
          { x1: 210, y1: 190, x2: 380, y2: 190, label: "VPC Peering / TLS" }
        ]
      }
    }
  },

  ecommerce: {
    name: "E-Commerce Microservices",
    dsl: {
      context: `workspace "E-Commerce Platform" "Cloud Microservices Architecture" {
    model {
        shopper = person "Online Shopper" "Browses products and places orders"
        ecommerce = softwareSystem "E-Commerce Platform" "Handles catalog, checkout, orders" "MainSystem"
        stripe = softwareSystem "Stripe Gateway" "Processes credit card payments" "External"
        warehouse = softwareSystem "Logistics ERP" "Manages inventory & shipping" "External"

        shopper -> ecommerce "Buys products via web & mobile"
        ecommerce -> stripe "Authorizes payments"
        ecommerce -> warehouse "Dispatches orders"
    }
    views {
        systemContext ecommerce "Context" {
            include *
            autoLayout lr
        }
    }
}`,
      container: `workspace "E-Commerce Platform" {
    model {
        ecommerce = softwareSystem "E-Commerce Platform" {
            storefront = container "Storefront SPA" "Next.js 15 Web application" "Next.js, TypeScript"
            orderService = container "Order Service" "Processes orders and orchestrates events" "Go, gRPC"
            paymentService = container "Payment Service" "Integrates with payment processors" "TypeScript, Hono"
            eventBus = container "Kafka Event Bus" "Asynchronous event broker" "Apache Kafka" "Queue"
        }
        stripe = softwareSystem "Stripe Gateway"

        storefront -> orderService "Submits orders" "gRPC"
        orderService -> eventBus "Publishes OrderCreated event"
        eventBus -> paymentService "Consumes events"
        paymentService -> stripe "Charges customer" "HTTPS"
    }
    views {
        container ecommerce "Containers" {
            include *
            autoLayout lr
        }
    }
}`,
      component: `workspace "E-Commerce Platform" {
    model {
        ecommerce = softwareSystem "E-Commerce Platform" {
            orderService = container "Order Service" {
                orderHandler = component "Order Handler" "Validates payload and checks quotas" "Go Handler"
                sagaManager = component "Saga Orchestrator" "Manages distributed checkout saga" "Go Package"
                repo = component "Order Repository" "Stores orders in state" "SQLc / PostgreSQL"
            }
        }
        orderHandler -> sagaManager "Starts checkout"
        sagaManager -> repo "Persists state"
    }
    views {
        component orderService "Components" {
            include *
            autoLayout lr
        }
    }
}`,
      deployment: `workspace "E-Commerce Platform" {
    model {
        cloud = deploymentEnvironment "AWS Cloud" {
            eks = deploymentNode "AWS EKS Cluster" {
                containerInstance orderService
                containerInstance paymentService
            }
            msk = deploymentNode "Amazon Managed Kafka (MSK)" {
                containerInstance eventBus
            }
        }
    }
    views {
        deployment ecommerce "cloud" "AWSProduction" {
            include *
            autoLayout lr
        }
    }
}`
    },
    diagrams: {
      context: {
        title: "System Context View: E-Commerce Platform",
        elements: [
          { id: "shopper", type: "person", name: "Online Shopper", tech: "[Person]", desc: "Browses products and places online orders.", x: 20, y: 150, canDrill: false },
          { id: "ecommerce", type: "system", name: "E-Commerce Platform", tech: "[Software System]", desc: "Handles storefront, checkout, and orders.", x: 260, y: 150, canDrill: true },
          { id: "stripe", type: "system", name: "Stripe Gateway", tech: "[External System]", desc: "Processes credit card transactions.", x: 500, y: 80, canDrill: false },
          { id: "warehouse", type: "system", name: "Logistics ERP", tech: "[External System]", desc: "Handles inventory and shipment fulfillment.", x: 500, y: 240, canDrill: false }
        ],
        relations: [
          { x1: 150, y1: 190, x2: 260, y2: 190, label: "Purchases" },
          { x1: 390, y1: 170, x2: 500, y2: 120, label: "Charges [API]" },
          { x1: 390, y1: 210, x2: 500, y2: 260, label: "Dispatches" }
        ]
      },
      container: {
        title: "Container View: E-Commerce Platform",
        elements: [
          { id: "storefront", type: "container-node", name: "Storefront Web", tech: "Next.js 15, React", desc: "Public website and catalog.", x: 30, y: 70, canDrill: false },
          { id: "orderService", type: "container-node", name: "Order Service", tech: "Go, gRPC", desc: "Orchestrates order workflow.", x: 260, y: 70, canDrill: true },
          { id: "eventBus", type: "database", name: "Kafka Event Bus", tech: "Apache Kafka", desc: "Event backbone for decoupled domains.", x: 260, y: 250, canDrill: false },
          { id: "paymentService", type: "container-node", name: "Payment Service", tech: "TypeScript, Hono", desc: "Processes payments via Stripe.", x: 490, y: 250, canDrill: false }
        ],
        relations: [
          { x1: 160, y1: 100, x2: 260, y2: 100, label: "gRPC calls" },
          { x1: 325, y1: 140, x2: 325, y2: 250, label: "Emits events" },
          { x1: 390, y1: 280, x2: 490, y2: 280, label: "Consumes events" }
        ]
      },
      component: {
        title: "Component View: Order Service",
        elements: [
          { id: "orderHandler", type: "component-node", name: "Order Handler", tech: "Go / gRPC", desc: "Validates orders and rate limits.", x: 40, y: 150, canDrill: false },
          { id: "sagaManager", type: "component-node", name: "Saga Manager", tech: "Go Package", desc: "State machine for distributed checkout.", x: 270, y: 150, canDrill: false },
          { id: "repo", type: "database", name: "Order DB", tech: "PostgreSQL", desc: "Stores order data.", x: 490, y: 150, canDrill: false }
        ],
        relations: [
          { x1: 170, y1: 180, x2: 270, y2: 180, label: "Dispatches" },
          { x1: 400, y1: 180, x2: 490, y2: 180, label: "Reads & writes" }
        ]
      },
      deployment: {
        title: "Deployment View: AWS Microservices",
        elements: [
          { id: "eks", type: "container-node", name: "AWS EKS (Containers)", tech: "Kubernetes 1.30", desc: "Runs all stateless microservices.", x: 80, y: 150, canDrill: false },
          { id: "msk", type: "database", name: "AWS MSK (Kafka)", tech: "Managed Kafka", desc: "High availability event broker.", x: 380, y: 150, canDrill: false }
        ],
        relations: [
          { x1: 210, y1: 190, x2: 380, y2: 190, label: "TLS / IAM Auth" }
        ]
      }
    }
  }
};

// Application State
let currentPreset = "banking";
let currentLevel = "context";

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initPresetSelector();
  initLevelTabs();
  initGuideTabs();
  initCopyButtons();
  initExportModal();
  renderCurrentView();
});

// Theme Management
function initThemeToggle() {
  const themeToggleBtn = document.getElementById("theme-toggle");
  const storedTheme = localStorage.getItem("openc4-theme") || "dark";
  document.documentElement.setAttribute("data-theme", storedTheme);
  updateThemeIcon(storedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("openc4-theme", next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.innerHTML = theme === "light" 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
}

// Preset Selector
function initPresetSelector() {
  const select = document.getElementById("preset-select");
  if (!select) return;

  select.addEventListener("change", (e) => {
    currentPreset = e.target.value;
    currentLevel = "context";
    updateActiveLevelTab();
    renderCurrentView();
  });
}

// Level Tabs (Context, Container, Component, Deployment)
function initLevelTabs() {
  const tabs = document.querySelectorAll(".level-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      currentLevel = tab.getAttribute("data-level");
      updateActiveLevelTab();
      renderCurrentView();
    });
  });
}

function updateActiveLevelTab() {
  document.querySelectorAll(".level-tab").forEach(t => {
    if (t.getAttribute("data-level") === currentLevel) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });
}

// Render Diagram & DSL View
function renderCurrentView() {
  const data = ARCHITECTURE_DATA[currentPreset];
  if (!data) return;

  // 1. Update DSL View
  const dslContainer = document.getElementById("dsl-editor-code");
  if (dslContainer) {
    const rawDsl = data.dsl[currentLevel] || data.dsl.context;
    dslContainer.innerHTML = syntaxHighlightDsl(rawDsl);
  }

  // 2. Update Canvas View
  const diagramData = data.diagrams[currentLevel] || data.diagrams.context;
  const stage = document.getElementById("c4-stage");
  if (!stage) return;

  stage.innerHTML = "";

  // Title in canvas toolbar
  const titleEl = document.getElementById("canvas-view-title");
  if (titleEl) {
    titleEl.textContent = diagramData.title;
  }

  // Draw SVG lines first
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "c4-rel-svg");
  svg.setAttribute("viewBox", "0 0 680 440");

  diagramData.relations.forEach(rel => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", rel.x1);
    line.setAttribute("y1", rel.y1);
    line.setAttribute("x2", rel.x2);
    line.setAttribute("y2", rel.y2);
    line.setAttribute("class", "c4-rel-line");
    svg.appendChild(line);

    const midX = (rel.x1 + rel.x2) / 2;
    const midY = (rel.y1 + rel.y2) / 2 - 8;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", midX);
    text.setAttribute("y", midY);
    text.setAttribute("class", "c4-rel-label");
    text.textContent = rel.label;
    svg.appendChild(text);
  });
  stage.appendChild(svg);

  // Draw Elements
  diagramData.elements.forEach(el => {
    const node = document.createElement("div");
    node.className = `c4-element ${el.type}`;
    node.style.left = `${el.x}px`;
    node.style.top = `${el.y}px`;
    node.style.width = "140px";

    node.innerHTML = `
      <div class="c4-type">${el.canDrill ? 'Double-Click to Drill' : el.type.replace('-node', '')}</div>
      <div class="c4-name">${escapeHtml(el.name)}</div>
      <div class="c4-tech">${escapeHtml(el.tech)}</div>
      <div class="c4-desc">${escapeHtml(el.desc)}</div>
    `;

    if (el.canDrill) {
      node.title = "Click to drill down into Containers/Components";
      node.addEventListener("click", () => {
        if (currentLevel === "context") {
          currentLevel = "container";
        } else if (currentLevel === "container") {
          currentLevel = "component";
        }
        updateActiveLevelTab();
        renderCurrentView();
      });
    }

    stage.appendChild(node);
  });
}

// Simple DSL Syntax Highlighter for Web Showcase
function syntaxHighlightDsl(code) {
  const lines = code.split("\n");
  const highlightedLines = lines.map(line => {
    let l = escapeHtml(line);
    // Strings
    l = l.replace(/"([^"]*)"/g, '<span class="dsl-str">"$1"</span>');
    // Keywords
    const keywords = ["workspace", "model", "person", "softwareSystem", "container", "component", "deploymentEnvironment", "deploymentNode", "containerInstance", "views", "systemContext", "autoLayout", "include"];
    keywords.forEach(kw => {
      const re = new RegExp(`\\b(${kw})\\b`, 'g');
      l = l.replace(re, '<span class="dsl-kw">$1</span>');
    });
    // Arrows
    l = l.replace(/-&gt;/g, '<span class="dsl-id">-&gt;</span>');
    return l;
  });
  return highlightedLines.join("\n");
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Guide Tabs Navigation
function initGuideTabs() {
  const tabs = document.querySelectorAll(".guide-tab-btn");
  const panes = document.querySelectorAll(".guide-pane");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");

      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

// Copy Code Button functionality
function initCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target");
      let text = "";
      if (targetId) {
        const el = document.getElementById(targetId);
        text = el ? el.innerText : "";
      } else {
        const pre = btn.closest(".code-box").querySelector("pre");
        text = pre ? pre.innerText : "";
      }

      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          const original = btn.textContent;
          btn.textContent = "Copied!";
          btn.style.color = "#10b981";
          btn.style.borderColor = "#10b981";
          setTimeout(() => {
            btn.textContent = original;
            btn.style.color = "";
            btn.style.borderColor = "";
          }, 2000);
        } catch (e) {
          console.warn("Clipboard access denied:", e);
        }
      }
    });
  });
}

// Export Modal Dialog
function initExportModal() {
  const modal = document.getElementById("export-modal");
  const openBtn = document.getElementById("open-export-btn");
  const closeBtn = document.getElementById("close-export-btn");
  const formatSelect = document.getElementById("export-format-select");
  const outputPre = document.getElementById("export-output-code");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => {
    updateExportOutput();
    modal.showModal();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.close();
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });

  if (formatSelect) {
    formatSelect.addEventListener("change", updateExportOutput);
  }

  function updateExportOutput() {
    const fmt = formatSelect ? formatSelect.value : "mermaid";
    if (fmt === "mermaid") {
      outputPre.textContent = `%% Generated by OpenC4 Multi-Format Export
C4Context
    title ${ARCHITECTURE_DATA[currentPreset].name} (${currentLevel})

    Person(customer, "Personal Banking Customer", "Customer of the bank")
    System(bankingSystem, "Internet Banking System", "Allows customers to view accounts")
    System_Ext(coreBanking, "Core Banking System", "Stores accounts & balances")

    Rel(customer, bankingSystem, "Uses", "HTTPS")
    Rel(bankingSystem, coreBanking, "Queries balances", "XML/HTTPS")`;
    } else if (fmt === "plantuml") {
      outputPre.textContent = `' Generated by OpenC4 Multi-Format Export
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "Personal Banking Customer", "Customer of the bank")
System(bankingSystem, "Internet Banking System", "Allows customers to view accounts")
System_Ext(coreBanking, "Core Banking System", "Stores accounts & balances")

Rel(customer, bankingSystem, "Uses", "HTTPS")
Rel(bankingSystem, coreBanking, "Queries balances", "XML/HTTPS")
@enduml`;
    } else if (fmt === "json") {
      outputPre.textContent = JSON.stringify({
        id: 1,
        name: ARCHITECTURE_DATA[currentPreset].name,
        description: "Exported from OpenC4",
        configuration: {},
        model: {
          people: [{ id: "1", name: "Personal Customer" }],
          softwareSystems: [{ id: "2", name: "Internet Banking System" }]
        }
      }, null, 2);
    }
  }
}

// Architecture View Tabs
function initArchTabs() {
  const tabs = document.querySelectorAll(".arch-tab-btn");
  const panes = document.querySelectorAll(".arch-view-pane");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-view");

      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}
