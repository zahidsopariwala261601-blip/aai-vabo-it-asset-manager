---
name: ui-spec
description: >-
  UI/UX interface specifications, component hierarchies, design tokens, responsive breakpoints, accessible interactions (WCAG 2.1 AA), and state representations. Use when specifying user interfaces, component design systems, or screen layouts.
---

# UI/UX Specification Skill

Comprehensive guidelines for specifying accessible, responsive, and maintainable user interfaces and component design systems.

## When to Use
- Designing new screens, modals, tables, dashboards, or interaction flows.
- Establishing or extending design tokens, component hierarchies, and style systems.
- Specifying accessibility compliance (WCAG 2.1 AA) and responsive behavior.

## Specification Checklist

### 1. Design Tokens & Visual Hierarchy
- **Colors**: Primary, Secondary, Background, Surface, Borders, Status (Success, Warning, Error, Info).
- **Typography**: Font family, scale (xs, sm, base, lg, xl, 2xl), line heights, weights.
- **Spacing & Layout**: Standard 4px/8px grid system, container max-widths.

### 2. Component Hierarchy & State Matrix
Every component specification must document all 8 fundamental UI states:
1. **Default / Idle**: Standard presentation.
2. **Hover**: Visual elevation or subtle color shift on cursor hover.
3. **Active / Focus**: Visible focus outline for keyboard accessibility (`:focus-visible`).
4. **Loading / Pending**: Skeleton loader or spinner during asynchronous operations.
5. **Empty**: Engaging empty state with clear call-to-action when data is null/empty.
6. **Error / Validation**: Inline validation messages with clear recovery actions.
7. **Success**: Confirmation feedback (toast or checkmark).
8. **Disabled**: Reduced opacity, `pointer-events: none`, aria-disabled.

### 3. Responsive Breakpoints
- Mobile (< 640px), Tablet (640px - 1024px), Desktop (> 1024px).
- Reflow strategy: grid collapse, hidden optional columns, mobile drawer menus.

### 4. Accessibility (A11y) Requirements
- All interactive controls must be keyboard operable (`Tab`, `Enter`, `Space`, `Escape`).
- Form inputs must have explicit `<label for="...">` associations.
- Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text and UI controls.
