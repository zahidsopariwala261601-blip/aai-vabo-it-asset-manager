const express = require('express');
const { db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { validateTransaction } = require('../middleware/validate');

const router = express.Router();

// Admin-only guard middleware
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permission required to edit audit logs' });
    }
    next();
}

// GET /api/transactions
router.get('/', authenticateToken, (req, res, next) => {
    const { page = 1, limit = 100, show_deleted = 0 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE is_deleted = 0";
    if (show_deleted === "1") whereClause = "";

    db.get(`SELECT COUNT(*) as total FROM transactions ${whereClause}`, (err, countRow) => {
        if (err) return next(err);

        const sql = `
            SELECT t.*,
                   COALESCE(e.name, t.employee_name) as employee_name,
                   COALESCE(e.designation, t.employee_desig) as employee_desig,
                   COALESCE(e.department, t.employee_dept) as employee_dept,
                   COALESCE(i.name, t.issuer_name) as issuer_name,
                   COALESCE(i.designation, t.issuer_desig) as issuer_desig,
                   COALESCE(i.department, t.issuer_dept) as issuer_dept
            FROM transactions t
            LEFT JOIN employees e ON t.employee_id = e.id
            LEFT JOIN employees i ON t.issuer_id = i.id
            ${whereClause} 
            ORDER BY t.timestamp DESC 
            LIMIT ? OFFSET ?
        `;

        db.all(
            sql,
            [parseInt(limit), offset],
            (err, rows) => {
                if (err) return next(err);
                res.json({
                    data: rows,
                    total: countRow.total,
                    page: parseInt(page),
                    totalPages: Math.ceil(countRow.total / parseInt(limit))
                });
            }
        );
    });
});

// DELETE /api/transactions/:id — Soft Delete Audit Log (Admin Only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res, next) => {
    const { id } = req.params;
    const { reason, override_protected = false } = req.body;
    const deletedBy = req.user.username;

    db.get(`SELECT is_protected FROM transactions WHERE id = ?`, [id], (err, row) => {
        if (err) return next(err);
        if (!row) return res.status(404).json({ error: 'Audit log not found' });

        if (row.is_protected && !override_protected) {
            return res.status(403).json({ 
                error: 'PROTECTED RECORD', 
                message: 'This record is marked as protected and cannot be deleted without override.' 
            });
        }

        db.run(
            `UPDATE transactions SET 
                is_deleted = 1, 
                deleted_by = ?, 
                deleted_at = datetime('now'), 
                delete_reason = ? 
             WHERE id = ?`,
            [deletedBy, reason || 'Manual cleanup', id],
            function(err) {
                if (err) return next(err);
                res.json({ 
                    message: 'Audit log and all linked trails updated successfully',
                    affected_id: id,
                    deleted_by: deletedBy,
                    deleted_at: new Date().toISOString()
                });
            }
        );
    });
});

// POST /api/transactions — Create and auto-update asset statuses
router.post('/', authenticateToken, validateTransaction, (req, res, next) => {
    const d = req.body;
    const assetIds = Array.isArray(d.asset_ids) ? d.asset_ids : [];

    // Prior to executing the transaction updates, verify that ALL IDs in d.asset_ids exist in the assets table
    if (assetIds.length > 0) {
        const placeholders = assetIds.map(() => '?').join(',');
        db.all(`SELECT id FROM assets WHERE id IN (${placeholders})`, assetIds, (err, rows) => {
            if (err) return next(err);
            const foundIds = new Set((rows || []).map(r => r.id));
            const hasMissing = assetIds.some(id => !foundIds.has(Number(id)));
            if (hasMissing) {
                return res.status(404).json({ error: 'One or more specified assets not found' });
            }
            executeTransaction();
        });
    } else {
        executeTransaction();
    }

    function executeTransaction() {
        const assetIdsStr = JSON.stringify(d.asset_ids);

        const sql = `INSERT INTO transactions
            (type, asset_ids, asset_names, ref_no, date,
             employee_name, employee_desig, employee_dept,
             issuer_name, issuer_desig, issuer_dept, remark, timestamp, employee_id, issuer_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?,?)`;
        const params = [
            d.type, assetIdsStr, d.asset_names || '', d.ref_no || '', d.date || '',
            d.employee_name, d.employee_desig || '', d.employee_dept || '',
            d.issuer_name || '', d.issuer_desig || '', d.issuer_dept || '',
            d.remark || '', d.employee_id || null, d.issuer_id || null
        ];

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return next(beginErr);

                db.run(sql, params, function (txErr) {
                    if (txErr) {
                        return db.run('ROLLBACK', () => next(txErr));
                    }
                    const transId = this.lastID;

                    const handoverSql = `UPDATE assets SET
                        status                = 'Assigned',
                        current_user          = ?,
                        contractual_user_name = ?,
                        assigned_dept         = ?,
                        assigned_desig        = ?,
                        employee_id           = ?,
                        ip_address            = ?,
                        hostname              = ?,
                        last_update           = datetime('now')
                     WHERE id = ?`;

                    const takeoverSql = `UPDATE assets SET
                        status                = 'In Stock',
                        current_user          = 'IT Store',
                        contractual_user_name = '',
                        assigned_dept         = '',
                        assigned_desig        = '',
                        employee_id           = NULL,
                        ip_address            = '',
                        hostname              = '',
                        last_update           = datetime('now')
                     WHERE id = ?`;

                    const contractualUser = (d.contractual_user_name !== undefined && d.contractual_user_name !== null && d.contractual_user_name !== '')
                        ? d.contractual_user_name
                        : (d.employee_name || '');

                    let updateFailed = false;
                    let completedCount = 0;
                    const totalUpdates = d.asset_ids.length;

                    if (totalUpdates === 0) {
                        return db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                return db.run('ROLLBACK', () => next(commitErr));
                            }
                            res.status(201).json({ id: transId, message: 'Transaction recorded & assets updated' });
                        });
                    }

                    d.asset_ids.forEach(id => {
                        const query = d.type === 'handover' ? handoverSql : takeoverSql;
                        const updateParams = d.type === 'handover' ? [
                            d.employee_name,
                            contractualUser,
                            d.employee_dept  || '',
                            d.employee_desig || '',
                            d.employee_id    || null,
                            d.new_ip_address || '',
                            d.new_hostname   || '',
                            id
                        ] : [id];

                        db.run(query, updateParams, function (uErr) {
                            if (updateFailed) return;
                            if (uErr) {
                                updateFailed = true;
                                return db.run('ROLLBACK', () => next(uErr));
                            }
                            if (this.changes === 0) {
                                updateFailed = true;
                                return db.run('ROLLBACK', () => res.status(404).json({ error: 'One or more specified assets not found' }));
                            }
                            completedCount++;
                            if (completedCount === totalUpdates) {
                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        return db.run('ROLLBACK', () => next(commitErr));
                                    }
                                    res.status(201).json({ id: transId, message: 'Transaction recorded & assets updated' });
                                });
                            }
                        });
                    });
                });
            });
        });
    }
});

// PUT /api/transactions/:id — Admin-only: Edit audit log with full change tracking
router.put('/:id', authenticateToken, requireAdmin, (req, res, next) => {
    const { id } = req.params;
    const editorUsername = req.user.username;
    const d = req.body;

    db.get(`SELECT * FROM transactions WHERE id = ?`, [id], (err, existing) => {
        if (err) return next(err);
        if (!existing) return res.status(404).json({ error: 'Audit record not found' });

        const editableFields = [
            'employee_name', 'employee_desig', 'employee_dept', 'employee_id',
            'issuer_name', 'issuer_desig', 'issuer_dept', 'issuer_id',
            'ref_no', 'date', 'asset_names', 'timestamp', 'remark'
        ];

        const changes = {};
        editableFields.forEach(field => {
            if (d[field] !== undefined && String(d[field]) !== String(existing[field] || '')) {
                changes[field] = { old: existing[field], new: d[field] };
            }
        });

        if (Object.keys(changes).length === 0) {
            return res.status(400).json({ error: 'No changes detected' });
        }

        let existingHistory = [];
        try { existingHistory = JSON.parse(existing.edit_history || '[]'); } catch {}
        existingHistory.push({
            edited_by: editorUsername,
            edited_at: new Date().toISOString(),
            changes
        });

        const sql = `UPDATE transactions SET
            employee_name  = COALESCE(?, employee_name),
            employee_desig = COALESCE(?, employee_desig),
            employee_dept  = COALESCE(?, employee_dept),
            issuer_name    = COALESCE(?, issuer_name),
            issuer_desig   = COALESCE(?, issuer_desig),
            issuer_dept    = COALESCE(?, issuer_dept),
            ref_no         = COALESCE(?, ref_no),
            date           = COALESCE(?, date),
            asset_names    = COALESCE(?, asset_names),
            timestamp      = COALESCE(?, timestamp),
            remark         = COALESCE(?, remark),
            employee_id    = COALESCE(?, employee_id),
            issuer_id      = COALESCE(?, issuer_id),
            edit_history   = ?,
            last_edited_by = ?,
            last_edited_at = datetime('now')
        WHERE id = ?`;

        const params = [
            d.employee_name  !== undefined ? d.employee_name  : null,
            d.employee_desig !== undefined ? d.employee_desig : null,
            d.employee_dept  !== undefined ? d.employee_dept  : null,
            d.issuer_name    !== undefined ? d.issuer_name    : null,
            d.issuer_desig   !== undefined ? d.issuer_desig   : null,
            d.issuer_dept    !== undefined ? d.issuer_dept    : null,
            d.ref_no         !== undefined ? d.ref_no         : null,
            d.date           !== undefined ? d.date           : null,
            d.asset_names    !== undefined ? d.asset_names    : null,
            d.timestamp      !== undefined ? d.timestamp      : null,
            d.remark         !== undefined ? d.remark         : null,
            d.employee_id    !== undefined ? d.employee_id    : null,
            d.issuer_id      !== undefined ? d.issuer_id      : null,
            JSON.stringify(existingHistory),
            editorUsername,
            id
        ];

        db.run(sql, params, function (err) {
            if (err) return next(err);
            res.json({
                message: 'Audit record updated successfully',
                changes,
                change_count: Object.keys(changes).length
            });
        });
    });
});

// GET /api/transactions/asset/:id — Get full trail for a specific asset
router.get('/asset/:id', authenticateToken, (req, res, next) => {
    const assetId = req.params.id;
    db.all(
        `SELECT * FROM transactions 
         WHERE asset_ids LIKE ? 
         AND is_deleted = 0 
         ORDER BY timestamp ASC`,
        [`%${assetId}%`],
        (err, rows) => {
            if (err) return next(err);
            const filtered = rows.filter(t => {
                try {
                    const ids = JSON.parse(t.asset_ids);
                    return ids.includes(parseInt(assetId)) || ids.includes(String(assetId));
                } catch { return false; }
            });
            res.json(filtered);
        }
    );
});

// POST /api/print-logs — Record a print or reprint action
router.post('/print-logs', authenticateToken, (req, res, next) => {
    const { transaction_id, action_type, system_ip, system_hostname, ref_no, doc_type } = req.body;
    const printed_by = req.user.username;

    // Get logged-in user's department from employees table (best effort)
    db.get(`SELECT department FROM employees WHERE name = ?`, [printed_by], (err, emp) => {
        const dept = emp?.department || '';
        db.run(
            `INSERT INTO print_logs
             (transaction_id, action_type, printed_by, printed_by_dept, system_ip, system_hostname, ref_no, doc_type, print_timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [transaction_id || null, action_type || 'Print', printed_by, dept,
             system_ip || '', system_hostname || '', ref_no || '', doc_type || ''],
            function (err) {
                if (err) return next(err);
                res.status(201).json({ id: this.lastID, message: 'Print action logged' });
            }
        );
    });
});

// GET /api/print-logs — Retrieve print audit log
router.get('/print-logs', authenticateToken, (req, res, next) => {
    db.all(
        `SELECT p.* FROM print_logs p
         LEFT JOIN transactions t ON p.transaction_id = t.id
         WHERE t.is_deleted IS NULL OR t.is_deleted = 0
         ORDER BY p.print_timestamp DESC LIMIT 500`,
        [],
        (err, rows) => {
            if (err) return next(err);
            res.json(rows);
        }
    );
});

// GET /api/transactions/employee/:name — Get full trail for a specific employee
router.get('/employee/:name', authenticateToken, (req, res, next) => {
    const empName = req.params.name;
    const sql = `
        SELECT t.*,
               COALESCE(e.name, t.employee_name) as employee_name,
               COALESCE(e.designation, t.employee_desig) as employee_desig,
               COALESCE(e.department, t.employee_dept) as employee_dept,
               COALESCE(i.name, t.issuer_name) as issuer_name,
               COALESCE(i.designation, t.issuer_desig) as issuer_desig,
               COALESCE(i.department, t.issuer_dept) as issuer_dept
        FROM transactions t
        LEFT JOIN employees e ON t.employee_id = e.id
        LEFT JOIN employees i ON t.issuer_id = i.id
        WHERE (t.employee_name = ? OR e.name = ?)
        AND t.is_deleted = 0 
        ORDER BY t.timestamp ASC
    `;
    db.all(
        sql,
        [empName, empName],
        (err, rows) => {
            if (err) return next(err);
            res.json(rows);
        }
    );
});

module.exports = router;
