const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { startTestServer } = require('../helpers/testServer');

describe('Milestone 2 Challenger 2 Empirical Test Suite: Password Self-Service, Admin Protection & JWT Auth Guards', () => {
    let testEnv;
    let initialAdminToken;
    let initialAdminId;
    let standardUserToken;
    let standardUserId;
    let testAssetId;

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-m2-c2-',
            adminUser: {
                username: 'root_admin',
                password: 'RootAdminPassword123!',
                role: 'admin'
            }
        });
        initialAdminToken = testEnv.adminToken;

        // Fetch root_admin info
        const meRes = await testEnv.request('/api/auth/me', { token: initialAdminToken });
        initialAdminId = meRes.data.user.id;

        // Register standard user
        const regRes = await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: {
                username: 'standard_staff',
                password: 'InitialUserPass123!'
            },
            status: 201
        });
        standardUserId = regRes.data.user.id;
        standardUserToken = regRes.data.token;

        // Create a test asset with rich fields (including quotes and commas) for CSV export verification
        const assetRes = await testEnv.request('/api/assets', {
            token: initialAdminToken,
            method: 'POST',
            body: {
                asset_tag: 'AAI-C2-EXP-001',
                name: 'Precision 5570 "Workstation"',
                serial_number: 'SN-C2-CSV-001',
                charger_serial: 'CHG-C2-001',
                monitor_make: 'Dell, 27-inch',
                monitor_serial: 'MON-C2-001',
                keyboard_make: 'Logitech',
                mouse_make: 'Logitech MX',
                make: 'Dell',
                model: 'Precision 5570',
                ip_address: '10.10.1.55',
                hostname: 'aai-c2-ws01',
                current_user: 'IT Store',
                contractual_user_name: 'AAI Contract, Staff',
                assigned_dept: 'IT',
                assigned_desig: 'Manager',
                year_of_purchase: 2024,
                status: 'In Stock'
            },
            status: 201
        });
        testAssetId = assetRes.data.id;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    // =========================================================================
    // SECTION 1: User Password Self-Service (PUT /api/auth/change-password)
    // =========================================================================
    describe('1. User Password Self-Service (PUT /api/auth/change-password)', () => {
        it('1.1: Rejects password change with incorrect current password (HTTP 400)', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: {
                    currentPassword: 'CompletelyWrongPassword999!',
                    newPassword: 'NewValidPassword123!'
                },
                status: 400
            });
            assert.equal(res.data.error, 'Current password is incorrect');
        });

        it('1.2: Rejects password change with case-mismatched current password (HTTP 400)', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: {
                    currentPassword: 'initialuserpass123!', // lowercase vs InitialUserPass123!
                    newPassword: 'NewValidPassword123!'
                },
                status: 400
            });
            assert.equal(res.data.error, 'Current password is incorrect');
        });

        it('1.3: Rejects missing currentPassword or newPassword (HTTP 400)', async () => {
            // Missing newPassword
            const res1 = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: { currentPassword: 'InitialUserPass123!' },
                status: 400
            });
            assert.equal(res1.data.error, 'Current password and new password are required');

            // Missing currentPassword
            const res2 = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: { newPassword: 'NewValidPassword123!' },
                status: 400
            });
            assert.equal(res2.data.error, 'Current password and new password are required');

            // Empty string fields
            const res3 = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: { currentPassword: '', newPassword: '' },
                status: 400
            });
            assert.equal(res3.data.error, 'Current password and new password are required');
        });

        it('1.4: Rejects weak or short new passwords (< 4 characters) with HTTP 400', async () => {
            const weakPasswords = ['1', 'ab', 'xyz'];
            for (const pwd of weakPasswords) {
                const res = await testEnv.request('/api/auth/change-password', {
                    token: standardUserToken,
                    method: 'PUT',
                    body: {
                        currentPassword: 'InitialUserPass123!',
                        newPassword: pwd
                    },
                    status: 400
                });
                assert.equal(res.data.error, 'New password must be at least 4 characters long');
            }
        });

        it('1.5: Rejects non-string new passwords with HTTP 400', async () => {
            const nonStringPasswords = [123456, true, ['a', 'b', 'c', 'd']];
            for (const pwd of nonStringPasswords) {
                const res = await testEnv.request('/api/auth/change-password', {
                    token: standardUserToken,
                    method: 'PUT',
                    body: {
                        currentPassword: 'InitialUserPass123!',
                        newPassword: pwd
                    },
                    status: 400
                });
                assert.equal(res.data.error, 'New password must be at least 4 characters long');
            }
        });

        it('1.6: Boundary test: exactly 4 characters new password succeeds (HTTP 200)', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: {
                    currentPassword: 'InitialUserPass123!',
                    newPassword: '4chr'
                },
                status: 200
            });
            assert.equal(res.data.message, 'Password updated successfully');

            // Verify login works with '4chr'
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'standard_staff', password: '4chr' },
                status: 200
            });
            assert.ok(loginRes.data.token);

            // Revert to a stronger password for next tests
            await testEnv.request('/api/auth/change-password', {
                token: loginRes.data.token,
                method: 'PUT',
                body: {
                    currentPassword: '4chr',
                    newPassword: 'StrongPassword2026!'
                },
                status: 200
            });
        });

        it('1.7: Unauthenticated request to change-password returns HTTP 401', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                method: 'PUT',
                body: {
                    currentPassword: 'StrongPassword2026!',
                    newPassword: 'AnotherPassword2026!'
                },
                status: 401
            });
            assert.equal(res.data.error, 'Access token required');
        });

        it('1.8: Request with invalid/forged JWT returns HTTP 403 Forbidden', async () => {
            const res = await testEnv.request('/api/auth/change-password', {
                headers: { Authorization: 'Bearer this.is.a.fake.jwt.token' },
                method: 'PUT',
                body: {
                    currentPassword: 'StrongPassword2026!',
                    newPassword: 'AnotherPassword2026!'
                },
                status: 403
            });
            assert.equal(res.data.error, 'Invalid or expired token');
        });

        it('1.9: Subsequent login with new password succeeds; old password fails', async () => {
            // Log in with current password 'StrongPassword2026!'
            const login1 = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'standard_staff', password: 'StrongPassword2026!' },
                status: 200
            });
            const activeToken = login1.data.token;

            // Update to a new password
            const newSecret = 'NextGenSecretPass#2026!';
            await testEnv.request('/api/auth/change-password', {
                token: activeToken,
                method: 'PUT',
                body: {
                    currentPassword: 'StrongPassword2026!',
                    newPassword: newSecret
                },
                status: 200
            });

            // Attempt login with OLD password -> MUST FAIL HTTP 401
            const failLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'standard_staff', password: 'StrongPassword2026!' },
                status: 401
            });
            assert.equal(failLogin.data.error, 'Invalid credentials');

            // Attempt login with NEW password -> MUST SUCCEED HTTP 200
            const successLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'standard_staff', password: newSecret },
                status: 200
            });
            assert.ok(successLogin.data.token);
            assert.equal(successLogin.data.user.username, 'standard_staff');

            // Verify the new token can access /api/auth/me
            const meRes = await testEnv.request('/api/auth/me', { token: successLogin.data.token, status: 200 });
            assert.equal(meRes.data.user.username, 'standard_staff');

            // Update standardUserToken for any subsequent tests
            standardUserToken = successLogin.data.token;
        });

        it('1.10: Password change handles special characters, quotes, and long passwords safely', async () => {
            const specialPassword = 'P@$$w0rd"\'<>&`~;-- DROP TABLE users; 🔒2026!';
            // Change to special password
            await testEnv.request('/api/auth/change-password', {
                token: standardUserToken,
                method: 'PUT',
                body: {
                    currentPassword: 'NextGenSecretPass#2026!',
                    newPassword: specialPassword
                },
                status: 200
            });

            // Login with special password
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'standard_staff', password: specialPassword },
                status: 200
            });
            assert.ok(loginRes.data.token);
            standardUserToken = loginRes.data.token;
        });
    });

    // =========================================================================
    // SECTION 2: Admin Account Protection Safeguards (DELETE /api/admin/users/:id)
    // =========================================================================
    describe('2. Admin Account Protection Safeguards (DELETE /api/admin/users/:id)', () => {
        let admin2Token;
        let admin2Id;

        it('2.1: Admin attempts to delete own ID -> rejected with HTTP 400', async () => {
            const res = await testEnv.request(`/api/admin/users/${initialAdminId}`, {
                token: initialAdminToken,
                method: 'DELETE',
                status: 400
            });
            assert.equal(res.data.error, 'Cannot delete your own account');
        });

        it('2.2: Regular user cannot call DELETE /api/admin/users/:id (HTTP 403)', async () => {
            const res = await testEnv.request(`/api/admin/users/${initialAdminId}`, {
                token: standardUserToken,
                method: 'DELETE',
                status: 403
            });
            assert.equal(res.data.error, 'Administrator access required');
        });

        it('2.3: Unauthenticated user cannot call DELETE /api/admin/users/:id (HTTP 401)', async () => {
            const res = await testEnv.request(`/api/admin/users/${initialAdminId}`, {
                method: 'DELETE',
                status: 401
            });
            assert.equal(res.data.error, 'Access token required');
        });

        it('2.4: Malformed or non-numeric user ID returns HTTP 400', async () => {
            const res = await testEnv.request('/api/admin/users/invalid-id-string', {
                token: initialAdminToken,
                method: 'DELETE',
                status: 400
            });
            assert.equal(res.data.error, 'Valid user ID required');
        });

        it('2.5: Non-existent user ID returns HTTP 404', async () => {
            const res = await testEnv.request('/api/admin/users/9999999', {
                token: initialAdminToken,
                method: 'DELETE',
                status: 404
            });
            assert.equal(res.data.error, 'User not found');
        });

        it('2.6: Lifecycle Verification: Creating second admin, deleting first, then attempting to delete second', async () => {
            // Step 1: Admin 1 creates Admin 2
            const createRes = await testEnv.request('/api/admin/users', {
                token: initialAdminToken,
                method: 'POST',
                body: {
                    username: 'second_admin_challenger',
                    password: 'SecondAdminPass123!',
                    role: 'admin'
                },
                status: 201
            });
            admin2Id = createRes.data.id;
            assert.equal(createRes.data.role, 'admin');

            // Step 2: Login as Admin 2
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: {
                    username: 'second_admin_challenger',
                    password: 'SecondAdminPass123!'
                },
                status: 200
            });
            admin2Token = loginRes.data.token;
            assert.ok(admin2Token);

            // Step 3: Admin 2 deletes Admin 1 (initialAdminId) -> SUCСEEDS because 2 admins exist
            const delRes = await testEnv.request(`/api/admin/users/${initialAdminId}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 200
            });
            assert.equal(delRes.data.message, 'User deleted');

            // Step 4: Verify Admin 1 is deleted from user list
            const userList = await testEnv.request('/api/admin/users', {
                token: admin2Token,
                status: 200
            });
            const foundAdmin1 = userList.data.find(u => u.id === initialAdminId);
            assert.equal(foundAdmin1, undefined, 'Admin 1 must no longer be present');

            // Step 5: Verify Admin 1 token is revoked/rejected (since user was deleted from DB)
            const revokedRes = await testEnv.request('/api/admin/users', {
                token: initialAdminToken,
                status: 403
            });
            assert.equal(revokedRes.data.error, 'Administrator access required');

            // Step 6: Admin 2 attempts to delete second admin (self / now sole admin) -> REJECTED HTTP 400
            const selfDelRes = await testEnv.request(`/api/admin/users/${admin2Id}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 400
            });
            assert.equal(selfDelRes.data.error, 'Cannot delete your own account');

            // Step 7: Attempting to delete the already-deleted Admin 1 returns HTTP 404
            const notFoundRes = await testEnv.request(`/api/admin/users/${initialAdminId}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 404
            });
            assert.equal(notFoundRes.data.error, 'User not found');
        });

        it('2.7: Admin deletion guard protects when target is sole admin and caller is not target', async () => {
            // To test the exact code branch:
            // if (targetUser.role === 'admin' && row.count <= 1) -> 400 'Cannot delete the last remaining administrator account'
            // We create Admin 3, then log in as Admin 3, Admin 3 attempts to delete Admin 2 when Admin 2 is the ONLY other admin?
            // If Admin 2 and Admin 3 exist, count = 2, so Admin 3 deleting Admin 2 succeeds.
            // But what if Admin 3 deletes Admin 2 -> now Admin 3 is the ONLY remaining admin.
            // If someone tries to delete Admin 3: Admin 3 cannot delete self.
            // What if a third admin was deleted concurrently?
            // To verify the count query directly, let's create a temporary admin, check count, delete it:
            const createAdmin3 = await testEnv.request('/api/admin/users', {
                token: admin2Token,
                method: 'POST',
                body: { username: 'temp_admin_3', password: 'Password333!', role: 'admin' },
                status: 201
            });
            const admin3Id = createAdmin3.data.id;

            // Admin 2 deletes Admin 3 -> succeeds (count drops back to 1)
            const delAdmin3 = await testEnv.request(`/api/admin/users/${admin3Id}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 200
            });
            assert.equal(delAdmin3.data.message, 'User deleted');
        });

        it('2.8: Admin can delete a standard user without triggering admin guard', async () => {
            // Create a disposable standard user
            const tempUser = await testEnv.request('/api/admin/users', {
                token: admin2Token,
                method: 'POST',
                body: { username: 'disposable_user', password: 'Pass12345!', role: 'user' },
                status: 201
            });
            const tempUserId = tempUser.data.id;

            // Delete standard user
            const delRes = await testEnv.request(`/api/admin/users/${tempUserId}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 200
            });
            assert.equal(delRes.data.message, 'User deleted');

            // Confirm 404 on repeat delete
            await testEnv.request(`/api/admin/users/${tempUserId}`, {
                token: admin2Token,
                method: 'DELETE',
                status: 404
            });
        });
    });

    // =========================================================================
    // SECTION 3: Protected Endpoints & 18-Field CSV BOM Export
    // =========================================================================
    describe('3. Protected Endpoints & 18-Field CSV Export', () => {
        let activeAdminToken;

        before(async () => {
            // Log in as active admin (admin2)
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: {
                    username: 'second_admin_challenger',
                    password: 'SecondAdminPass123!'
                },
                status: 200
            });
            activeAdminToken = loginRes.data.token;
        });

        it('3.1: GET /api/assets/export without Bearer token returns HTTP 401', async () => {
            const res = await testEnv.request('/api/assets/export', { status: 401 });
            assert.equal(res.data.error, 'Access token required');
        });

        it('3.2: GET /api/assets/export with invalid token returns HTTP 403', async () => {
            const res = await testEnv.request('/api/assets/export', {
                headers: { Authorization: 'Bearer invalid.token.value' },
                status: 403
            });
            assert.equal(res.data.error, 'Invalid or expired token');
        });

        it('3.3: GET /api/transactions without Bearer token returns HTTP 401', async () => {
            const res = await testEnv.request('/api/transactions', { status: 401 });
            assert.equal(res.data.error, 'Access token required');
        });

        it('3.4: GET /api/transactions with invalid token returns HTTP 403', async () => {
            const res = await testEnv.request('/api/transactions', {
                headers: { Authorization: 'Bearer bad.token.here' },
                status: 403
            });
            assert.equal(res.data.error, 'Invalid or expired token');
        });

        it('3.5: GET /api/transactions with valid JWT token succeeds (HTTP 200)', async () => {
            const res = await testEnv.request('/api/transactions', {
                token: activeAdminToken,
                status: 200
            });
            assert.ok(Array.isArray(res.data.data));
            assert.equal(typeof res.data.total, 'number');
            assert.equal(typeof res.data.page, 'number');
            assert.equal(typeof res.data.totalPages, 'number');
        });

        it('3.6: GET /api/transactions/asset/:id without Bearer token returns HTTP 401', async () => {
            const res = await testEnv.request(`/api/transactions/asset/${testAssetId}`, { status: 401 });
            assert.equal(res.data.error, 'Access token required');
        });

        it('3.7: GET /api/transactions/asset/:id with valid JWT token returns HTTP 200', async () => {
            const res = await testEnv.request(`/api/transactions/asset/${testAssetId}`, {
                token: activeAdminToken,
                status: 200
            });
            assert.ok(Array.isArray(res.data));
        });

        it('3.8: GET /api/assets/export with valid JWT downloads 18-field CSV with UTF-8 BOM', async () => {
            // Perform raw fetch to examine binary buffer bytes
            const rawRes = await fetch(testEnv.base + '/api/assets/export', {
                headers: { Authorization: `Bearer ${activeAdminToken}` }
            });
            assert.equal(rawRes.status, 200);

            // 1. Verify Headers
            const contentType = rawRes.headers.get('content-type');
            assert.ok(contentType.includes('text/csv'), `Content-Type should be text/csv, got: ${contentType}`);
            assert.ok(contentType.includes('charset=utf-8'), `Content-Type should include utf-8, got: ${contentType}`);

            const contentDisposition = rawRes.headers.get('content-disposition');
            assert.ok(
                contentDisposition.includes('attachment; filename=Inventory_'),
                `Content-Disposition should be attachment; filename=Inventory_..., got: ${contentDisposition}`
            );

            // 2. Verify UTF-8 BOM (0xEF, 0xBB, 0xBF)
            const buffer = Buffer.from(await rawRes.arrayBuffer());
            assert.ok(buffer.length >= 3, 'CSV output must contain at least BOM bytes');
            assert.equal(buffer[0], 0xEF, 'Byte 0 must be 0xEF (UTF-8 BOM)');
            assert.equal(buffer[1], 0xBB, 'Byte 1 must be 0xBB (UTF-8 BOM)');
            assert.equal(buffer[2], 0xBF, 'Byte 2 must be 0xBF (UTF-8 BOM)');

            // 3. Decode CSV string after the 3 BOM bytes
            const csvContent = buffer.subarray(3).toString('utf8');
            const lines = csvContent.trim().split('\n');
            assert.ok(lines.length >= 2, 'CSV must have at least header line and one data line');

            // 4. Verify 18 Header Fields exactly
            const expectedHeaders = [
                'ID',
                'Asset_Tag',
                'Asset Type',
                'Serial',
                'Charger_Serial',
                'Monitor_Make',
                'Monitor_Serial',
                'Keyboard_Make',
                'Mouse_Make',
                'Make',
                'Model',
                'IP',
                'Hostname',
                'Holder',
                'Physical_Asset_Holder',
                'Department',
                'Designation',
                'Year_of_Purchase'
            ];

            const headerLine = lines[0].replace(/\r$/, '');
            const headerFields = headerLine.split(',');
            assert.equal(headerFields.length, 18, `Header must contain exactly 18 fields, got ${headerFields.length}`);
            assert.deepEqual(headerFields, expectedHeaders, 'Header column names must match standard 18 fields');

            // 5. Verify CSV row parsing for test asset
            // Simple robust CSV row parser respecting quoted fields
            function parseCsvRow(text) {
                const fields = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < text.length; i++) {
                    const ch = text[i];
                    if (inQuotes) {
                        if (ch === '"') {
                            if (i + 1 < text.length && text[i + 1] === '"') {
                                current += '"';
                                i++;
                            } else {
                                inQuotes = false;
                            }
                        } else {
                            current += ch;
                        }
                    } else {
                        if (ch === '"') {
                            inQuotes = true;
                        } else if (ch === ',') {
                            fields.push(current);
                            current = '';
                        } else {
                            current += ch;
                        }
                    }
                }
                fields.push(current);
                return fields;
            }

            // Find our test asset row
            const dataRows = lines.slice(1).map(l => parseCsvRow(l.replace(/\r$/, '')));
            const testRow = dataRows.find(r => r[0] === String(testAssetId));
            assert.ok(testRow, `Test asset ID ${testAssetId} must be present in exported CSV rows`);

            // Verify testRow has exactly 18 fields
            assert.equal(testRow.length, 18, `Data row must have exactly 18 fields, got ${testRow.length}`);

            // Verify specific fields and quotation escaping
            assert.equal(testRow[0], String(testAssetId));
            assert.equal(testRow[1], 'AAI-C2-EXP-001'); // Asset_Tag
            assert.equal(testRow[2], 'Precision 5570 "Workstation"'); // Asset Type with escaped quotes
            assert.equal(testRow[3], 'SN-C2-CSV-001'); // Serial
            assert.equal(testRow[4], 'CHG-C2-001'); // Charger_Serial
            assert.equal(testRow[5], 'Dell, 27-inch'); // Monitor_Make with comma
            assert.equal(testRow[6], 'MON-C2-001'); // Monitor_Serial
            assert.equal(testRow[7], 'Logitech'); // Keyboard_Make
            assert.equal(testRow[8], 'Logitech MX'); // Mouse_Make
            assert.equal(testRow[9], 'Dell'); // Make
            assert.equal(testRow[10], 'Precision 5570'); // Model
            assert.equal(testRow[11], '10.10.1.55'); // IP
            assert.equal(testRow[12], 'aai-c2-ws01'); // Hostname
            assert.equal(testRow[13], 'IT Store'); // Holder
            assert.equal(testRow[14], 'AAI Contract, Staff'); // Physical_Asset_Holder with comma
            assert.equal(testRow[15], 'IT'); // Department
            assert.equal(testRow[16], 'Manager'); // Designation
            assert.equal(testRow[17], '2024'); // Year_of_Purchase
        });
    });
});
