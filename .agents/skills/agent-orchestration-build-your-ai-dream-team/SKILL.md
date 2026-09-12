---
name: agent-orchestration-build-your-ai-dream-team
description: >-
  Multi-agent orchestration, designing autonomous AI teams with specialized roles (Architect, Researcher, Developer, QA/Tester, Reviewer), parallel task delegation, and inter-agent coordination. Use when orchestrating complex multi-agent projects.
---

# Multi-Agent Orchestration: AI Dream Team Skill

Architectural framework for organizing, orchestrating, and coordinating teams of specialized AI subagents.

## When to Use
- Tackling large, multi-phase projects requiring parallel research, development, and testing.
- Designing specialized subagent roles with defined system prompts and tool constraints.
- Managing inter-agent communication, handoffs, and verification quality gates.

## Team Architecture & Roles

### 1. The Core Roles
1. **Lead Architect**: Decomposes user goals into actionable work packages; owns system design and plans.
2. **Specialized Researcher**: Gathers context, explores codebases, reads external documentation without polluting primary context.
3. **Core Developer**: Implements code changes with atomic, high-precision file edits and continuous validation.
4. **QA & Verification Engineer**: Executes automated test suites, writes regression tests, and validates live endpoints.
5. **Code Reviewer**: Audits proposed diffs for security, style adherence, edge cases, and documentation integrity.

### 2. Coordination & Handoff Protocols
- **Atomic Task Definitions**: Each subagent must receive a concise, unambiguous objective with explicit completion criteria.
- **Context Hygiene**: Pass only relevant summaries and file paths between agents to conserve context window tokens.
- **Verification Gates**: No implementation is considered complete without automated verification from the QA role.

### 3. Handling Concurrency
- Launch independent subagents in parallel for independent components.
- Serialize dependent stages (e.g., Architect -> Developer -> QA).
