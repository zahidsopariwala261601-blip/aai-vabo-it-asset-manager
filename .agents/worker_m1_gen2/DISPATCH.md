# Dispatch: Worker M1 Gen 2 (Milestone 1 Remediation)

## Role & Mission
You are Worker M1 Gen 2 (`teamwork_preview_worker`) on Milestone 1 (Database Architecture, Constraints & Transaction Boundaries).
Your mission is to remediate the specific defects identified by Reviewer 1 and Challenger 1.

## Authoritative Files
- Original Request: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md`
- Project Scope: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\PROJECT.md`
- Reviewer 1 Report: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\reviewer_m1_1\handoff.md`
- Challenger 1 Report: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\challenger_m1_1\handoff.md`
- Challenger 1 Test Suite: `tests/integration/m1_empirical_challenges.test.js`

## Exclusively Owned Files
- `config/db.js`
- `routes/assetRoutes.js`
- `routes/transactionRoutes.js`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Tasks
1. `config/db.js`:
   - Add `is_protected INTEGER DEFAULT 0` to `CREATE TABLE IF NOT EXISTS transactions`.
   - Add explicit foreign key constraints in schema DDL: `FOREIGN KEY (employee_id) REFERENCES employees(id)` in `assets` and `transactions`, and `FOREIGN KEY (issuer_id) REFERENCES employees(id)` in `transactions`.
   - Transaction Mutex/Queue: Ensure `beginTransaction()` serializes calls or uses a queue/mutex so concurrent async transactions on the single SQLite connection wait their turn instead of colliding with `SQLITE_ERROR: cannot start a transaction within a transaction`.
2. `routes/assetRoutes.js`:
   - Bulk CSV Import (`POST /api/assets/bulk`):
     - Sanitize input `req.body.assets`. Filter out any `null`, `undefined`, or non-object items.
     - If all items are invalid or array is empty, return HTTP 400 Bad Request `{ error: "No valid asset records provided" }`.
     - Ensure the entire bulk operation is wrapped in a try/catch block that rolls back and returns HTTP 400/500 rather than crashing the Express process.
   - Multi-Asset Wizard (`POST /api/assets/wizard`):
     - Use case-insensitive matching for duplicate serial checks against the database: `LOWER(serial_number) IN (...)` or `COLLATE NOCASE`.
   - Single Asset Registration (`POST /api/assets`):
     - In the error handler, catch SQLite `UNIQUE constraint failed: assets.serial_number` and return HTTP 409 Conflict with `{ error: "Asset with this serial number already exists" }`.
3. `routes/transactionRoutes.js`:
   - In `POST /api/transactions` (Handover & Takeover):
     - Prior to executing the transaction updates, verify that ALL IDs in `d.asset_ids` exist in the `assets` table.
     - If any asset ID does not exist, do NOT update any asset; return HTTP 404 or 400 Bad Request with `{ error: "One or more specified assets not found" }`.

## Verification Instructions
- Run `node --test tests/integration/m1_empirical_challenges.test.js` and verify that all 4 previously failing challenge tests pass.
- Run `npm test` to verify that all suites (116+ tests) pass with 0 failures.

## Output Requirements
Write your handoff report to:
`c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m1_gen2\handoff.md`
Send a completion message back to parent orchestrator once done.
