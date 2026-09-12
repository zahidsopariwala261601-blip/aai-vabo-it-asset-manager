const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to validate employee data
const validateEmployee = (req, res, next) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Employee Name is required' });
    }
    next();
};

// GET /api/employees — List all active employees
router.get('/', authenticateToken, (req, res, next) => {
    db.all(`SELECT * FROM employees WHERE status = 'Active' ORDER BY name ASC`, [], (err, rows) => {
        if (err) return next(err);
        res.json(rows);
    });
});

// POST /api/employees — Create
router.post('/', authenticateToken, validateEmployee, (req, res, next) => {
    const { name, designation, department } = req.body;
    const sql = `INSERT INTO employees (name, designation, department) VALUES (?, ?, ?)`;
    const params = [name.trim(), designation || '', department || ''];

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Employee with this name already exists' });
            }
            return next(err);
        }
        res.status(201).json({ id: this.lastID, message: 'Employee created' });
    });
});

// PUT /api/employees/:id — Update
router.put('/:id', authenticateToken, validateEmployee, (req, res, next) => {
    const { name, designation, department } = req.body;
    const sql = `UPDATE employees SET name = ?, designation = ?, department = ? WHERE id = ?`;
    const params = [name.trim(), designation || '', department || '', req.params.id];

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Another employee with this name already exists' });
            }
            return next(err);
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
        res.json({ updated: this.changes, message: 'Employee updated' });
    });
});

// DELETE /api/employees/:id — Soft delete
router.delete('/:id', authenticateToken, (req, res, next) => {
    db.run(`UPDATE employees SET status = 'Inactive' WHERE id = ?`, req.params.id, function (err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
        res.json({ deleted: this.changes, message: 'Employee removed' });
    });
});

module.exports = router;
