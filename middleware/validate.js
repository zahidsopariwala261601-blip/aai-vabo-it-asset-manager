function validateAsset(req, res, next) {
    const { name, serial_number } = req.body;
    const errors = [];

    if (!name || name.trim().length === 0) {
        errors.push('Asset name is required');
    }
    if (!serial_number || serial_number.trim().length === 0) {
        errors.push('Serial number is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
}

function validateUser(req, res, next) {
    const { username, password } = req.body;
    const errors = [];

    if (!username || username.trim().length < 3) {
        errors.push('Username must be at least 3 characters');
    }
    if (!password || password.length < 4) {
        errors.push('Password must be at least 4 characters');
    }
    if (username && /[^a-zA-Z0-9_]/.test(username)) {
        errors.push('Username may only contain letters, numbers, and underscores');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
}

function validateTransaction(req, res, next) {
    const { type, asset_ids, employee_name } = req.body;
    const errors = [];

    if (!type || !['handover', 'takeover'].includes(type)) {
        errors.push('Transaction type must be "handover" or "takeover"');
    }
    if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
        errors.push('At least one asset must be selected');
    }
    if (!employee_name || employee_name.trim().length === 0) {
        errors.push('Employee name is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
}

module.exports = { validateAsset, validateUser, validateTransaction };
