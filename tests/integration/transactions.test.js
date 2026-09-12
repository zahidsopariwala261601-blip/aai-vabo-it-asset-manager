const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { startTestServer } = require('../helpers/testServer');

describe('Integration Tests: Transactions, Movement & Audit Trail (transactions.test.js)', () => {
    let testEnv;
    let adminToken;
    let userToken;
    let asset1Id;
    let asset2Id;

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-trans-test-',
            adminUser: { username: 'audit_admin', password: 'AdminPassword123!', role: 'admin' }
        });
        adminToken = testEnv.adminToken;

        // Create a regular user for RBAC tests
        await testEnv.request('/api/auth/register', {
            method: 'POST',
            body: { username: 'regular_operator', password: 'UserPassword123!' }
        });
        const userLogin = await testEnv.request('/api/auth/login', {
            method: 'POST',
            body: { username: 'regular_operator', password: 'UserPassword123!' }
        });
        userToken = userLogin.data.token;

        // Register 2 assets for testing handover / takeover
        const a1 = await testEnv.request('/api/assets', {
            token: adminToken,
            method: 'POST',
            body: { name: 'Workstation PC', serial_number: 'SN-TRANS-PC-01', current_user: 'IT Store' }
        });
        asset1Id = a1.data.id;

        const a2 = await testEnv.request('/api/assets', {
            token: adminToken,
            method: 'POST',
            body: { name: '24-inch Monitor', serial_number: 'SN-TRANS-MON-01', current_user: 'IT Store' }
        });
        asset2Id = a2.data.id;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    describe('Tier 1: Handover & Takeover Workflows', () => {
        let handoverRefNo;
        let handoverTransId;

        it('T1.31: Handover issues assets to employee and updates hardware network info', async () => {
            handoverRefNo = `AAI/VABO/IT/HANDOVER/2026/TST001`;
            const payload = {
                type: 'handover',
                asset_ids: [asset1Id, asset2Id],
                asset_names: 'Workstation PC, 24-inch Monitor',
                ref_no: handoverRefNo,
                date: '2026-09-12',
                employee_name: 'Kavita Patel',
                employee_desig: 'Assistant Manager',
                employee_dept: 'CNS',
                issuer_name: 'Store Officer',
                new_ip_address: '172.29.85.101',
                new_hostname: 'VABO-CNS-AM02',
                remark: 'Issued for terminal duty'
            };

            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: payload,
                status: 201
            });

            assert.ok(res.data.id);
            handoverTransId = res.data.id;
            assert.equal(res.data.message, 'Transaction recorded & assets updated');

            // Verify both assets are now 'Assigned' to Kavita Patel with IP and hostname
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const p1 = allAssets.data.find(a => a.id === asset1Id);
            const p2 = allAssets.data.find(a => a.id === asset2Id);

            assert.equal(p1.status, 'Assigned');
            assert.equal(p1.current_user, 'Kavita Patel');
            assert.equal(p1.assigned_dept, 'CNS');
            assert.equal(p1.assigned_desig, 'Assistant Manager');
            assert.equal(p1.ip_address, '172.29.85.101');
            assert.equal(p1.hostname, 'VABO-CNS-AM02');

            assert.equal(p2.status, 'Assigned');
            assert.equal(p2.current_user, 'Kavita Patel');
        });

        it('T1.32: Transaction audit log correctly records handover movement', async () => {
            const res = await testEnv.request('/api/transactions', { token: adminToken, status: 200 });
            assert.ok(res.data.data.length >= 1);
            const entry = res.data.data.find(t => t.id === handoverTransId);
            assert.ok(entry);
            assert.equal(entry.type, 'handover');
            assert.equal(entry.employee_name, 'Kavita Patel');
            assert.equal(entry.ref_no, handoverRefNo);
        });

        it('T1.33: Asset-specific trail retrieves the movement history', async () => {
            const res = await testEnv.request(`/api/transactions/asset/${asset1Id}`, {
                token: adminToken,
                status: 200
            });
            assert.ok(res.data.length >= 1);
            assert.equal(res.data[0].employee_name, 'Kavita Patel');
        });

        it('T1.34: Employee-specific trail retrieves the employee history', async () => {
            const res = await testEnv.request(`/api/transactions/employee/Kavita%20Patel`, {
                token: adminToken,
                status: 200
            });
            assert.ok(res.data.length >= 1);
            assert.equal(res.data[0].ref_no, handoverRefNo);
        });

        it('T1.35: Takeover returns assets to IT Store and clears network bindings', async () => {
            const takeoverRef = `AAI/VABO/IT/TAKEOVER/2026/TST002`;
            const payload = {
                type: 'takeover',
                asset_ids: [asset1Id, asset2Id],
                asset_names: 'Workstation PC, 24-inch Monitor',
                ref_no: takeoverRef,
                date: '2026-09-12',
                employee_name: 'Kavita Patel',
                employee_desig: 'Assistant Manager',
                employee_dept: 'CNS',
                issuer_name: 'Store Officer',
                remark: 'Returned upon transfer'
            };

            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: payload,
                status: 201
            });

            assert.ok(res.data.id);

            // Verify assets are reset to In Stock, IT Store, empty IP and hostname
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const p1 = allAssets.data.find(a => a.id === asset1Id);
            const p2 = allAssets.data.find(a => a.id === asset2Id);

            assert.equal(p1.status, 'In Stock');
            assert.equal(p1.current_user, 'IT Store');
            assert.equal(p1.ip_address, '');
            assert.equal(p1.hostname, '');
            assert.equal(p1.assigned_dept, '');

            assert.equal(p2.status, 'In Stock');
            assert.equal(p2.current_user, 'IT Store');
        });
    });

    describe('Tier 2: Transaction Validation Boundaries', () => {
        it('T2.18: Transaction creation rejects invalid type or empty asset array', async () => {
            const invalidType = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: { type: 'borrow', asset_ids: [asset1Id], employee_name: 'Test' },
                status: 400
            });
            assert.ok(invalidType.data.details.some(d => d.includes('handover" or "takeover')));

            const emptyAssets = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: { type: 'handover', asset_ids: [], employee_name: 'Test' },
                status: 400
            });
            assert.ok(emptyAssets.data.details.some(d => d.includes('At least one asset')));
        });

        it('T2.19: Transaction creation rejects missing employee name', async () => {
            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: { type: 'handover', asset_ids: [asset1Id], employee_name: '' },
                status: 400
            });
            assert.ok(res.data.details.some(d => d.includes('Employee name is required')));
        });
    });

    describe('Tier 1 & 2: Admin Audit Log Edit & Diff Tracking', () => {
        let editTransId;

        before(async () => {
            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [asset1Id],
                    employee_name: 'Suman Roy',
                    employee_desig: 'Junior Executive',
                    employee_dept: 'ATM',
                    ref_no: 'AAI/REF/EDIT/01'
                }
            });
            editTransId = res.data.id;
        });

        it('T1.36: Non-admin is blocked from editing audit logs (403)', async () => {
            await testEnv.request(`/api/transactions/${editTransId}`, {
                token: userToken,
                method: 'PUT',
                body: { employee_desig: 'Manager' },
                status: 403
            });
        });

        it('T1.37: Admin edits audit record fields with JSON diff recorded in edit_history', async () => {
            const res = await testEnv.request(`/api/transactions/${editTransId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    employee_desig: 'Senior Executive',
                    remark: 'Corrected designation spelling'
                },
                status: 200
            });

            assert.equal(res.data.message, 'Audit record updated successfully');
            assert.equal(res.data.change_count, 2);
            assert.equal(res.data.changes.employee_desig.old, 'Junior Executive');
            assert.equal(res.data.changes.employee_desig.new, 'Senior Executive');

            // Verify edit_history stored in database
            const transRes = await testEnv.request('/api/transactions', { token: adminToken });
            const record = transRes.data.data.find(t => t.id === editTransId);
            assert.ok(record);
            assert.equal(record.last_edited_by, 'audit_admin');
            const history = JSON.parse(record.edit_history);
            assert.equal(history.length, 1);
            assert.equal(history[0].edited_by, 'audit_admin');
            assert.equal(history[0].changes.employee_desig.new, 'Senior Executive');
        });

        it('T2.20: Admin audit edit with no changed fields returns 400', async () => {
            const res = await testEnv.request(`/api/transactions/${editTransId}`, {
                token: adminToken,
                method: 'PUT',
                body: { employee_desig: 'Senior Executive' }, // identical to current value
                status: 400
            });
            assert.equal(res.data.error, 'No changes detected');
        });
    });

    describe('Tier 1 & 2: Soft Delete & Protection Safeguards', () => {
        let normalTransId;
        let protectedTransId;

        before(async () => {
            const t1 = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: { type: 'handover', asset_ids: [asset1Id], employee_name: 'Delete Target', ref_no: 'REF-DEL-1' }
            });
            normalTransId = t1.data.id;

            const t2 = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: { type: 'handover', asset_ids: [asset2Id], employee_name: 'Protected Target', ref_no: 'REF-PROT-1' }
            });
            protectedTransId = t2.data.id;

            // Set is_protected = 1 on t2 via raw sqlite query in child DB
            const sqlite3 = require('sqlite3');
            const db = new sqlite3.Database(testEnv.databasePath);
            await new Promise(r => db.run(`UPDATE transactions SET is_protected = 1 WHERE id = ?`, [protectedTransId], r));
            await new Promise(r => db.close(r));
        });

        it('T1.38: Regular user cannot soft-delete audit transactions (403)', async () => {
            await testEnv.request(`/api/transactions/${normalTransId}`, {
                token: userToken,
                method: 'DELETE',
                body: { reason: 'Unauthorized cleanup' },
                status: 403
            });
        });

        it('T1.39: Admin soft-deletes regular audit record and it is hidden from default view', async () => {
            const res = await testEnv.request(`/api/transactions/${normalTransId}`, {
                token: adminToken,
                method: 'DELETE',
                body: { reason: 'Duplicate test entry' },
                status: 200
            });
            assert.equal(res.data.deleted_by, 'audit_admin');

            // Default list (show_deleted=0) must NOT contain the record
            const defaultList = await testEnv.request('/api/transactions', { token: adminToken });
            assert.equal(defaultList.data.data.some(t => t.id === normalTransId), false);

            // With show_deleted=1, the record appears
            const deletedList = await testEnv.request('/api/transactions?show_deleted=1', { token: adminToken });
            const found = deletedList.data.data.find(t => t.id === normalTransId);
            assert.ok(found);
            assert.equal(found.is_deleted, 1);
            assert.equal(found.delete_reason, 'Duplicate test entry');
        });

        it('T2.21: Deleting protected record without override is blocked (403)', async () => {
            const res = await testEnv.request(`/api/transactions/${protectedTransId}`, {
                token: adminToken,
                method: 'DELETE',
                body: { reason: 'Attempted delete' },
                status: 403
            });
            assert.equal(res.data.error, 'PROTECTED RECORD');
        });

        it('T2.22: Deleting protected record with override_protected succeeds', async () => {
            const res = await testEnv.request(`/api/transactions/${protectedTransId}`, {
                token: adminToken,
                method: 'DELETE',
                body: { reason: 'Emergency security purge', override_protected: true },
                status: 200
            });
            assert.ok(res.data.affected_id);
        });
    });

    describe('Tier 1 & 2: Print Security Telemetry Logging', () => {
        it('T1.40: Log print action on voucher print', async () => {
            const res = await testEnv.request('/api/transactions/print-logs', {
                token: adminToken,
                method: 'POST',
                body: {
                    action_type: 'Print',
                    doc_type: 'Handover Receipt',
                    system_ip: '172.29.80.50',
                    system_hostname: 'VABO-STORE-01',
                    ref_no: 'AAI/VABO/IT/HANDOVER/2026/PRINT01'
                },
                status: 201
            });
            assert.equal(res.data.message, 'Print action logged');
        });

        it('T1.41: Log reprint action on historical reprint', async () => {
            const res = await testEnv.request('/api/transactions/print-logs', {
                token: adminToken,
                method: 'POST',
                body: {
                    action_type: 'Reprint',
                    doc_type: 'Handover Receipt',
                    system_ip: '172.29.80.50',
                    system_hostname: 'VABO-STORE-01',
                    ref_no: 'AAI/VABO/IT/HANDOVER/2026/PRINT01'
                },
                status: 201
            });
            assert.equal(res.data.message, 'Print action logged');
        });

        it('T1.42: Query print logs returns ordered telemetry records', async () => {
            const res = await testEnv.request('/api/transactions/print-logs', {
                token: adminToken,
                status: 200
            });
            assert.ok(Array.isArray(res.data));
            assert.ok(res.data.length >= 2);
            assert.equal(res.data[0].printed_by, 'audit_admin');
            assert.equal(res.data[0].system_ip, '172.29.80.50');
            assert.equal(res.data[0].system_hostname, 'VABO-STORE-01');
        });
    });
});
