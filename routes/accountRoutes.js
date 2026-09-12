const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, (req, res, next) => {
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return next(err);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Administrator access required' });
        }
        next();
    });
});

// ─── Admin API Routes ──────────────────────────────────────────

// GET all users
router.get('/users', (req, res) => {
    db.all(`SELECT id, username, role FROM users ORDER BY id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST create user
router.post('/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (role !== undefined && !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be user or admin' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
            [username.trim(), hash, role || 'user'],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'User already exists' });
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ id: this.lastID, username: username.trim(), role: role || 'user' });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT reset password
router.put('/users/:id/password', async (req, res) => {
    const { password } = req.body;
    const { id } = req.params;
    if (typeof password !== 'string' || !password) return res.status(400).json({ error: 'Password required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
            res.json({ message: 'Password updated' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE user
router.delete('/users/:id', (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) {
        return res.status(400).json({ error: 'Valid user ID required' });
    }

    if (req.user.id === targetId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.get('SELECT id, role FROM users WHERE id = ?', [targetId], (err, targetUser) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        if (targetUser.role === 'admin') {
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", [], (countErr, row) => {
                if (countErr) return res.status(500).json({ error: countErr.message });
                if (row.count <= 1) {
                    return res.status(400).json({ error: 'Cannot delete the last remaining administrator account' });
                }
                executeDelete();
            });
        } else {
            executeDelete();
        }

        function executeDelete() {
            db.run(`DELETE FROM users WHERE id = ?`, [targetId], function (delErr) {
                if (delErr) return res.status(500).json({ error: delErr.message });
                if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
                res.json({ message: 'User deleted' });
            });
        }
    });
});

module.exports = router;
