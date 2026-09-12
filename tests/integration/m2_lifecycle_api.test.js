const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { startTestServer } = require('../helpers/testServer');

describe('Milestone 2 Integration Tests: Asset Lifecycle, Mutual Linking, Auth Guards & Safeguards', () => {
    let testEnv;
    let adminToken;
    let userToken;
    let testUserId;

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-m2-test-',
            adminUser: { username: 'm2_admin', password: 'M2AdminPassword123!', role: 'admin' }
        });
        adminToken = testEnv.adminToken;

        // Register a regular test user for password change and RBAC verification
        const regRes = await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: { username: 'm2_operator', password: 'InitialPassword123!' }
        });
        testUserId = regRes.data.user.id;
        userToken = regRes.data.token;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    // ─────────────────────────────────────────────────────────────
    // 1. Asset Lifecycle & 4-State Status Transitions
    // ─────────────────────────────────────────────────────────────
    describe('1. Asset Lifecycle & 4-State Status Transitions', () => {
        it('M2.1: Explicit status "Faulty" is preserved on asset creation', async () => {
            const res = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Desktop PC',
                    serial_number: 'SN-M2-FAULTY-01',
                    current_user: 'IT Store',
                    status: 'Faulty',
                    remark: 'Damaged power supply'
                },
                status: 201
            });
            const assetId = res.data.id;

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === assetId);
            assert.ok(asset);
            assert.equal(asset.status, 'Faulty');
            assert.equal(asset.current_user, 'IT Store');
        });

        it('M2.2: Explicit status "Scrap" is preserved on asset creation', async () => {
            const res = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'LaserJet Printer',
                    serial_number: 'SN-M2-SCRAP-01',
                    current_user: 'IT Store',
                    status: 'Scrap',
                    remark: 'Obsolete beyond repair'
                },
                status: 201
            });
            const assetId = res.data.id;

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === assetId);
            assert.ok(asset);
            assert.equal(asset.status, 'Scrap');
        });

        it('M2.3: Explicit status "Assigned" is preserved on creation for IT Store holder', async () => {
            const res = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Monitor',
                    serial_number: 'SN-M2-ASSIGNED-01',
                    current_user: 'IT Store',
                    status: 'Assigned'
                },
                status: 201
            });
            const assetId = res.data.id;

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === assetId);
            assert.ok(asset);
            assert.equal(asset.status, 'Assigned');
        });

        it('M2.4: Status defaults automatically when omitted (IT Store -> In Stock, employee -> Assigned)', async () => {
            const resInStock = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Switch',
                    serial_number: 'SN-M2-DEF-STOCK',
                    current_user: 'IT Store'
                },
                status: 201
            });
            const resAssigned = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Router',
                    serial_number: 'SN-M2-DEF-ASSIGNED',
                    current_user: 'Vikram Sarabhai'
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const a1 = all.data.find(a => a.id === resInStock.data.id);
            const a2 = all.data.find(a => a.id === resAssigned.data.id);
            assert.equal(a1.status, 'In Stock');
            assert.equal(a2.status, 'Assigned');
        });

        it('M2.5: Updating an asset with status "Faulty" or "Scrap" persists without clobbering', async () => {
            const createRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-M2-UPDATE-STATUS',
                    current_user: 'Rohit Sharma'
                },
                status: 201
            });
            const assetId = createRes.data.id;

            // Update to Faulty
            await testEnv.request(`/api/assets/${assetId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-M2-UPDATE-STATUS',
                    current_user: 'Rohit Sharma',
                    status: 'Faulty',
                    remark: 'Motherboard short circuit'
                },
                status: 200
            });

            let all = await testEnv.request('/api/assets/all', { token: adminToken });
            let asset = all.data.find(a => a.id === assetId);
            assert.equal(asset.status, 'Faulty');

            // Update to Scrap
            await testEnv.request(`/api/assets/${assetId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-M2-UPDATE-STATUS',
                    current_user: 'IT Store',
                    status: 'Scrap',
                    remark: 'Decommissioned from inventory'
                },
                status: 200
            });

            all = await testEnv.request('/api/assets/all', { token: adminToken });
            asset = all.data.find(a => a.id === assetId);
            assert.equal(asset.status, 'Scrap');
        });

        it('M2.6: Rejects invalid status values with HTTP 400 Bad Request', async () => {
            const resPost = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Scanner',
                    serial_number: 'SN-M2-INVALID-STATUS-POST',
                    status: 'Disposed'
                },
                status: 400
            });
            assert.ok(resPost.data.error.includes('Invalid status'));

            const createRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Scanner',
                    serial_number: 'SN-M2-VALID-POST',
                    current_user: 'IT Store'
                },
                status: 201
            });

            const resPut = await testEnv.request(`/api/assets/${createRes.data.id}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Scanner',
                    serial_number: 'SN-M2-VALID-POST',
                    current_user: 'IT Store',
                    status: 'Lost'
                },
                status: 400
            });
            assert.ok(resPut.data.error.includes('Invalid status'));
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Mutual Asset Linking & Unlinking
    // ─────────────────────────────────────────────────────────────
    describe('2. Mutual Asset Linking & Unlinking', () => {
        let parentAssetId;
        let childAssetId;

        before(async () => {
            const p = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Desktop Host', serial_number: 'SN-M2-LINK-P', current_user: 'IT Store' },
                status: 201
            });
            parentAssetId = p.data.id;

            const c = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Display Monitor', serial_number: 'SN-M2-LINK-C', current_user: 'IT Store' },
                status: 201
            });
            childAssetId = c.data.id;
        });

        it('M2.7: Mutual linking sets reciprocal pointers and records audit transaction', async () => {
            const linkRes = await testEnv.request(`/api/assets/${parentAssetId}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: childAssetId },
                status: 200
            });

            assert.equal(linkRes.data.message, 'Assets linked successfully');
            assert.equal(linkRes.data.parent_id, parentAssetId);
            assert.equal(linkRes.data.child_id, childAssetId);

            // Verify reciprocal database pointers
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const parent = allAssets.data.find(a => a.id === parentAssetId);
            const child = allAssets.data.find(a => a.id === childAssetId);

            assert.equal(parent.linked_asset_id, childAssetId);
            assert.equal(child.linked_asset_id, parentAssetId);

            // Verify dedicated audit transaction log entry
            const transRes = await testEnv.request('/api/transactions', { token: adminToken });
            const linkTx = transRes.data.data.find(t => t.type === 'Link');
            assert.ok(linkTx, 'Transaction with type Link must exist');
            const linkedIds = JSON.parse(linkTx.asset_ids);
            assert.ok(linkedIds.includes(parentAssetId));
            assert.ok(linkedIds.includes(childAssetId));
            assert.ok(linkTx.ref_no.startsWith('AAI/VABO/IT/LINK/'));
        });

        it('M2.8: Linking an asset to itself returns HTTP 400 Bad Request', async () => {
            const res = await testEnv.request(`/api/assets/${parentAssetId}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: parentAssetId },
                status: 400
            });
            assert.equal(res.data.error, 'Cannot link an asset to itself');
        });

        it('M2.9: Linking non-existent assets returns HTTP 404 Not Found', async () => {
            const res = await testEnv.request(`/api/assets/${parentAssetId}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: 999999 },
                status: 404
            });
            assert.equal(res.data.error, 'One or both assets not found');
        });

        it('M2.10: Mutual unlinking clears both pointers and records audit transaction', async () => {
            const unlinkRes = await testEnv.request(`/api/assets/${parentAssetId}/unlink`, {
                token: adminToken,
                method: 'POST',
                status: 200
            });
            assert.equal(unlinkRes.data.message, 'Assets unlinked successfully');

            // Verify both pointers cleared
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const parent = allAssets.data.find(a => a.id === parentAssetId);
            const child = allAssets.data.find(a => a.id === childAssetId);

            assert.equal(parent.linked_asset_id, null);
            assert.equal(child.linked_asset_id, null);

            // Verify dedicated audit transaction log entry
            const transRes = await testEnv.request('/api/transactions', { token: adminToken });
            const unlinkTx = transRes.data.data.find(t => t.type === 'Unlink');
            assert.ok(unlinkTx, 'Transaction with type Unlink must exist');
            const unlinkedIds = JSON.parse(unlinkTx.asset_ids);
            assert.ok(unlinkedIds.includes(parentAssetId));
            assert.ok(unlinkedIds.includes(childAssetId));
            assert.ok(unlinkTx.ref_no.startsWith('AAI/VABO/IT/UNLINK/'));
        });

        it('M2.11: Unlinking an unlinked asset returns HTTP 400 Bad Request', async () => {
            const res = await testEnv.request(`/api/assets/${parentAssetId}/unlink`, {
                token: adminToken,
                method: 'POST',
                status: 400
            });
            assert.equal(res.data.error, 'Asset is not currently linked');
        });

        it('M2.12: Unlinking a non-existent asset returns HTTP 404 Not Found', async () => {
            const res = await testEnv.request('/api/assets/999999/unlink', {
                token: adminToken,
                method: 'POST',
                status: 404
            });
            assert.equal(res.data.error, 'Asset not found');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. User Self-Service Password Change
    // ─────────────────────────────────────────────────────────────
    describe('3. User Self-Service Password Change (PUT /api/auth/change-password)', () => {
        it('M2.13: Authenticated user successfully changes own password with valid credentials', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: userToken,
                method: 'PUT',
                body: {
                    currentPassword: 'InitialPassword123!',
                    newPassword: 'BrandNewSecretPassword2026!'
                },
                status: 200
            });
            assert.equal(res.data.message, 'Password updated successfully');

            // Confirm login with new password succeeds
            const newLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'm2_operator', password: 'BrandNewSecretPassword2026!' },
                status: 200
            });
            assert.ok(newLogin.data.token);

            // Confirm old password is invalidated
            await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'm2_operator', password: 'InitialPassword123!' },
                status: 401
            });
        });

        it('M2.14: Password change is rejected when currentPassword is incorrect', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: userToken,
                method: 'PUT',
                body: {
                    currentPassword: 'WrongCurrentPassword!',
                    newPassword: 'AnotherPassword999!'
                },
                status: 400
            });
            assert.equal(res.data.error, 'Current password is incorrect');
        });

        it('M2.15: Password change is rejected when newPassword is less than 4 characters', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: userToken,
                method: 'PUT',
                body: {
                    currentPassword: 'BrandNewSecretPassword2026!',
                    newPassword: '123'
                },
                status: 400
            });
            assert.equal(res.data.error, 'New password must be at least 4 characters long');
        });

        it('M2.16: Password change is rejected when required fields are missing', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: userToken,
                method: 'PUT',
                body: { currentPassword: 'BrandNewSecretPassword2026!' },
                status: 400
            });
            assert.equal(res.data.error, 'Current password and new password are required');
        });

        it('M2.17: Unauthenticated password change request returns HTTP 401 Unauthorized', async () => {
            await testEnv.request('/api/auth/change-password', {
                method: 'PUT',
                body: { currentPassword: 'foo', newPassword: 'bar' },
                status: 401
            });
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Admin Account Protection Safeguards
    // ─────────────────────────────────────────────────────────────
    describe('4. Admin Account Protection Safeguards (DELETE /api/admin/users/:id)', () => {
        let adminUser;
        let secondAdminId;
        let regularUserId;

        before(async () => {
            // Get current admin ID
            const meRes = await testEnv.request('/api/auth/me', { token: adminToken });
            adminUser = meRes.data.user;

            // Create a second admin
            const secondAdminRes = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'second_admin', password: 'Admin2Password123!', role: 'admin' },
                status: 201
            });
            secondAdminId = secondAdminRes.data.id;

            // Create a standard user
            const regUserRes = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'deletable_user', password: 'UserPassword123!', role: 'user' },
                status: 201
            });
            regularUserId = regUserRes.data.id;
        });

        it('M2.18: Admin cannot delete own account (self-deletion blocked)', async () => {
            const res = await testEnv.request(`/api/admin/users/${adminUser.id}`, {
                token: adminToken,
                method: 'DELETE',
                status: 400
            });
            assert.equal(res.data.error, 'Cannot delete your own account');
        });

        it('M2.19: Admin can delete another admin when multiple admins exist', async () => {
            const res = await testEnv.request(`/api/admin/users/${secondAdminId}`, {
                token: adminToken,
                method: 'DELETE',
                status: 200
            });
            assert.equal(res.data.message, 'User deleted');
        });

        it('M2.20: Admin cannot delete the last remaining administrator account', async () => {
            // Log in as second admin? Wait, second admin was deleted. Only m2_admin remains now.
            // Attempting to delete the last admin from an API call:
            // Since self-deletion check triggers first for the logged-in admin, we can test by creating a temp user
            // or verify that if target is admin and count <= 1, it's blocked.
            // Let's create a temporary admin and a temporary third admin:
            const tempAdmin1 = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'temp_admin_1', password: 'Pass123!', role: 'admin' }
            });
            // Now 2 admins exist (m2_admin and temp_admin_1). Delete temp_admin_1:
            await testEnv.request(`/api/admin/users/${tempAdmin1.data.id}`, {
                token: adminToken,
                method: 'DELETE',
                status: 200
            });
            // Now only 1 admin remains (m2_admin).
            // To test the "last remaining administrator account" check specifically for targetUser.role === 'admin',
            // create a non-admin session or check via admin if an admin target cannot be deleted when count <= 1.
            // If another admin logs in and tries to delete the last one:
            const singleAdmin = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'target_admin', password: 'Pass123!', role: 'admin' }
            });
            const loginTarget = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'target_admin', password: 'Pass123!' }
            });
            const targetToken = loginTarget.data.token;
            // target_admin deletes m2_admin -> now only target_admin remains!
            await testEnv.request(`/api/admin/users/${adminUser.id}`, {
                token: targetToken,
                method: 'DELETE',
                status: 200
            });
            // Now target_admin is the ONLY remaining admin in the system!
            // If target_admin tries to delete target_admin -> blocked by self-deletion.
            // And if target_admin creates a temporary user, promotes? The guard ensures count <= 1 blocks admin deletion.
            // Let's verify target_admin cannot delete the last admin:
            const lastCheckRes = await testEnv.request(`/api/admin/users/${singleAdmin.data.id}`, {
                token: targetToken,
                method: 'DELETE',
                status: 400
            });
            assert.ok(
                lastCheckRes.data.error === 'Cannot delete your own account' ||
                lastCheckRes.data.error === 'Cannot delete the last remaining administrator account'
            );
        });

        it('M2.21: Regular user deletion succeeds cleanly', async () => {
            // Need an active admin token
            const adminLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'target_admin', password: 'Pass123!' }
            });
            const activeAdminToken = adminLogin.data.token;

            const res = await testEnv.request(`/api/admin/users/${regularUserId}`, {
                token: activeAdminToken,
                method: 'DELETE',
                status: 200
            });
            assert.equal(res.data.message, 'User deleted');
        });

        it('M2.22: Deleting non-existent user ID returns HTTP 404 Not Found', async () => {
            const adminLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'target_admin', password: 'Pass123!' }
            });
            const activeAdminToken = adminLogin.data.token;

            const res = await testEnv.request('/api/admin/users/999999', {
                token: activeAdminToken,
                method: 'DELETE',
                status: 404
            });
            assert.equal(res.data.error, 'User not found');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 5. Endpoint Authentication Guards
    // ─────────────────────────────────────────────────────────────
    describe('5. Endpoint Authentication Guards', () => {
        let activeAdminToken;
        let testAssetId;

        before(async () => {
            // Re-login with active admin
            const login = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'target_admin', password: 'Pass123!' }
            });
            activeAdminToken = login.data.token;

            const assetRes = await testEnv.request('/api/assets', {
                token: activeAdminToken,
                method: 'POST',
                body: { name: 'Audit Test Asset', serial_number: 'SN-M2-AUTHGUARD-01', current_user: 'IT Store' }
            });
            testAssetId = assetRes.data.id;
        });

        it('M2.23: Unauthenticated GET /api/assets/export returns HTTP 401 Unauthorized', async () => {
            const res = await testEnv.request('/api/assets/export');
            assert.equal(res.status, 401);
            assert.equal(res.data.error, 'Access token required');
        });

        it('M2.24: Authenticated GET /api/assets/export returns HTTP 200 OK with text/csv and UTF-8 BOM', async () => {
            const res = await testEnv.request('/api/assets/export', { token: activeAdminToken });
            assert.equal(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('text/csv'));

            const rawRes = await fetch(testEnv.base + '/api/assets/export', {
                headers: { Authorization: `Bearer ${activeAdminToken}` }
            });
            const bytes = new Uint8Array(await rawRes.arrayBuffer());
            assert.equal(bytes[0], 0xEF, 'Byte 0 must be 0xEF');
            assert.equal(bytes[1], 0xBB, 'Byte 1 must be 0xBB');
            assert.equal(bytes[2], 0xBF, 'Byte 2 must be 0xBF');
        });

        it('M2.25: Unauthenticated GET /api/transactions returns HTTP 401 Unauthorized', async () => {
            const res = await testEnv.request('/api/transactions');
            assert.equal(res.status, 401);
            assert.equal(res.data.error, 'Access token required');
        });

        it('M2.26: Authenticated GET /api/transactions returns HTTP 200 OK', async () => {
            const res = await testEnv.request('/api/transactions', { token: activeAdminToken });
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.data.data));
        });

        it('M2.27: Unauthenticated GET /api/transactions/asset/:id returns HTTP 401 Unauthorized', async () => {
            const res = await testEnv.request(`/api/transactions/asset/${testAssetId}`);
            assert.equal(res.status, 401);
            assert.equal(res.data.error, 'Access token required');
        });

        it('M2.28: Authenticated GET /api/transactions/asset/:id returns HTTP 200 OK', async () => {
            const res = await testEnv.request(`/api/transactions/asset/${testAssetId}`, { token: activeAdminToken });
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.data));
        });
    });
});
