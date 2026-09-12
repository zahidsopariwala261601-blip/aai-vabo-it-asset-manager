const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

const root = path.resolve(__dirname, '..');

async function freePort() {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    return port;
}

test('single server serves the UI and APIs with administrator account management', { timeout: 30000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aai-asset-smoke-'));
    const database = path.join(directory, 'test.db');
    let child;
    let exited;
    let logs = '';
    try {
        const db = new sqlite3.Database(database);
        const run = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, err => err ? reject(err) : resolve());
        });
        try {
            await run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT \'user\')');
            await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                ['smoke-admin', await bcrypt.hash('smoke-password', 4), 'admin']);
        } finally {
            await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
        }

        const port = await freePort();
        child = spawn(process.execPath, ['server.js'], {
            cwd: root,
            env: { ...process.env, PORT: String(port), DB_PATH: database,
                JWT_SECRET: 'isolated-smoke-test-secret', NODE_ENV: 'test', RATE_LIMIT_MAX: '1000' },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        exited = once(child, 'exit');
        child.stdout.on('data', chunk => { logs += chunk; });
        child.stderr.on('data', chunk => { logs += chunk; });
        const base = `http://127.0.0.1:${port}`;
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (child.exitCode !== null) throw new Error(logs);
            try {
                const response = await fetch(`${base}/api/health`);
                if (response.ok) { ready = true; break; }
            } catch { /* Wait for startup. */ }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready, `Server did not start: ${logs}`);

        async function request(url, { token, method = 'GET', body, status = 200 } = {}) {
            const response = await fetch(base + url, {
                method,
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                ...(body !== undefined && { body: JSON.stringify(body) })
            });
            const data = await response.json();
            assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(data)}`);
            return data;
        }

        for (const page of ['/', '/accounts.html']) {
            const response = await fetch(base + page);
            assert.equal(response.status, 200);
            const html = await response.text();
            assert.match(html, /<!DOCTYPE html>/i);
            for (const match of html.matchAll(/(?:src|href)="(\/(?:js|css)\/[^"?#]+)"/g)) {
                const asset = await fetch(base + match[1]);
                assert.equal(asset.status, 200, match[1]);
                assert.doesNotMatch(asset.headers.get('content-type'), /text\/html/);
            }
        }
        await request('/api/admin/users', { status: 401 });
        await request('/api/assets', { status: 401 });
        await request('/api/missing', { status: 404 });
        const admin = await request('/api/auth/login', {
            method: 'POST', body: { username: 'smoke-admin', password: 'smoke-password' }
        });
        const token = admin.token;
        assert.equal((await request('/api/auth/me', { token })).user.role, 'admin');
        for (const url of ['/api/assets', '/api/assets/all', '/api/assets/stats',
            '/api/employees', '/api/transactions', '/api/transactions/print-logs']) {
            await request(url, { token });
        }
        const exportResponse = await fetch(base + '/api/assets/export', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(exportResponse.status, 200);
        assert.match(exportResponse.headers.get('content-type'), /text\/csv/);
        const exportCsvText = await exportResponse.text();
        assert.ok(exportCsvText.includes('ID,Asset_Tag,Asset Type,Serial,Charger_Serial,Monitor_Make,Monitor_Serial,Keyboard_Make,Mouse_Make,Make,Model,IP,Hostname,Holder,Physical_Asset_Holder,Department,Designation,Year_of_Purchase'));
        const created = await request('/api/admin/users', {
            token, method: 'POST', status: 201,
            body: { username: "smoke'user", password: 'initial-password', role: 'user' }
        });
        const users = await request('/api/admin/users', { token });
        assert.equal(users.length, 2);
        assert.ok(users.every(user => !('password' in user)));
        const regular = await request('/api/auth/login', {
            method: 'POST', body: { username: created.username, password: 'initial-password' }
        });
        for (const [method, url, body] of [
            ['GET', '/api/admin/users'],
            ['POST', '/api/admin/users', { username: 'blocked', password: 'blocked' }],
            ['PUT', `/api/admin/users/${created.id}/password`, { password: 'blocked' }],
            ['DELETE', `/api/admin/users/${created.id}`]
        ]) {
            await request(url, { token: regular.token, method, body, status: 403 });
        }
        await request(`/api/admin/users/${created.id}/password`, {
            token, method: 'PUT', body: { password: 'updated-password' }
        });
        await request('/api/auth/login', {
            method: 'POST', body: { username: created.username, password: 'updated-password' }
        });
        await request(`/api/admin/users/${created.id}`, { token, method: 'DELETE' });
        assert.equal((await request('/api/admin/users', { token })).length, 1);
    } finally {
        if (child && child.exitCode === null) {
            child.kill();
            await exited;
        }
        await fs.rm(directory, { recursive: true, force: true });
    }
});
