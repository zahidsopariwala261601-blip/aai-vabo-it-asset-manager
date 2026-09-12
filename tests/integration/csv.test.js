const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { startTestServer } = require('../helpers/testServer');

// Load client parseCSV from Public/js/utils.js
const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../Public/js/utils.js'), 'utf8');
const context = {
    console, Date, parseInt, isNaN, Object, RegExp, String, Array, Set, Math,
    document: null,
    window: { matchMedia: () => ({ matches: false }) }
};
vm.createContext(context);
vm.runInContext(utilsCode, context);
const { parseCSV } = context;

const EXPECTED_HEADERS = [
    'ID', 'Asset_Tag', 'Asset Type', 'Serial', 'Charger_Serial',
    'Monitor_Make', 'Monitor_Serial', 'Keyboard_Make', 'Mouse_Make',
    'Make', 'Model', 'IP', 'Hostname', 'Holder', 'Physical_Asset_Holder',
    'Department', 'Designation', 'Year_of_Purchase'
];

describe('Integration Tests: CSV Operations (csv.test.js)', () => {
    let testEnv;
    let token;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'aai-csv-test-' });
        token = testEnv.adminToken;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    describe('Tier 1: 18-Field CSV Export & BOM Header', () => {
        it('T1.43: CSV Export returns UTF-8 BOM, text/csv Content-Type, and 18 headers in exact sequence', async () => {
            const res = await testEnv.request('/api/assets/export', { token });
            assert.equal(res.status, 200);

            // Check Content-Type
            const contentType = res.headers.get('content-type');
            assert.ok(contentType.includes('text/csv'));
            assert.ok(contentType.includes('charset=utf-8'));

            // Check UTF-8 BOM (\uFEFF -> bytes 0xEF, 0xBB, 0xBF)
            const rawRes = await fetch(testEnv.base + '/api/assets/export', { headers: { Authorization: `Bearer ${token}` } });
            const buffer = new Uint8Array(await rawRes.arrayBuffer());
            assert.equal(buffer[0], 0xEF, 'Byte 0 must be 0xEF');
            assert.equal(buffer[1], 0xBB, 'Byte 1 must be 0xBB');
            assert.equal(buffer[2], 0xBF, 'Byte 2 must be 0xBF');
            assert.equal(buffer[3], 0x49, 'Byte 3 must be "I" (0x49)');

            // Check headers line from text
            const text = res.text;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            assert.ok(lines.length >= 1, 'Should at least contain header row');

            const headerLine = lines[0];
            const headers = headerLine.split(',');
            assert.equal(headers.length, 18, `Expected 18 headers, got ${headers.length}: ${headerLine}`);
            assert.deepEqual(headers, EXPECTED_HEADERS, 'Headers must match 18 standard fields in exact sequence');
        });

        it('T1.44: CSV Export properly escapes quotes and commas within asset fields', async () => {
            // Insert asset with commas and quotes in specifications
            await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Desktop PC',
                    serial_number: 'SN-CSV-ESC-01',
                    make: 'Dell, Inc.',
                    model: 'OptiPlex "7090" Micro',
                    current_user: 'IT Store',
                    assigned_dept: 'CNS',
                    year_of_purchase: 2023
                },
                status: 201
            });

            const res = await testEnv.request('/api/assets/export', { token });
            const lines = res.text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
            const escapedRow = lines.find(l => l.includes('SN-CSV-ESC-01'));
            assert.ok(escapedRow, 'Export must contain the inserted asset');
            assert.ok(escapedRow.includes('"Dell, Inc."'), 'Commas must be enclosed in double quotes');
            assert.ok(escapedRow.includes('"OptiPlex ""7090"" Micro"'), 'Quotes must be escaped as double-quotes');
        });

        it('T1.45: CSV Export preserves dual-holder tracking (Holder vs Physical_Asset_Holder)', async () => {
            await testEnv.request('/api/assets', {
                token,
                method: 'POST',
                body: {
                    name: 'Laptop',
                    serial_number: 'SN-CSV-DUAL-01',
                    current_user: 'Sanjay Verma',
                    contractual_user_name: 'Agency Contractor Tech',
                    assigned_dept: 'Operations',
                    assigned_desig: 'JE'
                },
                status: 201
            });

            const res = await testEnv.request('/api/assets/export', { token });
            const lines = res.text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
            const dualRow = lines.find(l => l.includes('SN-CSV-DUAL-01'));
            assert.ok(dualRow);
            assert.ok(dualRow.includes('"Sanjay Verma"'), 'System holder must be exported');
            assert.ok(dualRow.includes('"Agency Contractor Tech"'), 'Physical holder must be exported');
        });
    });

    describe('Tier 1: Bulk CSV Import with UPSERT', () => {
        it('T1.46: Bulk import inserts multiple new asset records', async () => {
            const batch = [
                {
                    name: 'Laptop',
                    serial_number: 'SN-BULK-001',
                    asset_tag: 'VABO-IT/CNS-OPS-LAP-01',
                    make: 'Lenovo',
                    model: 'ThinkPad T14',
                    current_user: 'IT Store',
                    assigned_dept: 'Operations',
                    assigned_desig: 'MGR',
                    year_of_purchase: 2024
                },
                {
                    name: 'Printer',
                    serial_number: 'SN-BULK-002',
                    asset_tag: 'VABO-IT/CNS-OPS-PRI-01',
                    make: 'HP',
                    model: 'LaserJet Pro',
                    current_user: 'IT Store',
                    assigned_dept: 'Operations',
                    assigned_desig: '',
                    year_of_purchase: 2022
                }
            ];

            const res = await testEnv.request('/api/assets/bulk', {
                token,
                method: 'POST',
                body: { assets: batch },
                status: 200
            });

            assert.equal(res.data.imported, 2);

            const allAssets = await testEnv.request('/api/assets/all', { token });
            const item1 = allAssets.data.find(a => a.serial_number === 'SN-BULK-001');
            const item2 = allAssets.data.find(a => a.serial_number === 'SN-BULK-002');
            assert.ok(item1);
            assert.ok(item2);
            assert.equal(item1.model, 'ThinkPad T14');
            assert.equal(item2.model, 'LaserJet Pro');
        });

        it('T1.47: Bulk import with existing serial number executes UPSERT without duplicate errors', async () => {
            // Re-import SN-BULK-001 with updated specs and assigned holder
            const updateBatch = [
                {
                    name: 'Laptop',
                    serial_number: 'SN-BULK-001',
                    asset_tag: 'VABO-IT/CNS-OPS-LAP-01',
                    make: 'Lenovo',
                    model: 'ThinkPad T14 Gen 2 (Upgraded)',
                    current_user: 'Nitin Gadkari',
                    contractual_user_name: 'Nitin Personal Tech',
                    assigned_dept: 'VIP Operations',
                    assigned_desig: 'ED',
                    year_of_purchase: 2024
                }
            ];

            const res = await testEnv.request('/api/assets/bulk', {
                token,
                method: 'POST',
                body: { assets: updateBatch },
                status: 200
            });

            assert.equal(res.data.imported, 1);

            // Verify database was updated in place and total count did NOT duplicate
            const allAssets = await testEnv.request('/api/assets/all', { token });
            const matching = allAssets.data.filter(a => a.serial_number === 'SN-BULK-001');
            assert.equal(matching.length, 1, 'Serial number must remain unique; no duplicate row created');
            assert.equal(matching[0].model, 'ThinkPad T14 Gen 2 (Upgraded)');
            assert.equal(matching[0].current_user, 'Nitin Gadkari');
            assert.equal(matching[0].contractual_user_name, 'Nitin Personal Tech');
            assert.equal(matching[0].assigned_dept, 'VIP Operations');
            assert.equal(matching[0].assigned_desig, 'ED');
            assert.equal(matching[0].status, 'Assigned');
        });

        it('T2.23: Bulk import rejects empty array or missing assets property (400)', async () => {
            await testEnv.request('/api/assets/bulk', {
                token,
                method: 'POST',
                body: { assets: [] },
                status: 400
            });

            await testEnv.request('/api/assets/bulk', {
                token,
                method: 'POST',
                body: {},
                status: 400
            });
        });
    });

    describe('Tier 3: CSV Round-Trip Data Fidelity (Export -> Parse -> Re-Import)', () => {
        it('T3.1: Export full database, parse with client CSV parser, and re-import with 0 data loss', async () => {
            // 1. Get current inventory count
            const beforeAssets = await testEnv.request('/api/assets/all', { token });
            const initialCount = beforeAssets.data.length;
            assert.ok(initialCount >= 4, 'Should have test assets seeded');

            // 2. Export CSV from server
            const exportRes = await testEnv.request('/api/assets/export', { token });
            assert.equal(exportRes.status, 200);
            const csvData = exportRes.text;

            // 3. Parse with client-side parseCSV()
            const parsedRows = parseCSV(csvData);
            assert.equal(parsedRows.length, initialCount, 'Parsed row count must equal export count');

            // Verify BOM was stripped and first column correctly recognized
            assert.ok(parsedRows.every(r => r._isValid), 'All parsed rows should be marked valid');

            // 4. Re-import all parsed rows via bulk UPSERT
            const importRes = await testEnv.request('/api/assets/bulk', {
                token,
                method: 'POST',
                body: { assets: parsedRows },
                status: 200
            });
            assert.equal(importRes.data.imported, initialCount);

            // 5. Verify database integrity after round-trip
            const afterAssets = await testEnv.request('/api/assets/all', { token });
            assert.equal(afterAssets.data.length, initialCount, 'Asset count must remain exactly identical');

            // Verify field-by-field match for a known record
            const targetBefore = beforeAssets.data.find(a => a.serial_number === 'SN-BULK-001');
            const targetAfter = afterAssets.data.find(a => a.serial_number === 'SN-BULK-001');

            assert.equal(targetAfter.name, targetBefore.name);
            assert.equal(targetAfter.serial_number, targetBefore.serial_number);
            assert.equal(targetAfter.asset_tag, targetBefore.asset_tag);
            assert.equal(targetAfter.make, targetBefore.make);
            assert.equal(targetAfter.model, targetBefore.model);
            assert.equal(targetAfter.current_user, targetBefore.current_user);
            assert.equal(targetAfter.contractual_user_name, targetBefore.contractual_user_name);
            assert.equal(targetAfter.assigned_dept, targetBefore.assigned_dept);
            assert.equal(targetAfter.year_of_purchase, targetBefore.year_of_purchase);
        });
    });
});
