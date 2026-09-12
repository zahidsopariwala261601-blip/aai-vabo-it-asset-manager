# Comprehensive Architectural Survey & Handoff Report: Backend, Database, APIs & Data Integrity

**Author**: Explorer 1 (Backend, Database, APIs & Data Integrity Survey)  
**Project**: AAI VABO IT Asset Management System  
**Working Directory**: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment`  
**Date**: 2026-09-12  

---

## 1. Observation

### 1.1 Server Architecture & Runtime
- **Entry Point**: `server.js` (lines 1–148). Framework: Express `^4.21.0` on Node.js (tested on Node `v24.19.0`, Windows).
- **Security Middleware**:
  - `helmet`: configured in `server.js` (lines 25–28) with `contentSecurityPolicy: false`, `crossOriginEmbedderPolicy: false`.
  - `cors`: configured in `server.js` (lines 31–34) with origin from `process.env.ALLOWED_ORIGINS` or `*`, `credentials: true`.
  - `compression`: configured in `server.js` (line 37).
  - `express-rate-limit`: configured in `server.js` (lines 40–47), limiting `/api/` to 200 requests per 15-minute window (`RATE_LIMIT_WINDOW_MS=900000`, `RATE_LIMIT_MAX=200`).
- **Static Assets & SPA Fallback**:
  - `Public/` served at root (`server.js` lines 93–97) with `maxAge: 0`, `etag: true`, `lastModified: true`.
  - Catch-all `app.get('*')` (`server.js` lines 100–103) returns `Public/index.html` for non-`/api/` routes.
- **Route Mounting**:
  - `app.use('/api/auth', authRoutes)` (`server.js` line 64)
  - `app.use('/api/assets', assetRoutes)` (`server.js` line 65)
  - `app.use('/api/transactions', transactionRoutes)` (`server.js` line 66)
  - `app.use('/api/employees', employeeRoutes)` (`server.js` line 67)
  - `app.use('/api/admin', accountRoutes)` (`server.js` line 68)
  - `app.get('/api/health')` (`server.js` lines 72–79)
  - `app.get('/api/info')` (`server.js` lines 82–90)

---

### 1.2 Database Architecture & SQLite Schema
Direct SQLite inspection of `database.db` via SQLite pragmas and catalog queries revealed the following:
- **Pragmas**: `PRAGMA journal_mode = WAL;` (enabled). `PRAGMA foreign_keys = ON;` is executed inside `initializeDatabase()` (`config/db.js` line 72).
- **Existing Data Counts**:
  - `assets`: 321 rows
  - `employees`: 129 rows
  - `transactions`: 152 rows
  - `users`: 5 rows (`admin` [admin], `IT_vabo` [user], `Zahid` [user], `krishnadeep` [user], `ansar` [user])
  - `print_logs`: 179 rows
  - `sqlite_sequence`: 5 rows
- **Schema Details**:
  1. `assets` Table:
     ```sql
     CREATE TABLE assets (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         serial_number TEXT NOT NULL,
         charger_serial TEXT DEFAULT '',
         monitor_make TEXT DEFAULT '',
         monitor_serial TEXT DEFAULT '',
         make TEXT DEFAULT '',
         model TEXT DEFAULT '',
         ip_address TEXT DEFAULT '',
         current_user TEXT DEFAULT 'IT Store',
         assigned_dept TEXT DEFAULT '',
         assigned_desig TEXT DEFAULT '',
         status TEXT DEFAULT 'In Stock',
         remark TEXT DEFAULT '',
         last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
         hostname TEXT DEFAULT '',
         year_of_purchase INTEGER DEFAULT NULL,
         mac_address TEXT DEFAULT '',
         warranty_status TEXT DEFAULT 'Active',
         employee_id INTEGER REFERENCES employees(id),
         asset_tag TEXT DEFAULT '',
         mouse_make TEXT DEFAULT '',
         kva TEXT DEFAULT '',
         keyboard_make TEXT DEFAULT '',
         warranty_expiry TEXT DEFAULT '',
         contractual_user_name TEXT DEFAULT '',
         linked_asset_id INTEGER DEFAULT NULL
     );
     ```
     - Indices: `idx_assets_employee_id ON assets(employee_id)`, `idx_assets_serial_unique ON assets(serial_number)` (UNIQUE), `idx_assets_name ON assets(name)`, `idx_assets_last_update ON assets(last_update DESC)`.
     - Foreign Key: `employee_id REFERENCES employees(id)` (NO ACTION).
     - Missing Constraint: No UNIQUE constraint on `asset_tag`; no CHECK constraint on `status`.
  2. `transactions` Table:
     ```sql
     CREATE TABLE transactions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         type TEXT NOT NULL,
         asset_ids TEXT NOT NULL,
         asset_names TEXT DEFAULT '',
         ref_no TEXT DEFAULT '',
         date TEXT DEFAULT '',
         employee_name TEXT NOT NULL,
         employee_desig TEXT DEFAULT '',
         employee_dept TEXT DEFAULT '',
         issuer_name TEXT DEFAULT '',
         timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
         issuer_desig TEXT DEFAULT '',
         issuer_dept TEXT DEFAULT '',
         edit_history TEXT DEFAULT '[]',
         last_edited_at DATETIME,
         last_edited_by TEXT DEFAULT '',
         is_deleted INTEGER DEFAULT 0,
         delete_reason TEXT DEFAULT '',
         deleted_at DATETIME,
         deleted_by TEXT DEFAULT '',
         is_protected INTEGER DEFAULT 0,
         remark TEXT DEFAULT '',
         employee_id INTEGER REFERENCES employees(id),
         issuer_id INTEGER REFERENCES employees(id)
     );
     ```
     - Indices: `idx_transactions_employee_id ON transactions(employee_id)`, `idx_transactions_timestamp ON transactions(timestamp DESC)`.
     - Foreign Keys: `employee_id REFERENCES employees(id)`, `issuer_id REFERENCES employees(id)`.
     - Critical Observation: `asset_ids` is stored as `TEXT NOT NULL` containing a JSON array (e.g., `"[1, 2]"`). There is NO junction table or foreign key constraint linking `transactions` to `assets(id)`.
  3. `employees` Table:
     ```sql
     CREATE TABLE employees (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL UNIQUE,
         designation TEXT DEFAULT '',
         department TEXT DEFAULT '',
         status TEXT DEFAULT 'Active',
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     ```
     - Indices: `idx_employees_name ON employees(name)`, `sqlite_autoindex_employees_1` (UNIQUE on `name`).
  4. `users` Table:
     ```sql
     CREATE TABLE users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         username TEXT NOT NULL UNIQUE,
         password TEXT NOT NULL,
         role TEXT NOT NULL DEFAULT 'user'
     );
     ```
     - Indices: `idx_users_username ON users(username)`, `sqlite_autoindex_users_1` (UNIQUE on `username`).
  5. `print_logs` Table:
     ```sql
     CREATE TABLE print_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         transaction_id INTEGER,
         action_type TEXT NOT NULL DEFAULT 'Print',
         printed_by TEXT NOT NULL DEFAULT '',
         printed_by_dept TEXT DEFAULT '',
         system_ip TEXT DEFAULT '',
         system_hostname TEXT DEFAULT '',
         ref_no TEXT DEFAULT '',
         doc_type TEXT DEFAULT '',
         print_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     ```
     - Indices: NONE. Missing index on `transaction_id` and `print_timestamp`. No foreign key to `transactions(id)`.

---

### 1.3 API Endpoints & Implementation Audit

#### 1.3.1 Authentication & RBAC (`routes/authRoutes.js` & `routes/accountRoutes.js`)
- `POST /api/auth/register`: Unprotected. Has bug at line 21: checks `if (err.message.includes('duplicate key'))`. SQLite returns `UNIQUE constraint failed: users.username`. This causes duplicate username attempts to trigger unhandled 500 errors instead of 409 Conflict.
- `POST /api/auth/login`: Verifies `username` and `bcrypt.compare(password, user.password)`. Signs JWT with 24-hour expiry (`TOKEN_EXPIRY = '24h'`).
- `GET /api/auth/me`: Protected by `authenticateToken`.
- `routes/accountRoutes.js` (mounted at `/api/admin`):
  - Middleware at lines 8–16 enforces `user.role === 'admin'`.
  - `GET /api/admin/users`: Lists users (excluding password hashes).
  - `POST /api/admin/users`: Creates user with role `user` or `admin`.
  - `PUT /api/admin/users/:id/password`: Resets user password.
  - `DELETE /api/admin/users/:id`: Deletes user.
  - GAPS:
    1. Regular users have no endpoint to change their own password (missing `/api/auth/change-password`).
    2. Admin can delete themselves or delete the last remaining admin (no safeguard).

#### 1.3.2 Asset Lifecycle & Status Management (`routes/assetRoutes.js`)
- `GET /api/assets`: Paginated with query filters (`search`, `type`, `dept`, `page`, `limit`). Joins `employees` via `COALESCE(e.name, a.current_user)`.
- `GET /api/assets/all`: Unpaginated list of all assets.
- `GET /api/assets/stats`: Aggregates total, inStock, assigned, and counts grouped by `name` (asset category).
- `POST /api/assets`: Creates single asset.
  - **CRITICAL BUG (lines 162–163)**:
    ```javascript
    const currentUser = (d.current_user || 'IT Store').trim();
    const status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';
    ```
    The `status` field is completely overwritten. Any attempt to set status to `Faulty` or `Scrap` is ignored.
- `PUT /api/assets/:id`: Updates asset.
  - **CRITICAL BUG (lines 193–194)**:
    ```javascript
    const currentUser = (d.current_user || 'IT Store').trim();
    const status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';
    ```
    Similarly overwrites status. Transitions to `Faulty` and `Scrap` are blocked.
- `DELETE /api/assets/:id`:
  - **SECURITY / INTEGRITY GAP (lines 213–219)**: Hard deletes asset (`DELETE FROM assets WHERE id = ?`). No admin role check (any authenticated standard user can delete any asset). No check if asset is currently `Assigned`. No audit log created.
- `POST /api/assets/wizard`: Multi-asset entry wizard.
  - Uses `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` (lines 251–301).
  - **CONCURRENCY BUG (lines 268–280)**: Inside `wizardAssets.forEach`, `generateAssetTag` is invoked asynchronously. All queries run concurrently before any row commits, leading to duplicate sequence numbers and duplicate `asset_tag` values.
- `POST /api/assets/bulk`: Bulk upsert on conflict `serial_number`.
  - Overwrites status using `currentUser.toLowerCase() === 'it store' ? 'In Stock' : 'Assigned'`.
  - Not wrapped in an explicit SQLite transaction (`BEGIN TRANSACTION` / `COMMIT`).

#### 1.3.3 Handover & Takeover Flows (`routes/transactionRoutes.js`)
- `POST /api/transactions`: Records handover or takeover.
  - Updates asset statuses: `Assigned` for handover, `In Stock` for takeover.
  - **CRITICAL ATOMICITY BUG (lines 114–165)**:
    Transaction record is inserted first, followed by asynchronous asset updates via `d.asset_ids.map(...)` wrapped in `Promise.all`. **There is NO `BEGIN TRANSACTION`, `COMMIT`, or `ROLLBACK`**. If an update fails midway, the database is left in a corrupted, partial state.
  - **CRITICAL DATA GAP**:
    In handover (lines 121–141), `contractual_user_name` (Physical Asset Holder) is never written or updated on `assets`. In takeover (lines 144–158), `contractual_user_name` is never cleared. It remains permanently stale.
- `GET /api/transactions`:
  - **SECURITY GAP (line 17)**: No `authenticateToken` middleware! Publicly exposed endpoint.
- `GET /api/transactions/asset/:id`:
  - **SECURITY GAP (line 253)**: No `authenticateToken` middleware! Publicly exposed endpoint.
  - Performs unindexed regex-like scan: `SELECT * FROM transactions WHERE asset_ids LIKE ?` followed by JavaScript `JSON.parse` filtering in memory.
- `PUT /api/transactions/:id`:
  - Admin-only audit edit with change tracking recorded in `edit_history` JSON.
- `DELETE /api/transactions/:id`:
  - Admin-only soft delete with `is_deleted = 1`, mandatory `delete_reason`, and `is_protected` check.

#### 1.3.4 CSV / Excel Import & Export (18 Standard Fields)
- **Standard Columns**:
  1. `ID`
  2. `Asset_Tag`
  3. `Asset Type`
  4. `Serial`
  5. `Charger_Serial`
  6. `Monitor_Make`
  7. `Monitor_Serial`
  8. `Keyboard_Make`
  9. `Mouse_Make`
  10. `Make`
  11. `Model`
  12. `IP`
  13. `Hostname`
  14. `Holder`
  15. `Physical_Asset_Holder`
  16. `Department`
  17. `Designation`
  18. `Year_of_Purchase`
- **Export**:
  - Backend `GET /api/assets/export` (`assetRoutes.js` lines 123–156): Emits all 18 columns with UTF-8 BOM (`\uFEFF`).
  - Frontend `downloadCSV()` (`Public/js/utils.js` lines 270–300): Emits all 18 columns with UTF-8 BOM (`\uFEFF`).
  - **SECURITY GAP**: `GET /api/assets/export` lacks `authenticateToken`.
- **Import**:
  - Handled on client via `parseCSV(text)` in `Public/js/utils.js`.
  - **BUGS**:
    1. Does not strip leading `\uFEFF` BOM. `lines[0].split(',')` yields `\uFEFFID` for the first column.
    2. Does not parse or preserve `ID`.
    3. Overwrites `status` to `In Stock` or `Assigned` regardless of asset condition.
    4. Client rejects `.xlsx` files (`app.js` line 958); no backend Excel parser exists.

---

### 1.4 Test Suite & Quality Status
- Running `npm test` executes: `node --test tests/smoke.test.js`.
- Execution Result:
  ```
  ✔ single server serves the UI and APIs with administrator account management (981.8656ms)
  ℹ tests 1 | suites 0 | pass 1 | fail 0 | cancelled 0 | skipped 0 | todo 0
  ```
- Current Coverage: Only 1 smoke test file exists covering server boot, HTML serving, basic auth, and admin user CRUD.
- Zero tests exist for:
  - Asset lifecycle CRUD and status transitions
  - Multi-asset handover/takeover transaction rollback
  - Bulk CSV/Excel round-trip
  - Audit log edits and soft deletions
  - Employee directory operations
  - End-to-end browser workflows (Playwright is not installed)

---

## 2. Logic Chain

```
Observation 1 (assetRoutes.js:163, 194):
status is hardcoded as (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned'
AND
Observation 2 (Public/index.html & app.js:623-645):
No status input field exists in asset form or quick-actions
└── Logic 1:
    The application is architecturally incapable of setting, updating, or maintaining
    assets in 'Faulty' or 'Scrap' status. Requirement R1 is violated.

Observation 3 (transactionRoutes.js:114-165):
POST /api/transactions inserts into transactions table and updates assets via Promise.all
without BEGIN TRANSACTION / COMMIT / ROLLBACK
└── Logic 2:
    Multi-asset handovers lack atomicity. A database failure or crash during execution
    results in a phantom transaction record or partially updated assets. Requirement R3 is violated.

Observation 4 (transactionRoutes.js:121-158 & Public/js/app.js:873-890):
contractual_user_name is omitted from handover updates and takeover resets
AND
Handover form lacks a field for contractual_user_name
└── Logic 3:
    The Physical Asset Holder cannot be assigned during handover and is not cleared
    during takeover, causing permanent data discrepancy.

Observation 5 (assetRoutes.js:213-219 & accountRoutes.js:8-16):
DELETE /api/assets/:id is not guarded by requireAdmin and writes no audit log
└── Logic 4:
    Any authenticated regular user can wipe inventory assets without administrative
    authorization, audit safeguards, or recovery trails.

Observation 6 (authRoutes.js:21):
err.message.includes('duplicate key') used for SQLite uniqueness check
└── Logic 5:
    SQLite throws 'UNIQUE constraint failed', so duplicate username registration
    escapes the 409 branch and triggers an unhandled 500 Internal Server Error.

Observation 7 (utils.js:183-208):
parseCSV splits raw text without stripping \uFEFF BOM
└── Logic 6:
    Exported UTF-8 BOM CSV files have \uFEFF prepended to the first column name ('ID'),
    preventing exact-match header detection on re-import.
```

---

## 3. Caveats

1. **Active Database State**: `database.db` contains 321 real/seeded assets, 129 employees, and 152 transactions. Any schema migration (e.g. adding constraints or indices) must preserve existing data without dropping tables or breaking data linkage.
2. **Read-Only Scope**: This investigation was strictly read-only; no application source code was modified during this survey.
3. **Playwright Dependency**: Playwright (`@playwright/test`) is currently not installed in `node_modules` or `package.json`. Implementing browser E2E tests (Acceptance Criteria R4) will require installing Playwright and browser binaries.

---

## 4. Conclusion & Actionable Gap Analysis

### 4.1 Prioritized Deficiency Matrix

| ID | Component | Severity | Description | Recommended Remediation |
|---|---|---|---|---|
| **GAP-01** | Backend Asset API | **HIGH** | `status` hardcoded to `In Stock`/`Assigned`, blocking `Faulty` and `Scrap` | Allow explicit status in `POST /api/assets`, `PUT /api/assets/:id`, and `POST /api/assets/bulk` |
| **GAP-02** | Transaction Routes | **HIGH** | `POST /api/transactions` lacks transaction atomicity (`BEGIN`/`COMMIT`/`ROLLBACK`) | Wrap transaction insert and asset updates in `db.serialize()` with explicit `BEGIN TRANSACTION` and rollback on error |
| **GAP-03** | Data Integrity | **HIGH** | `contractual_user_name` (Physical Holder) not updated in handover or cleared in takeover | Add `contractual_user_name` to `POST /api/transactions` handover update and set to `''` on takeover |
| **GAP-04** | Security / RBAC | **HIGH** | `DELETE /api/assets/:id` permits unauthorized deletion by any user without audit | Enforce admin role check (`requireAdmin`), prevent deletion of assigned assets, and log to audit trail |
| **GAP-05** | Security / Auth | **MEDIUM** | Public access to `GET /api/assets/export`, `GET /api/transactions`, `GET /api/transactions/asset/:id` | Add `authenticateToken` middleware to all inventory data endpoints |
| **GAP-06** | SQLite Bug | **MEDIUM** | Duplicate username registration triggers 500 error due to `'duplicate key'` check | Update error check in `authRoutes.js` to inspect for `UNIQUE constraint failed` |
| **GAP-07** | CSV / BOM Engine | **MEDIUM** | Client CSV parser does not strip `\uFEFF` BOM; no backend CSV import endpoint | Sanitize `\uFEFF` in `parseCSV()` and provide robust backend CSV parsing endpoint with 18 standard fields |
| **GAP-08** | Wizard Concurrency | **MEDIUM** | Asynchronous `generateAssetTag` in `wizardAssets.forEach` causes race condition | Execute tag generation sequentially or compute sequence offsets atomically |
| **GAP-09** | Database Indices | **LOW** | Missing indices on `print_logs(transaction_id)`, `print_logs(print_timestamp)`, `assets(asset_tag)` | Add missing indices in `config/db.js` schema initialization |
| **GAP-10** | Testing Suite | **HIGH** | Only 1 smoke test exists; 0 unit tests, 0 integration tests, 0 E2E tests | Build comprehensive API integration tests and Playwright browser E2E test suite |

---

## 5. Verification Method

To independently verify all findings in this survey, run the following commands:

1. **Verify Smoke Test Execution**:
   ```powershell
   npm test
   ```
   *Expected*: Passes with 1 test in ~1 second.

2. **Verify Database Integrity and Schema**:
   ```powershell
   python scripts/export_database_csv.py database.db --inspect
   ```
   *Expected*: Outputs database row counts (`assets: 321`, `employees: 129`, `transactions: 152`, `users: 5`, `print_logs: 179`).

3. **Verify Status Override Defect (Code Inspection)**:
   Inspect `routes/assetRoutes.js` line 163 and line 194:
   Confirm `const status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';`.

4. **Verify Missing Handover Transaction Atomicity (Code Inspection)**:
   Inspect `routes/transactionRoutes.js` lines 98–165:
   Confirm lack of `BEGIN TRANSACTION` / `ROLLBACK` around `db.run` and `Promise.all(updates)`.

5. **Verify Publicly Accessible Endpoints (Unauthenticated Curl)**:
   Start the server (`npm start`) and query:
   ```bash
   curl -i http://localhost:8001/api/assets/export
   curl -i http://localhost:8001/api/transactions
   ```
   *Expected*: HTTP 200 OK without Authorization header (demonstrates GAP-05).
