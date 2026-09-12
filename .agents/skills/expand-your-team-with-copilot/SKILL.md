---
name: expand-your-team-with-copilot
description: >-
  Leveraging GitHub Copilot and AI pair-programming effectively across the SDLC, conversational prompting, workspace indexing, doc generation, and test scaffolding. Use when maximizing developer productivity with GitHub Copilot.
---

# Expand Your Team with GitHub Copilot Skill

Strategies and workflows to maximize engineering velocity using GitHub Copilot and AI pair programming.

## When to Use
- Integrating GitHub Copilot into day-to-day coding, debugging, and testing workflows.
- Formulating high-leverage prompts using context variables (`#file`, `#symbol`, `#codebase`).
- Accelerating boilerplate generation, unit test scaffolding, and documentation.

## Core Interaction Patterns

### 1. Context Priming
- Use explicit context markers to anchor Copilot's reasoning:
  - Reference related files directly: `@workspace /explain how #file:assetRoutes.js handles export`
  - Reference symbols: `Refactor #symbol:downloadCSV to support UTF-8 BOM encoding`

### 2. Conversational Refactoring & Test Generation
- Generate tests first: Provide function signatures and ask Copilot to draft comprehensive unit tests covering edge cases.
- Step-by-step refactoring: Request localized modifications rather than whole-file rewrites.

### 3. Inline Copilot Shortcuts
- Accept suggestions word-by-word (`Ctrl`+`Right Arrow`) to maintain full control.
- Trigger inline edits (`Ctrl`+`I`) for rapid docstring, type annotation, or formatting tasks.
