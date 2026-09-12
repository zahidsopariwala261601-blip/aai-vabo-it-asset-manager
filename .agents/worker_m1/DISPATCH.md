# Dispatch: Worker M1 (Database Architecture, Constraints & Transaction Boundaries)

## Role & Mission
You are the Database & Backend Developer (Worker M1) on the AAI VABO IT Asset Management project.
Your mission is to implement database schema enhancements, transaction boundaries, error handling, and security safeguards.

## Authoritative Files to Read
- User Request: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md`
- Project Architecture: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\PROJECT.md`
- Explorer 1 Survey Report: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_1\handoff.md`

## Write Ownership (Exclusively Owned Files)
- `config/db.js`
- `routes/authRoutes.js`
- `routes/transactionRoutes.js`
- `routes/assetRoutes.js`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. `config/db.js`:
   - Ensure `PRAGMA foreign_keys = ON;` runs on database initialization.
   - Add indices for performance and integrity:
     `CREATE INDEX IF NOT EXISTS idx_print_logs_tx ON print_logs(transaction_id);`
     `CREATE INDEX IF NOT EXISTS idx_print_logs_ts ON print_logs(print_timestamp DESC);`
     `CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);`
   - Ensure SQLite helper functions (like `run`, `get`, `all`, transaction support) handle parameters safely.
2. `routes/authRoutes.js`:
   - Line 21 error detection bug: Change `if (err.message.includes('duplicate key'))` to handle SQLite:
     `if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key'))`
     Return HTTP 409 Conflict with `{ error: "Username already exists" }`.
3. `routes/transactionRoutes.js`:
   - In `POST /api/transactions`: Wrap the entire operation in an explicit SQLite transaction (`BEGIN TRANSACTION` ... insert transaction record and update all assets in `d.asset_ids` ... `COMMIT`, with `ROLLBACK` on any error).
   - In Handover: Synchronize physical holder (`contractual_user_name = d.contractual_user_name || d.employee_name || ''`) and update `current_user`, `assigned_dept`, `assigned_desig`, `employee_id`, `ip_address`, `hostname`, and `status = 'Assigned'`.
   - In Takeover: Reset `current_user = 'IT Store'`, `status = 'In Stock'`, and wipe `contractual_user_name = ''`, `assigned_dept = ''`, `assigned_desig = ''`, `employee_id = null`, `ip_address = ''`, `hostname = ''`.
4. `routes/assetRoutes.js`:
   - In `POST /api/assets/bulk`: Wrap the bulk upsert in an explicit transaction (`BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK`).
   - In `POST /api/assets/wizard`: Fix concurrent tag generation inside `forEach` to ensure sequence numbers are sequential and unique without collisions.
   - In `DELETE /api/assets/:id`: Add `requireAdmin` authorization middleware check. Verify asset exists and record an audit log entry in `transactions` before deleting.
5. Verification:
   - Run `node --test tests/smoke.test.js` to ensure zero regressions.
   - Document verification commands and output in your handoff report.

## Output Requirements
Write a complete, structured handoff report to:
`c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m1\handoff.md`
Including Observation, Logic Chain, Modified Files & Line ranges, and Verification Results.
Send a completion message back to parent orchestrator once done.

## 2026-09-12T11:42:54Z
You are Worker M1 (Database & Backend Developer) on the AAI VABO IT Asset Management project.
Your working directory is: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m1
Your dispatch assignment is at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m1\DISPATCH.md
Read the authoritative user request at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\PROJECT.md
Read the Explorer 1 report at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_1\handoff.md

Your exclusively owned files:
- config/db.js
- routes/authRoutes.js
- routes/transactionRoutes.js
- routes/assetRoutes.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement:
1. SQLite indices and foreign keys in config/db.js.
2. Fix SQLite UNIQUE constraint error handling (409 Conflict) in routes/authRoutes.js.
3. Atomic transaction handling (BEGIN TRANSACTION ... COMMIT / ROLLBACK) for multi-asset handovers and takeovers in routes/transactionRoutes.js.
4. Physical holder synchronization (contractual_user_name) in handover and takeover flows.
5. Atomic transaction wrapper for bulk CSV upsert in routes/assetRoutes.js.
6. Sequential, race-free tag generation in Multi-Asset Wizard (POST /api/assets/wizard).
7. Admin authorization guard (requireAdmin) and audit trail entry for asset deletion in routes/assetRoutes.js.

Run existing tests (node --test tests/smoke.test.js) to confirm zero regressions.
Write your handoff report to:
c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m1\handoff.md
Send a completion message to parent orchestrator when finished.
