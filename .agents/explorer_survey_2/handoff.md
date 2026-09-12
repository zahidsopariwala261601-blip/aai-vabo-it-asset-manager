# Frontend Architecture, UI/UX, States & Accessibility Survey Report
**Project**: AAI VABO IT Asset Management System  
**Agent**: Explorer 2 (Frontend Architecture, UI/UX, States & Accessibility Survey)  
**Date**: 2026-09-12T11:42:00Z  
**Working Directory**: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_2`  
**Status**: Completed  

---

## 1. Observation

### 1.1 Frontend Tech Stack & Architecture
- **Framework & Libraries**: Pure Vanilla ES6+ JavaScript, native HTML5, and bespoke CSS. No external UI frameworks (no React, Vue, Angular, or jQuery).
- **Bundling & Build Pipeline**: No bundler or compiler (no Webpack, Vite, Rollup, Babel, or Tailwind). All assets are served directly as static files.
- **Static Asset Serving (`server.js`)**:
  - `Public/` is served via Express static middleware:
    ```javascript
    // server.js:93-97
    app.use(express.static(path.join(__dirname, 'Public'), {
        maxAge: 0,        // No browser caching — always validate with server
        etag: true,       // Use ETags for efficient conditional requests
        lastModified: true
    }));
    ```
  - Single-Page Application (SPA) fallback route:
    ```javascript
    // server.js:100-103
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(__dirname, 'Public', 'index.html'));
    });
    ```
- **File Breakdown & Sizes**:
  - `Public/index.html` (73,256 bytes, 1,132 lines): Core SPA container, Dashboard, Inventory table, Handover/Takeover, Employee Directory, Audit Logs, Print logs, Multi-Asset Wizard, and 6 modal dialogs.
  - `Public/accounts.html` (5,299 bytes, 126 lines): Dedicated Account Management administration interface.
  - `Public/css/style.css` (43,304 bytes, 1,769 lines): Core design system, glassmorphism theme, layout components, table wrappers, modal overlays, print styles.
  - `Public/css/modern.css` (21,948 bytes, 298 lines): Modern design tokens, responsive breakpoints, mobile off-canvas drawer navigation, `:focus-visible` ring.
  - `Public/css/accounts.css` (4,993 bytes, 271 lines): Accounts page layout, modal, and table styles.
  - `Public/js/utils.js` (11,961 bytes, 310 lines): Toast notifications, date/IPv4 helpers, counter animation, CSV parser (`parseCSV`), CSV exporter (`downloadCSV`), designation normalization (`cleanDesignation`).
  - `Public/js/api.js` (6,198 bytes, 176 lines): Token retrieval/storage in `localStorage`, unified `apiRequest()` wrapper with Bearer token injection, API endpoints.
  - `Public/js/ui.js` (34,482 bytes, 635 lines): Dashboard statistics renderer, CSS donut chart (`renderPieChart`), inventory table (`renderInventory`), employee directory (`renderEmployees`), printable slip generator (`printTransaction`).
  - `Public/js/app.js` (97,848 bytes, 2,272 lines): Main controller, navigation routing (`switchView`), form handlers (`saveAsset`), transaction flows (`submitTransaction`), CSV import/preview modal (`importCSV`, `showImportPreview`), multi-asset entry wizard (`openWizard`, `wizardNext`).
  - `Public/js/accounts.js` (5,168 bytes, 143 lines): Account administration controller (`loadUsers`, `handleAddUser`, `handleResetPassword`, `deleteUser`).

---

### 1.2 Views & Component Inventory
1. **Workspace Topbar & Authentication View** (`index.html:88-145` & `269-273`):
   - Hero banner illustration (`/images/operations.svg`), feature tags, and sign-in card with login/register toggle (`toggleAuth`).
   - Header location indicator (`Vadodara Airport / IT asset operations / VABO`), network sync status pill (`#sync-state`), and user initials avatar (`#workspace-avatar`).
2. **Dashboard View** (`#view-dashboard`, `index.html:275-340`):
   - 4 Stat Cards: Total Assets (`#stat-total`), In Store (`#stat-stock`), Issued (`#stat-issued`), Deployment rate (`#stat-utilization`).
   - Fleet Readiness progress track (`#readiness-track`, `#readiness-legend`).
   - Department Allocation progress bars (`#department-bars`).
   - Split panel: Recent activity feed (`#recent-activity`) and CSS conic-gradient donut chart (`#pie-chart`).
3. **Category / Type Selector View** (`#view-inventory-select`, `index.html:344-434`):
   - Grid cards: All Assets, Department, Desktop/PC, AIO, Laptop, Printer, UPS, Scanner with live animated badge counters.
4. **Department Selector View** (`#view-department-select`, `index.html:436-455`):
   - Grid cards dynamically populated per airport department (`renderDepartmentTiles`).
5. **Inventory Table View** (`#view-inventory`, `index.html:457-556`):
   - Registration card (`.glass-card`): New registration / Edit asset form with 20 fields.
   - Live category type checker (`checkAssetType()`) toggling conditional fields (`in-charger`, `in-monitor-make`, `in-monitor-serial`, `in-keyboard-make`, `in-mouse-make`, `in-kva`).
   - 15-Column Table: `SR`, `Asset Type`, `Asset Tag`, `Make`, `Model`, `Serial No.`, `IP Address`, `Hostname`, `Current Holder`, `Designation`, `Department`, `Year`, `Warranty`, `Status`, `Actions`.
   - Sortable columns (`sortInventory()`) with visual sort direction indicators.
   - Row actions: Asset History Trail (`viewAssetTrail`), Edit Asset (`editAsset`), Delete Asset (`confirmDeleteAsset`).
6. **Employee Directory View** (`#view-employees`, `index.html:559-605`):
   - Multi-criteria sort select (`#employees-sort`: Name, Department, Year, AAI Designation hierarchy ranking 1-19).
   - Search filter (`#employees-search`), Add Employee button (`openEmployeeModal()`).
   - Table: Employee Name, Designation, Department, Assigned Assets (aggregated with serial and purchase year), Row actions (View Trail, Edit, Delete).
7. **Handover / Takeover View** (`#view-handover`, `index.html:608-710`):
   - Two-column split layout: Left = Searchable selectable asset list (`#selectable-assets`), Right = Transaction metadata form.
   - Mode switcher: Handover filters assets by `In Stock` and displays `#network-section`; Takeover filters assets by `Assigned` and displays `#takeover-notice`.
   - Autocomplete integration: Receiver (`#form-name`) and Issuer (`#form-issuer`) datalists automatically fill designation and department.
   - Action buttons: `Save Transaction` (`submitTransaction('save')`) and `Print / PDF` (`submitTransaction('print')`).
8. **Audit Logs View** (`#view-history`, `index.html:713-751`):
   - Search input (`#history-search`) and type filter dropdown (`#history-type-filter`).
   - Table: `Timestamp`, `Type`, `Assets`, `Person`, `Reference`, `Remark`, `Actions`.
   - Role gating: Actions column (`#history-actions-col`) is conditionally toggled based on `getUser()?.role === 'admin'`. Actions include `openAuditEditModal()`, `reprintFromLog()`, `confirmDeleteAuditLog()`.
9. **Print Audit Trail View** (`#view-print-logs`, `index.html:754-782`):
   - Table of all print actions: `Timestamp`, `Action` (Print / Reprint), `Printed By`, `System Info` (IP, Hostname), `Ref No.`, `Doc Type`.
10. **Multi-Asset Entry Wizard View** (`#view-wizard`, `index.html:785-869`):
    - 5-Step Stepper: Step 1 Employee -> Step 2 Categories -> Step 3 Specifications -> Step 4 Network Context -> Step 5 Review & Save.
11. **Modals Audit**:
    - `#employee-modal` (`index.html:873-900`): Add/edit employee name, designation, department.
    - `#audit-edit-modal` (`index.html:902-977`): Admin-only modification of historical logs with permanent change history tracking.
    - `#emp-trail-modal` (`index.html:980-1008`): Employee lifecycle timeline with print button (`printEmpTrail()`).
    - `#trail-modal` (`index.html:1011-1040`): Hardware lifecycle timeline with technical specs banner and print button (`printTrail()`).
    - `#import-modal` (`index.html:1042-1093`): CSV import validation breakdown, preview table (50 rows), failed record log, download error report.
    - `#audit-delete-modal` (`index.html:1096-1116`): Soft delete confirmation with mandatory reason prompt.
    - `#add-user-modal` (`accounts.html:77-102`): Admin creation of new user credentials and role (`user` vs `admin`).
    - `#reset-password-modal` (`accounts.html:105-121`): Admin password reset modal.

---

### 1.3 Audit of the 8 Standard UI States
1. **Default / Idle State**:
   - Implemented via CSS custom properties in `style.css:9-45` and `modern.css:2-23`.
   - Dark mode default (`--bg-primary: #0a111e`, `--bg-card: #111d2e`, `--text-primary: #edf3fa`).
   - Light mode alternate (`body.light-mode`, `modern.css:24-39`).
2. **Hover State**:
   - Implemented across navigation buttons (`.nav-btn:hover`), cards (`.glass-card:hover`), primary buttons (`.btn-primary:hover`), action icons (`.btn-icon:hover`), and table rows (`tr:hover td`).
3. **Active / Focus State**:
   - Focus outline explicitly defined in `modern.css:47-49`:
     ```css
     button:focus-visible, a:focus-visible, [tabindex]:focus-visible, input:focus-visible, select:focus-visible {
         outline: 3px solid var(--accent-cyan); outline-offset: 4px;
     }
     ```
   - Active press states: `.btn-primary:active` (`transform: scale(0.98)`).
4. **Loading / Pending State**:
   - Full-screen animated overlay `#loader-overlay` and initial screen `#loading-screen` (`index.html:20-85`, `style.css:145-180`) with animated SVG microchip circuitry and traces.
   - Table bodies default to `<tr><td colspan="...">Loading...</td></tr>`.
   - Header synchronization indicator `#sync-state` has data states: `loading`, `ready`, `error` (`app.js:51-55`).
   - **Defect**: No inline button loading states (spinners or disabled appearance inside buttons) during form submissions (`saveAsset()`, `submitTransaction()`, `saveEmployee()`).
5. **Empty State**:
   - Inventory table: `<td colspan="15">No assets found</td>` (`ui.js:149`).
   - Employee table: `<td colspan="5">No employees found</td>` (`ui.js:609`).
   - Audit logs: `<td colspan="6">No transaction history</td>` (`ui.js:263`).
   - Selectable assets: `<div style="...">No matching assets</div>` (`ui.js:207`).
   - Asset Trail: Includes an empty graphic icon and explanatory text (`app.js:1764-1768`).
   - **Defect**: Most table empty states are unstyled plain text without call-to-action buttons (e.g., "Add Asset" or "Reset Filters").
6. **Error / Validation State**:
   - Handled almost exclusively via asynchronous toast notifications (`toast(err.message, 'error')`).
   - **Defect**: Zero CSS rules for `.is-invalid`, `.form-error`, or `:invalid` input borders. Inputs do not indicate which specific field failed validation.
7. **Success State**:
   - Present via `toast(message, 'success')` (`utils.js:11,18`) with green accent color and checkmark icon.
8. **Disabled Actions State**:
   - **Defect**: Completely absent in CSS. A ripgrep search for `:disabled`, `[disabled]`, and `.disabled` across `style.css`, `modern.css`, and `accounts.css` returned **0 matches**. Disabled buttons and inputs do not display reduced opacity, `cursor: not-allowed`, or `pointer-events: none`.

---

### 1.4 User Interaction Flows & Functional Wiring

#### A. Asset Creation & Editing Form Flow
- Form location: `index.html:479-514`.
- **Defect**: The registration form is NOT wrapped in an HTML `<form>` tag. It consists of loose inputs inside a `.glass-card`.
- **Defect**: None of the 20 input fields have associated `<label for="...">` elements. They rely solely on `placeholder` attributes.
- **Defect**: Pressing the `Enter` key inside any input does not submit the form; user must explicitly click the `💾 Register Asset` button (`#btn-save-asset`).
- **Defect**: Client-side validation in `saveAsset()` (`app.js:617-621`) only checks:
  ```javascript
  const name = document.getElementById('in-name').value.trim();
  const serial = document.getElementById('in-serial').value.trim();
  if (!name || !serial) return toast('Name and Serial Number are required', 'warning');
  ```
  It does NOT validate IPv4 format (`in-ip`), hostname format (`in-hostname`), or purchase year range (`in-year`), despite `isValidIPv4` existing in `utils.js`.

#### B. Handover / Takeover Flow & Printable Receipt Layout
- Flow location: `app.js:835-920` and `ui.js:317-495`.
- Generates official AAI Vadodara Airport handover and takeover slips in a new window via `printTransaction()`:
  - Page specification: `@page { margin: 10mm; size: A4 landscape; }`.
  - Header table: Reference Number (`AAI/VABO/IT/2026/...`), Date, and optional Transaction Remark.
  - 11-column table: `SR NO.`, `Hardware Name`, `Serial Number`, `Make`, `Model`, `Monitor Details`, `Charger S.N.`, `IP Address`, `Hostname`, `Current Holder`, `Remark`.
  - **Policy Notes Block**: Rendered **strictly for Handover** transactions (`ui.js:328-344`), detailing all 8 official AAI Vadodara Airport IT regulations (asset ownership, damage liability, static IP restrictions, NOC requirement, theft FIR protocol).
  - Dual signature block: "Handover by" and "Takeover by" with Name, Designation, Department, and signature lines.
  - Reprint mode: Watermarks document with diagonal "REPRINT" text and session tracking footer (`ui.js:371-375, 470-474`).
  - Automatically invokes `window.print()` after 250ms delay (`ui.js:476-481`).
- **Defect 1**: `submitTransaction('print')` immediately executes `apiCreateTransaction(data)` and records the transaction in the database before printing. There is no read-only print preview without committing a transaction.
- **Defect 2 (Critical CSS Print Bug)**: In `style.css:1675-1735`:
  ```css
  @media print {
      #trail-modal {
          position: static !important;
          display: block !important;
          background: white !important;
  ...
      #emp-trail-modal {
          position: static !important;
          display: block !important;
          background: white !important;
  ...
  ```
  Because ID selectors have higher specificity than `.hidden` (`display: none !important`), pressing `Ctrl+P` while on ANY view (Dashboard, Inventory, Employees) forces closed `#trail-modal` and `#emp-trail-modal` to display at the bottom of the printed page.

#### C. Bulk CSV Import / Export Flow
- **Export Trigger** (`app.js:927-935` & `utils.js:270-300`):
  - Emits all 18 standard fields in exact order:
    `ID,Asset_Tag,Asset Type,Serial,Charger_Serial,Monitor_Make,Monitor_Serial,Keyboard_Make,Mouse_Make,Make,Model,IP,Hostname,Holder,Physical_Asset_Holder,Department,Designation,Year_of_Purchase`
  - Encoded with UTF-8 Byte Order Mark (`\uFEFF`):
    ```javascript
    // utils.js:295
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    ```
- **Import Flow** (`app.js:953-1065`, `utils.js:183-267`):
  - File picker restricted to `.csv` (`accept=".csv"`).
  - `parseCSV()` parses quoted CSV values, maps 18 headers (exact match prioritised over fuzzy match), and normalises designations via `cleanDesignation()`.
  - Displays validation metrics (`stat-import-total`, `stat-import-success`, `stat-import-failed`), error log, and downloadable error report.
- **Defect 1 (Severe Unstyled HTML in Import Modal)**:
  - In `index.html:1051-1091`, the CSV import modal uses CSS classes:
    `skeuo-card`, `skeuo-btn`, `skeuo-btn-primary`, `preview-table-wrapper`, `data-table`, `status-badge`, `status-success`, `status-error`, `import-log`, `log-item`.
  - Ripgrep search across all CSS files confirms that **NONE of these classes exist in `style.css` or `modern.css`**. The import modal rendered elements are completely unstyled raw HTML.
- **Defect 2 (No Excel Support)**: Despite the PRD requirement for CSV/Excel, only `.csv` files are parsed; `.xlsx`/`.xls` files are rejected.

#### D. Authentication & Role-Based Access Control (RBAC) Flow
- **Authentication**: JWT stored in `localStorage.getItem('aai_token')`; user object stored in `localStorage.getItem('aai_user')`.
- **401/403 Handling**: `apiRequest()` in `api.js:43-47` automatically clears tokens and redirects to `showAuth()`.
- **RBAC Gating**:
  - Audit logs view correctly gates the action buttons (`ui.js:268-270`).
  - **Defect 1**: The sidebar link to `/accounts.html` (`index.html:214`) is rendered statically for ALL users, regardless of whether they have the `admin` role.
  - **Defect 2**: `accounts.html` does not verify `getUser()?.role === 'admin'` prior to making API calls. Non-admin users who navigate to `/accounts.html` simply see an inline red error string without being redirected to the dashboard.
  - **Defect 3**: `accounts.js` uses native browser `alert()` and `confirm()` dialogs (`accounts.js:85, 90, 105, 109, 113, 120`), breaking the UI consistency of the application's glassmorphism toast and modal design system.
  - **Defect 4**: Inventory table row actions (Edit and Delete buttons in `ui.js:178-184`) are displayed unconditionally for all authenticated users, without checking `isAdmin`.

---

### 1.5 Accessibility & Responsiveness Audit

#### A. Keyboard Navigation & A11y (WCAG 2.1 AA)
- **Positive Implementations**:
  - Mobile sidebar drawer includes a focus trap and `Escape` key listener (`app.js:92-102`).
  - Category selector cards and theme toggle have `tabindex="0"`, `role="button"`, and Enter/Space event handlers (`app.js:105-111`).
  - High-visibility focus indicator: `outline: 3px solid var(--accent-cyan); outline-offset: 4px;` (`modern.css:47-49`).
  - Accessible motion: `@media (prefers-reduced-motion: reduce)` disables all animations and transitions (`modern.css:290-292`, `utils.js:74-77`).
- **Defects & Gaps**:
  - **Modal Dismissal**: None of the 6 modals in `index.html` or 2 modals in `accounts.html` listen for the `Escape` key.
  - **Backdrop Click**: Clicking the darkened backdrop outside `.modal-content` does not close modals in `index.html`.
  - **Focus Management**: Opening a modal does not trap keyboard focus inside the modal; pressing Tab cycles focus through background page elements. Closing a modal does not return focus to the originating trigger button.
  - **ARIA Attributes**: Modals lack `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="..."`.
  - **Form Labels**: New Registration form inputs (`#in-name`, `#in-serial`, etc.) completely lack `<label>` tags.

#### B. Responsive Breakpoints & Reflow
- **Breakpoints**:
  - Desktop (>1150px): Full multi-column dashboard, sticky sidebar (`var(--sidebar-width: 248px)`), multi-column forms.
  - Tablet (768px - 1150px): 2-column stats grid, single-column split containers, 2-column type selector.
  - Mobile (<768px and <480px): Sidebar transforms into an off-canvas drawer with `menu-toggle` button and backdrop scrim; forms collapse to 1 column.
- **Defects**:
  - 15-column inventory table requires extensive horizontal scrolling on mobile. While `overflow-x: auto` prevents container overflow, column priority hiding or stacked card reflow is missing for mobile screens.
  - In `accounts.css:242`, `.form-group input` has hardcoded `color: white;` which conflicts with light mode (`body.light-mode`), resulting in poor contrast.

#### C. Code Cleanliness & Duplication
- **Defect**: In `Public/js/app.js`, the function `printEmpTrail()` is defined **twice verbatim**:
  - First instance: `app.js:1643-1715`
  - Second instance: `app.js:1956-2028`
  This duplicate code creates maintenance hazards and dead code bloat.

---

## 2. Logic Chain

1. **Premise**: Production-grade client applications require consistent visual states, bulletproof error feedback, full keyboard accessibility (WCAG 2.1 AA), responsive reflow, and robust data import/export pipelines.
2. **Observation A**: A search for disabled styles across all CSS files yielded 0 matches.
   - **Inference A**: Disabled inputs or buttons (e.g., during network requests or lack of permissions) provide zero visual indication of their disabled status, confusing users.
3. **Observation B**: `index.html`'s CSV import modal references `.skeuo-card`, `.skeuo-btn`, `.preview-table-wrapper`, `.status-badge`, but these classes do not exist in any stylesheet.
   - **Inference B**: When users upload a CSV, the preview dialog renders broken, unstyled HTML elements with raw browser defaults.
4. **Observation C**: In `style.css:1675-1735`, `@media print` specifies `#trail-modal { display: block !important; }` and `#emp-trail-modal { display: block !important; }`.
   - **Inference C**: When any user prints the web page (e.g., using `Ctrl+P` on the Dashboard or Inventory page), closed modals forcibly render empty or stale content onto the printout.
5. **Observation D**: Registration inputs lack `<label>` elements and form wrapper, modals lack `Escape` listeners and focus traps, and inputs lack inline validation classes.
   - **Inference D**: The frontend does not comply with WCAG 2.1 AA standards for screen readers and keyboard-only navigation.
6. **Observation E**: `printEmpTrail()` is defined twice in `app.js` (lines 1643 and 1956).
   - **Inference E**: Redundant code increases script footprint and risks out-of-sync behavior during updates.
7. **Observation F**: Both client `downloadCSV()` and backend `/api/assets/export` format all 18 standard fields identically with UTF-8 BOM (`\uFEFF`), and `parseCSV()` parses and normalises them accurately.
   - **Inference F**: The core CSV data exchange schema conforms strictly to the authoritative specifications, but needs visual styling and validation polish in the UI modal.

---

## 3. Caveats

1. **Read-Only Constraint**: No source code was modified during this survey. All findings represent the exact current state of the repository.
2. **Browser Execution Environment**: Node test suite was run via CLI (`npm test`), but real browser rendering (Chrome/Firefox DOM paint, `@media print` output, popup blocker behavior) was verified through static code analysis and AST inspection. Automated browser verification (Playwright) will confirm rendering during QA phase.
3. **Backend Upsert Reliance**: The client CSV import relies on backend upsert via `serial_number`. Any duplicate serials within the CSV or database will overwrite records rather than create duplicates.

---

## 4. Conclusion

The frontend client of the AAI VABO IT Asset Management system possesses an impressive visual aesthetic with dark glassmorphism, responsive off-canvas drawer navigation, animated SVG loaders, and a comprehensive functional footprint (Dashboard, Inventory Table, Employee Directory, Handover/Takeover, Audit Logs, and Multi-Asset Wizard). The CSV export and slip generation adhere accurately to the 18 standard fields and AAI Vadodara Airport official formatting.

However, the survey identified **8 critical frontend gaps** that must be resolved to achieve production readiness:
1. **Unstyled CSV Import Modal**: Missing CSS classes (`.skeuo-*`, `.status-badge`, `.preview-table-wrapper`) cause the import preview to display unstyled HTML.
2. **CSS Print Leaks**: `@media print` in `style.css` forces closed `#trail-modal` and `#emp-trail-modal` into printouts.
3. **Missing Disabled State**: No CSS styling for `:disabled` across the application.
4. **Lack of Inline Validation**: Forms rely solely on toasts with no inline field error highlighting (`.is-invalid`, red borders).
5. **A11y Gaps**: Modals do not close on `Escape` or backdrop click; modals lack focus traps and ARIA dialog attributes; registration form lacks `<label>` tags and Enter key submission.
6. **Code Duplication**: `printEmpTrail()` is duplicated verbatim in `app.js`.
7. **RBAC UI Gating**: Sidebar `Account Manager` link is visible to non-admins, and `accounts.html` lacks frontend role gating while using native `alert()`/`confirm()`.
8. **Print Preview Without Saving**: Handover/Takeover currently saves transactions when printing without offering a pure preview mode.

---

## 5. Verification Method

### 5.1 Automated Codebase Verification
Run the existing smoke test suite to ensure server and static asset routes remain intact:
```powershell
npm test
```
*Expected output*: `1 test passed (0 failures)`.

### 5.2 Specific Files & Lines for Verification
1. Inspect unstyled classes in `Public/index.html:1051-1091` against `Public/css/style.css` and `Public/css/modern.css`.
2. Inspect print modal display bug in `Public/css/style.css:1675-1735`.
3. Inspect duplicate function in `Public/js/app.js:1643` vs `Public/js/app.js:1956`.
4. Inspect missing `<label>` tags in `Public/index.html:482-503`.
5. Inspect CSV 18-field formatting in `Public/js/utils.js:271` and UTF-8 BOM at line 295.

### 5.3 Visual & Interactive Quality Criteria for Implementation
- [ ] Clicking any modal's backdrop or pressing `Escape` closes the modal.
- [ ] CSV import modal displays styled cards, badges, and tables matching the dark glassmorphism design system.
- [ ] Printing the Dashboard or Inventory page via `Ctrl+P` produces clean output without trail modals appended.
- [ ] Disabled buttons display `opacity: 0.5; cursor: not-allowed; pointer-events: none;`.
- [ ] Empty tables display a styled empty state card with a relevant action button.
- [ ] Invalid inputs display a red border (`--accent-red`) and clear error feedback.
