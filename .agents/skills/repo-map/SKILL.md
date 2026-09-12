---
name: repo-map
description: >-
  Comprehensive codebase mapping, architecture visualizer, dependency graphing, directory inventory, and key entry point identification. Use when analyzing repository structure, onboarding to a codebase, or documenting system architecture.
---

# Repository Architecture & Map Skill

Provides systematic procedures to analyze, map, and document codebases of any size.

## When to Use
- Onboarding to an unfamiliar repository or codebase.
- Planning major refactors, migrations, or architectural changes.
- Documenting system components, data flows, and external integrations.

## Core Procedures

### 1. Structural Inventory
- Discover file tree topology: ignore `node_modules`, `.git`, build caches (`dist`, `build`).
- Identify primary languages, package manifests (`package.json`, `pyproject.toml`, `go.mod`).
- Locate application entry points: server entry (`server.js`, `main.py`), UI root (`index.html`, `App.tsx`).

### 2. Dependency & Component Mapping
- Map internal modules: controllers, services, database adapters, routes, views.
- Map external dependencies: databases, third-party APIs, authentication providers, object storage.
- Construct a Mermaid architecture diagram illustrating module boundaries and data flow.

### 3. Data Flow & State Verification
- Identify ingress points (HTTP endpoints, WebSocket handlers, event listeners).
- Track request lifecycle from routing -> validation -> business logic -> database -> response.

### 4. Output Artifacts
Always produce a clean, Markdown-formatted architecture summary:
- **System Overview**: High-level purpose and architectural pattern (e.g. MVC, Clean Architecture, Microservices).
- **Directory Guide**: Purpose of each key directory.
- **Entry Points & Routing Table**: Core endpoints and their responsibilities.
- **Tech Stack & Tooling Table**: Languages, frameworks, databases, test suites.
