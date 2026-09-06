workspace "OpenC4" "Architecture model of OpenC4 open-source C4 architecture platform" {
    model {
        architect = person "Software & Enterprise Architect" "Designs systems, models workspaces, manages enterprise catalog, and reviews visual diffs."
        developer = person "Software Engineer" "Navigates architecture diagrams, explores component designs, and exports Mermaid diagrams for documentation."
        aiAgent = person "AI Assistant" "Interacts via Model Context Protocol (MCP) to validate DSL, query models, and inspect architecture rules."
        cicdPipeline = person "CI/CD Pipeline" "Automates workspace publishing and validates architecture diagrams using structurizr-cli."

        openC4 = softwareSystem "OpenC4 Platform" "Modern open-source C4 architecture modeling tool, real-time diagram studio, and workspace server." "OpenC4" {
            webStudio = container "Web Studio" "Single-Page Application providing live split-screen DSL editing, interactive React Flow canvas, minimap, catalog browser, visual diffing, and export modals." "React 19, TypeScript, Vite, React Flow, Monaco Editor, Tailwind CSS" "WebBrowser"
            backendServer = container "Backend Server" "REST API and MCP server handling workspace storage, compilation, validation, and CLI communication." "Node.js, TypeScript, Hono" "ServerApp" {
                workspaceApi = component "Workspace Controller" "Handles workspace CRUD, drafts, version publishing, locks, and enterprise catalog APIs." "Hono Route Handler"
                cliApi = component "Structurizr CLI Controller" "Implements official Structurizr Web API endpoints (/api/workspace/*) for push/pull CLI interoperability." "Hono Route Handler"
                authController = component "Auth & RBAC Controller" "Handles authentication (/api/auth/login), session tokens, CASL abilities, and user CRUD." "Hono Route Handler"
                authService = component "Auth Service & Provider Registry" "Manages credentials, scrypt password hashing, JWT issuance, and enterprise SSO providers." "TypeScript Class"
                caslGuard = component "CASL Authorization Guard" "Enforces isomorphic permissions (admin, editor, viewer) on API endpoints using @casl/ability." "Hono Middleware"
                mcpController = component "MCP Controller" "JSON-RPC endpoint (/mcp) implementing Model Context Protocol tools (validate_dsl, inspect_workspace, export_diagram, query_model)." "Hono Route Handler"
                parser = component "DSL Lexer & Parser" "Tokenizes and parses Structurizr DSL source into typed AST models." "TypeScript Module"
                compiler = component "C4 Model Compiler" "Compiles AST into Structurizr JSON, Mermaid, PlantUML, and React Flow canvas layouts." "TypeScript Module"
                inspector = component "Architecture Linter" "Automated rule checker identifying orphaned elements, missing metadata, and implied conflicts." "TypeScript Module"
                diffEngine = component "Visual Diff Engine" "Compares workspace versions and computes added, modified, and removed elements." "TypeScript Module"
                repository = component "Workspace Repository" "Manages SQLite persistence for workspaces, revisions, users, API keys, locks, and catalog entries." "TypeScript Class / better-sqlite3"
            }
            database = container "Database" "Persists workspaces, DSL source code, revision history, user credentials, roles, API credentials, and enterprise catalog." "SQLite" "Database"
        }

        cliTool = softwareSystem "Structurizr CLI" "Official command-line tool for pushing/pulling DSL models in CI/CD pipelines." "ExternalTool"
        docSites = softwareSystem "Documentation Sites" "GitHub/GitLab READMEs, Notion, and static doc sites rendering exported Mermaid diagrams." "ExternalSystem"
        idp = softwareSystem "Enterprise Identity Provider" "Corporate Single Sign-On provider (OIDC, SAML 2.0, LDAP/Active Directory)." "ExternalSystem"

        # People & external relationships
        architect -> webStudio "Authenticates, edits architecture DSL, views diagrams, and manages RBAC users" "HTTPS"
        developer -> webStudio "Explores system, container, and component diagrams (Viewer/Editor)" "HTTPS"
        aiAgent -> mcpController "Invokes MCP tools to validate, inspect, query, and export models" "JSON-RPC / HTTP"
        cicdPipeline -> cliTool "Executes push and pull commands" "CLI"
        cliTool -> cliApi "Pushes and pulls workspace models" "HTTP / REST"

        # Container & component relationships
        webStudio -> authController "Authenticates users, verifies sessions, and retrieves CASL abilities" "JSON / REST"
        webStudio -> workspaceApi "Fetches workspaces, saves layout coordinates, and manages catalog" "JSON / REST"
        webStudio -> docSites "Exports Mermaid diagrams to" "Markdown"

        authController -> authService "Delegates credential verification, user management, and provider routing" "Internal Call"
        authController -> caslGuard "Applies CASL permission checks to user endpoints" "Internal Call"
        authService -> repository "Persists user accounts, password hashes, and roles" "Internal Call"
        authService -> idp "Delegates enterprise authentication and maps groups to roles" "OIDC / OAuth2"

        workspaceApi -> caslGuard "Validates user read/write/publish abilities before processing actions" "Internal Call"
        workspaceApi -> repository "Queries and updates workspace records" "Internal Call"
        workspaceApi -> parser "Parses DSL source code" "Internal Call"
        workspaceApi -> compiler "Compiles AST to JSON and layout coordinates" "Internal Call"
        workspaceApi -> diffEngine "Computes visual differences between versions" "Internal Call"

        cliApi -> repository "Retrieves and saves workspace revisions" "Internal Call"
        cliApi -> parser "Parses uploaded DSL" "Internal Call"
        cliApi -> compiler "Compiles workspace to Structurizr JSON" "Internal Call"

        mcpController -> parser "Parses DSL for validation" "Internal Call"
        mcpController -> inspector "Inspects architectural rules and completeness" "Internal Call"
        mcpController -> compiler "Exports diagrams to Mermaid, PlantUML, and JSON" "Internal Call"
        mcpController -> repository "Queries workspace models" "Internal Call"

        repository -> database "Reads and writes data" "SQL / better-sqlite3"
    }

    views {
        systemContext openC4 "SystemContext" "The system context diagram for the OpenC4 platform." {
            include *
            autoLayout lr
        }

        container openC4 "Containers" "The container diagram for the OpenC4 platform." {
            include *
            autoLayout lr
        }

        component backendServer "BackendComponents" "The component diagram for the OpenC4 backend server." {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "OpenC4" {
                background #0f52ba
                color #ffffff
            }
            element "Container" {
                background #2b77c5
                color #ffffff
            }
            element "WebBrowser" {
                shape WebBrowser
            }
            element "Database" {
                shape Cylinder
                background #1b5b9e
                color #ffffff
            }
            element "Component" {
                background #438dd5
                color #ffffff
            }
            element "ExternalTool" {
                background #64748b
                color #ffffff
            }
            element "ExternalSystem" {
                background #64748b
                color #ffffff
            }
        }
    }
}
