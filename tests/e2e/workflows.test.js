const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');

// Load client parseCSV from Public/js/utils.js
const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../Public/js/utils.js'), 'utf8');
const vmContext = {
    console, Date, parseInt, isNaN, Object, RegExp, String, Array, Set, Math,
    document: null,
    window: { matchMedia: () => ({ matches: false }) }
};
vm.createContext(vmContext);
vm.runInContext(utilsCode, vmContext);
const { parseCSV } = vmContext;

describe('Tier 4: Enterprise Real-World Airport IT Workflows (workflows.test.js)', () => {
    let testEnv;
    let adminToken;

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-e2e-workflow-',
            adminUser: { username: 'vabo_director', password: 'AirportDirector2026!', role: 'admin' }
        });
        adminToken = testEnv.adminToken;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    describe('Scenario S1: New Terminal Staff Onboarding & IT Hardware Provisioning', () => {
        let employeeId;
        let createdAssetIds = [];
        let handoverRefNo;

        it('Step 1: Admin registers new employee in Staff Directory', async () => {
            const empRes = await testEnv.request('/api/employees', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Arun Joshi',
                    designation: 'Assistant Manager',
                    department: 'CNS'
                },
                status: 201
            });
            assert.ok(empRes.data.id);
            employeeId = empRes.data.id;

            const allEmps = await testEnv.request('/api/employees', { token: adminToken });
            assert.ok(allEmps.data.some(e => e.id === employeeId && e.name === 'Arun Joshi'));
        });

        it('Step 2: Launches Multi-Asset Wizard to bundle Desktop PC, Monitor and UPS', async () => {
            const wizardRes = await testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Arun Joshi', designation: 'Assistant Manager', department: 'CNS' },
                    assets: [
                        { name: 'Desktop PC', serial_number: 'SN-AJ-PC-01', make: 'HP', model: 'ProDesk 600' },
                        { name: 'Monitor', serial_number: 'SN-AJ-MON-01', make: 'Dell', model: 'E2216H' },
                        { name: 'UPS', serial_number: 'SN-AJ-UPS-01', make: 'APC', kva: '1KVA' }
                    ],
                    ip_address: '172.29.85.110',
                    hostname: 'VABO-CNS-AM01'
                },
                status: 201
            });

            assert.equal(wizardRes.data.asset_ids.length, 3);
            createdAssetIds = wizardRes.data.asset_ids;

            // Verify assets are bound to Arun Joshi with IP and Hostname
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const userAssets = allAssets.data.filter(a => createdAssetIds.includes(a.id));
            assert.equal(userAssets.length, 3);
            userAssets.forEach(a => {
                assert.equal(a.current_user, 'Arun Joshi');
                assert.equal(a.ip_address, '172.29.85.110');
                assert.equal(a.hostname, 'VABO-CNS-AM01');
                assert.equal(a.status, 'Assigned');
            });
        });

        it('Step 3: Verifies operations dashboard metrics reflect newly issued hardware', async () => {
            const stats = await testEnv.request('/api/assets/stats', { token: adminToken });
            assert.ok(stats.data.total >= 3);
            assert.ok(stats.data.assigned >= 3);
            assert.ok('Desktop PC' in stats.data.categories);
        });

        it('Step 4: Generates official voucher print log with workstation telemetry', async () => {
            handoverRefNo = `AAI/VABO/IT/HANDOVER/2026/S1AJ`;
            const printRes = await testEnv.request('/api/transactions/print-logs', {
                token: adminToken,
                method: 'POST',
                body: {
                    action_type: 'Print',
                    doc_type: 'Official Handover Voucher',
                    system_ip: '172.29.80.22',
                    system_hostname: 'VABO-ADMIN-DESK',
                    ref_no: handoverRefNo
                },
                status: 201
            });
            assert.equal(printRes.data.message, 'Print action logged');

            const printAudit = await testEnv.request('/api/transactions/print-logs', { token: adminToken });
            const logEntry = printAudit.data.find(p => p.ref_no === handoverRefNo);
            assert.ok(logEntry);
            assert.equal(logEntry.printed_by, 'vabo_director');
            assert.equal(logEntry.system_ip, '172.29.80.22');
        });
    });

    describe('Scenario S2: Shift Transfer & IT Hardware Return (Takeover Flow)', () => {
        let returnAssetIds = [];

        before(async () => {
            // Provision 2 laptops to a security officer
            const a1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Laptop', serial_number: 'SN-SEC-LAP-01',
                    current_user: 'Vikram Security', assigned_dept: 'Security',
                    ip_address: '172.29.90.15', hostname: 'VABO-SEC-L01'
                }
            });
            const a2 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Scanner', serial_number: 'SN-SEC-SCN-01',
                    current_user: 'Vikram Security', assigned_dept: 'Security',
                    ip_address: '172.29.90.16', hostname: 'VABO-SEC-S01'
                }
            });
            returnAssetIds = [a1.data.id, a2.data.id];
        });

        it('Step 1: Executes Takeover of items back to IT Store', async () => {
            const takeoverRef = `AAI/VABO/IT/TAKEOVER/2026/S2SEC`;
            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: returnAssetIds,
                    asset_names: 'Laptop, Scanner',
                    ref_no: takeoverRef,
                    date: '2026-09-12',
                    employee_name: 'Vikram Security',
                    issuer_name: 'Store Supervisor',
                    remark: 'Normal wear, shift completion return'
                },
                status: 201
            });
            assert.ok(res.data.id);

            // Step 2: Verify network IP and hostname wiped clean, status reset to In Stock
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const returned = allAssets.data.filter(a => returnAssetIds.includes(a.id));
            assert.equal(returned.length, 2);
            returned.forEach(a => {
                assert.equal(a.current_user, 'IT Store');
                assert.equal(a.status, 'In Stock');
                assert.equal(a.ip_address, '');
                assert.equal(a.hostname, '');
            });
        });

        it('Step 3: Logs takeover receipt printing with supervisor workstation context', async () => {
            const printRes = await testEnv.request('/api/transactions/print-logs', {
                token: adminToken,
                method: 'POST',
                body: {
                    action_type: 'Print',
                    doc_type: 'Takeover Return Slip',
                    system_ip: '172.29.80.33',
                    system_hostname: 'VABO-STORE-TERMINAL',
                    ref_no: 'AAI/VABO/IT/TAKEOVER/2026/S2SEC'
                },
                status: 201
            });
            assert.ok(printRes.data.id);
        });
    });

    describe('Scenario S3: Annual Airport IT Master Inventory Audit & Reconciliation', () => {
        it('Step 1: Exports complete master spreadsheet in 18-column CSV format with BOM', async () => {
            const exportRes = await testEnv.request('/api/assets/export', { token: adminToken });
            assert.equal(exportRes.status, 200);

            // Verify raw BOM
            const rawRes = await fetch(testEnv.base + '/api/assets/export', { headers: { Authorization: `Bearer ${adminToken}` } });
            const bytes = new Uint8Array(await rawRes.arrayBuffer());
            assert.equal(bytes[0], 0xEF);
            assert.equal(bytes[1], 0xBB);
            assert.equal(bytes[2], 0xBF);

            // Step 2: Parse spreadsheet using client parser
            const parsed = parseCSV(exportRes.text);
            assert.ok(parsed.length >= 5, 'Should have multiple inventory rows');

            // Step 3: Auditor reconciles by updating existing assets and adding 2 new assets
            parsed[0].assigned_dept = 'Civil Aviation Management';
            parsed[0].remark = 'Audited 2026 - Verified in Rack 3';

            parsed.push({
                name: 'Server',
                serial_number: 'SN-AUDIT-SRV-999',
                asset_tag: 'VABO-IT/CNS-SRV-01',
                make: 'Dell',
                model: 'PowerEdge R750',
                current_user: 'IT Store',
                assigned_dept: 'IT / CNS',
                year_of_purchase: 2025
            });

            // Step 4: Re-import updated master spreadsheet via bulk UPSERT
            const bulkRes = await testEnv.request('/api/assets/bulk', {
                token: adminToken,
                method: 'POST',
                body: { assets: parsed },
                status: 200
            });
            assert.equal(bulkRes.data.imported, parsed.length);

            // Step 5: Verify new server exists and first asset department was updated
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken });
            const srv = allAssets.data.find(a => a.serial_number === 'SN-AUDIT-SRV-999');
            assert.ok(srv);
            assert.equal(srv.model, 'PowerEdge R750');

            const updatedAsset = allAssets.data.find(a => a.serial_number === parsed[0].serial_number);
            assert.equal(updatedAsset.assigned_dept, 'Civil Aviation Management');
        });
    });

    describe('Scenario S4: Security Incident Forensics & Audit Trail Reconstruction', () => {
        let forensicAssetId;
        let forensicTransId;
        const targetIP = '172.29.84.203';

        before(async () => {
            // Provision asset with specific target IP
            const assetRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Desktop PC', serial_number: 'SN-FORENSIC-01',
                    current_user: 'Ramesh Suspicious', assigned_dept: 'Cargo',
                    ip_address: targetIP, hostname: 'VABO-CARGO-PC09'
                }
            });
            forensicAssetId = assetRes.data.id;

            // Record handover voucher
            const tRes = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [forensicAssetId],
                    employee_name: 'Ramesh Suspicious',
                    ref_no: 'AAI/VABO/IT/HANDOVER/2026/SEC-INCIDENT-01',
                    new_ip_address: targetIP,
                    new_hostname: 'VABO-CARGO-PC09'
                }
            });
            forensicTransId = tRes.data.id;
        });

        it('Step 1: Locates hardware and employee assigned to anomalous IP', async () => {
            const allAssets = await testEnv.request('/api/assets/all', { token: adminToken, status: 200 });
            const matched = allAssets.data.find(a => a.ip_address === targetIP);
            assert.ok(matched, 'Should locate asset with anomalous IP');
            assert.equal(matched.id, forensicAssetId);
            assert.equal(matched.current_user, 'Ramesh Suspicious');
        });

        it('Step 2: Reconstructs asset lifecycle movement trail', async () => {
            const trailRes = await testEnv.request(`/api/transactions/asset/${forensicAssetId}`, {
                token: adminToken,
                status: 200
            });
            assert.ok(trailRes.data.length >= 1);
            assert.equal(trailRes.data[0].id, forensicTransId);
            assert.equal(trailRes.data[0].employee_name, 'Ramesh Suspicious');
        });

        it('Step 3: Locks transaction evidence with is_protected = 1 to prevent deletion', async () => {
            // Set is_protected = 1 via direct sqlite db
            const db = new sqlite3.Database(testEnv.databasePath);
            await new Promise(r => db.run(`UPDATE transactions SET is_protected = 1 WHERE id = ?`, [forensicTransId], r));
            await new Promise(r => db.close(r));

            // Verify deletion attempt without override is rejected (403)
            const delAttempt = await testEnv.request(`/api/transactions/${forensicTransId}`, {
                token: adminToken,
                method: 'DELETE',
                body: { reason: 'Accidental cleanup' },
                status: 403
            });
            assert.equal(delAttempt.data.error, 'PROTECTED RECORD');
        });
    });

    describe('Scenario S5: RBAC Boundary & User Account Lifecycle', () => {
        let operatorToken;
        let operatorId;

        it('Step 1: Unauthenticated request to /api/admin/users is rejected (401)', async () => {
            await testEnv.request('/api/admin/users', { status: 401 });
        });

        it('Step 2: Admin creates new operator account', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: adminToken,
                method: 'POST',
                body: { username: 'terminal_operator_1', password: 'TempPassword123!', role: 'user' },
                status: 201
            });
            assert.equal(res.data.username, 'terminal_operator_1');
            assert.equal(res.data.role, 'user');
            operatorId = res.data.id;
        });

        it('Step 3: Operator logs in and receives restricted user access (403 on admin routes)', async () => {
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'terminal_operator_1', password: 'TempPassword123!' },
                status: 200
            });
            assert.ok(loginRes.data.token);
            operatorToken = loginRes.data.token;

            // Operator can read assets
            await testEnv.request('/api/assets', { token: operatorToken, status: 200 });

            // Operator is blocked from user management (403)
            await testEnv.request('/api/admin/users', { token: operatorToken, status: 403 });
            await testEnv.request(`/api/admin/users/${operatorId}/password`, {
                token: operatorToken, method: 'PUT', body: { password: 'hack' }, status: 403
            });
        });

        it('Step 4: Admin resets operator password and operator logs in with new password', async () => {
            await testEnv.request(`/api/admin/users/${operatorId}/password`, {
                token: adminToken,
                method: 'PUT',
                body: { password: 'PermanentPassword456!' },
                status: 200
            });

            // Old password fails
            await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'terminal_operator_1', password: 'TempPassword123!' },
                status: 401
            });

            // New password succeeds
            const newLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'terminal_operator_1', password: 'PermanentPassword456!' },
                status: 200
            });
            assert.ok(newLogin.data.token);
        });

        it('Step 5: Admin deletes operator account and session is permanently revoked', async () => {
            await testEnv.request(`/api/admin/users/${operatorId}`, {
                token: adminToken,
                method: 'DELETE',
                status: 200
            });

            // Login fails
            await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'terminal_operator_1', password: 'PermanentPassword456!' },
                status: 401
            });
        });
    });
});
