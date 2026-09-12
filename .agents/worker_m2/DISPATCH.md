# Dispatch: Worker M2 (Asset Lifecycle, Status Engine & Core API Wiring)

## Role & Mission
You are Worker M2 (`teamwork_preview_worker`) on Milestone 2 of the AAI VABO IT Asset Management project.
Your mission is to implement full asset lifecycle status transitions (`In Stock`, `Assigned`, `Faulty`, `Scrap`), mutual asset linking/unlinking, user self-service password change, admin account safeguards, and protect endpoints with JWT authentication.

## Authoritative Files to Read
- User Request: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md`
- Project Scope & Architecture: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\orchestrator_1\PROJECT.md`
- Test Ready Spec: `c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\TEST_READY.md`

## Exclusively Owned Files
- `routes/assetRoutes.js`
- `routes/authRoutes.js`
- `routes/accountRoutes.js`
- `routes/transactionRoutes.js`
- `tests/integration/m2_lifecycle_api.test.js`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. **Asset Lifecycle & Status Transitions** (`routes/assetRoutes.js`):
   - In `POST /api/assets` and `PUT /api/assets/:id`:
     - Allow all 4 valid statuses: `'In Stock'`, `'Assigned'`, `'Faulty'`, `'Scrap'`.
     - If `req.body.status` is provided and is one of the 4 valid statuses, use it!
     - Only fall back to automatic status calculation `(current_user.toLowerCase() === 'it store' ? 'In Stock' : 'Assigned')` if `status` is omitted or empty.
     - Never clobber explicit `Faulty` or `Scrap` status when updating or creating assets.
2. **Mutual Asset Linking & Unlinking** (`routes/assetRoutes.js`):
   - Implement `POST /api/assets/:id/link`:
     - Accepts `{ child_id }` in body.
     - Validates that both `:id` (parent) and `child_id` (child) exist in the database and are distinct (`:id !== child_id`).
     - Updates reciprocal pointers inside a transaction: `UPDATE assets SET linked_asset_id = ? WHERE id = ?` for both assets.
     - Records a dedicated transaction entry in `transactions` (`type = 'Link'`, referencing both assets).
     - Returns HTTP 200 with `{ message: "Assets linked successfully", parent_id, child_id }`.
   - Implement `POST /api/assets/:id/unlink`:
     - Finds the currently linked asset (`SELECT linked_asset_id FROM assets WHERE id = ?`).
     - If not linked, returns HTTP 400 `{ error: "Asset is not currently linked" }`.
     - Inside a transaction, clears `linked_asset_id = NULL` on both the target asset and its previously linked partner.
     - Records a dedicated transaction entry in `transactions` (`type = 'Unlink'`).
     - Returns HTTP 200 with `{ message: "Assets unlinked successfully" }`.
3. **User Self-Service Password Change** (`routes/authRoutes.js`):
   - Implement `PUT /api/auth/change-password` (protected by `authenticateToken`):
     - Accepts `{ currentPassword, newPassword }`.
     - Validates that `currentPassword` matches the authenticated user's current hashed password using `bcrypt.compare`.
     - Validates `newPassword` (min 4 characters).
     - Hashes `newPassword` (10 rounds bcrypt) and updates `users` table.
     - Returns HTTP 200 with `{ message: "Password updated successfully" }`.
4. **Admin Account Protection Safeguards** (`routes/accountRoutes.js`):
   - In `DELETE /api/admin/users/:id`:
     - Prevent an admin from deleting themselves (`if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: "Cannot delete your own account" });`).
     - Check if target user is an admin; if so, count total admins (`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`). If `count <= 1`, return HTTP 400 `{ error: "Cannot delete the last remaining administrator account" }`.
5. **Endpoint Authentication Guards** (`routes/assetRoutes.js` & `routes/transactionRoutes.js`):
   - Add `authenticateToken` middleware to:
     - `GET /api/assets/export`
     - `GET /api/transactions`
     - `GET /api/transactions/asset/:id`
6. **Automated Verification**:
   - Write comprehensive tests in `tests/integration/m2_lifecycle_api.test.js` verifying:
     - Status transitions to `Faulty`, `Scrap`, `In Stock`, `Assigned`.
     - Mutual linking and unlinking reciprocal pointers and audit transactions.
     - Password self-service with correct vs incorrect current password.
     - Self-deletion and last-admin deletion prevention.
     - 401 unauthenticated access to `/api/assets/export` and `/api/transactions`.
   - Run `npm test` and ensure 100% of all test suites pass with 0 failures.

## Output Requirements
Write your handoff report to:
`c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m2\handoff.md`
Send a completion message back to parent orchestrator once done.

## 2026-09-12T12:03:52Z
You are Worker M2 (API & Asset Lifecycle Developer) on the AAI VABO IT Asset Management project.
Your working directory is: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m2
Your dispatch assignment is at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m2\DISPATCH.md
Read the authoritative files:
- ORIGINAL_REQUEST.md
- PROJECT.md
- TEST_READY.md

Exclusively owned files:
- routes/assetRoutes.js
- routes/authRoutes.js
- routes/accountRoutes.js
- routes/transactionRoutes.js
- tests/integration/m2_lifecycle_api.test.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement:
1. Full 4-state lifecycle status transitions ('In Stock', 'Assigned', 'Faulty', 'Scrap') in routes/assetRoutes.js.
2. Mutual asset linking and unlinking endpoints (POST /api/assets/:id/link, POST /api/assets/:id/unlink) with reciprocal pointers and dedicated audit transaction records.
3. User self-service password change (PUT /api/auth/change-password) with bcrypt verification.
4. Admin deletion guards (prevent self-deletion and deleting last remaining admin) in routes/accountRoutes.js.
5. Endpoint authentication guards (authenticateToken on export and transaction routes).
6. Integration test suite tests/integration/m2_lifecycle_api.test.js verifying all new capabilities.

Run npm test and confirm 100% pass rate.
Write handoff report to:
c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\worker_m2\handoff.md
Send a completion message to parent orchestrator when finished.

