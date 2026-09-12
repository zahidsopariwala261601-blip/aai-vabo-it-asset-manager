const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');

describe('Milestone 1 Empirical Challenge Suite', () => {
    let testEnv;
    let adminToken;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'm1-empirical-' });
        adminToken = testEnv.adminToken;
    });

    after(async () => {
        if (testEnv) await testEnv.close();
    });

    function queryDb(sql, params = []) {
        const db = new sqlite3.Database(testEnv.databasePath);
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    function runDb(sql, params = []) {
        const db = new sqlite3.Database(testEnv.databasePath);
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                db.close();
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // =========================================================================
    // 1. Multi-Asset Handover & Takeover Rollback
    // =========================================================================
    describe('1. Handover & Takeover Transaction Boundaries', () => {
        it('1.1: Forced mid-batch error during asset update rolls back transaction and all asset updates', async () => {
            const a1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Workstation 1', serial_number: 'SN-ROLL-01', current_user: 'IT Store', status: 'In Stock' },
                status: 201
            });
            const a2 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Workstation 2', serial_number: 'SN-ROLL-02', current_user: 'IT Store', status: 'In Stock' },
                status: 201
            });

            const id1 = a1.data.id;
            const id2 = a2.data.id;

            // Create a trigger that forces an abort when updating asset 2
            await runDb(`
                CREATE TRIGGER fail_asset_update_trigger
                BEFORE UPDATE ON assets
                WHEN NEW.id = ${id2}
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated mid-batch update error');
                END;
            `);

            try {
                const res = await testEnv.request('/api/transactions', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        type: 'handover',
                        asset_ids: [id1, id2],
                        employee_name: 'Rollback Subject',
                        contractual_user_name: 'Rollback Subject'
                    }
                });

                assert.notEqual(res.status, 201, 'Request should fail when mid-batch trigger aborts');

                // Verify asset 1 was NOT left in 'Assigned' state
                const rows = await queryDb('SELECT id, status, current_user FROM assets WHERE id IN (?, ?)', [id1, id2]);
                for (const row of rows) {
                    assert.equal(row.status, 'In Stock', `Asset ${row.id} must be 'In Stock'`);
                    assert.equal(row.current_user, 'IT Store', `Asset ${row.id} must be 'IT Store'`);
                }

                // Verify transaction was rolled back
                const txs = await queryDb('SELECT * FROM transactions WHERE employee_name = ?', ['Rollback Subject']);
                assert.equal(txs.length, 0, 'Transaction record must be rolled back');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_asset_update_trigger;');
            }
        });

        it('1.2: Handover with non-existent asset ID in array commits partial state (BUG IDENTIFIED)', async () => {
            const a1 = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Workstation 3', serial_number: 'SN-ROLL-03', current_user: 'IT Store', status: 'In Stock' },
                status: 201
            });
            const validId = a1.data.id;
            const nonExistentId = 888888;

            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [validId, nonExistentId],
                    employee_name: 'Partial Leak Tester',
                    contractual_user_name: 'Partial Leak Tester'
                }
            });

            // Inspect DB: Did the system commit a transaction containing the non-existent ID?
            const txs = await queryDb('SELECT * FROM transactions WHERE employee_name = ?', ['Partial Leak Tester']);
            const assetRow = (await queryDb('SELECT status, current_user FROM assets WHERE id = ?', [validId]))[0];

            console.log('1.2 Result: status =', res.status, ', committed tx count =', txs.length, ', assetRow =', assetRow);
            // In a strict transaction model, an invalid asset ID MUST cause rejection and 0 updates
            const isStrict = res.status !== 201 && txs.length === 0 && assetRow.status === 'In Stock';
            assert.ok(
                isStrict,
                `VULNERABILITY CONFIRMED: Handover with non-existent ID succeeded with status ${res.status}, updated asset ${validId} to '${assetRow?.status}', and committed phantom audit record`
            );
        });
    });

    // =========================================================================
    // 2. Concurrent Wizard Requests & Tag Collision
    // =========================================================================
    describe('2. Concurrent Wizard Requests & Concurrency Safety', () => {
        it('2.1: Concurrent wizard requests crash with SQLITE_ERROR transaction conflict (BUG IDENTIFIED)', async () => {
            const promises = [
                testEnv.request('/api/assets/wizard', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        employee: { name: 'Concurrent User A', department: 'CNS' },
                        assets: [{ name: 'Laptop', serial_number: 'SN-CONC-A1' }]
                    }
                }),
                testEnv.request('/api/assets/wizard', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        employee: { name: 'Concurrent User B', department: 'CNS' },
                        assets: [{ name: 'Laptop', serial_number: 'SN-CONC-B1' }]
                    }
                })
            ];

            const results = await Promise.all(promises);
            const statuses = results.map(r => r.status);
            console.log('2.1 Concurrent wizard statuses:', statuses);

            const has500Error = results.some(r => r.status === 500 && r.data?.error?.includes('cannot start a transaction within a transaction'));
            console.log('2.1 Has cannot start a transaction within a transaction 500 error:', has500Error);

            // In a production-grade system, concurrent requests must both succeed gracefully (201), not crash with 500
            assert.ok(
                statuses.every(s => s === 201),
                `CONCURRENCY DEFECT CONFIRMED: Concurrent wizard requests failed with statuses [${statuses.join(', ')}]. SQLite nested transaction collision: ${JSON.stringify(results.map(r => r.data))}`
            );
        });

        it('2.2: Sequential wizard requests generate monotonic unique tags', async () => {
            const res1 = await testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Seq User 1', department: 'OPS' },
                    assets: [{ name: 'Radio', serial_number: 'SN-SEQ-01' }]
                },
                status: 201
            });

            const res2 = await testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Seq User 2', department: 'OPS' },
                    assets: [{ name: 'Radio', serial_number: 'SN-SEQ-02' }]
                },
                status: 201
            });

            const a1 = (await queryDb('SELECT asset_tag FROM assets WHERE id = ?', [res1.data.asset_ids[0]]))[0];
            const a2 = (await queryDb('SELECT asset_tag FROM assets WHERE id = ?', [res2.data.asset_ids[0]]))[0];

            console.log('2.2 Tags:', a1.asset_tag, a2.asset_tag);
            assert.notEqual(a1.asset_tag, a2.asset_tag, 'Tags must be distinct');
        });
    });

    // =========================================================================
    // 3. API Error Contract: Uniqueness Collisions
    // =========================================================================
    describe('3. Uniqueness Collisions Error Contract (PROJECT.md line 85)', () => {
        it('3.1: Single asset creation returns 500 instead of 409 Conflict on duplicate serial_number (BUG IDENTIFIED)', async () => {
            // Create first asset
            await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Original Asset', serial_number: 'SN-DUP-TEST' },
                status: 201
            });

            // Attempt to create second asset with identical serial_number
            const dupRes = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Duplicate Asset', serial_number: 'SN-DUP-TEST' }
            });

            console.log('3.1 Duplicate asset creation status:', dupRes.status, 'error:', dupRes.data);
            assert.equal(
                dupRes.status,
                409,
                `DEFECT CONFIRMED: PROJECT.md interface contract specifies 409 Conflict for uniqueness collisions, but POST /api/assets returned ${dupRes.status} with error: ${JSON.stringify(dupRes.data)}`
            );
        });
    });

    // =========================================================================
    // 4. Bulk CSV Import Rollback & Resiliency (in isolated test server)
    // =========================================================================
    describe('4. Bulk CSV Import Rollback & Resiliency', () => {
        it('4.1: Bulk import SQL failure triggers rollback leaving 0 assets inserted', async () => {
            const initialCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;

            await runDb(`
                CREATE TRIGGER fail_bulk_trigger
                BEFORE INSERT ON assets
                WHEN NEW.serial_number = 'FAIL-BULK-MID'
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated mid-batch bulk error');
                END;
            `);

            try {
                const res = await testEnv.request('/api/assets/bulk', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        assets: [
                            { name: 'Bulk A', serial_number: 'SN-BLK-A' },
                            { name: 'Bulk Fail', serial_number: 'FAIL-BULK-MID' },
                            { name: 'Bulk B', serial_number: 'SN-BLK-B' }
                        ]
                    }
                });

                assert.notEqual(res.status, 200, 'Bulk import must fail');
                const finalCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;
                assert.equal(finalCount, initialCount, 'Database asset count must not increase after failed bulk import');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_bulk_trigger;');
            }
        });

        it('4.2: Bulk import with null item in array crashes server with unhandled TypeError (BUG IDENTIFIED)', async () => {
            // Spawn separate server specifically to observe crash without affecting other tests
            const crashServer = await startTestServer({ prefix: 'm1-crash-test-' });
            let crashed = false;
            try {
                await crashServer.request('/api/assets/bulk', {
                    token: crashServer.adminToken,
                    method: 'POST',
                    body: {
                        assets: [
                            { name: 'Bulk Valid', serial_number: 'SN-BLK-VALID' },
                            null
                        ]
                    }
                });
            } catch (err) {
                console.log('4.2 Caught fetch error (server process crashed):', err.message);
                crashed = true;
            } finally {
                await crashServer.close();
            }

            assert.ok(
                !crashed,
                'CRITICAL DEFECT CONFIRMED: Server process crashed (ECONNRESET) on malformed bulk array item due to unhandled TypeError in db.serialize loop'
            );
        });
    });
});
