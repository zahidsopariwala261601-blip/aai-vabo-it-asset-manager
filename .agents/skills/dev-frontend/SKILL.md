---
name: dev-frontend
description: >-
  Modern frontend engineering workflows, component architecture, state management, reactive DOM manipulation, modern CSS/responsive styling, accessibility, and performance optimization. Use when developing or refactoring web user interfaces.
---

# Frontend Development Skill

Modern best practices for creating responsive, accessible, high-performance web frontends.

## When to Use
- Developing or refactoring frontend user interfaces (vanilla JS, React, Vue, HTML/CSS).
- Optimizing DOM rendering performance, minimizing bundle size, and reducing layout thrashing.
- Implementing responsive layouts, accessible forms, and rich interactive dashboards.

## Core Engineering Principles

### 1. Component Architecture & Separation of Concerns
- Maintain clean separation: Markup (Structure), Styles (Presentation), Logic (Behavior).
- Single Responsibility: Components should manage only their dedicated view and state.
- Keep utilities and API callers decoupled from UI rendering logic.

### 2. State Management & Asynchronous Flows
- Maintain single source of truth for application state.
- Implement optimistic UI updates with automatic rollback on server failure.
- Debounce high-frequency events (search inputs, resize handlers) and throttle scroll listeners.
- Always provide clear visual feedback during async operations (loading indicators, disabled buttons).

### 3. Defensive DOM Manipulation
- Sanitize all dynamic HTML injection to eliminate Cross-Site Scripting (XSS).
- Use `textContent` or dedicated templating helpers instead of raw `innerHTML` where possible.
- Cache DOM queries; avoid querying the document repeatedly inside loops.

### 4. Modern CSS & Responsive Layouts
- Utilize CSS Grid for 2D page layouts and Flexbox for 1D component alignments.
- Leverage CSS custom properties (variables) for theme consistency and dark/light modes.
- Employ mobile-first media queries: `@media (min-width: 640px) { ... }`.
