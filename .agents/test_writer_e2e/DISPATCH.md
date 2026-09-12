# Dispatch: QA Test Engineer (E2E Testing Track)

## Role & Mission
You are the QA Test Engineer / Test Writer on the AAI VABO IT Asset Management project.
Your mission is to construct the comprehensive automated test suite covering Tiers 1-4, publish `TEST_READY.md`, and configure test scripts in `package.json`.

## Authoritative Files to Read
- User Request: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md`
- Project Architecture: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\PROJECT.md`
- Test Infrastructure Spec: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\TEST_INFRA.md`
- Spec Miner Report: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3\handoff.md`

## Write Ownership (Exclusively Owned Files)
- `tests/` directory and any subdirectories (`tests/unit/`, `tests/integration/`, `tests/e2e/`)
- `package.json` test scripts (ensure `npm test` runs all tests)
- `TEST_READY.md` at project root: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\TEST_READY.md`

## Detailed Tasks
1. Establish modular test suite structure in `tests/`:
   - `tests/unit/utils.test.js`:
     - Test `cleanDesignation()` fuzzy mapping (e.g. 'MANEGAR' -> 'MGR', 'DGM' -> 'DGM', unknown stays uppercase).
     - Test `parseCSV()` handling of quotes, commas, newlines, and UTF-8 BOM `\uFEFF`.
     - Test `isValidIPv4()` valid vs invalid IP addresses.
     - Test `validateAssetRecord()` year ranges (2000-2026), mandatory fields.
   - `tests/integration/auth_rbac.test.js`:
     - Test login with valid vs invalid credentials.
     - Test user registration, token generation, 24h validity.
     - Test duplicate username returns 409 Conflict.
     - Test admin routes (`/api/admin/users`) blocked with 403 for standard users.
     - Test admin can create user, reset password, delete user.
   - `tests/integration/assets.test.js`:
     - Test single asset registration with auto-tag `VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}`.
     - Test duplicate serial rejection.
     - Test asset update and status changes (`In Stock`, `Assigned`, `Faulty`, `Scrap`).
     - Test asset deletion (admin only).
     - Test multi-asset wizard with atomic rollback on collision.
   - `tests/integration/transactions.test.js`:
     - Test Handover workflow: assets marked 'Assigned', employee & physical holder updated, ref voucher generated.
     - Test Takeover workflow: assets reset to 'In Stock', holder & network cleared.
     - Test atomic rollback if an asset update fails in multi-asset transaction.
     - Test admin audit log edit with diff tracking in `edit_history`.
     - Test soft delete with protection flag (`is_protected = 1`).
     - Test print security telemetry logging (`/api/transactions/print-log`).
   - `tests/integration/csv.test.js`:
     - Test CSV export with UTF-8 BOM (`\uFEFF`) and exact 18 headers in correct order.
     - Test CSV bulk import with UPSERT (`ON CONFLICT(serial_number) DO UPDATE`).
     - Test round-trip: export DB -> import back -> 0 data loss.
   - `tests/e2e/workflows.test.js`:
     - Full enterprise user journeys (Provisioning, Return, Audit Reconciliation, RBAC).
2. Test Isolation Guarantee:
   - Ensure each test file creates an isolated temporary SQLite database (e.g. using `os.tmpdir()` and dynamic free port, similar to `tests/smoke.test.js`).
   - Tests MUST NOT pollute or lock `database.db`.
3. Package Scripts:
   - Update `package.json` so `"test": "node --test tests/**/*.test.js tests/*.test.js"` (or matching pattern that discovers all tests).
4. Run tests and verify:
   - Execute the test suite and confirm all pass cleanly.
5. Publish `TEST_READY.md`:
   - Create `TEST_READY.md` at project root with runner command, test counts across Tiers 1-4, and feature checklist.

## Output Requirements
Write a complete handoff report to:
`c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\test_writer_e2e\handoff.md`
Send a completion message back to parent orchestrator once done.
