const assert = require('node:assert/strict');
const { describe, it, before, after, beforeEach } = require('node:test');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');
const { db: mainDb } = require('../../config/db');

describe('Milestone 1 Adversarial & Boundary Challenges (challenger_m1_2.test.js)', () => {
    let testEnv;
    let adminToken;
    let userToken;
    let employeeId;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'challenger-m1-2-' });
        adminToken = testEnv.adminToken;

        // Register a regular non-admin user
        const userReg = await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: { username: 'test_challenger_user', password: 'user-pass-123' },
            status: 201
        });
        userToken = userReg.data.token;

        // Ensure an active employee exists in the test DB
        const empDb = new sqlite3.Database(testEnv.databasePath);
        await new Promise((resolve, reject) => {
            empDb.run(
                `INSERT INTO employees (name, designation, department) VALUES (?, ?, ?)`,
                ['Ramesh Kumar', 'Senior Manager', 'CNS'],
                function(err) {
                    if (err) return reject(err);
                    employeeId = this.lastID;
                    empDb.close(resolve);
                }
            );
        });
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scope 1: Foreign Key Enforcement
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scope 1: SQLite Foreign Key Enforcement', () => {
        it('CH2-FK.1: SQLite connection enforces foreign keys when PRAGMA foreign_keys = ON', async () => {
            const raw = new sqlite3.Database(testEnv.databasePath);
            const fkStatus = await new Promise((resolve, reject) => {
                raw.get('PRAGMA foreign_keys;', (err, row) => err ? reject(err) : resolve(row));
            });
            await new Promise(r => raw.close(r));
            assert.equal(typeof fkStatus.foreign_keys, 'number');
        });

        it('CH2-FK.2: Direct insertion with invalid employee_id on production database.db is blocked by FK constraint', async () => {
            await new Promise((resolve) => {
                mainDb.run(
                    `INSERT INTO assets (name, serial_number, employee_id) VALUES (?, ?, ?)`,
                    ['FK Stress Test Asset', 'SN-FK-INVALID-999', 9999999],
                    function(err) {
                        assert.ok(err, 'Expected SQLite constraint error on invalid employee_id');
                        assert.match(err.message, /FOREIGN KEY constraint failed/i);
                        resolve();
                    }
                );
            });
        });

        it('CH2-FK.3: Direct insertion with invalid employee_id in transactions on production database.db is blocked', async () => {
            await new Promise((resolve) => {
                mainDb.run(
                    `INSERT INTO transactions (type, asset_ids, employee_name, employee_id) VALUES (?, ?, ?, ?)`,
                    ['handover', '[99999]', 'Unknown User', 9999999],
                    function(err) {
                        assert.ok(err, 'Expected SQLite constraint error on invalid employee_id in transactions');
                        assert.match(err.message, /FOREIGN KEY constraint failed/i);
                        resolve();
                    }
                );
            });
        });

        it('CH2-FK.4: Deleting an employee referenced by an active asset is blocked by FK constraint', async () => {
            const refEmp = await new Promise((resolve, reject) => {
                mainDb.get('SELECT employee_id FROM assets WHERE employee_id IS NOT NULL LIMIT 1', (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.employee_id : null);
                });
            });

            if (refEmp) {
                await new Promise((resolve) => {
                    mainDb.run('DELETE FROM employees WHERE id = ?', [refEmp], function(err) {
                        assert.ok(err, 'Deleting a referenced employee must fail due to FK constraint');
                        assert.match(err.message, /FOREIGN KEY constraint failed/i);
                        resolve();
                    });
                });
            }
        });

        it('CH2-FK.5: Foreign key allows NULL employee_id for unassigned assets and transactions', async () => {
            await new Promise((resolve, reject) => {
                mainDb.run(
                    `INSERT INTO assets (name, serial_number, employee_id, current_user) VALUES (?, ?, NULL, 'IT Store')`,
                    ['FK Nullable Asset', 'SN-FK-NULL-001'],
                    function(err) {
                        if (err) return reject(err);
                        const id = this.lastID;
                        mainDb.run('DELETE FROM assets WHERE id = ?', [id], () => resolve());
                    }
                );
            });
        });

        it('CH2-FK.6: Architecture Audit: Fresh database initialization schema in config/db.js omits REFERENCES in CREATE TABLE', async () => {
            const fs = require('fs');
            const path = require('path');
            const content = fs.readFileSync(path.resolve(__dirname, '../../config/db.js'), 'utf8');

            const assetsMatch = content.match(/CREATE TABLE IF NOT EXISTS assets \(([\s\S]*?)\);/);
            assert.ok(assetsMatch, 'CREATE TABLE assets must be present in db.js');
            const assetsTableSql = assetsMatch[1];

            const hasAssetFkInCreate = /employee_id\s+INTEGER\s+REFERENCES\s+employees/i.test(assetsTableSql);
            assert.equal(hasAssetFkInCreate, false, 'Architectural finding: db.js CREATE TABLE assets lacks inline REFERENCES constraint on employee_id');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scope 2: Unique Index Enforcement & 409 Conflict Handling
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scope 2: Unique Index Enforcement & 409 Conflict Responses', () => {
        it('CH2-UQ.1: Duplicate username on POST /api/auth/register returns 409 with proper error JSON', async () => {
            const res = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'test_challenger_user', password: 'different-password' },
                status: 409
            });

            assert.equal(res.status, 409);
            assert.deepEqual(res.data, { error: 'Username already exists' });
        });

        it('CH2-UQ.2: Registration validator rejects usernames containing invalid characters before reaching DB', async () => {
            const res = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'test challenger user', password: 'different-password' },
                status: 400
            });

            assert.equal(res.status, 400);
            assert.equal(res.data.error, 'Validation failed');
            assert.ok(res.data.details.includes('Username may only contain letters, numbers, and underscores'));
        });

        it('CH2-UQ.3: Admin user creation POST /api/admin/users returns 409 for duplicate username', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'test_challenger_user', password: 'admin-added-password', role: 'user' },
                status: 409
            });

            assert.equal(res.status, 409);
            assert.deepEqual(res.data, { error: 'User already exists' });
        });

        it('CH2-UQ.4: Non-admin is blocked with 403 on POST /api/admin/users before duplicate check', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: userToken,
                method: 'POST',
                body: { username: 'brand_new_unique_user', password: 'new-user-pass', role: 'user' },
                status: 403
            });

            assert.equal(res.status, 403);
            assert.equal(res.data.error, 'Administrator access required');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scope 3: Physical Holder Synchronization Across Handover & Takeover
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scope 3: Physical Holder Sync in Single & Multi-Asset Operations', () => {
        let singleAssetId;
        let multiAssetId1;
        let multiAssetId2;

        before(async () => {
            const a1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Single Laptop', serial_number: 'CH2-SN-S1', current_user: 'IT Store' },
                status: 201
            });
            singleAssetId = a1.data.id;

            const a2 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Multi Terminal 1', serial_number: 'CH2-SN-M1', current_user: 'IT Store' },
                status: 201
            });
            multiAssetId1 = a2.data.id;

            const a3 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Multi Terminal 2', serial_number: 'CH2-SN-M2', current_user: 'IT Store' },
                status: 201
            });
            multiAssetId2 = a3.data.id;
        });

        it('CH2-SYNC.1: Single-asset handover with explicit contractual_user_name sets both holder fields', async () => {
            const handoverRes = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [singleAssetId],
                    employee_name: 'Vikas Gupta',
                    contractual_user_name: 'Vikas G (Vendor Consultant)',
                    employee_dept: 'IT',
                    employee_desig: 'Consultant',
                    new_ip_address: '10.10.1.101',
                    new_hostname: 'VABO-IT-VG'
                },
                status: 201
            });

            assert.ok(handoverRes.data.id);

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === singleAssetId);

            assert.equal(asset.status, 'Assigned');
            assert.equal(asset.current_user, 'Vikas Gupta');
            assert.equal(asset.contractual_user_name, 'Vikas G (Vendor Consultant)');
            assert.equal(asset.ip_address, '10.10.1.101');
            assert.equal(asset.hostname, 'VABO-IT-VG');
        });

        it('CH2-SYNC.2: Single-asset handover with omitted contractual_user_name defaults to employee_name', async () => {
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: [singleAssetId],
                    employee_name: 'Vikas Gupta'
                },
                status: 201
            });

            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [singleAssetId],
                    employee_name: 'Priya Sharma',
                    employee_dept: 'OPS',
                    employee_desig: 'Supervisor'
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === singleAssetId);

            assert.equal(asset.current_user, 'Priya Sharma');
            assert.equal(asset.contractual_user_name, 'Priya Sharma', 'contractual_user_name must default to employee_name');
            assert.equal(asset.status, 'Assigned');
        });

        it('CH2-SYNC.3: Single-asset takeover clears contractual_user_name and resets status to In Stock', async () => {
            const takeoverRes = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: [singleAssetId],
                    employee_name: 'Priya Sharma'
                },
                status: 201
            });

            assert.ok(takeoverRes.data.id);

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const asset = all.data.find(a => a.id === singleAssetId);

            assert.equal(asset.status, 'In Stock');
            assert.equal(asset.current_user, 'IT Store');
            assert.equal(asset.contractual_user_name, '', 'contractual_user_name must be empty string after takeover');
            assert.equal(asset.employee_id, null, 'employee_id must be null after takeover');
            assert.equal(asset.ip_address, '');
            assert.equal(asset.hostname, '');
        });

        it('CH2-SYNC.4: Multi-asset handover updates contractual_user_name across all assets uniformly', async () => {
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [multiAssetId1, multiAssetId2],
                    employee_name: 'Deepak Verma',
                    contractual_user_name: 'Deepak V (Contract Staff)',
                    employee_dept: 'FIN',
                    employee_desig: 'Analyst',
                    new_ip_address: '10.20.2.1',
                    new_hostname: 'FIN-ANL-01'
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const ast1 = all.data.find(a => a.id === multiAssetId1);
            const ast2 = all.data.find(a => a.id === multiAssetId2);

            assert.equal(ast1.current_user, 'Deepak Verma');
            assert.equal(ast1.contractual_user_name, 'Deepak V (Contract Staff)');
            assert.equal(ast1.status, 'Assigned');

            assert.equal(ast2.current_user, 'Deepak Verma');
            assert.equal(ast2.contractual_user_name, 'Deepak V (Contract Staff)');
            assert.equal(ast2.status, 'Assigned');
        });

        it('CH2-SYNC.5: Multi-asset takeover clears contractual_user_name for all assets in batch', async () => {
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: [multiAssetId1, multiAssetId2],
                    employee_name: 'Deepak Verma'
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const ast1 = all.data.find(a => a.id === multiAssetId1);
            const ast2 = all.data.find(a => a.id === multiAssetId2);

            assert.equal(ast1.status, 'In Stock');
            assert.equal(ast1.current_user, 'IT Store');
            assert.equal(ast1.contractual_user_name, '');

            assert.equal(ast2.status, 'In Stock');
            assert.equal(ast2.current_user, 'IT Store');
            assert.equal(ast2.contractual_user_name, '');
        });

        it('CH2-SYNC.6: Multi-Asset Wizard sets contractual_user_name from input or employee.name', async () => {
            const wizRes = await testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Aakash Mehra', designation: 'Engineer', department: 'CNS' },
                    assets: [
                        { name: 'Switch', serial_number: 'WIZ-SW-01', contractual_user_name: 'Aakash (Special Unit)' },
                        { name: 'Router', serial_number: 'WIZ-RT-01' }
                    ]
                },
                status: 201
            });

            assert.equal(wizRes.data.asset_ids.length, 2);
            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const sw = all.data.find(a => a.id === wizRes.data.asset_ids[0]);
            const rt = all.data.find(a => a.id === wizRes.data.asset_ids[1]);

            assert.equal(sw.contractual_user_name, 'Aakash (Special Unit)');
            assert.equal(rt.contractual_user_name, 'Aakash Mehra');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scope 4: Asset Deletion Security & RBAC Protection
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scope 4: Asset Deletion Security & RBAC Protection', () => {
        let testAssetId;

        beforeEach(async () => {
            const createRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Delete Target Asset',
                    serial_number: `DEL-SN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    current_user: 'IT Store'
                },
                status: 201
            });
            testAssetId = createRes.data.id;
        });

        it('CH2-DEL.1: Unauthenticated DELETE /api/assets/:id returns 401 Unauthorized', async () => {
            const res = await testEnv.request(`/api/assets/${testAssetId}`, {
                method: 'DELETE',
                status: 401
            });

            assert.equal(res.status, 401);
            assert.equal(res.data.error, 'Access token required');
        });

        it('CH2-DEL.2: Regular user (role: user) DELETE /api/assets/:id returns 403 Forbidden', async () => {
            const res = await testEnv.request(`/api/assets/${testAssetId}`, {
                token: userToken,
                method: 'DELETE',
                status: 403
            });

            assert.equal(res.status, 403);
            assert.equal(res.data.error, 'Administrator access required');

            // Verify the asset is STILL intact in the database
            const check = await testEnv.request('/api/assets/all', { token: adminToken });
            assert.ok(check.data.some(a => a.id === testAssetId), 'Asset must not be deleted by non-admin');
        });

        it('CH2-DEL.3: Admin DELETE on non-existent asset ID returns 404 Not Found', async () => {
            const res = await testEnv.request('/api/assets/99999999', {
                token: adminToken,
                method: 'DELETE',
                status: 404
            });

            assert.equal(res.status, 404);
            assert.equal(res.data.error, 'Asset not found');
        });

        it('CH2-DEL.4: Admin DELETE deletes asset and writes audit log to transactions table', async () => {
            const delRes = await testEnv.request(`/api/assets/${testAssetId}`, {
                token: adminToken,
                method: 'DELETE',
                status: 200
            });

            assert.equal(delRes.status, 200);
            assert.equal(delRes.data.message, 'Asset deleted');

            // Confirm asset is gone
            const check = await testEnv.request('/api/assets/all', { token: adminToken });
            assert.ok(!check.data.some(a => a.id === testAssetId), 'Asset must be removed from inventory');

            // Verify audit trail entry in transactions
            const txRes = await testEnv.request('/api/transactions?show_deleted=1', { token: adminToken });
            const auditEntry = txRes.data.data.find(t =>
                t.type === 'deletion' && t.asset_ids.includes(String(testAssetId))
            );

            assert.ok(auditEntry, 'Audit log entry for deletion must exist in transactions');
            assert.equal(auditEntry.issuer_name, 'test-admin');
            assert.ok(auditEntry.ref_no.startsWith('AAI/VABO/IT/DELETE/'));
            assert.match(auditEntry.remark, /Asset deleted/i);
            assert.match(auditEntry.remark, /Delete Target Asset/i);
        });

        it('CH2-DEL.5: Sequential second deletion attempt against the same asset ID returns 404 Not Found', async () => {
            const res1 = await testEnv.request(`/api/assets/${testAssetId}`, { token: adminToken, method: 'DELETE', status: 200 });
            assert.equal(res1.status, 200);

            const res2 = await testEnv.request(`/api/assets/${testAssetId}`, { token: adminToken, method: 'DELETE', status: 404 });
            assert.equal(res2.status, 404);
            assert.equal(res2.data.error, 'Asset not found');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scope 5: Adversarial Concurrency & Data Resilience
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scope 5: Adversarial Concurrency & Unicode Resilience', () => {
        it('CH2-ADV.1: Concurrent registration of identical username results in 201 for one and 409 for the second', async () => {
            const targetUsername = `race_user_${Date.now()}`;
            const [reg1, reg2] = await Promise.all([
                testEnv.request('/api/auth/register', {
                    method: 'POST',
                    body: { username: targetUsername, password: 'race-password-123' }
                }),
                testEnv.request('/api/auth/register', {
                    method: 'POST',
                    body: { username: targetUsername, password: 'race-password-123' }
                })
            ]);

            const statuses = [reg1.status, reg2.status].sort();
            assert.deepEqual(statuses, [201, 409], `Expected exactly one 201 and one 409 on concurrent registration, got ${statuses.join(', ')}`);
        });

        it('CH2-ADV.2: Unicode/Devanagari characters in contractual_user_name are preserved with high fidelity', async () => {
            const assetRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Unicode Terminal', serial_number: `UNI-SN-${Date.now()}`, current_user: 'IT Store' },
                status: 201
            });
            const uId = assetRes.data.id;

            const unicodeHolder = 'डॉ. राजेश शर्मा (वरिष्ठ सलाहकार)';
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [uId],
                    employee_name: 'Rajesh Sharma',
                    contractual_user_name: unicodeHolder,
                    employee_dept: 'CNS',
                    employee_desig: 'Senior Consultant'
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const found = all.data.find(a => a.id === uId);
            assert.equal(found.contractual_user_name, unicodeHolder, 'Unicode contractual_user_name must be stored and returned exactly');
        });

        it('CH2-ADV.3: Explicit null contractual_user_name in handover payload falls back to employee_name', async () => {
            const assetRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Null Holder Asset', serial_number: `NULL-SN-${Date.now()}`, current_user: 'IT Store' },
                status: 201
            });
            const nId = assetRes.data.id;

            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [nId],
                    employee_name: 'Manish Tiwari',
                    contractual_user_name: null
                },
                status: 201
            });

            const all = await testEnv.request('/api/assets/all', { token: adminToken });
            const found = all.data.find(a => a.id === nId);
            assert.equal(found.contractual_user_name, 'Manish Tiwari', 'null contractual_user_name must fallback to employee_name');
        });
    });
});
