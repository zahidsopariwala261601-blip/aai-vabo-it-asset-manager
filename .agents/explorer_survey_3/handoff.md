# Comprehensive Specification Mining & Test Framework Survey Report
**Project:** AAI VABO IT Asset Management System (Vadodara Airport)  
**Agent:** Spec Miner / Explorer Survey 3  
**Working Directory:** `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3`  
**Date & Timestamp:** 2026-09-12T11:45:00Z  
**Authoritative Sources:**
1. `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md`
2. `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\AAI_VABO_IT_Asset_Manager_Specification.pdf` (v2.0, 7 Pages)
3. Active codebase: `server.js`, `package.json`, `config/db.js`, `routes/*.js`, `middleware/*.js`, `Public/index.html`, `Public/accounts.html`, `Public/js/*.js`, `tests/smoke.test.js`

---

## 1. Observation

Direct observations from codebase inspection, database schema analysis, PDF OCR extraction, and test command execution:

### 1.1 Specification Document (`AAI_VABO_IT_Asset_Manager_Specification.pdf`)
The authoritative 7-page specification establishes:
- **12 Functional Capabilities & Modules:** (1) Dashboard & Real-Time Analytics, (2) Asset Inventory & Data Controls, (3) Single Asset Registration & Auto Tagging, (4) Unified Multi-Asset Entry Wizard, (5) Handover & Takeover Workflows, (6) Mutual Asset Linking & Unlinking, (7) Audit Logs & Revision Tracking, (8) Document Print Security Audit Logs, (9) Employee Directory & Asset Trail, (10) Accounts & Access Control Manager, (11) Bulk Import (UPSERT), Export & Backups, (12) Barcode Scanning & UI Personalization.
- **5 Database Tables:**
  1. `users` (4 columns: `id`, `username`, `password`, `role`)
  2. `employees` (6 columns: `id`, `name`, `designation`, `department`, `status`, `created_at`)
  3. `assets` (25 columns: `id`, `name`, `serial_number`, `asset_tag`, `charger_serial`, `monitor_make`, `monitor_serial`, `keyboard_make`, `mouse_make`, `make`, `model`, `ip_address`, `hostname`, `current_user`, `contractual_user_name`, `assigned_dept`, `assigned_desig`, `employee_id`, `linked_asset_id`, `status`, `remark`, `year_of_purchase`, `kva`, `warranty_expiry`, `last_update`)
  4. `transactions` (24 columns: `id`, `type`, `asset_ids`, `asset_names`, `ref_no`, `date`, `employee_name`, `employee_desig`, `employee_dept`, `issuer_name`, `issuer_desig`, `issuer_dept`, `employee_id`, `issuer_id`, `remark`, `edit_history`, `last_edited_by`, `last_edited_at`, `timestamp`, `is_deleted`, `deleted_by`, `deleted_at`, `delete_reason`, `is_protected`)
  5. `print_logs` (10 columns: `id`, `transaction_id`, `action_type`, `printed_by`, `printed_by_dept`, `system_ip`, `system_hostname`, `ref_no`, `doc_type`, `print_timestamp`)
- **10 Core Business Logic Rules:**
  1. Bcrypt salt rounds = 10, JWT expiration 24h, admin authorization check (`req.user.role === 'admin'`), default admin seed (`admin` / `admin123`).
  2. Automatic status calculation: `(currentUser.trim().toLowerCase() === 'it store') ? 'In Stock' : 'Assigned'`.
  3. Asset Tag rule: `VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}` (2-digit zero-padded sequence).
  4. Handover state mutation: `status = 'Assigned'`, `current_user = employee_name`, `assigned_dept`, `assigned_desig`, `employee_id`, `ip_address`, `hostname`, reference voucher `AAI/VABO/IT/HANDOVER/...`.
  5. Takeover state mutation: `status = 'In Stock'`, `current_user = 'IT Store'`, wipe department, designation, employee_id, ip_address, hostname, contractual_user_name, reference voucher `AAI/VABO/IT/TAKEOVER/...`.
  6. Unified Wizard transaction integrity: 100% single-transaction SQL integrity (`BEGIN TRANSACTION ... COMMIT / ROLLBACK`), duplicate serial checks in input and existing DB with 409 Conflict.
  7. Mutual parent-child linking: Reciprocal pointers (`parent.linked_asset_id = child.id` AND `child.linked_asset_id = parent.id`), clears existing pointers, logs dedicated link/unlink transaction.
  8. Admin audit revision tracking: Structured JSON diff `{ edited_by, edited_at, changes: { field: { old, new } } }` appended to `edit_history`.
  9. Bulk CSV UPSERT strategy: `ON CONFLICT(serial_number) DO UPDATE`.
  10. PostgreSQL & SQLite hybrid translation layer in `config/db.js`.

### 1.2 User Request Constraints (`ORIGINAL_REQUEST.md`)
- **18 Standard Fields:**
  `ID`, `Asset_Tag`, `Asset Type`, `Serial`, `Charger_Serial`, `Monitor_Make`, `Monitor_Serial`, `Keyboard_Make`, `Mouse_Make`, `Make`, `Model`, `IP`, `Hostname`, `Holder`, `Physical_Asset_Holder`, `Department`, `Designation`, `Year_of_Purchase`.
- **Export Encoding:** Must use UTF-8 BOM (`\uFEFF`) so Excel on Windows parses it correctly.
- **Round-Trip Import:** Exported CSV must be re-importable without data loss.
- **Status Lifecycle:** `In Stock`, `Assigned`, `Faulty`, `Scrap`.
- **UI States (8):** Default, hover, active, loading/spinner, empty state, validation errors, success toasts, disabled actions.
- **Accessibility:** Tab navigation, Enter/Space action triggers, Escape modal dismissal, responsive viewports (Desktop 1280px+, Tablet 768px-1024px, Mobile <640px).
- **Automated Verification:** 4-tier testing suite passing `npm test` with 0 failures, plus Playwright browser E2E.

### 1.3 Active Codebase & Architecture Observations
- `server.js`: Single Express server on port 8001 serving static frontend (`Public/`) and mounting routes (`/api/auth`, `/api/assets`, `/api/transactions`, `/api/employees`, `/api/admin`).
- `config/db.js`: SQLite connection (`database.db`), schema initialization, table migrations, and employee seeding.
- `routes/assetRoutes.js`:
  - `GET /api/assets/export` (lines 127-156): Correctly sends `\uFEFF` and all 18 standard column headers.
  - `POST /api/assets/bulk` (lines 321-382): Correctly implements `ON CONFLICT(serial_number) DO UPDATE`.
  - `POST /api/assets/wizard` (lines 221-319): Uses `BEGIN TRANSACTION`, verifies duplicate serials in input and DB.
  - `POST /api/assets` & `PUT /api/assets/:id`: Overwrites status based only on `it store` check (`const status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';`). Statuses `'Faulty'` and `'Scrap'` are not supported.
  - `DELETE /api/assets/:id`: Hard deletion without admin role verification or audit log recording.
- `routes/transactionRoutes.js`:
  - `POST /api/transactions` (lines 98-166): Executes `INSERT INTO transactions` and multiple `UPDATE assets` asynchronously WITHOUT `BEGIN TRANSACTION ... COMMIT / ROLLBACK`.
  - `PUT /api/transactions/:id` (lines 169-250): Admin-only, records changes diff in `edit_history`.
  - `DELETE /api/transactions/:id` (lines 60-95): Admin-only soft-delete (`is_deleted = 1`), checks `is_protected`.
- `routes/authRoutes.js`:
  - Line 21: `if (err.message.includes('duplicate key'))` checks for PostgreSQL wording instead of SQLite `UNIQUE constraint failed`, leading to 500 errors on duplicate username registration.
- `Public/js/app.js`:
  - Line 94: Escape key only triggers `setNavigation(false)` for the mobile drawer. It does NOT close open modals (`#employee-modal`, `#audit-edit-modal`, `#emp-trail-modal`, `#trail-modal`, `#import-modal`, `#audit-delete-modal`).
  - Line 315: `form-ref` in handover/takeover is prefilled with prefix `AAI/VABO/IT/2026/` rather than full auto-generated reference code.
- `tests/smoke.test.js` & `package.json`:
  - `"test": "node --test tests/smoke.test.js"`
  - `npm test` executed: Passed in 1059ms (1 test, 0 failures).
  - No other test files exist. No Playwright or unit test files exist.

---

## 2. Logic Chain

1. **Mapping Authoritative Specs to Code:** Comparing `ORIGINAL_REQUEST.md`, `AAI_VABO_IT_Asset_Manager_Specification.pdf`, and the codebase revealed an established core, but several clear gaps where features were partially implemented or missing.
2. **Column Mapping Verification:** The 18 standard CSV fields in `ORIGINAL_REQUEST.md` map to database columns in `assets`:
   - `ID` -> `id`
   - `Asset_Tag` -> `asset_tag`
   - `Asset Type` -> `name`
   - `Serial` -> `serial_number`
   - `Charger_Serial` -> `charger_serial`
   - `Monitor_Make` -> `monitor_make`
   - `Monitor_Serial` -> `monitor_serial`
   - `Keyboard_Make` -> `keyboard_make`
   - `Mouse_Make` -> `mouse_make`
   - `Make` -> `make`
   - `Model` -> `model`
   - `IP` -> `ip_address`
   - `Hostname` -> `hostname`
   - `Holder` -> `current_user`
   - `Physical_Asset_Holder` -> `contractual_user_name`
   - `Department` -> `assigned_dept`
   - `Designation` -> `assigned_desig`
   - `Year_of_Purchase` -> `year_of_purchase`
   *(Plus internal columns: `employee_id`, `linked_asset_id`, `status`, `remark`, `kva`, `warranty_expiry`, `last_update`)*.
3. **Identification of Gaps:**
   - *Status Transitions:* Lifecycle requires `In Stock`, `Assigned`, `Faulty`, `Scrap`. Currently the code hardcodes binary status based on `current_user === 'IT Store'`.
   - *Mutual Asset Linking:* Spec describes mutual parent-child linking (`parent.linked_asset_id = child.id` and reciprocal) with dedicated audit transactions. Database column exists, but API endpoints and UI controls are missing.
   - *Handover Transaction Boundaries:* Multi-asset handovers lack `BEGIN TRANSACTION ... ROLLBACK` in `transactionRoutes.js`.
   - *Asset Deletion Safeguard:* Deleting an asset is a hard delete without role check or audit record.
   - *Keyboard Modal Dismissal:* Modals cannot be closed via Escape key.
   - *Test Infrastructure:* Only a single smoke test file is run. No unit tests, no pairwise tests, no scenario tests, and no Playwright E2E browser tests exist.
4. **Formulation of the 4-Tier Test Architecture:**
   - Tier 1: Functional coverage for all 16 features (>=5 test cases each = 80+ cases).
   - Tier 2: Boundary and edge case coverage (>=5 test cases each = 80+ cases).
   - Tier 3: Pairwise cross-feature combinations (12 key combinatorial integration scenarios).
   - Tier 4: Realistic enterprise application workflows (5 full end-to-end operational scenarios).
   - E2E Browser Automation: Playwright setup with Node.js test runner harness.

---

## 3. Caveats

1. **Read-Only Investigation:** Per dispatch instructions, this investigation is strictly non-destructive and read-only. No application code has been modified.
2. **Platform Specifics:** Host system is Windows with PowerShell (`pwsh`). File paths and shell commands in verification scripts must respect Windows conventions.
3. **Database Concurrency in Tests:** SQLite in WAL mode allows multiple readers with one writer. Automated tests running in parallel should use isolated database instances (such as `fs.mkdtemp` in `smoke.test.js`) to prevent file lock contention (`SQLITE_BUSY`).

---

## 4. Conclusion & Exhaustive Specification Findings

### 4.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth & RBAC | User Login | Authenticate user via credentials and return signed JWT token | `username`, `password` (JSON) | `token` (JWT, 24h), `user` object (`id`, `username`, `role`) | 400 if missing fields, 401 if invalid credentials | `routes/authRoutes.js:37` |
| 2 | Auth & RBAC | User Registration | Create new user account with hashed password (bcrypt 10 rounds) | `username` (min 3, alphanumeric/underscore), `password` (min 4) | `token`, `user` object (role='user'), 201 Created | 400 validation error, 409 if user exists | `routes/authRoutes.js:10` |
| 3 | Auth & RBAC | Session Verification (`/api/auth/me`) | Validate active JWT Bearer token | `Authorization: Bearer <token>` | `user` payload from decoded JWT | 401 if token missing, 403 if expired or invalid | `routes/authRoutes.js:61` |
| 4 | Admin & RBAC | User List (`/api/admin/users`) | Administrator lists all system users | Admin JWT token | Array of user objects (`id`, `username`, `role`), excluding passwords | 401 unauthenticated, 403 non-admin | `routes/accountRoutes.js:21` |
| 5 | Admin & RBAC | Create User (`POST /api/admin/users`) | Administrator creates user with explicit role (`admin` or `user`) | `username`, `password`, `role` | Created user object, 201 Created | 400 validation error, 409 duplicate user, 403 non-admin | `routes/accountRoutes.js:29` |
| 6 | Admin & RBAC | Reset Password (`PUT /api/admin/users/:id/password`) | Administrator resets user password | `id` (param), `password` (body) | Success message | 400 missing password, 404 user not found, 403 non-admin | `routes/accountRoutes.js:57` |
| 7 | Admin & RBAC | Delete User (`DELETE /api/admin/users/:id`) | Administrator removes a user account | `id` (param) | Success message | 404 user not found, 403 non-admin | `routes/accountRoutes.js:75` |
| 8 | Asset Inventory | Asset Registration (`POST /api/assets`) | Register single asset with auto-tag generation and dynamic field storage | 18 standard fields + `kva`, `warranty_expiry`, `remark` | `{ id, asset_tag, message }`, 201 Created | 400 if missing name/serial, 500/409 duplicate serial | `routes/assetRoutes.js:160` |
| 9 | Asset Inventory | Auto Asset Tag Generation | Generate formatted tag: `VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}` | `assigned_dept`, `name` (asset type) | Next 2-digit zero-padded sequence string | Falls back to `GEN` and `IT` if dept/type empty | `routes/assetRoutes.js:16` |
| 10 | Asset Inventory | Dynamic Field Visibility | Show/hide hardware-specific inputs based on asset category | Asset type selection (Laptop, PC, AIO, UPS) | DOM toggling: Charger for Laptop, Monitor/Keyboard/Mouse for PC/AIO, KVA for UPS | Fallback to standard inputs | `Public/js/app.js:220` |
| 11 | Asset Inventory | Dual-Holder Tracking | Track system holder (`current_user`) vs physical holder (`contractual_user_name`) | `current_user`, `contractual_user_name` | Stored distinctly in DB columns and CSV export | Default `current_user` = 'IT Store' | `config/db.js:95-96` |
| 12 | Asset Inventory | List Assets with Pagination & Filter | Search by name, serial, holder, dept, IP, hostname with pagination | `search`, `type`, `dept`, `page`, `limit` (default 50) | Array of enriched asset objects with employee joins | Empty array if no matches | `routes/assetRoutes.js:34` |
| 13 | Asset Inventory | Type Selector Grid | Visual grid filtering inventory by hardware type (PC, AIO, Laptop, Printer, UPS, Scanner) | Card click event | Filters inventory view to specific category | Renders empty table if no assets match | `Public/index.html:352` |
| 14 | Asset Inventory | Department Selector Grid | Grid displaying asset count per airport unit, filtering on click | Department card click event | Filters inventory view to selected department | Renders empty table if unit has 0 assets | `Public/index.html:436` |
| 15 | Asset Inventory | Asset Update (`PUT /api/assets/:id`) | Update asset metadata, specifications, and holder | `id` (param), asset fields (body) | Success message, updated count | 400 validation error, 404 asset not found | `routes/assetRoutes.js:191` |
| 16 | Asset Inventory | Asset Deletion (`DELETE /api/assets/:id`) | Hard delete asset from database | `id` (param) | Success message, deleted count | 404 asset not found | `routes/assetRoutes.js:213` |
| 17 | Asset Inventory | Asset Status Lifecycle | Lifecycle transitions: In Stock, Assigned, Faulty, Scrap | Status string | Stored in `assets.status` | Currently hardcoded to In Stock/Assigned based on holder | `ORIGINAL_REQUEST.md:R1` |
| 18 | Multi-Asset Wizard | 5-Step Unified Entry Wizard | 5-step interactive wizard bundling multiple hardware items to one employee | Step 1: Employee, Step 2: Types, Step 3: Serials, Step 4: Network, Step 5: Save | Atomic creation of assets, employee, and transaction | 400 if validation fails, 409 duplicate serials | `routes/assetRoutes.js:222` |
| 19 | Multi-Asset Wizard | Atomic SQL Transaction Integrity | Execute entire multi-asset registration batch in single SQL transaction | Batch assets payload | Commit on success; 100% rollback on any error | 409 Conflict if duplicate serial; Rollback with 0 side effects | `routes/assetRoutes.js:250` |
| 20 | Handover / Takeover | Handover Workflow | Issue hardware items to employee with IP and Hostname assignment | `asset_ids`, `employee_name`, `new_ip_address`, `new_hostname`, `ref_no`, `date` | Transaction record created, assets updated to 'Assigned' | 400 if validation fails, missing required fields | `routes/transactionRoutes.js:98` |
| 21 | Handover / Takeover | Takeover Workflow | Receive items back to IT Store, clearing employee and network bindings | `asset_ids`, `employee_name`, `ref_no`, `date` | Transaction record created, assets reset to 'In Stock', network cleared | 400 if validation fails | `routes/transactionRoutes.js:98` |
| 22 | Handover / Takeover | Auto Voucher Reference Number | Auto-generate official reference code `AAI/VABO/IT/{TYPE}/{YEAR}/{RAND}` | `type`, current year | Reference string | Prefixes `AAI/VABO/IT/2026/` if custom not supplied | `AAI_VABO_IT_Asset_Manager_Specification.pdf:p.1` |
| 23 | Handover / Takeover | Printable Slip Generation | Open printable A4 landscape receipt formatted for A4 printing and PDF | Transaction data and selected items | Formatted HTML document with title, ref, tables, notes, signatures | Popup blocker warning if window blocked | `Public/js/ui.js:317` |
| 24 | Handover / Takeover | Handover Terms & Policy Notes | Include 8 mandatory airport IT security rules on handover receipts | Handover slip print trigger | Rendered HTML unordered list of 8 legal terms | Only displayed on Handover slips (not Takeover) | `Public/js/ui.js:329` |
| 25 | Handover / Takeover | Dual Signature Block | Render exact 'Handover by' and 'Takeover by' signature boxes | Employee and Issuer data | Printed 2-column signature table with Name, Desig, Dept, Signature line | Live values from transaction | `Public/js/ui.js:447` |
| 26 | Handover / Takeover | Reprint Watermark | Add translucent diagonal 'REPRINT' watermark on historical voucher reprints | Reprint action trigger | Watermark CSS and header tag `[REPRINT]` | Only shown when `session.action === 'Reprint'` | `Public/js/ui.js:371` |
| 27 | Print Security | Print Action Audit Logging | Record every print and reprint action with user and machine telemetry | `transaction_id`, `action_type`, `system_ip`, `system_hostname`, `ref_no`, `doc_type` | Inserted row in `print_logs` table, 201 Created | Ignored or logged with empty strings if client info omitted | `routes/transactionRoutes.js:275` |
| 28 | Print Security | Retrieve Print Audit Trail | Query history of all printed vouchers | Admin or authenticated request | Array of print log records with join to transactions | Empty array if no print logs | `routes/transactionRoutes.js:297` |
| 29 | Audit Logs | Transaction History Listing | List all movement transactions with employee joins and pagination | `page`, `limit`, `show_deleted` | Enriched transaction list with pagination metadata | Empty list if no records | `routes/transactionRoutes.js:17` |
| 30 | Audit Logs | Admin Audit Log Edit | Administrator edits transaction fields with change diff tracking | `id` (param), editable fields (body) | Success response, changes object | 400 no changes detected, 403 non-admin, 404 not found | `routes/transactionRoutes.js:169` |
| 31 | Audit Logs | JSON Change Diff Tracking | Compute old vs new values and append to `edit_history` JSON array | Modified fields vs DB values | Updated JSON array in `transactions.edit_history` | Preserves full historical audit chain | `routes/transactionRoutes.js:195` |
| 32 | Audit Logs | Soft Delete with Mandatory Reason | Mark audit log as deleted (`is_deleted = 1`) with reason and username | `id` (param), `reason` (body) | Success message, soft-deleted record | 403 if protected without override, 404 not found | `routes/transactionRoutes.js:60` |
| 33 | Audit Logs | Record Protection Flag | Prevent accidental deletion of critical audit vouchers (`is_protected = 1`) | `is_protected` DB flag, `override_protected` flag in body | Blocks delete unless explicit override provided | 403 'PROTECTED RECORD' error | `routes/transactionRoutes.js:69` |
| 34 | Bulk Operations | CSV Export with UTF-8 BOM | Export all assets with exact 18 headers and UTF-8 BOM (`\uFEFF`) | `GET /api/assets/export` or client `downloadCSV()` | CSV stream with `\uFEFF` and 18 quoted columns | Empty CSV with header if 0 assets | `routes/assetRoutes.js:123` |
| 35 | Bulk Operations | Bulk CSV Import with UPSERT | Import CSV file into database using `ON CONFLICT(serial_number) DO UPDATE` | Parsed CSV rows array | `{ imported: count, message }` | 400 if empty array or invalid structure | `routes/assetRoutes.js:321` |
| 36 | Bulk Operations | CSV Import Preview & Error Reporting | Validate CSV rows before database commit, displaying preview and error log | Uploaded `.csv` file in browser | Preview modal with Valid vs Invalid counters and error log | Rejects non-CSV files; shows downloadable error log | `Public/js/app.js:984` |
| 37 | Bulk Operations | Designation Fuzzy Cleaning & Mapping | Standardize non-standard staff designations (e.g., 'MANEGAR' -> 'MGR') | Raw designation string | Normalized designation string from `ALLOWED_DESIGNATIONS` | Retains uppercase original if no mapping matches | `Public/js/utils.js:140` |
| 38 | Bulk Operations | JSON Database Backup | Full client-side backup of assets and transactions | `backupData()` click event | Downloaded JSON file timestamped `Backup_YYYY-MM-DD.json` | None | `Public/js/app.js:937` |
| 39 | Employee Directory | Staff Directory Listing | List all active employees with designations and departments | `GET /api/employees` | Array of employee records sorted by name | Empty array if no employees | `routes/employeeRoutes.js:16` |
| 40 | Employee Directory | Add / Edit Employee | Create or update employee record with uniqueness constraint | `name`, `designation`, `department` | `{ id, message }` or `{ updated, message }` | 400 if name missing or duplicate name | `routes/employeeRoutes.js:24` |
| 41 | Employee Directory | Employee Soft Deletion | Inactivate employee (`status = 'Inactive'`) | `id` (param) | Success message | 404 employee not found | `routes/employeeRoutes.js:59` |
| 42 | Employee Directory | Lifetime Employee Asset Trail | Modal timeline showing all historical items assigned to an employee | Employee name click event | Modal with current assets and chronological history timeline | Empty state if employee has no transaction history | `Public/js/app.js:1300` |
| 43 | Employee Directory | Asset Trail Printable View | Generate printable view of an employee's historical asset trail | `printEmpTrail()` click event | Printable window formatted with employee details and history table | Popup blocker warning if blocked | `Public/js/ui.js:500` |
| 44 | Asset Trail | Individual Asset Trail Modal | Chronological lifecycle timeline modal for a single hardware asset | Asset row trail button click event | Modal timeline showing registration, handovers, takeovers | Empty state if no transactions for asset | `Public/js/app.js:1400` |
| 45 | Mutual Linking | Mutual Asset Linking | Pair PC Tower to Monitor or Printer to Laptop with reciprocal pointers | `parent_id`, `child_id` | Reciprocal `linked_asset_id` pointers updated in DB | 400 if already linked or invalid ID | `AAI_VABO_IT_Asset_Manager_Specification.pdf:p.1` |
| 46 | Mutual Linking | Mutual Asset Unlinking | Sever mutual asset pointer pairing with dedicated audit record | `asset_id` | Clears `linked_asset_id` on both parent and child | 400 if asset is not linked | `AAI_VABO_IT_Asset_Manager_Specification.pdf:p.1` |
| 47 | UI & Analytics | Operations Dashboard Metrics | Live metric cards for Total Assets, In Store, Issued, Deployment Rate | Page load / refresh trigger | Numeric counters animated with easeOutCubic | Displays 0 if database is empty | `Public/js/app.js:400` |
| 48 | UI & Analytics | Asset Readiness & Department Bars | Visual progress track and department allocation distribution | Dashboard data load | CSS progress bars and department breakdown list | 'Loading...' or empty insight message | `Public/js/ui.js:50` |
| 49 | UI & Analytics | Category Distribution Donut Chart | CSS-rendered donut pie chart with interactive legends | Category counts from `/api/assets/stats` | Conic-gradient SVG/CSS donut chart with color-coded legend | Renders grey circle if total is 0 | `Public/js/ui.js:100` |
| 50 | UI & Analytics | Recent Activity Stream | Chronological stream of latest movements on dashboard | Recent transactions from DB | List of activity cards with asset name, person, and relative time | 'No recent activity' if 0 transactions | `Public/js/ui.js:80` |
| 51 | UI & Accessibility | 8 Standard UI States | Complete visual feedback for Default, Hover, Active, Loading, Empty, Error, Success, Disabled | User interaction and API lifecycle | CSS state rules, spinner overlay, empty banners, toasts | Clearly distinguishable color tokens | `ORIGINAL_REQUEST.md:R2` |
| 52 | UI & Accessibility | Keyboard Navigation | Tab focus ordering, Enter/Space action execution, Escape dismissal | Keyboard key events | Focus outline, action execution, modal/drawer dismissal | Prevents tab trapping inside hidden elements | `ORIGINAL_REQUEST.md:R2` |
| 53 | UI & Accessibility | Responsive Breakpoints | Dynamic layout reflows across Desktop (1280px+), Tablet (768-1024px), Mobile (<640px) | Viewport resize | Full sidebar vs drawer overlay, table scroll wrappers, single column | No horizontal overflow or layout breakage | `ORIGINAL_REQUEST.md:R2` |
| 54 | UI & Accessibility | Theme & Font Customization | Toggle between Light Mode and Glassmorphic Dark Mode, font scaling (A-, A, A+) | Theme button, font scaling buttons | `localStorage` persistence, CSS custom property recalculation | Remembers preference across browser reloads | `Public/js/app.js:70` |
| 55 | Barcode & Tools | Barcode / QR Code Scanner | Integrated camera barcode/QR code reader using `html5-qrcode` | Video camera feed / scanner trigger | Scanned text populated into serial/asset tag search | Camera permission denial error message | `AAI_VABO_IT_Asset_Manager_Specification.pdf:p.2` |
| 56 | Diagnostics | Health & Info Endpoints | Server status, uptime, node version, memory diagnostics | `GET /api/health`, `GET /api/info` | JSON diagnostics payload | 500 if server unhealthy | `server.js:72,82` |

---

### 4.2 Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | User Registration | Duplicate username registration | Code in `authRoutes.js:21` searches for `'duplicate key'`, failing to match SQLite's `'UNIQUE constraint failed'`, returning 500 error instead of 409 Conflict. |
| 2 | Single Asset Registration | Missing required `name` or `serial_number` | Middleware returns 400 Bad Request: `{"error":"Name and Serial Number are required"}`. |
| 3 | Single Asset Registration | Asset with already existing `serial_number` | SQLite throws `SQLITE_CONSTRAINT: UNIQUE constraint failed: assets.serial_number`, caught by global error handler. |
| 4 | Asset Tag Auto-Generation | Empty department and empty asset type | Defaults `dept` to `'GEN'` and `type` to `'IT'`, generating tag `VABO-IT/CNS-GEN-IT-01`. |
| 5 | Asset Tag Auto-Generation | Existing tags `VABO-IT/CNS-ATC-PC-01` through `09` | Next tag properly generated with 2-digit zero-padding: `VABO-IT/CNS-ATC-PC-10`. |
| 6 | Single Asset Status Calculation | Current holder input as `"  IT Store  "` | Case-insensitive trim matches `'it store'`, status automatically set to `'In Stock'`. |
| 7 | Single Asset Status Calculation | Current holder input as `"Rajesh Kumar"` | Does not match `'it store'`, status automatically set to `'Assigned'`. |
| 8 | Single Asset Status Calculation | Setting status explicitly to `'Faulty'` or `'Scrap'` | Current backend logic ignores passed `status` and recomputes based on holder, overwriting `'Faulty'` back to `'In Stock'` or `'Assigned'`. |
| 9 | Multi-Asset Wizard | Duplicate serial numbers entered in Step 3 of wizard | Wizard detects duplicate serials within the array before database query and aborts with 400: `"Duplicate serial numbers found in the wizard input"`. |
| 10 | Multi-Asset Wizard | Serial number in wizard payload already exists in DB | Backend executes `SELECT serial_number FROM assets WHERE serial_number IN (...)`, detects collision, and returns 409: `"Serial number(s) already exist: [SERIAL]"`. |
| 11 | Multi-Asset Wizard | Mid-batch SQL insert failure | Transaction block `BEGIN TRANSACTION` triggers `ROLLBACK`, guaranteeing 0 orphaned assets and 0 transaction logs. |
| 12 | Handover Workflow | Submitting handover with 0 assets selected | Validation rejects request with 400: `"At least one asset must be selected"`. |
| 13 | Handover Workflow | Invalid IPv4 string entered (`"192.168.1.999"`) | Frontend `isValidIPv4()` check triggers warning toast: `"Please enter a valid IP address"`, blocking submission. |
| 14 | Handover Workflow | Multiple assets selected across different departments | Handover updates all selected assets to receiver's department, designation, and new IP/hostname in single operation. |
| 15 | Takeover Workflow | Taking over previously assigned asset | Clears `ip_address`, `hostname`, `assigned_dept`, `assigned_desig`, sets `current_user = 'IT Store'`, and resets `status = 'In Stock'`. |
| 16 | Printable Slip | Printable receipt popup blocked by browser | `window.open` returns `null`; frontend catches this and displays error toast: `"Popup blocked! Please allow popups for this site."`. |
| 17 | Printable Slip | Long asset list (>15 assets) printed | CSS `@page { size: A4 landscape; }` and table borders paginate cleanly across A4 pages without clipping signature block. |
| 18 | Printable Slip Reprint | Reprinting historical transaction voucher | Applies diagonal `REPRINT` watermark across document and prepends `[REPRINT]` to document title. |
| 19 | CSV Export | Exporting assets with commas, quotes, and newlines in remarks | `q(val)` wraps fields in double quotes and escapes existing quotes as `""`, preserving RFC 4180 CSV syntax. |
| 20 | CSV Export | Opening exported CSV in Windows Excel | First 3 bytes are UTF-8 BOM `\uFEFF`, preventing Excel from corrupting ASCII/Unicode characters and column alignment. |
| 21 | CSV Bulk Import | Import file without `.csv` extension | Frontend validates extension; displays error toast: `"Please upload a valid CSV file"`. |
| 22 | CSV Bulk Import | CSV with mismatched or non-standard designation (`"MANEGAR"`) | `cleanDesignation()` maps `"MANEGAR"` to `"MGR"` before validation check. |
| 23 | CSV Bulk Import | CSV with invalid year (`"1998"` or `"2045"`) | `validateAssetRecord()` flags line as invalid: `"Invalid Year: 1998 (Must be 2000-2026)"` and records in failed log. |
| 24 | CSV Bulk Import | CSV contains existing serial number | `ON CONFLICT(serial_number) DO UPDATE` updates asset in place rather than throwing unique constraint error. |
| 25 | Admin Audit Edit | Submitting audit record update with 0 changed fields | Backend detects empty diff and returns 400: `{"error":"No changes detected"}`. |
| 26 | Admin Audit Edit | Modifying `employee_name` from `"John"` to `"John Doe"` | Backend appends `{ edited_by: "admin", edited_at: ISO, changes: { employee_name: { old: "John", new: "John Doe" } } }` to `edit_history`. |
| 27 | Audit Log Deletion | Deleting record with `is_protected = 1` without override flag | Soft-delete route rejects with 403: `{"error":"PROTECTED RECORD","message":"This record is marked as protected..."}`. |
| 28 | Audit Log Deletion | Non-admin user attempts `DELETE /api/transactions/:id` | `requireAdmin` middleware checks `req.user?.role !== 'admin'` and rejects with 403 Forbidden. |
| 29 | Account Management | Regular user calls `GET /api/admin/users` | Middleware checks user role in DB and rejects with 403: `{"error":"Administrator access required"}`. |
| 30 | Keyboard Navigation | Pressing `Escape` key while modal dialog is open | Currently only closes the mobile navigation sidebar drawer; modal remains open (identified accessibility gap). |

---

### 4.3 Current Test Infrastructure Audit & Gaps

#### Current Status
- **Test Runner:** Node.js native test runner (`node --test`).
- **Test Scripts in `package.json`:**
  - `"test": "node --test tests/smoke.test.js"`
- **Existing Test Files:** Only 1 file: `tests/smoke.test.js` (136 lines).
- **Execution Benchmark:**
  - Runs in ~1050ms.
  - Passes with 1 test suite, 0 failures.
  - Spawns isolated Express server on random port (`freePort()`) with a temporary SQLite database in `os.tmpdir()`.
  - Verifies health check, static assets, 401 unauthenticated, 404 missing routes, admin login, token validation, 18 CSV headers, user creation/password reset/deletion, and RBAC 403 enforcement.

#### Gaps & Deficiencies
1. **No Test Discoverability:** Running `npm test` only targets `tests/smoke.test.js`. If other test files are added, `npm test` does not execute them unless changed to `node --test tests/*.test.js` or `tests/**/*.test.js`.
2. **Missing Unit Tests:**
   - No isolated tests for `utils.js` (`cleanDesignation`, `parseCSV`, `isValidIPv4`, `validateAssetRecord`).
   - No isolated tests for `routes/assetRoutes.js` helper `generateAssetTag`.
3. **Missing Integration Tests:**
   - Single asset CRUD lifecycle (create, read, update, delete, duplicate serial collision).
   - Handover and Takeover transactions and status transitions.
   - Unified Multi-Asset Wizard atomic rollback.
   - Bulk CSV Import UPSERT logic.
   - Audit log edit diff tracking and soft-deletion with protection flags.
   - Print security audit log insertion and retrieval.
4. **No Automated Browser E2E Tests:**
   - No Playwright, Puppeteer, or Cypress packages installed.
   - No automated verification of browser DOM interactions, modal workflows, keyboard shortcuts, or printable voucher popups.

---

### 4.4 4-Tier E2E Testing Architecture Design

To ensure 100% verification coverage across the entire system, the testing architecture is structured into four progressive tiers:

```
┌────────────────────────────────────────────────────────┐
│     Tier 4: Enterprise Real-World Application Scenarios│ (5 Scenarios)
├────────────────────────────────────────────────────────┤
│     Tier 3: Pairwise Cross-Feature Combinations        │ (12 Combinations)
├────────────────────────────────────────────────────────┤
│     Tier 2: Boundary, Edge & Corner Cases              │ (>=5 per feature = 80+ Tests)
├────────────────────────────────────────────────────────┤
│     Tier 1: Comprehensive Feature Functional Coverage  │ (>=5 per feature = 80+ Tests)
└────────────────────────────────────────────────────────┘
```

#### Tier 1: Functional Feature Coverage (>=5 test cases per feature)
*Each feature group contains at least 5 isolated functional tests validating standard user paths:*

1. **Authentication & Session (5 tests):**
   - T1.1: Admin login with valid credentials yields JWT token and user profile.
   - T1.2: Regular user login with valid credentials yields JWT token.
   - T1.3: User registration creates user, hashes password, and returns valid JWT.
   - T1.4: `GET /api/auth/me` with Bearer token returns decoded user context.
   - T1.5: Unauthenticated request to protected route returns 401 Unauthorized.
2. **Account Manager & RBAC (5 tests):**
   - T1.6: Admin can list all registered users (excluding password hashes).
   - T1.7: Admin can create new user with role 'admin' or 'user'.
   - T1.8: Admin can update password for another user.
   - T1.9: Admin can delete user account.
   - T1.10: Regular user receives 403 Forbidden on all `/api/admin/*` endpoints.
3. **Single Asset Registration & Tagging (5 tests):**
   - T1.11: Register asset with auto-generated tag `VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}`.
   - T1.12: Register asset with explicit custom asset tag.
   - T1.13: Register laptop with charger serial and verify fields stored.
   - T1.14: Register PC tower with monitor make, monitor serial, keyboard, and mouse make.
   - T1.15: Register UPS with KVA rating.
4. **Asset Inventory Listing & Data Controls (5 tests):**
   - T1.16: List assets with default pagination (limit 50, page 1).
   - T1.17: Search assets by serial number keyword.
   - T1.18: Search assets by employee holder name.
   - T1.19: Filter assets by hardware category type ('Laptop', 'PC', 'Printer').
   - T1.20: Filter assets by department ('IT / CNS', 'ATC', 'Airport Director').
5. **Single Asset Update & Deletion (5 tests):**
   - T1.21: Update asset make, model, and year of purchase.
   - T1.22: Update asset holder and verify automatic status update to 'Assigned'.
   - T1.23: Update asset holder to 'IT Store' and verify status resets to 'In Stock'.
   - T1.24: Delete asset by ID and verify removal from database.
   - T1.25: Attempt to delete non-existent asset ID returns 404 Not Found.
6. **Unified Multi-Asset Entry Wizard (5 tests):**
   - T1.26: Execute wizard with 1 asset assigned to existing employee.
   - T1.27: Execute wizard bundling 3 different asset types (PC, Monitor, UPS).
   - T1.28: Execute wizard for new employee (verifies employee auto-creation in `employees` table).
   - T1.29: Verify shared network context (IP and Hostname) populated across all bundled assets.
   - T1.30: Verify handover transaction automatically generated with reference number.
7. **Handover Workflow (5 tests):**
   - T1.31: Issue 1 asset to staff member; status becomes 'Assigned'.
   - T1.32: Issue multiple assets to staff member in single handover transaction.
   - T1.33: Verify `ip_address` and `hostname` assigned to hardware during handover.
   - T1.34: Verify audit record inserted into `transactions` table with `type = 'handover'`.
   - T1.35: Verify `employee_id` and `issuer_id` foreign keys resolved correctly.
8. **Takeover Workflow (5 tests):**
   - T1.36: Receive 1 asset back into store; status resets to 'In Stock'.
   - T1.37: Receive multiple assets back in single takeover transaction.
   - T1.38: Verify `ip_address` and `hostname` are wiped clean upon takeover.
   - T1.39: Verify `current_user` set to 'IT Store' and `employee_id` set to NULL.
   - T1.40: Verify audit record inserted into `transactions` table with `type = 'takeover'`.
9. **Printable Receipt / Slips (5 tests):**
   - T1.41: Handover slip formats A4 landscape layout with title and ref code.
   - T1.42: Handover slip renders 8 mandatory airport IT policy terms and conditions.
   - T1.43: Takeover slip renders hardware list without handover-only terms.
   - T1.44: Dual signature block renders 'Handover by' and 'Takeover by' with live data.
   - T1.45: Historical reprint renders diagonal `REPRINT` watermark.
10. **Mutual Asset Linking & Unlinking (5 tests):**
    - T1.46: Establish mutual link between PC tower (parent) and Monitor (child).
    - T1.47: Verify reciprocal pointer sync (`parent.linked_asset_id = child.id` and `child.linked_asset_id = parent.id`).
    - T1.48: Sever mutual link and verify both pointers reset to NULL.
    - T1.49: Linking an asset logs dedicated transaction record (`type = 'link'`).
    - T1.50: Unlinking an asset logs dedicated transaction record (`type = 'unlink'`).
11. **Audit Logs & Revision Tracking (5 tests):**
    - T1.51: List all historical transactions with pagination.
    - T1.52: Filter audit logs by transaction type ('handover', 'takeover').
    - T1.53: Admin edits audit record fields; changes diff saved to `edit_history` JSON.
    - T1.54: Admin soft-deletes audit record with reason (`is_deleted = 1`).
    - T1.55: Standard query filters out soft-deleted records unless `show_deleted=1`.
12. **Bulk CSV Export (5 tests):**
    - T1.56: `GET /api/assets/export` returns HTTP 200 with `Content-Type: text/csv; charset=utf-8`.
    - T1.57: Export output starts with UTF-8 BOM (`\uFEFF`).
    - T1.58: Header row contains exactly the 18 specified column names in sequence.
    - T1.59: All assets exported match database record count.
    - T1.60: Exported CSV fields containing commas or quotes are properly escaped.
13. **Bulk CSV Import (5 tests):**
    - T1.61: Import valid CSV with 18 standard fields creates new asset records.
    - T1.62: Import CSV with existing serial number executes UPSERT without crashing.
    - T1.63: Import parser automatically normalizes dirty designations ('MANEGAR' -> 'MGR').
    - T1.64: Import preview table accurately computes valid vs invalid row counts.
    - T1.65: Round-trip: Exported CSV can be re-imported with 100% data fidelity.
14. **Employee Directory (5 tests):**
    - T1.66: List all active employees.
    - T1.67: Create new employee with name, designation, department.
    - T1.68: Update employee designation and department.
    - T1.69: Inactivate employee (`status = 'Inactive'`).
    - T1.70: Retrieve employee asset trail (`/api/transactions/employee/:name`).
15. **Print Security Audit Logs (5 tests):**
    - T1.71: Log print action on voucher print (`POST /api/transactions/print-logs`).
    - T1.72: Log reprint action on historical voucher reprint.
    - T1.73: Stored print log contains username, client IP, hostname, and document type.
    - T1.74: Query print logs (`GET /api/transactions/print-logs`) returns ordered history.
    - T1.75: Print logs associated with soft-deleted transactions are handled appropriately.
16. **UI States, Themes & Diagnostics (5 tests):**
    - T1.76: `/api/health` returns status 'ok', uptime, and environment.
    - T1.77: `/api/info` returns version '2.0.0' and node version.
    - T1.78: Theme switch updates body class to `.light-mode` and stores in `localStorage`.
    - T1.79: Font scaling buttons update font scale multiplier CSS property.
    - T1.80: Empty search results render designated empty state banner without broken UI.

#### Tier 2: Boundary, Edge & Corner Cases (>=5 test cases per feature)
*Validates defensive programming, failure modes, error codes, and extreme inputs:*

1. **Authentication Boundaries (5 tests):**
   - T2.1: Login with empty username or empty password returns 400.
   - T2.2: Register with username < 3 chars or password < 4 chars returns 400.
   - T2.3: Register with special characters in username (`user@name#`) returns 400.
   - T2.4: Attempt login with SQL injection payload (`' OR '1'='1`) returns 401.
   - T2.5: Request with expired or tampered JWT Bearer token returns 403.
2. **Account Manager Boundaries (5 tests):**
   - T2.6: Create user with invalid role (`role: 'superadmin'`) returns 400.
   - T2.7: Create user with already existing username returns 409 Conflict.
   - T2.8: Reset password with empty string returns 400.
   - T2.9: Reset password for non-existent user ID returns 404.
   - T2.10: Regular user attempting to delete admin account returns 403.
3. **Asset Registration Boundaries (5 tests):**
   - T2.11: Register asset with 255-character serial number succeeds cleanly.
   - T2.12: Register asset with serial number containing spaces trims whitespace.
   - T2.13: Duplicate serial number registration with different casing (`ABC12` vs `abc12`) handled consistently.
   - T2.14: Purchase year < 2000 or > current year triggers validation rejection.
   - T2.15: Asset name containing HTML tags (`<script>alert(1)</script>`) is sanitized/escaped.
4. **Inventory Search & Pagination Boundaries (5 tests):**
   - T2.16: Search with SQL wildcards (`%`, `_`) treats characters as literal strings.
   - T2.17: Pagination with `page=0` or negative page number handled gracefully (defaults to page 1).
   - T2.18: Pagination beyond total records returns empty array with correct total count.
   - T2.19: Limit set to 0 or negative defaults to standard limit (50).
   - T2.20: Filter by non-existent category type returns empty array.
5. **Asset Update & Deletion Boundaries (5 tests):**
   - T2.21: Updating asset serial number to match an existing asset's serial returns 409/error.
   - T2.22: Update asset with empty name or empty serial returns 400.
   - T2.23: Deleting an asset with active linked child clears reciprocal link or prevents orphan pointers.
   - T2.24: Concurrent update requests on the same asset ID resolve safely.
   - T2.25: Attempting deletion on protected record blocks destructive action.
6. **Multi-Asset Wizard Boundaries (5 tests):**
   - T2.26: Wizard payload with empty `assets` array returns 400.
   - T2.27: Wizard payload with 20 items successfully inserts all 20 in single transaction.
   - T2.28: Wizard with duplicate serials in payload returns 400 without DB insertion.
   - T2.29: Wizard where 1st asset is unique but 2nd asset exists in DB returns 409; 1st asset is rolled back.
   - T2.30: Wizard with invalid IP format rejects before transaction commit.
7. **Handover Boundaries (5 tests):**
   - T2.31: Handover with non-existent asset ID returns 400 or ignores invalid ID.
   - T2.32: Handover asset already marked 'Assigned' reassigned to new employee with updated audit log.
   - T2.33: Handover with IPv4 boundary addresses (`0.0.0.0`, `255.255.255.255`) accepted.
   - T2.34: Handover with IPv4 octet > 255 (`192.168.1.300`) rejected by validator.
   - T2.35: Handover with empty hostname returns warning and blocks handover.
8. **Takeover Boundaries (5 tests):**
   - T2.36: Takeover of asset already 'In Stock' updates transaction log and keeps status 'In Stock'.
   - T2.37: Takeover of multiple assets where some have contractual holders clears both holders.
   - T2.38: Takeover without issuer name returns validation error.
   - T2.39: Takeover with 50 assets in one transaction executes cleanly.
   - T2.40: Takeover of parent asset in mutual pair handles child link safely.
9. **Print Slip Boundaries (5 tests):**
   - T2.41: Slip generated for single asset with no monitor/charger renders dashes (`-`).
   - T2.42: Slip generated for 30 assets renders paginated table without broken markup.
   - T2.43: Long employee name (80+ characters) wraps without breaking 2-column signature table.
   - T2.44: Special characters in remarks (`&`, `<`, `>`, `"`, `'`) escaped to prevent XSS in print document.
   - T2.45: Reprinting slip when original issuer has left organization retains original issuer snapshot.
10. **Mutual Linking Boundaries (5 tests):**
    - T2.46: Linking asset to itself (`asset_id === linked_asset_id`) rejected with 400.
    - T2.47: Linking already linked asset automatically breaks old link before creating new link.
    - T2.48: Linking to non-existent asset ID returns 404.
    - T2.49: Unlinking an unlinked asset returns benign 200 or 400 without crashing.
    - T2.50: Linking asset in 'Scrap' or 'Faulty' status is restricted or flagged.
11. **Audit Logs Boundaries (5 tests):**
    - T2.51: Admin edit submitting empty string for nullable fields updates them to empty/null.
    - T2.52: Admin edit modifying timestamp validates ISO 8601 date format.
    - T2.53: Soft-deleting protected record without `override_protected=true` returns 403.
    - T2.54: Soft-deleting protected record with `override_protected=true` succeeds.
    - T2.55: Soft-deleting without providing `reason` rejected or defaults to fallback reason.
12. **CSV Export Boundaries (5 tests):**
    - T2.56: Export when assets table is empty produces header-only CSV with BOM.
    - T2.57: Export asset with empty string fields outputs consecutive commas (`,"",`).
    - T2.58: Export asset with Unicode/multilingual text (Gujarati/Hindi names) preserved via UTF-8.
    - T2.59: Export asset with multiline remark containing embedded newlines enclosed in quotes.
    - T2.60: Export 5,000+ assets streams without memory exhaustion.
13. **CSV Import Boundaries (5 tests):**
    - T2.61: Import file with 0 byte size returns 400: `"No valid data found in CSV"`.
    - T2.62: Import CSV with missing mandatory header (`Serial_No`) flags rows as invalid.
    - T2.63: Import CSV with non-standard column order correctly matches columns by name.
    - T2.64: Import CSV with 1,000 rows executes batch UPSERT in reasonable time (<3s).
    - T2.65: Import CSV with unknown designation retains original without rejecting row.
14. **Employee Directory Boundaries (5 tests):**
    - T2.66: Create employee with duplicate name returns 400: `"Employee with this name already exists"`.
    - T2.67: Create employee with leading/trailing whitespace trims name before insertion.
    - T2.68: Soft-delete employee currently assigned assets allows query of historical trail.
    - T2.69: Update employee name propagates or preserves integrity with linked assets.
    - T2.70: Employee trail search with special regex characters (`.*+?^$`) performs literal match.
15. **Print Logs Boundaries (5 tests):**
    - T2.71: Insert print log with IPv6 address stored and queried without truncation.
    - T2.72: Insert print log with NULL transaction ID (ad-hoc document print) succeeds.
    - T2.73: Retrieve print logs limit (500) pagination verified.
    - T2.74: Rapid consecutive print log entries from same client recorded in correct order.
    - T2.75: Print log ref_no exceeding 100 characters stored safely.
16. **UI & Accessibility Boundaries (5 tests):**
    - T2.76: Viewport resize to 320px width: navigation drawer accessible, table scrolls horizontally.
    - T2.77: Viewport resize to 4K (3840px): content centered, glass cards scale cleanly.
    - T2.78: Pressing Escape with open modal closes modal and returns focus to trigger element.
    - T2.79: Rapid theme toggling (10 clicks) maintains state consistency in `localStorage`.
    - T2.80: Keyboard Tab navigation cycles through all modal interactive inputs without escaping into background.

#### Tier 3: Pairwise Cross-Feature Combinations (12 Integration Scenarios)
*Validates feature interactions and data invariant preservation across subsystems:*

1. **P1: Handover -> Inventory Search & Dashboard Metrics:**
   - Handover asset to "Kavita Patel" in "CNS".
   - Invariant: Asset status becomes 'Assigned', disappears from 'In Stock' filter, appears in 'Assigned' and 'CNS' filters; dashboard counter increments 'Issued' and decrements 'In Store'.
2. **P2: Takeover -> Network Cleanup & CSV Export:**
   - Asset with IP `172.29.85.50` and hostname `VABO-ATC-01` taken over into IT Store.
   - Invariant: Network bindings cleared; CSV export shows `IP=""`, `Hostname=""`, `Holder="IT Store"`, `status="In Stock"`.
3. **P3: Multi-Asset Wizard -> Employee Directory Sync -> Asset Trail:**
   - Wizard registers 3 items to new employee "Vikram Singh".
   - Invariant: "Vikram Singh" added to `employees` directory; employee trail modal shows 3 assets currently assigned and 1 initial handover transaction.
4. **P4: CSV Export -> Modify -> CSV Bulk Import UPSERT:**
   - Export 18-column CSV; edit 5 assets (update department and designation); add 2 new assets.
   - Invariant: Re-import updates 5 existing assets in place without duplicate error, inserts 2 new assets, and total count increments by exactly 2.
5. **P5: Mutual Asset Linking -> Handover of Parent:**
   - Link PC Tower to Monitor. Handover PC Tower to staff member.
   - Invariant: Child monitor reflects association; audit trail logs parent movement while preserving mutual link pointer.
6. **P6: Asset Status Transition to Faulty/Scrap -> Handover Exclusion:**
   - Transition asset to 'Faulty' or 'Scrap'.
   - Invariant: Asset excluded from selectable handover inventory list; attempting direct API handover returns validation error.
7. **P7: Handover -> Print Slip -> Historical Reprint -> Print Security Audit Log:**
   - Submit handover with 'Print' method. Print log recorded.
   - Open History, trigger Reprint on voucher.
   - Invariant: Watermark `REPRINT` rendered; 2 distinct records present in `print_logs` table (one 'Print', one 'Reprint').
8. **P8: Admin Audit Record Revision -> Diff History -> Audit Log View:**
   - Admin edits employee designation in audit log.
   - Invariant: `edit_history` JSON contains diff object with old/new values, editor username, and ISO date; audit history list displays revision badge.
9. **P9: Soft-Delete Audit Record -> Filter Isolation -> Admin Visibility:**
   - Admin soft-deletes transaction with reason "Duplicate entry".
   - Invariant: Hidden from default audit logs table (`show_deleted=0`); visible when `show_deleted=1` with strike-through and deletion reason.
10. **P10: RBAC User Deletion -> Active Session Revocation:**
    - Admin deletes operator user account in Account Manager while operator is logged in.
    - Invariant: Subsequent authenticated requests by operator fail with 401/403 because user record no longer exists in database.
11. **P11: Employee Inactivation -> Assignment Safeguard:**
    - Inactivate employee in Employee Directory.
    - Invariant: Inactive employee excluded from Handover autocomplete suggestions; attempting handover to inactive employee is rejected.
12. **P12: Barcode / QR Scanner -> Quick Registration & Lookup:**
    - Scan barcode input into search field.
    - Invariant: Automatically locates asset by serial number or asset tag and opens asset detail/edit modal.

#### Tier 4: Real-World Application Scenarios (5 Comprehensive Workflows)
*End-to-end simulations of actual enterprise operations at Vadodara Airport:*

1. **Scenario S1: New Terminal Staff Onboarding & IT Hardware Bundle Provisioning**
   - Step 1: Admin logs into application using credentials (`admin` / `admin123`).
   - Step 2: Opens Employee Directory, registers new employee "Arun Joshi" (Designation: "Assistant Manager", Department: "CNS").
   - Step 3: Launches Multi-Asset Entry Wizard. Selects "Arun Joshi" (auto-completes designation and dept).
   - Step 4: Bundles 4 items: Desktop PC, Monitor, Keyboard, and Mouse.
   - Step 5: Enters serial numbers and specifications. Sets network context (`172.29.85.110`, `VABO-CNS-AM01`).
   - Step 6: Submits wizard: 4 assets created with sequential tags, 1 atomic handover voucher generated, employee profile linked.
   - Step 7: Verifies dashboard counters updated (Total +4, Issued +4, Utilization recalculated).
   - Step 8: Generates and prints official handover voucher. Print audit log verified.

2. **Scenario S2: Airport Department Relocation & Equipment Return (Takeover Flow)**
   - Step 1: Airport security personnel rotating out of Terminal 2 return hardware.
   - Step 2: IT Store officer opens Takeover interface, filters by employee name.
   - Step 3: Selects 2 Laptops, 1 Barcode Scanner, and 1 Laser Printer.
   - Step 4: Enters return date and condition remarks ("All items inspected; normal wear").
   - Step 5: Submits takeover: assets returned to store (`status = 'In Stock'`, `current_user = 'IT Store'`).
   - Step 6: Network IP and hostname wiped clean from all 4 assets.
   - Step 7: Official takeover receipt generated and printed. Print log recorded with workstation IP.
   - Step 8: Verifies assets appear in Inventory Table ready for re-assignment.

3. **Scenario S3: Annual AAI IT Equipment Audit & Master Spreadsheet Reconciliation**
   - Step 1: Airport Internal Auditor clicks "Export CSV" on inventory view.
   - Step 2: Downloads `Inventory_YYYY-MM-DD.csv` containing all 18 standard columns and UTF-8 BOM.
   - Step 3: Auditor opens file in Microsoft Excel; verifies column sequence and data integrity.
   - Step 4: Auditor reconciles physical hardware, updates 20 asset departments, adds 5 newly purchased workstations.
   - Step 5: Uploads updated CSV through CSV Data Import modal.
   - Step 6: System parses CSV, auto-cleans designations, presents preview table (Total: 225, Valid: 225, Failed: 0).
   - Step 7: Confirms import: SQLite executes `ON CONFLICT(serial_number) DO UPDATE`, updating 20 assets and inserting 5 without errors.
   - Step 8: Verifies inventory reflects latest state.

4. **Scenario S4: Security Incident Forensics & Audit Trail Reconstruction**
   - Step 1: Network Security detects anomalous activity from IP `172.29.84.203`.
   - Step 2: IT Administrator opens Audit Logs, filters by search term `172.29.84.203`.
   - Step 3: Identifies exact handover transaction voucher `AAI/VABO/IT/HANDOVER/2026/XYZ` issued to specific staff member.
   - Step 4: Opens Print Audit Trail, traces who printed and reprinted the voucher, including client IP and timestamp.
   - Step 5: Opens Employee Trail modal for the staff member, reviewing complete lifetime hardware history.
   - Step 6: Exports complete trail report for airport security committee.
   - Step 7: Admin marks record with `is_protected = 1` to prevent accidental deletion during investigation.

5. **Scenario S5: Role-Based Access Control Audit & Administrator User Lifecycle**
   - Step 1: Unauthorized user attempts to access `/api/admin/users` or `/accounts.html` without token; system redirects/rejects with 401.
   - Step 2: User logs in with non-admin credentials; attempts administrative API operations; rejected with 403.
   - Step 3: System Administrator logs in and opens Account Manager.
   - Step 4: Creates a new operator account with role 'user' and temporary password.
   - Step 5: Verifies operator can sign in, view inventory, execute handovers, but cannot access user management.
   - Step 6: Administrator resets operator password. Operator logs in with new password.
   - Step 7: Administrator deletes operator account. Operator session immediately invalidated.

---

### 4.5 Playwright / Node Browser Automation Setup

For complete end-to-end browser verification, the following architecture is designed:

#### Architecture & Configuration
1. **Dependencies to Install (`devDependencies`):**
   ```json
   {
     "devDependencies": {
       "@playwright/test": "^1.47.0"
     }
   }
   ```
2. **Playwright Config (`playwright.config.js`):**
   - `testDir`: `./tests/e2e`
   - `baseURL`: `http://localhost:8001`
   - `webServer`:
     - Command: `node server.js`
     - Port: `8001`
     - ReuseExistingServer: `!process.env.CI`
     - Env: `NODE_ENV=test`, `DB_PATH=:memory:` or isolated temporary DB.
   - Browsers: Chromium (primary), Firefox, WebKit.
   - Artifacts: Screenshot on failure, video on retry, trace recording enabled.

#### Test Suites Implementation Plan
1. `tests/e2e/auth.spec.js`:
   - Login, logout, session persistence across page reload, redirect to login on 401.
2. `tests/e2e/inventory.spec.js`:
   - Single asset registration modal, dynamic field display (charger, monitor, KVA), asset creation, edit, deletion, search, category filtering.
3. `tests/e2e/wizard.spec.js`:
   - Multi-asset entry wizard step-by-step completion (Steps 1-5), employee autocomplete, asset assignment, transaction verification.
4. `tests/e2e/handover-takeover.spec.js`:
   - Asset selection, handover execution, print slip popup inspection, takeover execution, network IP/hostname cleanup verification.
5. `tests/e2e/csv-operations.spec.js`:
   - CSV export download event capture, verification of `\uFEFF` BOM and 18 headers, CSV upload via import modal, preview validation, import finalization.
6. `tests/e2e/accounts.spec.js`:
   - Account Manager navigation, user creation, password reset modal, user deletion, RBAC guard verification.
7. `tests/e2e/accessibility-responsive.spec.js`:
   - Keyboard Tab traversal, Enter/Space activation, Escape key modal dismissal, viewport resize to mobile (375px) and tablet (768px), theme toggle persistence.

---

### 4.6 Benchmarks & Recommendations for `TEST_INFRA.md` & `TEST_READY.md`

1. **Test Infrastructure Standard (`TEST_INFRA.md`):**
   - **Unified Test Command:** Update `package.json` `"test"` script from `node --test tests/smoke.test.js` to:
     ```json
     "scripts": {
       "test": "node --test tests/**/*.test.js",
       "test:smoke": "node --test tests/smoke.test.js",
       "test:unit": "node --test tests/unit/**/*.test.js",
       "test:integration": "node --test tests/integration/**/*.test.js",
       "test:e2e": "playwright test"
     }
     ```
   - **Zero-Dependency Native Tests:** Utilize Node's native `node:test` and `node:assert/strict` for Tiers 1-3 so they execute instantly without requiring heavyweight packages.
   - **Isolation Pattern:** Every test suite must instantiate its own isolated SQLite database (or in-memory database) and random port to ensure 100% test reproducibility with 0 side effects on `database.db`.

2. **Quality Gates & Benchmarks (`TEST_READY.md`):**
   - **Pass Rate:** 100% pass rate (0 failures, 0 skipped, 0 flaky tests) across all test runs.
   - **Execution Speed:**
     - Smoke test: <= 1.5 seconds.
     - Full Unit & Integration test suite: <= 10 seconds.
     - Browser E2E suite (Playwright): <= 30 seconds.
   - **Coverage Milestones:**
     - All 18 standard fields verified in both export and import.
     - All 4 asset lifecycle states (`In Stock`, `Assigned`, `Faulty`, `Scrap`) verified.
     - All 8 standard UI states verified.
     - Both Admin and Regular user RBAC paths verified.
     - Atomic rollback verified under simulated failure.

---

## 5. Verification Method

To independently verify the observations, specification mapping, and test status documented in this report:

1. **Verify Smoke Test Execution:**
   ```powershell
   npm test
   ```
   *Expected result:* 1 test suite passed in ~1 second, exit code 0.

2. **Verify Database Schema & Tables:**
   ```powershell
   node -e "const { db } = require('./config/db'); db.all('SELECT name FROM sqlite_master WHERE type=\'table\'', [], (e, r) => { console.log(r); db.close(); });"
   ```
   *Expected result:* Lists `users`, `employees`, `assets`, `transactions`, `print_logs`, `sqlite_sequence`.

3. **Verify 18 Standard Column Headers in CSV Export:**
   ```powershell
   node -e "fetch('http://localhost:8001/api/assets/export').then(r => r.text()).then(t => console.log(t.split('\n')[0]))"
   ```
   *Expected result:* `ID,Asset_Tag,Asset Type,Serial,Charger_Serial,Monitor_Make,Monitor_Serial,Keyboard_Make,Mouse_Make,Make,Model,IP,Hostname,Holder,Physical_Asset_Holder,Department,Designation,Year_of_Purchase`.

4. **Verify UTF-8 BOM (`\uFEFF`) Presence:**
   ```powershell
   node -e "fetch('http://localhost:8001/api/assets/export').then(r => r.arrayBuffer()).then(b => { const u = new Uint8Array(b); console.log(u[0]===0xEF && u[1]===0xBB && u[2]===0xBF ? 'UTF-8 BOM Verified' : 'No BOM'); })"
   ```
   *Expected result:* `'UTF-8 BOM Verified'`.

5. **Verify Specification Document OCR:**
   - Review `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\AAI_VABO_IT_Asset_Manager_Specification.pdf` pages 1-7 for complete feature list, schema definitions, and business logic rules.
