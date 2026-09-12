---
name: test-with-actions
description: >-
  CI/CD test automation using GitHub Actions, matrix builds, automated unit/smoke/integration test execution, caching, artifacts, and status badges. Use when creating or debugging GitHub Actions testing workflows.
---

# GitHub Actions CI/CD Testing Skill

Standardized practices for configuring automated test pipelines with GitHub Actions.

## When to Use
- Creating, fixing, or optimizing GitHub Actions CI/CD workflows.
- Setting up automated smoke tests, unit tests, linting, and coverage reporting on pull requests.
- Configuring build matrix strategies, dependency caching, and deployment triggers.

## Standard Workflow Template (`.github/workflows/ci.yml`)

```yaml
name: Continuous Integration

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    name: Test & Lint
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Linter
        run: npm run lint --if-present

      - name: Run Test Suite
        run: npm test

      - name: Upload Test Coverage
        if: always() && matrix.node-version == '20.x'
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: coverage/
```

## Key Optimization Guidelines
1. **Use `npm ci`**: Guarantees deterministic, reproducible dependency trees from `package-lock.json`.
2. **Action Caching**: Cache `~/.npm`, `pip cache`, or package managers to accelerate CI cycles.
3. **Fail Fast**: Run fast checks (lint, typecheck) before long-running integration/e2e tests.
