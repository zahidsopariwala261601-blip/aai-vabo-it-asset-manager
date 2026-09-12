const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');

function queryDb(databasePath, sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath);
        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

describe('Milestone 2 Challenger Empirical Stress Suite', () => {
    let testEnv;
    let adminToken;

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-m2-challenger-',
            adminUser: { username: 'challenger_admin', password: 'ChallengerPass123!', role: 'admin' }
        });
        adminToken = testEnv.adminToken;
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    // ─────────────────────────────────────────────────────────────
    // 1. Mutual Linking & Unlinking Stress-Testing
    // ─────────────────────────────────────────────────────────────
    describe('1. Mutual Linking & Unlinking Stress-Testing', () => {
        it('CH-M2.1: Self-linking attempt (parent_id === child_id) returns HTTP 400', async () => {
            const assetRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Standalone PC', serial_number: 'SN-CH-SELF-1', current_user: 'IT Store' },
                status: 201
            });
            const assetId = assetRes.data.id;

            const linkRes = await testEnv.request(`/api/assets/${assetId}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: assetId },
                status: 400
            });
            assert.equal(linkRes.data.error, 'Cannot link an asset to itself');
        });

        it('CH-M2.2: Unlinking an unlinked asset returns HTTP 400 Bad Request', async () => {
            const assetRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Unlinked Device', serial_number: 'SN-CH-UNLINKED-1', current_user: 'IT Store' },
                status: 201
            });
            const assetId = assetRes.data.id;

            const unlinkRes = await testEnv.request(`/api/assets/${assetId}/unlink`, {
                token: adminToken,
                method: 'POST',
                status: 400
            });
            assert.equal(unlinkRes.data.error, 'Asset is not currently linked');
        });

        it('CH-M2.3: SQLite reciprocal pointers verified on link and unlink', async () => {
            const a1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Host Unit A', serial_number: 'SN-CH-RECIP-A', current_user: 'IT Store' },
                status: 201
            });
            const a2 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Display Unit B', serial_number: 'SN-CH-RECIP-B', current_user: 'IT Store' },
                status: 201
            });
            const idA = a1.data.id;
            const idB = a2.data.id;

            // Link A to B
            await testEnv.request(`/api/assets/${idA}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idB },
                status: 200
            });

            // Inspect raw SQLite database directly
            const rowsAfterLink = await queryDb(testEnv.databasePath, 'SELECT id, linked_asset_id FROM assets WHERE id IN (?, ?)', [idA, idB]);
            const dbA = rowsAfterLink.find(r => r.id === idA);
            const dbB = rowsAfterLink.find(r => r.id === idB);
            assert.equal(dbA.linked_asset_id, idB, 'Asset A must point to Asset B in SQLite');
            assert.equal(dbB.linked_asset_id, idA, 'Asset B must point to Asset A in SQLite');

            // Unlink via child B
            await testEnv.request(`/api/assets/${idB}/unlink`, {
                token: adminToken,
                method: 'POST',
                status: 200
            });

            // Inspect raw SQLite database directly after unlink
            const rowsAfterUnlink = await queryDb(testEnv.databasePath, 'SELECT id, linked_asset_id FROM assets WHERE id IN (?, ?)', [idA, idB]);
            const unlinkedA = rowsAfterUnlink.find(r => r.id === idA);
            const unlinkedB = rowsAfterUnlink.find(r => r.id === idB);
            assert.equal(unlinkedA.linked_asset_id, null, 'Asset A pointer must be cleared in SQLite');
            assert.equal(unlinkedB.linked_asset_id, null, 'Asset B pointer must be cleared in SQLite');
        });

        it('CH-M2.4A: Redundant re-linking of already linked pair should be rejected or handled', async () => {
            const p = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Server A', serial_number: 'SN-CH-REDUN-A', current_user: 'IT Store' },
                status: 201
            });
            const c = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'KVM Switch B', serial_number: 'SN-CH-REDUN-B', current_user: 'IT Store' },
                status: 201
            });
            const idA = p.data.id;
            const idB = c.data.id;

            // First link
            await testEnv.request(`/api/assets/${idA}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idB },
                status: 200
            });

            // Attempt to link again without unlinking
            const relinkRes = await testEnv.request(`/api/assets/${idA}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idB }
            });

            // Re-linking an already linked asset pair must return HTTP 400 to prevent redundant transactions
            assert.equal(relinkRes.status, 400, `Expected HTTP 400 when linking already-linked assets, got ${relinkRes.status}`);
        });

        it('CH-M2.4B: Re-linking already linked asset to another asset leaves dangling pointers (Reciprocal Corruption)', async () => {
            // Setup Asset X linked to Asset Y
            const x = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Workstation X', serial_number: 'SN-CH-RELINK-X', current_user: 'IT Store' },
                status: 201
            });
            const y = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Monitor Y', serial_number: 'SN-CH-RELINK-Y', current_user: 'IT Store' },
                status: 201
            });
            const z = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Monitor Z', serial_number: 'SN-CH-RELINK-Z', current_user: 'IT Store' },
                status: 201
            });
            const idX = x.data.id;
            const idY = y.data.id;
            const idZ = z.data.id;

            // Link X and Y
            await testEnv.request(`/api/assets/${idX}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idY },
                status: 200
            });

            // Attempt to link X to Z without unlinking X from Y
            const relinkRes = await testEnv.request(`/api/assets/${idX}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idZ }
            });

            const rows = await queryDb(testEnv.databasePath, 'SELECT id, name, linked_asset_id FROM assets WHERE id IN (?, ?, ?)', [idX, idY, idZ]);
            const rowX = rows.find(r => r.id === idX);
            const rowY = rows.find(r => r.id === idY);
            const rowZ = rows.find(r => r.id === idZ);

            // Re-linking an already linked asset without unlinking must be blocked with HTTP 400
            assert.equal(
                relinkRes.status,
                400,
                `DEFECT: Re-linking already linked asset succeeded with 200, leaving Asset Y (id ${idY}) pointing to Asset X (id ${idX}) while Asset X points to Asset Z (id ${idZ})!`
            );
        });

        it('CH-M2.5: Deleting an asset that is currently linked to another asset corrupts partner pointer', async () => {
            const m1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Parent Host', serial_number: 'SN-CH-DEL-P', current_user: 'IT Store' },
                status: 201
            });
            const m2 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Child Screen', serial_number: 'SN-CH-DEL-C', current_user: 'IT Store' },
                status: 201
            });
            const idP = m1.data.id;
            const idC = m2.data.id;

            // Link them
            await testEnv.request(`/api/assets/${idP}/link`, {
                token: adminToken,
                method: 'POST',
                body: { child_id: idC },
                status: 200
            });

            // Delete Parent Host
            const delRes = await testEnv.request(`/api/assets/${idP}`, {
                token: adminToken,
                method: 'DELETE'
            });

            // Check database state of Child Screen
            const childRows = await queryDb(testEnv.databasePath, 'SELECT id, name, linked_asset_id FROM assets WHERE id = ?', [idC]);
            const childRow = childRows[0];

            if (delRes.status === 200) {
                // If deletion succeeded, partner's linked_asset_id MUST be nullified (no dangling pointer to deleted asset)
                assert.equal(
                    childRow.linked_asset_id,
                    null,
                    `DEFECT: Asset #${idC} still references deleted Asset #${idP} via linked_asset_id. Reciprocal pointer was not cleaned up on DELETE!`
                );
            } else {
                // If deletion was blocked due to active link, must return HTTP 400
                assert.equal(delRes.status, 400, 'Deleting a linked asset should return 400 if blocked');
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Asset Status Engine Transitions
    // ─────────────────────────────────────────────────────────────
    describe('2. Asset Status Engine Transitions', () => {
        it('CH-M2.6: Explicit transition to Faulty and Scrap', async () => {
            // Create asset with Faulty
            const res = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Status Test PC',
                    serial_number: 'SN-CH-STAT-1',
                    current_user: 'IT Store',
                    status: 'Faulty'
                },
                status: 201
            });
            const assetId = res.data.id;

            let row = (await queryDb(testEnv.databasePath, 'SELECT status FROM assets WHERE id = ?', [assetId]))[0];
            assert.equal(row.status, 'Faulty');

            // Transition to Scrap
            await testEnv.request(`/api/assets/${assetId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Status Test PC',
                    serial_number: 'SN-CH-STAT-1',
                    current_user: 'IT Store',
                    status: 'Scrap'
                },
                status: 200
            });

            row = (await queryDb(testEnv.databasePath, 'SELECT status FROM assets WHERE id = ?', [assetId]))[0];
            assert.equal(row.status, 'Scrap');
        });

        it('CH-M2.7: Updating an asset specifications without changing status retains Faulty or Scrap', async () => {
            // 1. Create a Faulty asset
            const fRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Faulty Workstation',
                    serial_number: 'SN-CH-FAULTY-SPEC',
                    current_user: 'IT Store',
                    status: 'Faulty',
                    make: 'Dell',
                    model: 'OptiPlex 3050'
                },
                status: 201
            });
            const fId = fRes.data.id;

            // Verify it is Faulty
            let fRow = (await queryDb(testEnv.databasePath, 'SELECT status FROM assets WHERE id = ?', [fId]))[0];
            assert.equal(fRow.status, 'Faulty');

            // Update specifications (e.g. model, make, remark) WITHOUT passing status in PUT body
            await testEnv.request(`/api/assets/${fId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Faulty Workstation',
                    serial_number: 'SN-CH-FAULTY-SPEC',
                    current_user: 'IT Store',
                    make: 'Dell',
                    model: 'OptiPlex 7090', // updated model spec
                    remark: 'RAM upgraded, still faulty power supply'
                },
                status: 200
            });

            fRow = (await queryDb(testEnv.databasePath, 'SELECT status, model, remark FROM assets WHERE id = ?', [fId]))[0];

            assert.equal(
                fRow.status,
                'Faulty',
                `DEFECT: Updating specifications without changing status clobbered "Faulty" to "${fRow.status}"!`
            );

            // 2. Create a Scrap asset assigned to employee
            const sRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Scrap Laptop',
                    serial_number: 'SN-CH-SCRAP-SPEC',
                    current_user: 'Kiran Rao',
                    status: 'Scrap'
                },
                status: 201
            });
            const sId = sRes.data.id;

            // Update specifications without passing status
            await testEnv.request(`/api/assets/${sId}`, {
                token: adminToken,
                method: 'PUT',
                body: {
                    name: 'Scrap Laptop',
                    serial_number: 'SN-CH-SCRAP-SPEC',
                    current_user: 'Kiran Rao',
                    remark: 'Board fried'
                },
                status: 200
            });

            const sRow = (await queryDb(testEnv.databasePath, 'SELECT status FROM assets WHERE id = ?', [sId]))[0];

            assert.equal(
                sRow.status,
                'Scrap',
                `DEFECT: Updating specifications without changing status clobbered "Scrap" to "${sRow.status}"!`
            );
        });

        it('CH-M2.8: Handover sets status to Assigned and Takeover resets status to In Stock', async () => {
            // Create an In Stock asset
            const createRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: {
                    name: 'Handover Test Laptop',
                    serial_number: 'SN-CH-HO-1',
                    current_user: 'IT Store'
                },
                status: 201
            });
            const assetId = createRes.data.id;

            let row = (await queryDb(testEnv.databasePath, 'SELECT status, current_user FROM assets WHERE id = ?', [assetId]))[0];
            assert.equal(row.status, 'In Stock');
            assert.equal(row.current_user, 'IT Store');

            // Perform Handover transaction
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [assetId],
                    employee_name: 'Ananya Roy',
                    employee_dept: 'Operations',
                    employee_desig: 'Manager',
                    new_ip_address: '172.29.80.50',
                    new_hostname: 'OPS-MGR-01'
                },
                status: 201
            });

            row = (await queryDb(testEnv.databasePath, 'SELECT status, current_user, assigned_dept, ip_address FROM assets WHERE id = ?', [assetId]))[0];
            assert.equal(row.status, 'Assigned', 'Handover must set status to Assigned');
            assert.equal(row.current_user, 'Ananya Roy', 'Handover must set current_user to employee');
            assert.equal(row.assigned_dept, 'Operations');
            assert.equal(row.ip_address, '172.29.80.50');

            // Perform Takeover transaction
            await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: [assetId],
                    employee_name: 'Ananya Roy'
                },
                status: 201
            });

            row = (await queryDb(testEnv.databasePath, 'SELECT status, current_user, assigned_dept, ip_address FROM assets WHERE id = ?', [assetId]))[0];
            assert.equal(row.status, 'In Stock', 'Takeover must reset status to In Stock');
            assert.equal(row.current_user, 'IT Store', 'Takeover must reset current_user to IT Store');
            assert.equal(row.ip_address, '', 'Takeover must clear IP binding');
        });
    });
});
