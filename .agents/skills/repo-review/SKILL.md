---
name: repo-review
description: >-
  Deep repository code review, architectural sanity checks, security vulnerabilities, anti-patterns, code smell detection, documentation coverage, and refactoring recommendations. Use when conducting comprehensive codebase reviews or PR evaluations.
---

# Repository Review & Code Quality Skill

Structured framework for executing rigorous, actionable code and architecture reviews.

## When to Use
- Evaluating a repository for technical debt, security flaws, or scalability limits.
- Conducting comprehensive Pull Request reviews prior to merging.
- Generating refactoring roadmaps for legacy codebases.

## Review Protocol

### 1. Multi-Dimensional Evaluation Matrix
1. **Architecture & Design**: Are boundaries respected? Does it follow modular principles?
2. **Security**: SQL injection vulnerabilities, XSS vectors, unvalidated inputs, hardcoded secrets.
3. **Reliability & Error Handling**: Are asynchronous calls wrapped in try/catch? Are errors typed and logged?
4. **Performance & Scalability**: Inefficient database queries (N+1), memory leaks, unindexed foreign keys.
5. **Maintainability & Testability**: Are functions small and focused? Is test coverage adequate?

### 2. Issue Severity Rating
- **Critical (P0)**: Security flaw, data loss risk, or breaking bug requiring immediate resolution.
- **High (P1)**: Major performance degradation or architectural violation.
- **Medium (P2)**: Code smell, missing test coverage, or unhandled edge case.
- **Low (P3)**: Minor naming inconsistency, style preference, or documentation typo.

### 3. Review Output Format
Always structure feedback constructively:
- Summary of strengths and architectural alignment.
- Prioritized findings with exact file/line links, code diffs, and rationale.
- Actionable next steps and recommendations.
