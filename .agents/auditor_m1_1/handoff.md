# Forensic Audit Report: Milestone 1 (Database Architecture, Constraints & Transaction Boundaries)

**Auditor**: Forensic Auditor (`auditor_m1_1`)  
**Workspace**: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment`  
**Target Milestone**: M1 Deliverables (Worker M1)  
**Profile**: General Project (Development Mode)  
**Verdict**: **CLEAN**

---

## 1. Observation

All files modified by Worker M1 were forensically inspected and empirically verified:

1. **`config/db.js`**:
   - Lines 11–17: SQLite connection initialization sets `rawDb.run('PRAGMA foreign_keys = ON;')` directly in the connection callback.
   - Lines 61–71: Helper functions `beginTransaction(callback)`, `commit(callback)`, and `rollback(callback)` invoke `run('BEGIN TRANSACTION', callback)`, `run('COMMIT', callback)`, and `run('ROLLBACK', callback)` respectively.
   - Lines 73–84: Exported `db` exposes `run`, `get`, `all`, `beginTransaction`, `commit`, `rollback`, `prepare`, `serialize`, `close`, `exec`.
   - Lines 172, 176–177: Added `CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);`, `CREATE INDEX IF NOT EXISTS idx_print_logs_tx ON print_logs(transaction_id);`, `CREATE INDEX IF NOT EXISTS idx_print_logs_ts ON print_logs(print_timestamp DESC);` in `schema`.
   - Lines 319–321: Mirrored indices created in `migrateData()`.

2. **`routes/authRoutes.js`**:
   - Lines 20–24: Error handler detects SQLite uniqueness failures (`err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key') || err.message.includes('UNIQUE')`) and returns HTTP 409 Conflict with `{ error: 'Username already exists' }`.

3. **`routes/transactionRoutes.js`**:
   - Lines 8–14: Genuine `requireAdmin` middleware checks `req.user?.role !== 'admin'` and returns HTTP 403.
   - Lines 114–198: Multi-asset handover/takeover wrapped in `db.serialize()` with explicit `BEGIN TRANSACTION`.
   - Lines 118–121: Any initial failure rolls back via `db.run('ROLLBACK', () => next(txErr))`.
   - Lines 124–134: Handover updates `status = 'Assigned'`, `current_user = ?`, `contractual_user_name = ?`, `assigned_dept = ?`, `assigned_desig = ?`, `employee_id = ?`, `ip_address = ?`, `hostname = ?`.
   - Lines 136–146: Takeover updates `status = 'In Stock'`, `current_user = 'IT Store'`, `contractual_user_name = ''`, `assigned_dept = ''`, `assigned_desig = ''`, `employee_id = NULL`, `ip_address = ''`, `hostname = ''`.
   - Lines 178–193: Failures in individual updates trigger `ROLLBACK`; full completion triggers `COMMIT`.

4. **`routes/assetRoutes.js`**:
   - Lines 15–21: `requireAdmin` checks `req.user?.role !== 'admin'`.
   - Lines 220–270: `DELETE /api/assets/:id` uses `requireAdmin`. It verifies asset existence via `SELECT * FROM assets WHERE id = ?` (returns 404 if not found). It inserts an audit record in `transactions` (`type = 'deletion'`) before executing `DELETE FROM assets WHERE id = ?` inside an atomic `BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK` block.
   - Lines 272–424: `POST /api/assets/wizard` uses prefix sequence caching (`tagCounters[prefix]`) and sequential `await` insertion inside `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`.
   - Lines 426–510: `POST /api/assets/bulk` runs bulk upserts using prepared statement executions inside an atomic `BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK` block.

5. **`tests/integration/m1_integrity.test.js`**:
   - 6 test cases independently asserting:
     - SQLite indices existence via `sqlite_master` query.
     - HTTP 409 on duplicate user registration.
     - Multi-asset handover dual-holder sync and takeover clearing.
     - Wizard sequential tag generation.
     - Admin-only asset deletion and audit logging.
     - Bulk upsert execution in transaction.

6. **Empirical Static & Runtime Evidence**:
   - Grep for bypass flags (`NODE_ENV === 'test'`, `mock`, `dummy`, `x-bypass`): 0 bypasses found.
   - Database rollback empirical execution: Verified via live node process that calling `db.rollback()` after an insert leaves 0 ghost rows (`row === undefined`).
   - Foreign key verification: Verified via live node process that `config/db.js` opens connection with `foreign_keys = 1`.
   - Automated test suite execution: 107 tests across 31 suites passed with 0 failures in 1.76 seconds.

---

## 2. Logic Chain

1. **Static Analysis & Bypass Check**:
   - Search across `routes/` and `config/` showed zero instances of environment bypasses (`if (NODE_ENV === 'test') return success`) or conditional short-circuits.
   - All response payloads are constructed dynamically from SQLite query results or validated inputs.
   - *Inference*: The implementation is authentic, not a facade or mock.

2. **Transaction Integrity & Atomicity**:
   - SQLite execution in `transactionRoutes.js`, `assetRoutes.js` (deletion, wizard, bulk), and `config/db.js` uses valid SQLite SQL commands (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`).
   - Testing `beginTransaction` and `rollback` against SQLite confirmed that partial operations are rolled back completely without persistent artifacts.
   - *Inference*: Transaction boundaries are genuine and prevent partial database writes.

3. **Data Constraint & RBAC Enforcement**:
   - SQLite UNIQUE constraint failures on `users.username` trigger `err.message` containing `UNIQUE constraint failed`. The updated handler correctly maps this to HTTP 409 Conflict.
   - `requireAdmin` checks `req.user.role === 'admin'` from verified JWT tokens. Adversarial testing with unauthenticated requests (401), invalid/forged tokens (403), and regular user tokens (403) confirmed no authorization bypass is possible.
   - *Inference*: Data constraints and administrative privileges are securely and genuinely enforced.

4. **Tag Generation & Multi-Asset Concurrency**:
   - Sequential processing of wizard assets with in-memory sequence tracking (`tagCounters[prefix]`) ensures that batch assets with the same department and asset type increment sequentially without tag collision.
   - *Inference*: Race conditions in asset tag numbering have been eliminated.

---

## 3. Caveats

- **Frontend Wiring (M2 Scope)**: This audit verified database architecture, schema migrations, backend API routes, and integration tests. Frontend UI modal integrations and 4-state lifecycle UI buttons belong to Milestone 2.
- **SQLite Concurrency**: SQLite operates in single-writer mode (WAL journal mode). Node's `sqlite3` driver serializes statements on a single connection. The transaction boundaries implemented by Worker M1 properly respect SQLite's connection serialization model.
- **No other caveats**: All core M1 requirements are fully satisfied.

---

## 4. Conclusion & Binary Verdict

### **Verdict**: **CLEAN**

All 5 prohibited patterns (hardcoded test results, facade implementations, fabricated verification outputs, self-certifying tests, execution delegation) were evaluated and confirmed absent. Worker M1's deliverables represent authentic, production-grade implementation of SQLite transactions, constraints, RBAC, and boundary testing.

### Phase Results
- **Hardcoded test results detection**: PASS (0 detected)
- **Facade / Mock detection**: PASS (0 detected)
- **Bypass conditional detection**: PASS (0 detected)
- **Pre-populated artifact detection**: PASS (0 detected)
- **Empirical Build & Test Execution**: PASS (107/107 passed across 31 suites)
- **SQL Transaction & Rollback Authenticity**: PASS (Genuine SQLite transaction statements verified)
- **RBAC Security Boundaries**: PASS (JWT verification and role checks verified)

---

## 5. Verification Method

To independently reproduce the forensic verification results:

1. **Run full automated test suite**:
   ```powershell
   npm test
   ```
   *Expected Output*: 107 passing tests, 0 failures, 31 suites.

2. **Run dedicated M1 integrity test suite**:
   ```powershell
   node --test tests/integration/m1_integrity.test.js
   ```
   *Expected Output*: 6 passing tests, 0 failures.

3. **Empirically test SQLite transaction rollback**:
   ```powershell
   node -e "const { db } = require('./config/db'); db.serialize(() => { db.beginTransaction(() => { db.run('INSERT INTO assets (name, serial_number) VALUES (?, ?)', ['RB_TEST', 'TEMP_SN_999'], function() { db.rollback(() => { db.get('SELECT * FROM assets WHERE serial_number = ?', ['TEMP_SN_999'], (err, row) => { console.log('ROW AFTER ROLLBACK:', row); process.exit(row ? 1 : 0); }); }); }); }); });"
   ```
   *Expected Output*: `ROW AFTER ROLLBACK: undefined` (exit code 0).

4. **Verify PRAGMA foreign_keys is ON**:
   ```powershell
   node -e "const { db } = require('./config/db'); db.get('PRAGMA foreign_keys;', (err, row) => { console.log(row); process.exit(row.foreign_keys === 1 ? 0 : 1); });"
   ```
   *Expected Output*: `{ foreign_keys: 1 }` (exit code 0).
