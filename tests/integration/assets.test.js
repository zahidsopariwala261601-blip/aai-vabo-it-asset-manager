const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { startTestServer } = require('../helpers/testServer');

describe('Integration Tests: Assets Management & Wizard (assets.test.js)', () => {
    let testEnv;
    let token;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'aai-assets-test-' });
        token = testEnv.adminToken;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    describe('Tier 1: Asset Registration & Auto-Tagging', () => {
        it('T1.11: Register single asset with auto-generated tag VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Desktop PC',
                    serial_number: 'SN-AUTO-001',
                    assigned_dept: 'Communication',
                    current_user: 'IT Store'
                },
                status: 201
            });

            assert.ok(res.data.id);
            assert.equal(res.data.asset_tag, 'VABO-IT/CNS-COM-DES-01');
            assert.equal(res.data.message, 'Asset created');
        });

        it('T1.12: Sequential asset creation increments tag sequence zero-padded', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Desktop PC',
                    serial_number: 'SN-AUTO-002',
                    assigned_dept: 'Communication',
                    current_user: 'IT Store'
                },
                status: 201
            });

            assert.equal(res.data.asset_tag, 'VABO-IT/CNS-COM-DES-02');
        });

        it('T1.13: Fallback auto-tag generated when department and type are missing or generic', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'IT',
                    serial_number: 'SN-FALLBACK-001',
                    current_user: 'IT Store'
                },
                status: 201
            });

            assert.ok(res.data.asset_tag.startsWith('VABO-IT/CNS-GEN-IT-'));
        });

        it('T1.14: Custom asset tag is preserved if provided explicitly', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-CUSTOM-TAG-01',
                    asset_tag: 'CUSTOM-VABO-TAG-99',
                    current_user: 'IT Store'
                },
                status: 201
            });

            assert.equal(res.data.asset_tag, 'CUSTOM-VABO-TAG-99');
        });

        it('T1.15: Hardware accessory fields (charger, monitor, kva) are persisted', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-ACC-001',
                    charger_serial: 'CHG-9988',
                    make: 'Dell',
                    model: 'Latitude 5420',
                    kva: '65W',
                    year_of_purchase: 2023,
                    current_user: 'IT Store'
                },
                status: 201
            });

            const allAssets = await testEnv.request('/api/assets/all', { token });
            const saved = allAssets.data.find(a => a.id === res.data.id);
            assert.ok(saved);
            assert.equal(saved.charger_serial, 'CHG-9988');
            assert.equal(saved.make, 'Dell');
            assert.equal(saved.model, 'Latitude 5420');
            assert.equal(saved.year_of_purchase, 2023);
        });
    });

    describe('Tier 2: Asset Validation & Error Boundaries', () => {
        it('T2.11: Asset registration rejects missing name or missing serial_number', async () => {
            const missingName = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: { serial_number: 'SN-NO-NAME' },
                status: 400
            });
            assert.equal(missingName.data.error, 'Name and Serial Number are required');

            const missingSerial = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: { name: 'PC' },
                status: 400
            });
            assert.equal(missingSerial.data.error, 'Name and Serial Number are required');
        });

        it('T2.12: Duplicate serial number registration is rejected', async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: { name: 'Duplicate PC', serial_number: 'SN-AUTO-001', current_user: 'IT Store' }
            });
            assert.ok(res.status === 409 || res.status === 500, 'Duplicate serial should fail');
        });

        it('T2.13: Updating asset with non-existent ID returns 404', async () => {
            const res = await testEnv.request('/api/assets/999999', {
                token,
                method: 'PUT',
                body: { name: 'Non-existent', serial_number: 'SN-999999', current_user: 'IT Store' },
                status: 404
            });
            assert.equal(res.data.error, 'Asset not found');
        });

        it('T2.14: Deleting non-existent asset ID returns 404', async () => {
            const res = await testEnv.request('/api/assets/999999', {
                token,
                method: 'DELETE',
                status: 404
            });
            assert.equal(res.data.error, 'Asset not found');
        });
    });

    describe('Tier 1 & 2: Asset Lifecycle, Update & Inventory Querying', () => {
        let assetId;

        before(async () => {
            const res = await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Printer',
                    serial_number: 'SN-LIFECYCLE-01',
                    assigned_dept: 'Air Traffic Control',
                    current_user: 'IT Store'
                }
            });
            assetId = res.data.id;
        });

        it('T1.16: Status is "In Stock" when current_user is IT Store', async () => {
            const all = await testEnv.request('/api/assets/all', { token });
            const item = all.data.find(a => a.id === assetId);
            assert.equal(item.status, 'In Stock');
        });

        it('T1.17: Status updates to "Assigned" when current_user changes from IT Store', async () => {
            await testEnv.request(`/api/assets/${assetId}`, {
                token,
                method: 'PUT',
                body: {
                    name: 'Printer',
                    serial_number: 'SN-LIFECYCLE-01',
                    current_user: 'Suresh Raina',
                    assigned_dept: 'Air Traffic Control',
                    assigned_desig: 'DGM'
                },
                status: 200
            });

            const all = await testEnv.request('/api/assets/all', { token });
            const item = all.data.find(a => a.id === assetId);
            assert.equal(item.current_user, 'Suresh Raina');
            assert.equal(item.status, 'Assigned');
        });

        it('T1.18: Search and department filter locate matching assets', async () => {
            const searchRes = await testEnv.request('/api/assets?search=LIFECYCLE', { token, status: 200 });
            assert.ok(searchRes.data.length >= 1);
            assert.equal(searchRes.data[0].serial_number, 'SN-LIFECYCLE-01');

            const deptRes = await testEnv.request('/api/assets?dept=Air Traffic Control', { token, status: 200 });
            assert.ok(deptRes.data.some(a => a.id === assetId));
        });

        it('T1.19: Category filter limits results to specific asset type', async () => {
            const typeRes = await testEnv.request('/api/assets?type=Printer', { token, status: 200 });
            assert.ok(typeRes.data.length >= 1);
            assert.ok(typeRes.data.every(a => a.name === 'Printer'));
        });

        it('T1.20: Stats endpoint aggregates total, inStock, assigned, and categories', async () => {
            const stats = await testEnv.request('/api/assets/stats', { token, status: 200 });
            assert.ok(stats.data.total >= 5);
            assert.ok('inStock' in stats.data);
            assert.ok('assigned' in stats.data);
            assert.ok('Printer' in stats.data.categories);
        });

        it('T1.21: Asset can be deleted cleanly', async () => {
            const delRes = await testEnv.request(`/api/assets/${assetId}`, {
                token,
                method: 'DELETE',
                status: 200
            });
            assert.equal(delRes.data.message, 'Asset deleted');

            const all = await testEnv.request('/api/assets/all', { token });
            assert.equal(all.data.some(a => a.id === assetId), false);
        });
    });

    describe('Tier 1 & 2: Multi-Asset Wizard & Atomic Rollback', () => {
        it('T1.22: Wizard registers bundled assets and generates handover transaction', async () => {
            const payload = {
                employee: {
                    name: 'Vikram Sarabhai',
                    designation: 'General Manager',
                    department: 'CNS'
                },
                assets: [
                    { name: 'Desktop PC', serial_number: 'SN-WIZ-PC-01', make: 'HP', model: 'Elite' },
                    { name: 'Monitor', serial_number: 'SN-WIZ-MON-01', make: 'Dell', model: 'P2419H' },
                    { name: 'UPS', serial_number: 'SN-WIZ-UPS-01', kva: '1KVA' }
                ],
                ip_address: '172.29.85.15',
                hostname: 'VABO-CNS-GM01'
            };

            const res = await testEnv.request('/api/assets/wizard', {
                token,
                method: 'POST',
                body: payload,
                status: 201
            });

            assert.equal(res.data.asset_ids.length, 3);
            assert.ok(res.data.transaction_id);

            // Verify assets have sequential tags, correct holder, IP and hostname
            const allAssets = await testEnv.request('/api/assets/all', { token });
            const created = allAssets.data.filter(a => res.data.asset_ids.includes(a.id));
            assert.equal(created.length, 3);
            created.forEach(a => {
                assert.equal(a.current_user, 'Vikram Sarabhai');
                assert.equal(a.ip_address, '172.29.85.15');
                assert.equal(a.hostname, 'VABO-CNS-GM01');
                assert.equal(a.status, 'Assigned');
            });

            // Verify employee was added to employees table
            const empRes = await testEnv.request('/api/employees', { token });
            assert.ok(empRes.data.some(e => e.name === 'Vikram Sarabhai'));

            // Verify handover transaction was created
            const transRes = await testEnv.request('/api/transactions', { token });
            const trans = transRes.data.data.find(t => t.id === res.data.transaction_id);
            assert.ok(trans);
            assert.equal(trans.type, 'handover');
            assert.equal(trans.employee_name, 'Vikram Sarabhai');
        });

        it('T2.15: Wizard rejects duplicate serial numbers within input payload (400)', async () => {
            const payload = {
                employee: { name: 'Arun Test', designation: 'MGR', department: 'IT' },
                assets: [
                    { name: 'PC', serial_number: 'SN-DUP-INTERNAL' },
                    { name: 'Monitor', serial_number: 'SN-DUP-INTERNAL' }
                ]
            };

            const res = await testEnv.request('/api/assets/wizard', {
                token,
                method: 'POST',
                body: payload,
                status: 400
            });
            assert.equal(res.data.error, 'Duplicate serial numbers found in the wizard input');
        });

        it('T2.16: Wizard rejects payload colliding with existing database serial (409)', async () => {
            // Register an asset with known serial
            await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: { name: 'Pre-existing PC', serial_number: 'sn-wiz-precheck-01', current_user: 'IT Store' },
                status: 201
            });

            const payload = {
                employee: { name: 'Arun Test', designation: 'MGR', department: 'IT' },
                assets: [
                    { name: 'PC', serial_number: 'sn-brand-new-99' },
                    { name: 'Monitor', serial_number: 'sn-wiz-precheck-01' } // collides with existing DB serial
                ]
            };

            const res = await testEnv.request('/api/assets/wizard', {
                token,
                method: 'POST',
                body: payload,
                status: 409
            });
            assert.ok(res.data.error.includes('Serial number(s) already exist'));

            // Verify atomic rollback: sn-brand-new-99 must NOT have been inserted!
            const allAssets = await testEnv.request('/api/assets/all', { token });
            assert.equal(allAssets.data.some(a => a.serial_number === 'sn-brand-new-99'), false,
                'First asset must be rolled back on second asset collision');
        });

        it('T2.17: Wizard rejects empty asset array or missing employee', async () => {
            await testEnv.request('/api/assets/wizard', {
                token,
                method: 'POST',
                body: { employee: { name: 'Test' }, assets: [] },
                status: 400
            });

            await testEnv.request('/api/assets/wizard', {
                token,
                method: 'POST',
                body: { assets: [{ name: 'PC', serial_number: 'SN-1' }] },
                status: 400
            });
        });
    });
});
