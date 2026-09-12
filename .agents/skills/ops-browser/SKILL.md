---
name: ops-browser
description: >-
  Browser automation, end-to-end testing, visual regression testing, synthetic user journeys, DOM inspection, and debugging using Playwright and Puppeteer. Use when verifying web applications in headless or headed browsers.
---

# Browser Operations & E2E Verification Skill

Guidance for automating browser sessions, executing synthetic user flows, and performing end-to-end testing with Playwright / Puppeteer.

## When to Use
- Running automated end-to-end tests across Chromium, Firefox, and WebKit.
- Verifying complex multi-page UI interactions, forms, and file uploads/downloads.
- Capturing screenshots, recording visual regression baselines, or debugging network responses.

## Playwright Core Patterns

### 1. Robust Element Selection
- Prefer user-visible locators over fragile CSS/XPath selectors:
  - `page.getByRole('button', { name: 'Save Asset' })`
  - `page.getByLabel('Serial Number')`
  - `page.getByPlaceholder('Scan barcode...')`

### 2. Asynchronous Stability
- Never use arbitrary sleep timers (`sleep(5000)`).
- Always use auto-waiting assertions:
  ```javascript
  await expect(page.getByText('Asset created successfully')).toBeVisible();
  ```
- Wait for network idle or specific API responses when validating asynchronous mutations.

### 3. Form Automation & Download Verification
```javascript
// Handling file downloads
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export CSV' }).click();
const download = await downloadPromise;
const filePath = await download.path();
```

### 4. Diagnostics & Artifacts
- Capture screenshots on test failures: `await page.screenshot({ path: 'failure.png', fullPage: true });`.
- Enable Playwright trace recording for step-by-step post-mortem inspection.
