---
name: audit-frontend
description: >-
  Comprehensive frontend auditing covering Lighthouse metrics (Core Web Vitals - LCP, FID/INP, CLS), accessibility (a11y/WCAG), bundle size analysis, network waterfalls, and SEO. Use when auditing frontend codebases for quality, speed, and accessibility.
---

# Frontend Audit & Quality Assurance Skill

Procedures for evaluating web applications against industry standards for performance, accessibility, SEO, and security.

## When to Use
- Performing pre-release QA or frontend health checks.
- Diagnosing slow page loads, layout shifts, or bundle bloat.
- Auditing web interfaces for WCAG 2.1 AA accessibility compliance.

## Audit Dimensions

### 1. Performance & Core Web Vitals
- **LCP (Largest Contentful Paint)**: Target < 2.5s. Optimize hero images, preload critical fonts, eliminate render-blocking CSS/JS.
- **INP (Interaction to Next Paint)**: Target < 200ms. Break up long JavaScript tasks, debounce event listeners.
- **CLS (Cumulative Layout Shift)**: Target < 0.1. Always specify `width` and `height` attributes on `<img>` and iframe tags.

### 2. Accessibility (A11y)
- Validate semantic HTML: correct landmark usage (`<header>`, `<nav>`, `<main>`, `<footer>`).
- Inspect interactive elements: buttons have text or `aria-label`, images have descriptive `alt` attributes.
- Keyboard navigation: test complete user journeys without touching the mouse.

### 3. Asset & Bundle Size Optimization
- Minify CSS and JavaScript assets.
- Eliminate unused code (Dead Code Elimination / Tree-Shaking).
- Compress images using modern formats (WebP, AVIF) with responsive `srcset`.

### 4. Security Hygiene
- Content Security Policy (CSP) headers configured to prevent inline script execution.
- `rel="noopener noreferrer"` on all external links opening in new tabs.
