# Project: AAI VABO IT Asset Management System

## Architecture
- **Backend**: Node.js, Express (`server.js`), modular routes (`routes/authRoutes.js`, `routes/accountRoutes.js`, `routes/assetRoutes.js`, `routes/transactionRoutes.js`, `routes/employeeRoutes.js`), SQLite (`config/db.js`, `database.db`), JWT authentication & RBAC middleware (`middleware/auth.js`).
- **Frontend**: Vanilla ES6+ SPA (`Public/index.html`, `Public/accounts.html`, `Public/css/*.css`, `Public/js/*.js`), client-side state, printable vouchers (`@media print`), 18-field CSV import/export with UTF-8 BOM (`\uFEFF`).
- **Testing**: Node native test runner (`node --test`), Playwright/Node E2E browser automation, API integration suites, and 4-tier requirement verification.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | User Login & JWT | Authenticate credentials and return signed 24h JWT token | M1 | Survey |
| 2 | User Registration & Unique Constraint | Register user with bcrypt and handle SQLite UNIQUE constraint | M1 | Survey |
| 3 | Session Verification (`/api/auth/me`) | Validate active JWT Bearer token | M1 | Survey |
| 4 | Admin User Management (`/api/admin/users`) | List, create, reset password, delete users with RBAC guard | M1 | Survey |
| 5 | Admin Deletion Safeguards | Prevent deleting last active admin or self | M1 | Survey |
| 6 | User Password Self-Service | Allow authenticated user to update own password | M2 | Survey |
| 7 | Single Asset Registration | Register single asset with auto-tag generation | M2 | Survey |
| 8 | Auto Asset Tag Formula | `VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}` with zero-padding | M2 | Survey |
| 9 | Dynamic Field Visibility | Toggle charger, monitor, keyboard, mouse, KVA by asset type | M3 | Survey |
| 10 | Dual-Holder Tracking | Track system holder (`current_user`) and physical holder (`contractual_user_name`) | M1 | Survey |
| 11 | Asset Inventory Listing & Filters | Search, filter by type/dept/status, and paginate assets | M2 | Survey |
| 12 | Type & Dept Selector Grids | Visual card grids filtering inventory | M3 | Survey |
| 13 | Single Asset Editing | Update asset metadata and holder details | M2 | Survey |
| 14 | Asset Deletion Safeguard | Admin-only asset deletion with audit logging | M1 | Survey |
| 15 | Asset Lifecycle Status Engine | Manage `In Stock`, `Assigned`, `Faulty`, `Scrap` transitions | M2 | Survey |
| 16 | Multi-Asset Entry Wizard | 5-step wizard registering hardware bundle to one employee | M1 | Survey |
| 17 | Wizard Atomic SQL Transaction | Batch execution with 100% rollback on failure | M1 | Survey |
| 18 | Handover Workflow | Issue assets to employee, set IP/hostname, generate voucher | M1 | Survey |
| 19 | Takeover Workflow | Return assets to IT Store, wipe employee & network bindings | M1 | Survey |
| 20 | Handover/Takeover Atomic Transaction | Wrap multi-asset updates in SQLite transaction block | M1 | Survey |
| 21 | Physical Holder Handover Sync | Update `contractual_user_name` on handover/takeover | M1 | Survey |
| 22 | Voucher Reference Formula | Auto-generate `AAI/VABO/IT/{TYPE}/{YEAR}/{RAND}` reference | M2 | Survey |
| 23 | Printable Voucher Slips | Formatted A4 landscape printable receipts for handover/takeover | M3 | Survey |
| 24 | Handover Mandatory Terms | Render 8 airport IT security rules on handover slips | M3 | Survey |
| 25 | Dual Signature Blocks | Render 'Handover by' and 'Takeover by' signature boxes | M3 | Survey |
| 26 | Reprint Watermark & Tag | Diagonal `REPRINT` watermark on historical printouts | M3 | Survey |
| 27 | Print Action Telemetry Logging | Record print/reprint actions in `print_logs` table | M1 | Survey |
| 28 | Retrieve Print Audit Trail | Query historical print logs | M1 | Survey |
| 29 | Transaction Audit Listing | List movement history with employee joins and pagination | M2 | Survey |
| 30 | Admin Audit Log Edit & Diff | Edit transactions with JSON diff appended to `edit_history` | M1 | Survey |
| 31 | Soft Delete with Reason | Mark transactions deleted with required explanation | M1 | Survey |
| 32 | Audit Record Protection Flag | Prevent deleting protected transactions (`is_protected = 1`) | M1 | Survey |
| 33 | CSV Export 18 Standard Fields | Export all 18 fields with UTF-8 BOM (`\uFEFF`) header | M2 | Survey |
| 34 | Bulk CSV Import with UPSERT | `ON CONFLICT(serial_number) DO UPDATE` in SQLite transaction | M1 | Survey |
| 35 | CSV Import Preview & Error Log | Validate uploaded CSV and display preview and error log | M3 | Survey |
| 36 | Client CSV Parser BOM Stripping | Strip `\uFEFF` in `parseCSV()` to recognize first header `ID` | M3 | Survey |
| 37 | Designation Fuzzy Cleaning | Normalize non-standard designations (`MANEGAR` -> `MGR`) | M3 | Survey |
| 38 | JSON Database Backup | Full client-side JSON export of assets and transactions | M3 | Survey |
| 39 | Staff Directory Listing | Query active staff with department and designation | M2 | Survey |
| 40 | Add / Edit Employee | Create or update employee record with uniqueness constraint | M2 | Survey |
| 41 | Employee Soft Deletion | Inactivate employee (`status = 'Inactive'`) | M2 | Survey |
| 42 | Lifetime Employee Asset Trail | Modal timeline showing history of assigned assets | M3 | Survey |
| 43 | Employee Trail Printable View | Generate printable view of employee's asset trail | M3 | Survey |
| 44 | Individual Asset Trail Modal | Chronological lifecycle timeline modal for an asset | M3 | Survey |
| 45 | Mutual Asset Linking | Reciprocal `linked_asset_id` pointers between assets | M2 | Survey |
| 46 | Mutual Asset Unlinking | Sever reciprocal link and record dedicated audit log | M2 | Survey |
| 47 | Dashboard Metrics & Counters | Live animated counters for Total, In Store, Issued, Rate | M3 | Survey |
| 48 | Asset Readiness & Dept Bars | Progress bars and departmental asset breakdown | M3 | Survey |
| 49 | Category Donut Chart | Conic-gradient SVG/CSS donut chart with legends | M3 | Survey |
| 50 | Recent Activity Stream | Chronological stream of recent asset movements | M3 | Survey |
| 51 | 8 Standard UI States | Default, hover, active, loading, empty, error, success, disabled | M3 | Survey |
| 52 | Keyboard Accessibility | Focus outlines, Enter triggers, Escape dismisses all modals | M3 | Survey |
| 53 | Responsive Breakpoints | Responsive reflows for Desktop (1280+), Tablet (768-1024), Mobile (<640) | M3 | Survey |
| 54 | Theme & Font Customization | Dark/Light mode toggle and font scaling (A-, A, A+) | M3 | Survey |
| 55 | Barcode / QR Scanner | Camera-based barcode/QR scanner integration | M3 | Survey |
| 56 | Server Health & Diagnostics | `/api/health` and `/api/info` diagnostic endpoints | M1 | Survey |
| 57 | E2E Test Suite (Tiers 1-4) | Comprehensive test suite verifying all 56 features | M4 & E2E Track | Survey |
| 58 | Adversarial Test Hardening | White-box stress testing and edge-case validation (Tier 5) | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Architecture, Constraints & Transaction Boundaries | SQLite schema constraints, foreign keys, transaction boundaries for handover/takeover, wizard concurrency fix, bulk import transaction, audit safeguards, and SQLite error handling | none | DONE |
| E2E | Opaque-Box E2E Testing Suite Track | Design and implement 4-Tier test suite (Tiers 1-4) + Playwright/Node E2E browser tests, publishing TEST_READY.md | none (parallel) | DONE |
| M2 | Asset Lifecycle, Status Engine & Core API Wiring | Full 4-state lifecycle (In Stock, Assigned, Faulty, Scrap), mutual linking/unlinking, 18-field CSV UTF-8 BOM roundtrip, auth protection, and user self-service | M1 | PLANNED |
| M3 | Frontend UI/UX Refinement, 8 States & Accessibility | Unstyled modal CSS fix, print leak fix, disabled state styling, CSV parser BOM strip, inline validation, Escape modal dismissal, and RBAC view gating | M2 | PLANNED |
| M4 | Final Integration, 100% E2E Pass & Adversarial Hardening | Phase 1: 100% pass across E2E test suite (Tiers 1-4). Phase 2: Tier 5 adversarial testing & forensic audit | M3, TEST_READY.md | PLANNED |

## Interface Contracts

### M1 ↔ M2 (Database & API Layer)
- SQLite Database: `config/db.js` provides `run(sql, params)`, `get(sql, params)`, `all(sql, params)`, `beginTransaction()`, `commit()`, `rollback()`, and in-memory `txQueue` serialized transactions.
- Handover / Takeover Transaction API: `POST /api/transactions` executes atomically within SQLite transaction, updating `current_user`, `status`, `assigned_dept`, `assigned_desig`, `employee_id`, and `contractual_user_name`. Pre-validates all asset IDs exist before mutating DB.
- Asset Deletion API: `DELETE /api/assets/:id` enforces `requireAdmin` and records entry in `transactions` audit log.
- Error contract: Uniqueness collisions return 409 Conflict with `{ error: string }`.

### M2 ↔ M3 (Backend API ↔ Frontend Client)
- Asset Lifecycle: `status` accepts `'In Stock'`, `'Assigned'`, `'Faulty'`, `'Scrap'`.
- CSV Export: `GET /api/assets/export` streams RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) and 18 headers: `ID`, `Asset_Tag`, `Asset Type`, `Serial`, `Charger_Serial`, `Monitor_Make`, `Monitor_Serial`, `Keyboard_Make`, `Mouse_Make`, `Make`, `Model`, `IP`, `Hostname`, `Holder`, `Physical_Asset_Holder`, `Department`, `Designation`, `Year_of_Purchase`.
- Mutual Linking: `POST /api/assets/:id/link` payload `{ child_id }`, `POST /api/assets/:id/unlink`.
- Password Self-Service: `PUT /api/auth/change-password` payload `{ currentPassword, newPassword }`.

### M3 ↔ M4 & E2E Track (Application ↔ Verification)
- E2E Test Suite commands: `npm test` runs all unit, integration, and E2E suites.
- Browser test entry points: `http://localhost:<PORT>` with `#login-modal`, `#inventory-table`, `#handover-form`, `#import-modal`.

## Code Layout
- `server.js`: Server entry, security middleware, and route mounting.
- `config/db.js`: Database connection, schema migrations, and SQLite helper methods with FIFO transaction queue.
- `middleware/auth.js`: JWT verification (`authenticateToken`) and RBAC guards (`requireAdmin`).
- `routes/authRoutes.js`: Authentication, registration, and password self-service.
- `routes/accountRoutes.js`: Admin user management.
- `routes/assetRoutes.js`: Asset CRUD, wizard, stats, export, and bulk import.
- `routes/transactionRoutes.js`: Movement transactions, audit trail, and print logs.
- `routes/employeeRoutes.js`: Employee directory endpoints.
- `Public/index.html`: Main SPA interface.
- `Public/accounts.html`: Account management interface.
- `Public/css/`: Stylesheets (`style.css`, `glass.css`, `modern-components.css`, etc.).
- `Public/js/`: Frontend logic (`app.js`, `ui.js`, `utils.js`, `api.js`, `auth.js`).
- `tests/`: Automated test suites (`tests/smoke.test.js`, `tests/unit/*.test.js`, `tests/integration/*.test.js`, `tests/e2e/*.test.js`).
