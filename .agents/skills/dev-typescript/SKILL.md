---
name: dev-typescript
description: >-
  Strict TypeScript development standards, advanced type systems, generics, utility types, discriminated unions, runtime schema validation (Zod), and compiler configuration. Use when writing or refactoring TypeScript code.
---

# TypeScript Engineering & Type Safety Skill

Authoritative patterns for building robust, strictly-typed TypeScript systems.

## When to Use
- Writing, refactoring, or reviewing TypeScript codebases.
- Eliminating `any` types and replacing them with precise types or `unknown`.
- Designing generic abstractions, discriminated unions, or runtime type validators.

## TypeScript Standards

### 1. Strict Compiler Configuration
- Always enforce `strict: true` in `tsconfig.json`.
- Enable `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.

### 2. Type Architecture Best Practices
- **Discriminated Unions**: Model states with an unambiguous discriminant:
  ```typescript
  type AsyncState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error };
  ```
- **Type Guards**: Use custom type predicate functions (`value is Type`) to narrow types safely.
- **Utility Types**: Master built-in utilities (`Pick`, `Omit`, `Partial`, `Readonly`, `Record`, `ReturnType`).

### 3. Runtime Type Validation (Zod / Typebox)
- Static types evaporate at runtime. Always validate external data (API payloads, query params, CSV rows) at the application boundaries using Zod schemas.
- Infer TypeScript types directly from schemas: `type Asset = z.infer<typeof AssetSchema>;`.

### 4. Eliminating Anti-Patterns
- **Never use `any`**: Use `unknown` when the shape is truly arbitrary, then narrow.
- Avoid non-null assertions (`!`) unless backed by provable local invariants.
