---
name: customize-your-github-copilot-experience
description: >-
  Customizing GitHub Copilot repository instructions (.github/copilot-instructions.md), prompt templates, editor rules, team guidelines, and domain context. Use when establishing organizational or repository-level Copilot guidelines.
---

# Customizing GitHub Copilot Experience Skill

Standard practices for shaping GitHub Copilot behavior to adhere to team conventions, architectural patterns, and coding standards.

## When to Use
- Setting up or updating `.github/copilot-instructions.md` for a repository.
- Enforcing repository-specific guidelines (e.g. naming conventions, disallowed libraries, security rules).
- Configuring custom prompt files and team workflows.

## Configuration Guide: `.github/copilot-instructions.md`

Place instructions in `.github/copilot-instructions.md` at the repository root. Follow this structure:

```markdown
# Repository Instructions for GitHub Copilot

## Tech Stack & Architecture
- Frameworks: Express 4.x, SQLite3, Vanilla JavaScript UI
- Architecture: REST API backend with client-side DOM rendering

## Coding Conventions
- Always write strict, defensive code with explicit error handling.
- Use explicit status codes in API responses (200, 201, 400, 401, 404, 500).
- Preserve existing docstrings and comments.

## Security & Quality Invariants
- Parameterize all SQL queries; NEVER concatenate user inputs into SQL strings.
- Escape dynamic content before DOM insertion to prevent XSS.
- All exported CSV files must include UTF-8 BOM (`\uFEFF`) for Microsoft Excel compatibility.
```

## Best Practices
1. **Be Specific**: Specify exact library choices (e.g. "Use node:assert/strict for tests, not Jest").
2. **Keep It Concise**: Prioritize high-impact rules to avoid diluting the model's instruction following.
