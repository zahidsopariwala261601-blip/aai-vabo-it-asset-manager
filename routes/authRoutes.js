const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { generateToken } = require('../middleware/auth');
const { validateUser } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/register
router.post('/register', validateUser, async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const hash = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (username, password) VALUES (?, ?)`,
            [username.trim(), hash],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key') || err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Username already exists' });
                    }
                    return next(err);
                }
                const user = { id: this.lastID, username: username.trim(), role: 'user' };
                const token = generateToken(user);
                res.status(201).json({ message: 'Registration successful', token, user: { id: user.id, username: user.username, role: user.role } });
            }
        );
    } catch (err) {
        next(err);
    }
});

// POST /api/login
router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username.trim()], async (err, user) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateToken(user);
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    });
});

// GET /api/me - Get current user info
router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// PUT /api/auth/change-password - User self-service password change
router.put('/change-password', authenticateToken, async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) return next(err);
        if (!user) return res.status(404).json({ error: 'User not found' });

        try {
            const matches = await bcrypt.compare(currentPassword, user.password);
            if (!matches) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            const hash = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id], function (updateErr) {
                if (updateErr) return next(updateErr);
                res.json({ message: 'Password updated successfully' });
            });
        } catch (bcryptErr) {
            next(bcryptErr);
        }
    });
});

module.exports = router;

