const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const sqlite3 = require('sqlite3');
const { startTestServer } = require('../helpers/testServer');

describe('Milestone 1 Iteration 2 Empirical Stress Challenges', () => {
    let testEnv;
    let adminToken;

    before(async () => {
        testEnv = await startTestServer({ prefix: 'm1-stress-' });
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
    // 1. Transaction Rollback & Atomicity Under Stress
    // =========================================================================
    describe('1. Transaction Rollback & Atomicity Stress Tests', () => {
        it('1.1: Multi-asset handover mid-batch failure rolls back ALL asset updates and transaction', async () => {
            // Create 5 assets
            const ids = [];
            for (let i = 1; i <= 5; i++) {
                const a = await testEnv.request('/api/assets', {
                    token: adminToken,
                    method: 'POST',
                    body: { name: `Batch Workstation ${i}`, serial_number: `SN-MBATCH-${i}`, current_user: 'IT Store', status: 'In Stock' },
                    status: 201
                });
                ids.push(a.data.id);
            }

            // Abort trigger on 4th asset update
            await runDb(`
                CREATE TRIGGER fail_mid_batch_handover
                BEFORE UPDATE ON assets
                WHEN NEW.id = ${ids[3]}
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated mid-batch update failure');
                END;
            `);

            try {
                const res = await testEnv.request('/api/transactions', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        type: 'handover',
                        asset_ids: ids,
                        employee_name: 'MidBatch Fail Subject'
                    }
                });

                assert.notEqual(res.status, 201, 'Request must not succeed when trigger aborts');

                // Verify ALL 5 assets remained untouched
                const rows = await queryDb(`SELECT id, status, current_user FROM assets WHERE id IN (${ids.join(',')})`);
                assert.equal(rows.length, 5);
                for (const row of rows) {
                    assert.equal(row.status, 'In Stock', `Asset ${row.id} must be In Stock`);
                    assert.equal(row.current_user, 'IT Store', `Asset ${row.id} must be IT Store`);
                }

                // Verify 0 transactions were created
                const txs = await queryDb('SELECT * FROM transactions WHERE employee_name = ?', ['MidBatch Fail Subject']);
                assert.equal(txs.length, 0, 'No transaction records should be committed');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_mid_batch_handover;');
            }
        });

        it('1.2: Multi-asset takeover with one missing asset ID returns 404 and rolls back cleanly', async () => {
            // Create 3 assigned assets
            const ids = [];
            for (let i = 1; i <= 3; i++) {
                const a = await testEnv.request('/api/assets', {
                    token: adminToken,
                    method: 'POST',
                    body: { name: `Takeover Laptop ${i}`, serial_number: `SN-TK-ROLL-${i}`, current_user: 'Worker Jane', status: 'Assigned' },
                    status: 201
                });
                ids.push(a.data.id);
            }

            const res = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'takeover',
                    asset_ids: [ids[0], 999999, ids[2]],
                    employee_name: 'Worker Jane'
                }
            });

            assert.equal(res.status, 404, 'Must return 404 for missing asset in takeover');

            // Verify assets remain Assigned to Worker Jane
            const rows = await queryDb(`SELECT id, status, current_user FROM assets WHERE id IN (${ids.join(',')})`);
            for (const row of rows) {
                assert.equal(row.status, 'Assigned');
                assert.equal(row.current_user, 'Worker Jane');
            }

            // Verify 0 takeover transactions
            const txs = await queryDb('SELECT * FROM transactions WHERE employee_name = ? AND type = ?', ['Worker Jane', 'takeover']);
            assert.equal(txs.length, 0);
        });

        it('1.3: Wizard mid-batch insertion error rolls back employee and all assets', async () => {
            const initialAssetCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;

            // Trigger to abort insert on specific serial
            await runDb(`
                CREATE TRIGGER fail_wizard_insert
                BEFORE INSERT ON assets
                WHEN NEW.serial_number = 'SN-WIZ-FAIL-TRIGGER'
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated mid-wizard insert abort');
                END;
            `);

            try {
                const res = await testEnv.request('/api/assets/wizard', {
                    token: adminToken,
                    method: 'POST',
                    body: {
                        employee: { name: 'Wizard Rollback Employee', department: 'CNS' },
                        assets: [
                            { name: 'Monitor', serial_number: 'SN-WIZ-OK-1' },
                            { name: 'Keyboard', serial_number: 'SN-WIZ-FAIL-TRIGGER' },
                            { name: 'Mouse', serial_number: 'SN-WIZ-OK-2' }
                        ]
                    }
                });

                assert.notEqual(res.status, 201, 'Wizard must fail when trigger aborts');

                // Verify no assets were added
                const finalAssetCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;
                assert.equal(finalAssetCount, initialAssetCount, 'Asset count must not increase after failed wizard');

                // Verify no transaction record was inserted
                const txs = await queryDb('SELECT * FROM transactions WHERE employee_name = ?', ['Wizard Rollback Employee']);
                assert.equal(txs.length, 0, 'No transaction record should be committed');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_wizard_insert;');
            }
        });

        it('1.4: Asset deletion rollback preserves asset if deletion audit transaction fails', async () => {
            // Create an asset to delete
            const a = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Protected Deletion Subject', serial_number: 'SN-DEL-ROLLBACK-01' },
                status: 201
            });
            const assetId = a.data.id;

            // Trigger that aborts deletion from assets table
            await runDb(`
                CREATE TRIGGER fail_asset_delete
                BEFORE DELETE ON assets
                WHEN OLD.id = ${assetId}
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated deletion block');
                END;
            `);

            try {
                const res = await testEnv.request(`/api/assets/${assetId}`, {
                    token: adminToken,
                    method: 'DELETE'
                });

                assert.notEqual(res.status, 200, 'Deletion must fail');

                // Verify asset still exists
                const row = (await queryDb('SELECT * FROM assets WHERE id = ?', [assetId]))[0];
                assert.ok(row, 'Asset must still exist');

                // Verify audit transaction for this deletion was rolled back
                const txs = await queryDb('SELECT * FROM transactions WHERE type = ? AND asset_ids LIKE ?', ['deletion', `%"${assetId}"%`]);
                assert.equal(txs.length, 0, 'Deletion transaction must be rolled back');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_asset_delete;');
            }
        });
    });

    // =========================================================================
    // 2. High-Concurrency Wizard Calls & Race Conditions
    // =========================================================================
    describe('2. High-Concurrency Wizard Stress Tests', () => {
        it('2.1: 5 simultaneous wizard requests all succeed (HTTP 201) with distinct tags and no SQLite locks', async () => {
            const promises = [];
            for (let i = 1; i <= 5; i++) {
                promises.push(
                    testEnv.request('/api/assets/wizard', {
                        token: adminToken,
                        method: 'POST',
                        body: {
                            employee: { name: `Concurrent Stress Worker ${i}`, department: 'ENG' },
                            assets: [
                                { name: 'Monitor', serial_number: `SN-CONC-5-${i}-MON` },
                                { name: 'Workstation', serial_number: `SN-CONC-5-${i}-WS` }
                            ]
                        }
                    })
                );
            }

            const results = await Promise.all(promises);
            for (let i = 0; i < results.length; i++) {
                assert.equal(results[i].status, 201, `Wizard ${i + 1} must return 201, got ${results[i].status}: ${JSON.stringify(results[i].data)}`);
            }

            // Verify all 10 assets have unique asset tags
            const tags = await queryDb("SELECT asset_tag FROM assets WHERE serial_number LIKE 'SN-CONC-5-%'");
            assert.equal(tags.length, 10);
            const tagSet = new Set(tags.map(t => t.asset_tag));
            assert.equal(tagSet.size, 10, 'All generated asset tags across concurrent requests must be unique');
        });

        it('2.2: Concurrent race on identical serial number: exactly one succeeds (201) and one conflicts (409)', async () => {
            const sharedSerial = 'SN-RACE-COLLISION-SHARED';
            const req1 = testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Racer 1', department: 'OPS' },
                    assets: [{ name: 'Radio', serial_number: sharedSerial }]
                }
            });

            const req2 = testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Racer 2', department: 'OPS' },
                    assets: [{ name: 'Radio', serial_number: sharedSerial }]
                }
            });

            const [res1, res2] = await Promise.all([req1, req2]);
            const statuses = [res1.status, res2.status].sort();

            console.log('2.2 Race statuses:', res1.status, res2.status);
            assert.deepEqual(statuses, [201, 409], 'Race condition must result in exactly one 201 and one 409 Conflict');

            // Verify only one asset exists in the DB with that serial
            const matching = await queryDb('SELECT * FROM assets WHERE serial_number = ?', [sharedSerial]);
            assert.equal(matching.length, 1, 'Only exactly 1 asset record must exist');
        });

        it('2.3: Interleaved concurrent operations (wizard, single insert, handover) execute without deadlock', async () => {
            // Seed an asset for handover
            const seed = await testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Interleaved Device', serial_number: 'SN-INTERLEAVED-01', current_user: 'IT Store' },
                status: 201
            });
            const seedId = seed.data.id;

            const op1 = testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Interleaved Emp A', department: 'HR' },
                    assets: [{ name: 'Laptop', serial_number: 'SN-IL-WIZ-01' }]
                }
            });

            const op2 = testEnv.request('/api/assets', {
                token: adminToken,
                method: 'POST',
                body: { name: 'Single Device', serial_number: 'SN-IL-SINGLE-01' }
            });

            const op3 = testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [seedId],
                    employee_name: 'Interleaved Emp B'
                }
            });

            const [r1, r2, r3] = await Promise.all([op1, op2, op3]);
            assert.equal(r1.status, 201);
            assert.equal(r2.status, 201);
            assert.equal(r3.status, 201);
        });
    });

    // =========================================================================
    // 3. Malformed Bulk Import Payloads & Rollback Resiliency
    // =========================================================================
    describe('3. Malformed Bulk Import Payloads & Rollback Resiliency', () => {
        it('3.1: Bulk import with mixed invalid types in array processes valid items without crash', async () => {
            const mixedPayload = {
                assets: [
                    null,
                    undefined,
                    12345,
                    "invalid-string-element",
                    true,
                    [],
                    { name: 'Resilient Asset A', serial_number: 'SN-BULK-RES-01' },
                    null,
                    { name: 'Resilient Asset B', serial_number: 'SN-BULK-RES-02' }
                ]
            };

            const res = await testEnv.request('/api/assets/bulk', {
                token: adminToken,
                method: 'POST',
                body: mixedPayload
            });

            assert.equal(res.status, 200, `Bulk import should process valid items, got ${res.status}`);
            assert.equal(res.data.imported, 2, 'Should process exactly the 2 valid asset records');

            const rows = await queryDb("SELECT * FROM assets WHERE serial_number IN ('SN-BULK-RES-01', 'SN-BULK-RES-02')");
            assert.equal(rows.length, 2);
        });

        it('3.2: Bulk import with entirely malformed array returns 400 Bad Request', async () => {
            const malformedPayload = {
                assets: [null, undefined, 42, "hello", false]
            };

            const res = await testEnv.request('/api/assets/bulk', {
                token: adminToken,
                method: 'POST',
                body: malformedPayload
            });

            assert.equal(res.status, 400, 'Must return 400 when no valid records are provided');
            assert.match(res.data.error, /no valid asset records/i);
        });

        it('3.3: Bulk import with SQL injection attempts in fields is safely parameterized', async () => {
            const sqlInjectionPayload = {
                assets: [
                    {
                        name: "Test'); DROP TABLE assets; --",
                        serial_number: "SN-SQLI-01'; DROP TABLE users; --",
                        current_user: "Admin' OR '1'='1"
                    }
                ]
            };

            const res = await testEnv.request('/api/assets/bulk', {
                token: adminToken,
                method: 'POST',
                body: sqlInjectionPayload
            });

            assert.equal(res.status, 200);

            // Verify tables still exist
            const tableCheck = await queryDb("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('assets', 'users')");
            assert.equal(tableCheck.length, 2, 'Tables must not be dropped by SQL injection');

            const inserted = (await queryDb("SELECT * FROM assets WHERE serial_number LIKE 'SN-SQLI-01%'"))[0];
            assert.ok(inserted);
            assert.equal(inserted.name, "Test'); DROP TABLE assets; --");
        });

        it('3.4: Bulk import mid-batch SQL failure rolls back ALL 10 items (atomicity)', async () => {
            const initialCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;

            await runDb(`
                CREATE TRIGGER fail_bulk_stress
                BEFORE INSERT ON assets
                WHEN NEW.serial_number = 'SN-BULK-FAIL-07'
                BEGIN
                    SELECT RAISE(ABORT, 'Simulated mid-bulk error at item 7');
                END;
            `);

            try {
                const bulkItems = [];
                for (let i = 1; i <= 10; i++) {
                    bulkItems.push({
                        name: `Atomic Bulk Asset ${i}`,
                        serial_number: `SN-BULK-FAIL-${String(i).padStart(2, '0')}`
                    });
                }

                const res = await testEnv.request('/api/assets/bulk', {
                    token: adminToken,
                    method: 'POST',
                    body: { assets: bulkItems }
                });

                assert.notEqual(res.status, 200, 'Bulk import must fail when trigger aborts');

                const finalCount = (await queryDb('SELECT COUNT(*) as c FROM assets'))[0].c;
                assert.equal(finalCount, initialCount, 'Zero records must be inserted upon rollback (strict atomicity)');
            } finally {
                await runDb('DROP TRIGGER IF EXISTS fail_bulk_stress;');
            }
        });

        it('3.5: Extreme payload: 100 asset records in a single bulk import succeed atomically', async () => {
            const bulkItems = [];
            for (let i = 1; i <= 100; i++) {
                bulkItems.push({
                    name: `Large Bulk Workstation ${i}`,
                    serial_number: `SN-LBLK-100-${String(i).padStart(3, '0')}`,
                    current_user: 'IT Store'
                });
            }

            const res = await testEnv.request('/api/assets/bulk', {
                token: adminToken,
                method: 'POST',
                body: { assets: bulkItems }
            });

            assert.equal(res.status, 200);
            assert.equal(res.data.imported, 100);

            const count = (await queryDb("SELECT COUNT(*) as c FROM assets WHERE serial_number LIKE 'SN-LBLK-100-%'"))[0].c;
            assert.equal(count, 100, 'All 100 records must be present in the database');
        });

        it('3.6: Concurrent bulk imports execute sequentially via transaction queue without locking errors', async () => {
            const batchA = [];
            const batchB = [];
            for (let i = 1; i <= 20; i++) {
                batchA.push({ name: 'Batch A Item', serial_number: `SN-CONC-BLK-A-${i}` });
                batchB.push({ name: 'Batch B Item', serial_number: `SN-CONC-BLK-B-${i}` });
            }

            const [resA, resB] = await Promise.all([
                testEnv.request('/api/assets/bulk', {
                    token: adminToken,
                    method: 'POST',
                    body: { assets: batchA }
                }),
                testEnv.request('/api/assets/bulk', {
                    token: adminToken,
                    method: 'POST',
                    body: { assets: batchB }
                })
            ]);

            assert.equal(resA.status, 200);
            assert.equal(resB.status, 200);

            const countA = (await queryDb("SELECT COUNT(*) as c FROM assets WHERE serial_number LIKE 'SN-CONC-BLK-A-%'"))[0].c;
            const countB = (await queryDb("SELECT COUNT(*) as c FROM assets WHERE serial_number LIKE 'SN-CONC-BLK-B-%'"))[0].c;
            assert.equal(countA, 20);
            assert.equal(countB, 20);
        });
    });

    // =========================================================================
    // 4. Transaction Queue Resilience & Fault Recovery
    // =========================================================================
    describe('4. Transaction Queue Resilience & Fault Recovery', () => {
        it('4.1: Queue recovers immediately after an aborted transaction without deadlocking', async () => {
            // Intentionally abort a handover transaction by sending non-existent asset ID
            const failRes = await testEnv.request('/api/transactions', {
                token: adminToken,
                method: 'POST',
                body: {
                    type: 'handover',
                    asset_ids: [9999999],
                    employee_name: 'Faulty Request'
                }
            });
            assert.equal(failRes.status, 404);

            // Immediately execute a valid wizard transaction
            const successRes = await testEnv.request('/api/assets/wizard', {
                token: adminToken,
                method: 'POST',
                body: {
                    employee: { name: 'Queue Recovery Employee', department: 'FIN' },
                    assets: [{ name: 'Recovery Tablet', serial_number: 'SN-RECOVERY-01' }]
                }
            });
            assert.equal(successRes.status, 201, 'Subsequent transaction must succeed cleanly after previous transaction aborted');
        });
    });
});
