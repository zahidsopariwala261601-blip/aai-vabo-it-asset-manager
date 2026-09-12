---
name: domain-modeling
description: >-
  Domain-driven design (DDD) modeling, entity relationships, aggregate roots, value objects, domain events, state machines, and invariants. Use when designing business domains, data architectures, database schemas, or bounded contexts.
---

# Domain Modeling & DDD Skill

Authoritative guidance for modeling complex business domains, aggregates, entities, and database schemas.

## When to Use
- Designing new data models or relational/document database schemas.
- Refactoring tangled business logic into clean domain models.
- Establishing bounded contexts and explicit domain state machines.

## Modeling Protocol

### 1. Ubiquitous Language & Bounded Contexts
- Define glossary of domain terms agreed upon by domain experts and developers.
- Isolate bounded contexts to prevent model contamination across subsystems.

### 2. Strategic Elements
- **Entities**: Objects with explicit identity persisting across state changes (e.g., `Asset`, `Employee`).
- **Value Objects**: Immutable objects identified purely by attributes (e.g., `IPAddress`, `SerialTag`).
- **Aggregate Roots**: The root entity guarding consistency invariants of its cluster (e.g., `Transaction` guarding its item allocations).

### 3. Invariants & Business Rules
- Specify invariants that must ALWAYS hold true:
  - An asset cannot simultaneously be assigned to two different users.
  - State changes must emit corresponding audit log entries.

### 4. State Machine Definition
- Document state transitions:
  ```mermaid
  stateDiagram-v2
    [*] --> InStock: New Asset Added
    InStock --> Assigned: Issued to Employee
    Assigned --> InStock: Returned
    Assigned --> UnderMaintenance: Marked Faulty
    UnderMaintenance --> InStock: Repaired
    UnderMaintenance --> Disposed: Scrap
  ```

### 5. Schema & Persistence Mapping
- Map domain models to relational tables with explicit primary keys, foreign keys, and unique indexes.
