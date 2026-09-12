const assert = require('node:assert/strict');
const { test, describe, it, before, after } = require('node:test');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');

describe('Worker M1 Integrity & Boundary Tests', () => {
    let testEnv;
    let adminToken;
    let userToken;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'm1-test-' });
        adminToken = testEnv.adminToken;

        // Register a regular user
        const regRes = await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: { username: 'm1_regular_user', password: 'm1-password-123' },
            status: 201
        });
        userToken = regRes.data.token;
    });

    after(async () => {
        if (testEnv) await testEnv.close();
    });

    it('M1.1: SQLite indices exist in schema', async () => {
        const db = new sqlite3.Database(testEnv.databasePath);
        const all = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        try {
            const indices = await all(`SELECT name FROM sqlite_master WHERE type='index'`);
            const indexNames = indices.map(i => i.name);

            assert.ok(indexNames.includes('idx_print_logs_tx'), 'idx_print_logs_tx must exist');
            assert.ok(indexNames.includes('idx_print_logs_ts'), 'idx_print_logs_ts must exist');
            assert.ok(indexNames.includes('idx_assets_tag'), 'idx_assets_tag must exist');
        } finally {
            await new Promise(resolve => db.close(resolve));
        }
    });

    it('M1.2: Registration returns 409 Conflict when username already exists', async () => {
        const dupRes = await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: { username: 'm1_regular_user', password: 'another-password' },
            status: 409
        });
        assert.equal(dupRes.data.error, 'Username already exists');
    });

    it('M1.3: Multi-asset handover updates contractual_user_name and all holders', async () => {
        // Create 2 test assets
        const a1 = await testEnv.request('/api/assets', {
            token: adminToken,
            method: 'POST',
            body: { name: 'Workstation', serial_number: 'M1-SN-HO-01', current_user: 'IT Store' },
            status: 201
        });
        const a2 = await testEnv.request('/api/assets', {
            token: adminToken,
            method: 'POST',
            body: { name: 'Workstation', serial_number: 'M1-SN-HO-02', current_user: 'IT Store' },
            status: 201
        });

        const asset1Id = a1.data.id;
        const asset2Id = a2.data.id;

        // Perform handover specifying explicit contractual_user_name
        const handoverRes = await testEnv.request('/api/transactions', {
            token: adminToken,
            method: 'POST',
            body: {
                type: 'handover',
                asset_ids: [asset1Id, asset2Id],
                employee_name: 'Rajesh Sharma',
                contractual_user_name: 'Rajesh S (Contractor)',
                employee_dept: 'OPS',
                employee_desig: 'Consultant',
                new_ip_address: '192.168.10.50',
                new_hostname: 'OPS-CONS-01'
            },
            status: 201
        });

        assert.ok(handoverRes.data.id);

        // Verify both assets have synchronized contractual_user_name
        const assetsRes = await testEnv.request('/api/assets/all', { token: adminToken });
        const ast1 = assetsRes.data.find(a => a.id === asset1Id);
        const ast2 = assetsRes.data.find(a => a.id === asset2Id);

        assert.equal(ast1.status, 'Assigned');
        assert.equal(ast1.current_user, 'Rajesh Sharma');
        assert.equal(ast1.contractual_user_name, 'Rajesh S (Contractor)');
        assert.equal(ast1.ip_address, '192.168.10.50');
        assert.equal(ast1.hostname, 'OPS-CONS-01');

        assert.equal(ast2.status, 'Assigned');
        assert.equal(ast2.contractual_user_name, 'Rajesh S (Contractor)');

        // Now test takeover clears contractual_user_name back to empty
        await testEnv.request('/api/transactions', {
            token: adminToken,
            method: 'POST',
            body: {
                type: 'takeover',
                asset_ids: [asset1Id, asset2Id],
                employee_name: 'Rajesh Sharma'
            },
            status: 201
        });

        const afterTakeover = await testEnv.request('/api/assets/all', { token: adminToken });
        const ast1After = afterTakeover.data.find(a => a.id === asset1Id);
        const ast2After = afterTakeover.data.find(a => a.id === asset2Id);

        assert.equal(ast1After.status, 'In Stock');
        assert.equal(ast1After.current_user, 'IT Store');
        assert.equal(ast1After.contractual_user_name, '');
        assert.equal(ast1After.ip_address, '');
        assert.equal(ast1After.hostname, '');

        assert.equal(ast2After.status, 'In Stock');
        assert.equal(ast2After.contractual_user_name, '');
    });

    it('M1.4: Wizard sequential, race-free tag generation avoids duplicate tags', async () => {
        const wizardRes = await testEnv.request('/api/assets/wizard', {
            token: adminToken,
            method: 'POST',
            body: {
                employee: {
                    name: 'Homi Bhabha',
                    designation: 'Director',
                    department: 'RND'
                },
                assets: [
                    { name: 'Server', serial_number: 'WZ-SRV-01' },
                    { name: 'Server', serial_number: 'WZ-SRV-02' },
                    { name: 'Server', serial_number: 'WZ-SRV-03' }
                ],
                ip_address: '10.0.1.1',
                hostname: 'RND-SRV-NODE'
            },
            status: 201
        });

        assert.equal(wizardRes.data.asset_ids.length, 3);

        const assetsRes = await testEnv.request('/api/assets/all', { token: adminToken });
        const createdAssets = wizardRes.data.asset_ids.map(id => assetsRes.data.find(a => a.id === id));

        const tags = createdAssets.map(a => a.asset_tag);
        const uniqueTags = new Set(tags);
        assert.equal(uniqueTags.size, 3, `Expected 3 unique tags, got: ${tags.join(', ')}`);

        // Check sequence numbers are sequential
        const seqs = tags.map(t => {
            const m = t.match(/-(\d+)$/);
            return m ? parseInt(m[1], 10) : -1;
        });
        assert.equal(seqs[1], seqs[0] + 1);
        assert.equal(seqs[2], seqs[1] + 1);
    });

    it('M1.5: Asset deletion requires admin role and records audit log', async () => {
        // Create an asset
        const created = await testEnv.request('/api/assets', {
            token: adminToken,
            method: 'POST',
            body: { name: 'Old Monitor', serial_number: 'DEL-TEST-001', current_user: 'IT Store' },
            status: 201
        });
        const delAssetId = created.data.id;

        // Regular user attempt must be blocked (403)
        await testEnv.request(`/api/assets/${delAssetId}`, {
            token: userToken,
            method: 'DELETE',
            status: 403
        });

        // Non-existent ID returns 404
        await testEnv.request(`/api/assets/999999`, {
            token: adminToken,
            method: 'DELETE',
            status: 404
        });

        // Admin deletion succeeds
        const delRes = await testEnv.request(`/api/assets/${delAssetId}`, {
            token: adminToken,
            method: 'DELETE',
            status: 200
        });
        assert.equal(delRes.data.message, 'Asset deleted');

        // Asset is no longer in database
        const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
        assert.ok(!allAssets.data.some(a => a.id === delAssetId));

        // Audit log exists in transactions
        const txList = await testEnv.request('/api/transactions?show_deleted=1', { token: adminToken });
        const delTx = txList.data.data.find(t => t.type === 'deletion' && t.asset_ids.includes(String(delAssetId)));
        assert.ok(delTx, 'Audit record for deletion must exist in transactions');
        assert.equal(delTx.issuer_name, 'test-admin');
    });

    it('M1.6: Bulk upsert processes records in transaction', async () => {
        const bulkRes = await testEnv.request('/api/assets/bulk', {
            token: adminToken,
            method: 'POST',
            body: {
                assets: [
                    { name: 'Bulk Laptop 1', serial_number: 'BULK-M1-01', current_user: 'IT Store' },
                    { name: 'Bulk Laptop 2', serial_number: 'BULK-M1-02', current_user: 'IT Store' }
                ]
            },
            status: 200
        });
        assert.equal(bulkRes.data.imported, 2);

        const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
        assert.ok(allAssets.data.some(a => a.serial_number === 'BULK-M1-01'));
        assert.ok(allAssets.data.some(a => a.serial_number === 'BULK-M1-02'));
    });
});
