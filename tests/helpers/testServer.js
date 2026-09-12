const net = require('node:net');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

const projectRoot = path.resolve(__dirname, '..', '..');

async function getFreePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

/**
 * Boots an isolated Express server and SQLite database for test suites.
 */
async function startTestServer(options = {}) {
    const prefix = options.prefix || 'aai-test-';
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const databasePath = path.join(directory, 'test.db');
    let child = null;
    let exited = null;
    let logs = '';

    // Pre-create tables and default admin if desired
    const adminUser = options.adminUser || {
        username: 'test-admin',
        password: 'test-admin-password',
        role: 'admin'
    };

    const db = new sqlite3.Database(databasePath);
    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    try {
        await run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        )`);
        await run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            asset_ids TEXT NOT NULL,
            asset_names TEXT DEFAULT '',
            ref_no TEXT DEFAULT '',
            date TEXT DEFAULT '',
            employee_name TEXT NOT NULL,
            employee_desig TEXT DEFAULT '',
            employee_dept TEXT DEFAULT '',
            issuer_name TEXT DEFAULT '',
            issuer_desig TEXT DEFAULT '',
            issuer_dept TEXT DEFAULT '',
            employee_id INTEGER DEFAULT NULL,
            issuer_id INTEGER DEFAULT NULL,
            remark TEXT DEFAULT '',
            edit_history TEXT DEFAULT '[]',
            last_edited_by TEXT DEFAULT '',
            last_edited_at DATETIME DEFAULT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            deleted_by TEXT DEFAULT '',
            deleted_at DATETIME,
            delete_reason TEXT DEFAULT '',
            is_protected INTEGER DEFAULT 0
        )`);
        if (adminUser) {
            const hash = await bcrypt.hash(adminUser.password, 4);
            await run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                [adminUser.username, hash, adminUser.role]);
        }
    } finally {
        await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
    }

    const port = await getFreePort();
    const env = {
        ...process.env,
        PORT: String(port),
        DB_PATH: databasePath,
        JWT_SECRET: options.jwtSecret || 'test-jwt-secret-key-12345',
        NODE_ENV: 'test',
        RATE_LIMIT_MAX: '10000',
        ...options.env
    };

    child = spawn(process.execPath, ['server.js'], {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    exited = once(child, 'exit');
    child.stdout.on('data', chunk => { logs += chunk; });
    child.stderr.on('data', chunk => { logs += chunk; });

    const base = `http://127.0.0.1:${port}`;
    let ready = false;

    for (let attempt = 0; attempt < 80; attempt++) {
        if (child.exitCode !== null) {
            throw new Error(`Server process exited prematurely with code ${child.exitCode}: ${logs}`);
        }
        try {
            const res = await fetch(`${base}/api/health`);
            if (res.ok) {
                ready = true;
                break;
            }
        } catch {
            // Server still starting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!ready) {
        if (child.exitCode === null) child.kill();
        await fs.rm(directory, { recursive: true, force: true });
        throw new Error(`Server failed to respond to /api/health within timeout:\n${logs}`);
    }

    // Login as admin to get a ready-to-use token
    let adminToken = null;
    if (adminUser) {
        const loginRes = await fetch(`${base}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: adminUser.username, password: adminUser.password })
        });
        if (loginRes.ok) {
            const data = await loginRes.json();
            adminToken = data.token;
        }
    }

    async function request(url, { method = 'GET', token, body, headers = {}, status } = {}) {
        const finalHeaders = {
            ...headers
        };
        if (token) {
            finalHeaders['Authorization'] = `Bearer ${token}`;
        }
        if (body !== undefined && !finalHeaders['Content-Type']) {
            finalHeaders['Content-Type'] = 'application/json';
        }

        const response = await fetch(base + url, {
            method,
            headers: finalHeaders,
            body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
        });

        const contentType = response.headers.get('content-type') || '';
        let data = null;
        let text = null;

        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch {
                data = null;
            }
        } else {
            text = await response.text();
        }

        if (status !== undefined && response.status !== status) {
            const errDetails = data ? JSON.stringify(data) : text;
            throw new Error(`Expected HTTP ${status} from ${method} ${url}, got ${response.status}: ${errDetails}`);
        }

        return {
            status: response.status,
            headers: response.headers,
            data,
            text,
            raw: response
        };
    }

    async function close() {
        if (child && child.exitCode === null) {
            child.kill();
            await exited;
        }
        try {
            await fs.rm(directory, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors on Windows temp locks
        }
    }

    return {
        base,
        port,
        databasePath,
        directory,
        adminToken,
        adminUser,
        request,
        close,
        getLogs: () => logs
    };
}

module.exports = { startTestServer, getFreePort };
