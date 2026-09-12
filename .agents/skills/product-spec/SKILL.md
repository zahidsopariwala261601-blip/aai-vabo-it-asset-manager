---
name: product-spec
description: >-
  Authoring comprehensive product specifications, PRDs, user stories, acceptance criteria, personas, functional requirements, and edge case specifications. Use when translating user needs or business requests into actionable engineering specs.
---

# Product Specification & Requirements Skill

Standardized methodology for drafting high-clarity Product Requirement Documents (PRDs) and engineering specifications.

## When to Use
- Translating high-level user ideas or business goals into technical specifications.
- Defining features, acceptance criteria, and user journeys before development starts.
- Aligning stakeholders, engineers, and designers on scope and success metrics.

## Specification Framework

### 1. Problem Statement & Objective
- **Problem**: Clear description of the user pain point or technical bottleneck.
- **Goal**: Quantifiable outcome (e.g., reduce asset lookup latency by 50%).
- **Non-Goals**: Explicit boundaries on what is out of scope.

### 2. User Personas & User Journeys
- Define primary user personas (e.g., IT Administrator, Inventory Auditor).
- Step-by-step user journeys describing standard workflows and alternate branches.

### 3. Functional Requirements
- Enumerate functional requirements with MoSCoW prioritization (Must-Have, Should-Have, Could-Have, Won't-Have).
- Format user stories: *As a [role], I want [action] so that [benefit].*

### 4. Acceptance Criteria (Given / When / Then)
- Define unambiguous verification rules using Gherkin syntax:
  ```gherkin
  Scenario: Exporting filtered inventory
    Given an administrator has filtered assets by status "In Stock"
    When the user clicks "Export Excel"
    Then a verified UTF-8 CSV containing all 18 standard fields is downloaded
  ```

### 5. Edge Cases, Failure Modes & Non-Functional Requirements
- Network disconnects, large dataset limits, rate limits, concurrent edits.
- Performance SLA, security requirements (RBAC, sanitization), audit trails.
