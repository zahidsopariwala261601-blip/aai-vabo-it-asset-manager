---
name: repo-delivery
description: >-
  Release engineering, semantic versioning, automated changelogs, Docker container packaging, environment configuration, health checks, and deployment runbooks. Use when packaging, releasing, or deploying applications.
---

# Repository Delivery & Release Engineering Skill

Protocols for repeatable, zero-downtime release engineering, packaging, and deployments.

## When to Use
- Packaging applications into production-ready Docker containers.
- Formulating deployment runbooks, rollback plans, and health check procedures.
- Managing Semantic Versioning (SemVer) and automated changelog generation.

## Delivery Pipeline

### 1. Versioning & Changelog
- Adhere strictly to Semantic Versioning (MAJOR.MINOR.PATCH).
- Automate release notes from conventional commit messages (`feat:`, `fix:`, `perf:`, `chore:`).

### 2. Containerization (Dockerfile Best Practices)
- Utilize multi-stage builds to produce minimal runtime container images.
- Run processes under non-root users for container security.
- Leverage `.dockerignore` to exclude test files, logs, and development dependencies.

### 3. Health Checks & Observability
- Expose dedicated liveness (`/api/health/live`) and readiness (`/api/health/ready`) endpoints.
- Ensure graceful shutdown handling (`SIGTERM`, `SIGINT`) to allow ongoing requests to drain.

### 4. Production Runbook Checklist
1. Pre-deployment backup of databases and configuration states.
2. Database schema migrations executed in backward-compatible steps.
3. Canary / Blue-Green deployment to verify live health before full traffic cutover.
4. Rollback trigger conditions defined and tested in advance.
