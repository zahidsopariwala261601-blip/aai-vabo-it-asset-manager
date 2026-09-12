const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to validate asset data
const validateAsset = (req, res, next) => {
    const { name, serial_number } = req.body;
    const nameLower = (name || '').toLowerCase();
    const isKbOrMouse = nameLower.includes('keyboard') || nameLower.includes('mouse');
    if (!name || (!serial_number && !isKbOrMouse)) {
        return res.status(400).json({ error: 'Name and Serial Number are required' });
    }
    next();
};

// Admin-only guard middleware
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
}

// Valid lifecycle statuses
const VALID_STATUSES = ['In Stock', 'Assigned', 'Faulty', 'Scrap'];
const toUpper = str => typeof str === 'string' ? str.trim().toUpperCase() : (str || '');

// Asset Tag auto-generation: VABO-IT/CNS-{DEPT}-{TYPE}-{SEQ}
function generateAssetTag(dept, type, callback) {
    const prefix = `VABO-IT/CNS-${(dept || 'GEN').substring(0, 3).toUpperCase()}-${(type || 'IT').substring(0, 3).toUpperCase()}-`;
    db.all(`SELECT asset_tag FROM assets WHERE asset_tag LIKE ?`, [`${prefix}%`], (err, rows) => {
        let maxSeq = 0;
        if (!err && rows) {
            rows.forEach(row => {
                const match = (row.asset_tag || '').match(/-(\d+)$/);
                if (match) {
                    const seq = parseInt(match[1], 10);
                    if (seq > maxSeq) maxSeq = seq;
                }
            });
        }
        const nextSeq = String(maxSeq + 1).padStart(2, '0');
        callback(null, `${prefix}${nextSeq}`);
    });
}

// GET /api/assets — List with pagination and search
router.get('/', authenticateToken, (req, res, next) => {
    const { search, type, dept, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
        SELECT a.*, 
               COALESCE(e.name, a.current_user) as current_user,
               COALESCE(e.department, a.assigned_dept) as assigned_dept,
               COALESCE(e.designation, a.assigned_desig) as assigned_desig
        FROM assets a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        sql += ` AND (a.name LIKE ? OR a.serial_number LIKE ? OR a.current_user LIKE ? OR a.assigned_dept LIKE ? OR e.name LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
    }
    if (type) {
        sql += ` AND a.name = ?`;
        params.push(type);
    }
    if (dept) {
        sql += ` AND (a.assigned_dept = ? OR e.department = ?)`;
        params.push(dept, dept);
    }

    sql += ` ORDER BY a.last_update DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    db.all(sql, params, (err, rows) => {
        if (err) return next(err);
        res.json(rows);
    });
});

// GET /api/assets/all — Get all assets (no pagination)
router.get('/all', authenticateToken, (req, res, next) => {
    const sql = `
        SELECT a.*, 
               COALESCE(e.name, a.current_user) as current_user,
               COALESCE(e.department, a.assigned_dept) as assigned_dept,
               COALESCE(e.designation, a.assigned_desig) as assigned_desig
        FROM assets a
        LEFT JOIN employees e ON a.employee_id = e.id
        ORDER BY a.last_update DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return next(err);
        res.json(rows);
    });
});

// GET /api/assets/stats — Inventory aggregates
router.get('/stats', authenticateToken, (req, res, next) => {
    const sqlMain = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'In Stock' THEN 1 ELSE 0 END) as inStock,
            SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN status = 'Faulty' THEN 1 ELSE 0 END) as faulty,
            SUM(CASE WHEN status = 'Scrap' THEN 1 ELSE 0 END) as scrap
        FROM assets
    `;
    const sqlCategories = `SELECT name, COUNT(*) as count FROM assets GROUP BY name`;

    db.get(sqlMain, [], (err, row) => {
        if (err) return next(err);
        
        db.all(sqlCategories, [], (err, categories) => {
            if (err) return next(err);
            
            const stats = {
                total: row?.total || 0,
                inStock: row?.inStock || 0,
                assigned: row?.assigned || 0,
                faulty: row?.faulty || 0,
                scrap: row?.scrap || 0,
                categories: {}
            };
            
            if (categories) {
                categories.forEach(c => {
                    if (c.name) {
                        stats.categories[c.name] = c.count;
                    }
                });
            }
            
            res.json(stats);
        });
    });
});

// GET /api/assets/export — Export as CSV
router.get('/export', authenticateToken, (req, res, next) => {
    const sql = `
        SELECT a.*, 
               COALESCE(e.name, a.current_user) as current_user_name,
               COALESCE(e.department, a.assigned_dept) as dept,
               COALESCE(e.designation, a.assigned_desig) as desig
        FROM assets a
        LEFT JOIN employees e ON a.employee_id = e.id
        ORDER BY a.id ASC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return next(err);

        const q = str => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const headers = [
            'ID', 'Asset_Tag', 'Asset Type', 'Serial', 'Charger_Serial',
            'Monitor_Make', 'Monitor_Serial', 'Keyboard_Make', 'Mouse_Make',
            'Make', 'Model', 'IP', 'Hostname', 'Holder',
            'Physical_Asset_Holder', 'Department', 'Designation', 'Year_of_Purchase'
        ];

        let csv = headers.join(',') + '\n';
        rows.forEach(a => {
            const row = [
                a.id,
                q(a.asset_tag),
                q(a.name),
                q(a.serial_number),
                q(a.charger_serial),
                q(a.monitor_make),
                q(a.monitor_serial),
                q(a.keyboard_make),
                q(a.mouse_make),
                q(a.make),
                q(a.model),
                q(a.ip_address),
                q(a.hostname),
                q(a.current_user_name || a.current_user),
                q(a.contractual_user_name),
                q(a.dept || a.assigned_dept),
                q(a.desig || a.assigned_desig),
                a.year_of_purchase || ''
            ];
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
        res.send('\uFEFF' + csv);
    });
});

// POST /api/assets — Create
router.post('/', authenticateToken, validateAsset, (req, res, next) => {
    const d = req.body;
    const currentUser = (d.current_user || 'IT Store').trim();
    let status;
    if (d.status && typeof d.status === 'string' && d.status.trim()) {
        const trimmedStatus = d.status.trim();
        if (!VALID_STATUSES.includes(trimmedStatus)) {
            return res.status(400).json({ error: "Invalid status. Allowed statuses: 'In Stock', 'Assigned', 'Faulty', 'Scrap'" });
        }
        status = trimmedStatus;
    } else {
        status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';
    }

    // Auto-generate asset tag if not provided
    const finishInsert = (assetTag) => {
        const sql = `INSERT INTO assets (name, serial_number, asset_tag, charger_serial, monitor_make, monitor_serial, keyboard_make, mouse_make, make, model, ip_address, hostname, current_user, contractual_user_name, assigned_dept, assigned_desig, employee_id, linked_asset_id, status, remark, year_of_purchase, kva, warranty_expiry, last_update) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`;
        const params = [
            d.name?.trim(), d.serial_number?.trim(), assetTag || '', d.charger_serial || '', d.monitor_make || '',
            d.monitor_serial || '', d.keyboard_make || '', d.mouse_make || '', d.make || '', d.model || '', d.ip_address || '', d.hostname || '',
            currentUser, d.contractual_user_name || '', d.assigned_dept || '', d.assigned_desig || '', d.employee_id || null,
            d.linked_asset_id || null, status, d.remark || '', d.year_of_purchase || null, d.kva || '', d.warranty_expiry || ''
        ];

        db.run(sql, params, function (err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE constraint failed: assets.serial_number')) {
                    return res.status(409).json({ error: 'Asset with this serial number already exists' });
                }
                return next(err);
            }
            res.status(201).json({ id: this.lastID, asset_tag: assetTag, message: 'Asset created' });
        });
    };

    if (d.asset_tag) {
        finishInsert(d.asset_tag);
    } else {
        generateAssetTag(d.assigned_dept, d.name, (err, tag) => {
            finishInsert(err ? '' : tag);
        });
    }
});

// PUT /api/assets/:id — Update
router.put('/:id', authenticateToken, validateAsset, (req, res, next) => {
    const d = req.body;
    const currentUser = (d.current_user || 'IT Store').trim();

    // Determine status: if caller explicitly sends a status, validate and use it.
    // If status is absent/empty:
    //   - Preserve Faulty / Scrap (terminal states — never auto-override them)
    //   - For In Stock / Assigned, auto-infer from current_user (preserves T1.17 behaviour)
    const resolveStatus = (currentDbStatus, callback) => {
        if (d.status && typeof d.status === 'string' && d.status.trim()) {
            const trimmedStatus = d.status.trim();
            if (!VALID_STATUSES.includes(trimmedStatus)) {
                return callback(new Error('INVALID_STATUS'));
            }
            return callback(null, trimmedStatus);
        }
        // No status supplied
        const TERMINAL_STATUSES = ['Faulty', 'Scrap'];
        if (TERMINAL_STATUSES.includes(currentDbStatus)) {
            // Preserve terminal state — caller must explicitly change it
            return callback(null, currentDbStatus);
        }
        // Auto-infer from current_user for non-terminal states
        const inferred = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';
        callback(null, inferred);
    };

    db.get('SELECT status FROM assets WHERE id = ?', [req.params.id], (fetchErr, existing) => {
        if (fetchErr) return next(fetchErr);
        if (!existing) return res.status(404).json({ error: 'Asset not found' });

        resolveStatus(existing.status, (statusErr, status) => {
            if (statusErr && statusErr.message === 'INVALID_STATUS') {
                return res.status(400).json({ error: "Invalid status. Allowed statuses: 'In Stock', 'Assigned', 'Faulty', 'Scrap'" });
            }
            if (statusErr) return next(statusErr);

            const sql = `UPDATE assets SET name=?, serial_number=?, asset_tag=?, charger_serial=?, monitor_make=?, monitor_serial=?, keyboard_make=?, mouse_make=?, make=?, model=?, ip_address=?, hostname=?, current_user=?, contractual_user_name=?, assigned_dept=?, assigned_desig=?, employee_id=?, linked_asset_id=?, status=?, remark=?, year_of_purchase=?, kva=?, warranty_expiry=?, last_update=datetime('now') WHERE id=?`;
            const params = [
                d.name?.trim(), d.serial_number?.trim(), d.asset_tag || '', d.charger_serial || '', d.monitor_make || '',
                d.monitor_serial || '', d.keyboard_make || '', d.mouse_make || '', d.make || '', d.model || '', d.ip_address || '', d.hostname || '',
                currentUser, d.contractual_user_name || '', d.assigned_dept || '', d.assigned_desig || '', d.employee_id || null,
                d.linked_asset_id || null, status, d.remark || '', d.year_of_purchase || null, d.kva || '', d.warranty_expiry || '',
                req.params.id
            ];

            db.run(sql, params, function (err) {
                if (err) {
                    if (err.message && err.message.includes('UNIQUE constraint failed: assets.serial_number')) {
                        return res.status(409).json({ error: 'Asset with this serial number already exists' });
                    }
                    return next(err);
                }
                if (this.changes === 0) return res.status(404).json({ error: 'Asset not found' });
                res.json({ updated: this.changes, message: 'Asset updated' });
            });
        });
    });
});

// DELETE /api/assets/:id — Admin-only with audit trail entry
router.delete('/:id', authenticateToken, requireAdmin, (req, res, next) => {
    const assetId = req.params.id;

    db.get('SELECT * FROM assets WHERE id = ?', [assetId], (err, asset) => {
        if (err) return next(err);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const refNo = `AAI/VABO/IT/DELETE/${new Date().getFullYear()}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const transSql = `INSERT INTO transactions 
            (type, asset_ids, asset_names, ref_no, date, employee_name, employee_desig, employee_dept, issuer_name, issuer_desig, issuer_dept, remark, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
        const transParams = [
            'deletion',
            JSON.stringify([asset.id]),
            asset.name,
            refNo,
            new Date().toISOString().split('T')[0],
            asset.current_user || 'IT Store',
            asset.assigned_desig || '',
            asset.assigned_dept || '',
            req.user.username,
            'Administrator',
            'IT/CNS',
            `Asset deleted: ${asset.name} (S/N: ${asset.serial_number || 'N/A'}, Tag: ${asset.asset_tag || 'N/A'}) by ${req.user.username}`
        ];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return next(beginErr);

                db.run(transSql, transParams, function (tErr) {
                    if (tErr) {
                        return db.run('ROLLBACK', () => next(tErr));
                    }

                    // Null out the reciprocal linked_asset_id pointer on any partner asset
                    db.run('UPDATE assets SET linked_asset_id = NULL WHERE linked_asset_id = ?', [assetId], function (unlinkErr) {
                        if (unlinkErr) {
                            return db.run('ROLLBACK', () => next(unlinkErr));
                        }

                        db.run('DELETE FROM assets WHERE id = ?', [assetId], function (dErr) {
                            if (dErr) {
                                return db.run('ROLLBACK', () => next(dErr));
                            }
                            const deletedCount = this.changes;
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    return db.run('ROLLBACK', () => next(commitErr));
                                }
                                res.json({ deleted: deletedCount, message: 'Asset deleted' });
                            });
                        });
                    });
                });
            });
        });
    });
});

// POST /api/assets/:id/link — Mutual asset linking
router.post('/:id/link', authenticateToken, (req, res, next) => {
    const parentId = parseInt(req.params.id, 10);
    const childId = parseInt(req.body.child_id, 10);

    if (isNaN(parentId) || isNaN(childId)) {
        return res.status(400).json({ error: 'Valid parent asset ID and child_id are required' });
    }

    if (parentId === childId) {
        return res.status(400).json({ error: 'Cannot link an asset to itself' });
    }

    db.all('SELECT id, name, asset_tag, serial_number, current_user, linked_asset_id FROM assets WHERE id IN (?, ?)', [parentId, childId], (err, rows) => {
        if (err) return next(err);
        if (!rows || rows.length < 2) {
            return res.status(404).json({ error: 'One or both assets not found' });
        }

        const parent = rows.find(r => r.id === parentId);
        const child = rows.find(r => r.id === childId);

        // Reject if either asset already has an active link to prevent dangling/corrupt reciprocal pointers
        if (parent.linked_asset_id !== null && parent.linked_asset_id !== undefined) {
            return res.status(400).json({ error: `Asset #${parentId} is already linked to Asset #${parent.linked_asset_id}. Unlink it first.` });
        }
        if (child.linked_asset_id !== null && child.linked_asset_id !== undefined) {
            return res.status(400).json({ error: `Asset #${childId} is already linked to Asset #${child.linked_asset_id}. Unlink it first.` });
        }

        const refNo = `AAI/VABO/IT/LINK/${new Date().getFullYear()}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const transSql = `INSERT INTO transactions 
            (type, asset_ids, asset_names, ref_no, date, employee_name, employee_desig, employee_dept, issuer_name, issuer_desig, issuer_dept, remark, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
        const transParams = [
            'Link',
            JSON.stringify([parentId, childId]),
            `${parent.name}, ${child.name}`,
            refNo,
            new Date().toISOString().split('T')[0],
            parent.current_user || 'IT Store',
            '',
            '',
            req.user.username,
            req.user.role === 'admin' ? 'Administrator' : 'User',
            'IT/CNS',
            `Asset #${parentId} (${parent.name}) linked with Asset #${childId} (${child.name}) by ${req.user.username}`
        ];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return next(beginErr);

                db.run('UPDATE assets SET linked_asset_id = ?, last_update = datetime(\'now\') WHERE id = ?', [childId, parentId], function (pErr) {
                    if (pErr) {
                        return db.run('ROLLBACK', () => next(pErr));
                    }
                    db.run('UPDATE assets SET linked_asset_id = ?, last_update = datetime(\'now\') WHERE id = ?', [parentId, childId], function (cErr) {
                        if (cErr) {
                            return db.run('ROLLBACK', () => next(cErr));
                        }
                        db.run(transSql, transParams, function (tErr) {
                            if (tErr) {
                                return db.run('ROLLBACK', () => next(tErr));
                            }
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    return db.run('ROLLBACK', () => next(commitErr));
                                }
                                res.json({
                                    message: 'Assets linked successfully',
                                    parent_id: parentId,
                                    child_id: childId
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// POST /api/assets/:id/unlink — Mutual asset unlinking
router.post('/:id/unlink', authenticateToken, (req, res, next) => {
    const assetId = parseInt(req.params.id, 10);
    if (isNaN(assetId)) {
        return res.status(400).json({ error: 'Valid asset ID is required' });
    }

    db.get('SELECT id, name, linked_asset_id, current_user FROM assets WHERE id = ?', [assetId], (err, asset) => {
        if (err) return next(err);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        if (!asset.linked_asset_id) {
            return res.status(400).json({ error: 'Asset is not currently linked' });
        }

        const partnerId = asset.linked_asset_id;

        const refNo = `AAI/VABO/IT/UNLINK/${new Date().getFullYear()}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const transSql = `INSERT INTO transactions 
            (type, asset_ids, asset_names, ref_no, date, employee_name, employee_desig, employee_dept, issuer_name, issuer_desig, issuer_dept, remark, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
        const transParams = [
            'Unlink',
            JSON.stringify([assetId, partnerId]),
            asset.name,
            refNo,
            new Date().toISOString().split('T')[0],
            asset.current_user || 'IT Store',
            '',
            '',
            req.user.username,
            req.user.role === 'admin' ? 'Administrator' : 'User',
            'IT/CNS',
            `Asset #${assetId} (${asset.name}) unlinked from Asset #${partnerId} by ${req.user.username}`
        ];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return next(beginErr);

                db.run('UPDATE assets SET linked_asset_id = NULL, last_update = datetime(\'now\') WHERE id = ?', [assetId], function (u1Err) {
                    if (u1Err) {
                        return db.run('ROLLBACK', () => next(u1Err));
                    }
                    db.run('UPDATE assets SET linked_asset_id = NULL, last_update = datetime(\'now\') WHERE id = ?', [partnerId], function (u2Err) {
                        if (u2Err) {
                            return db.run('ROLLBACK', () => next(u2Err));
                        }
                        db.run(transSql, transParams, function (tErr) {
                            if (tErr) {
                                return db.run('ROLLBACK', () => next(tErr));
                            }
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    return db.run('ROLLBACK', () => next(commitErr));
                                }
                                res.json({ message: 'Assets unlinked successfully' });
                            });
                        });
                    });
                });
            });
        });
    });
});

// POST /api/assets/wizard — Multi-Asset Entry Wizard (transactional bulk assign)
router.post('/wizard', authenticateToken, (req, res, next) => {
    const { employee, assets: wizardAssets, ip_address, hostname } = req.body;

    if (!employee || !wizardAssets || !Array.isArray(wizardAssets) || wizardAssets.length === 0) {
        return res.status(400).json({ error: 'Employee info and at least one asset are required' });
    }

    // Check for duplicate serial numbers in input (only for provided serial numbers)
    const serials = wizardAssets
        .map(a => (a.serial_number || '').trim().toLowerCase())
        .filter(s => s.length > 0);
    const uniqueSerials = new Set(serials);
    if (uniqueSerials.size !== serials.length) {
        return res.status(400).json({ error: 'Duplicate serial numbers found in the wizard input' });
    }

    // Check for existing serial numbers in DB (case-insensitive)
    const checkSql = `SELECT serial_number FROM assets WHERE LOWER(serial_number) IN (${serials.map(() => '?').join(',')})`;
    db.all(checkSql, serials, (err, existing) => {
        if (err) return next(err);
        if (existing && existing.length > 0) {
            const dupes = existing.map(e => e.serial_number).join(', ');
            return res.status(409).json({ error: `Serial number(s) already exist: ${dupes}` });
        }

        // All clear — begin transaction
        const currentUser = (employee.name || 'IT Store').trim();
        const status = (currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned';
        const assetIds = [];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return next(beginErr);

                // Insert employee if not exists
                db.run(
                    `INSERT OR IGNORE INTO employees (name, designation, department) VALUES (?, ?, ?)`,
                    [employee.name, employee.designation || '', employee.department || ''],
                    function (empErr) {
                        if (empErr) {
                            return db.run('ROLLBACK', () => next(empErr));
                        }

                        // Get employee ID
                        db.get(`SELECT id FROM employees WHERE name = ?`, [employee.name], async (getEmpErr, empRow) => {
                            if (getEmpErr) {
                                return db.run('ROLLBACK', () => next(getEmpErr));
                            }
                            const empId = empRow?.id || null;

                            // Cache tag sequence counters per prefix to guarantee sequential, collision-free numbers
                            const tagCounters = {};

                            function getSequentialTag(dept, type) {
                                return new Promise((resolve, reject) => {
                                    const prefix = `VABO-IT/CNS-${(dept || 'GEN').substring(0, 3).toUpperCase()}-${(type || 'IT').substring(0, 3).toUpperCase()}-`;
                                    if (tagCounters[prefix] !== undefined) {
                                        tagCounters[prefix] += 1;
                                        const nextSeq = String(tagCounters[prefix]).padStart(2, '0');
                                        return resolve(`${prefix}${nextSeq}`);
                                    }

                                    db.all(`SELECT asset_tag FROM assets WHERE asset_tag LIKE ?`, [`${prefix}%`], (err, rows) => {
                                        if (err) return reject(err);
                                        let maxSeq = 0;
                                        if (rows) {
                                            rows.forEach(row => {
                                                const match = (row.asset_tag || '').match(/-(\d+)$/);
                                                if (match) {
                                                    const seq = parseInt(match[1], 10);
                                                    if (seq > maxSeq) maxSeq = seq;
                                                }
                                            });
                                        }
                                        tagCounters[prefix] = maxSeq + 1;
                                        const nextSeq = String(tagCounters[prefix]).padStart(2, '0');
                                        resolve(`${prefix}${nextSeq}`);
                                    });
                                });
                            }

                            try {
                                for (const a of wizardAssets) {
                                    const assetTag = (a.asset_tag && a.asset_tag.trim())
                                        ? a.asset_tag.trim()
                                        : await getSequentialTag(employee.department, a.name);

                                    const insertSql = `INSERT INTO assets (
                                        name, serial_number, asset_tag, charger_serial, monitor_make, monitor_serial,
                                        keyboard_make, mouse_make, make, model, ip_address, hostname,
                                        current_user, contractual_user_name, assigned_dept, assigned_desig,
                                        employee_id, status, remark, year_of_purchase, kva, warranty_expiry, last_update
                                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`;

                                    const contractualUser = a.contractual_user_name || employee.physical_holder || employee.contractual_user_name || '';
                                    const itemIp = (a.ip_address !== undefined && a.ip_address !== null) ? a.ip_address : (ip_address || '');
                                    const itemHostname = (a.hostname !== undefined && a.hostname !== null) ? a.hostname : (hostname || '');

                                    const params = [
                                        a.name || '', a.serial_number || '', assetTag || '', a.charger_serial || '',
                                        a.monitor_make || '', a.monitor_serial || '', a.keyboard_make || '', a.mouse_make || '',
                                        a.make || '', a.model || '', itemIp, itemHostname,
                                        currentUser, contractualUser, employee.department || '', employee.designation || '',
                                        empId, status, a.remark || '', a.year_of_purchase || null, a.kva || '', a.warranty_expiry || ''
                                    ];

                                    await new Promise((resolve, reject) => {
                                        db.run(insertSql, params, function (insertErr) {
                                            if (insertErr) return reject(insertErr);
                                            assetIds.push(this.lastID);
                                            resolve();
                                        });
                                    });
                                }

                                // Create transaction record
                                const refNo = `AAI/VABO/IT/HANDOVER/${new Date().getFullYear()}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                                const transSql = `INSERT INTO transactions (
                                    type, asset_ids, asset_names, ref_no, date,
                                    employee_name, employee_desig, employee_dept, employee_id,
                                    issuer_name, issuer_desig, issuer_dept, remark, timestamp
                                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`;
                                const transParams = [
                                    'handover', JSON.stringify(assetIds),
                                    wizardAssets.map(a => a.name).join(', '), refNo,
                                    new Date().toISOString().split('T')[0],
                                    employee.name, employee.designation || '', employee.department || '',
                                    empId, req.user?.username || '', '', '', 'Multi-asset wizard entry'
                                ];

                                db.run(transSql, transParams, function (tErr) {
                                    if (tErr) {
                                        return db.run('ROLLBACK', () => next(tErr));
                                    }
                                    const transId = this.lastID;
                                    db.run('COMMIT', (commitErr) => {
                                        if (commitErr) {
                                            return db.run('ROLLBACK', () => next(commitErr));
                                        }
                                        res.status(201).json({
                                            message: `${assetIds.length} assets registered and assigned to ${employee.name}`,
                                            asset_ids: assetIds,
                                            transaction_id: transId
                                        });
                                    });
                                });
                            } catch (loopErr) {
                                return db.run('ROLLBACK', () => {
                                    if (loopErr.message && loopErr.message.includes('UNIQUE constraint failed: assets.serial_number')) {
                                        return res.status(409).json({ error: 'Asset with this serial number already exists' });
                                    }
                                    next(loopErr);
                                });
                            }
                        });
                    }
                );
            });
        });
    });
});

// POST /api/assets/bulk — Bulk import (Upsert by serial_number)
router.post('/bulk', authenticateToken, (req, res, next) => {
    const { assets } = req.body;
    if (!Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({ error: 'Assets array is required' });
    }

    const validAssets = assets.filter(d => d !== null && d !== undefined && typeof d === 'object' && !Array.isArray(d));
    if (validAssets.length === 0) {
        return res.status(400).json({ error: 'No valid asset records provided' });
    }

    let count = 0;
    // UPSERT: Insert or Update on serial_number conflict
    const sql = `
        INSERT INTO assets (
            name, serial_number, asset_tag, charger_serial, monitor_make, monitor_serial,
            keyboard_make, mouse_make, make, model, ip_address, hostname, current_user,
            contractual_user_name, assigned_dept, assigned_desig, employee_id, linked_asset_id,
            status, remark, year_of_purchase, kva, warranty_expiry, last_update
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(serial_number) DO UPDATE SET
            name=excluded.name,
            asset_tag=excluded.asset_tag,
            charger_serial=excluded.charger_serial,
            monitor_make=excluded.monitor_make,
            monitor_serial=excluded.monitor_serial,
            keyboard_make=excluded.keyboard_make,
            mouse_make=excluded.mouse_make,
            make=excluded.make,
            model=excluded.model,
            ip_address=excluded.ip_address,
            hostname=excluded.hostname,
            current_user=excluded.current_user,
            contractual_user_name=excluded.contractual_user_name,
            assigned_dept=excluded.assigned_dept,
            assigned_desig=excluded.assigned_desig,
            employee_id=excluded.employee_id,
            linked_asset_id=excluded.linked_asset_id,
            status=excluded.status,
            remark=excluded.remark,
            year_of_purchase=excluded.year_of_purchase,
            kva=excluded.kva,
            warranty_expiry=excluded.warranty_expiry,
            last_update=datetime('now')
    `;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
            if (beginErr) return next(beginErr);

            try {
                let hasError = false;
                let firstError = null;
                const stmt = db.prepare(sql, (prepErr) => {
                    if (prepErr) {
                        return db.run('ROLLBACK', () => next(prepErr));
                    }
                });

                for (const d of validAssets) {
                    if (!d || typeof d !== 'object') continue;
                    const currentUser = (d.current_user || 'IT Store').trim();
                    const status = d.status ? d.status.trim() : ((currentUser.toLowerCase() === 'it store') ? 'In Stock' : 'Assigned');
                    stmt.run([
                        d.name || '', d.serial_number || '', d.asset_tag || '', d.charger_serial || '', d.monitor_make || '',
                        d.monitor_serial || '', d.keyboard_make || '', d.mouse_make || '', d.make || '', d.model || '', d.ip_address || '', d.hostname || '',
                        currentUser, d.contractual_user_name || '', d.assigned_dept || '', d.assigned_desig || '', d.employee_id || null,
                        d.linked_asset_id || null, status, d.remark || '', d.year_of_purchase || null, d.kva || '', d.warranty_expiry || ''
                    ], function (runErr) {
                        if (runErr && !hasError) {
                            hasError = true;
                            firstError = runErr;
                        }
                    });
                    count++;
                }

                stmt.finalize((finalizeErr) => {
                    if (hasError || finalizeErr) {
                        return db.run('ROLLBACK', () => next(firstError || finalizeErr));
                    }
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            return db.run('ROLLBACK', () => next(commitErr));
                        }
                        res.json({ imported: count, message: `${count} assets processed (inserted/updated)` });
                    });
                });
            } catch (err) {
                return db.run('ROLLBACK', () => next(err));
            }
        });
    });
});

module.exports = router;
