const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const jwt = require('jsonwebtoken');
const { startTestServer } = require('../helpers/testServer');

describe('Integration Tests: Auth & RBAC (auth_rbac.test.js)', () => {
    let testEnv;
    const testSecret = 'auth-rbac-test-secret-key-999';

    before(async () => {
        testEnv = await startTestServer({
            prefix: 'aai-auth-test-',
            jwtSecret: testSecret,
            adminUser: {
                username: 'system_admin',
                password: 'AdminPassword123!',
                role: 'admin'
            }
        });
    });

    after(async () => {
        if (testEnv) {
            await testEnv.close();
        }
    });

    describe('Tier 1: Authentication & Session Verification', () => {
        it('T1.1: Admin login with valid credentials yields JWT token and user profile', async () => {
            const res = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'system_admin', password: 'AdminPassword123!' },
                status: 200
            });

            assert.ok(res.data.token, 'Should return JWT token');
            assert.equal(res.data.user.username, 'system_admin');
            assert.equal(res.data.user.role, 'admin');

            // Verify JWT token payload and expiration
            const decoded = jwt.verify(res.data.token, testSecret);
            assert.equal(decoded.username, 'system_admin');
            assert.equal(decoded.role, 'admin');
            assert.ok(decoded.exp - decoded.iat >= 86000, 'Token validity should be ~24h');
        });

        it('T1.2: Regular user registration yields JWT token and role user', async () => {
            const res = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'john_doe', password: 'SecretPassword123' },
                status: 201
            });

            assert.equal(res.data.message, 'Registration successful');
            assert.ok(res.data.token, 'Should return JWT token');
            assert.equal(res.data.user.username, 'john_doe');
            assert.equal(res.data.user.role, 'user');
        });

        it('T1.3: Regular user can login with registered credentials', async () => {
            const res = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'john_doe', password: 'SecretPassword123' },
                status: 200
            });

            assert.ok(res.data.token);
            assert.equal(res.data.user.username, 'john_doe');
            assert.equal(res.data.user.role, 'user');
        });

        it('T1.4: GET /api/auth/me returns current user profile with valid Bearer token', async () => {
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'john_doe', password: 'SecretPassword123' }
            });

            const meRes = await testEnv.request('/api/auth/me', {
                token: loginRes.data.token,
                status: 200
            });

            assert.equal(meRes.data.user.username, 'john_doe');
            assert.equal(meRes.data.user.role, 'user');
        });

        it('T1.5: Unauthenticated access to /api/auth/me returns 401', async () => {
            const res = await testEnv.request('/api/auth/me', { status: 401 });
            assert.equal(res.data.error, 'Access token required');
        });
    });

    describe('Tier 2: Boundary & Negative Authentication Tests', () => {
        it('T2.1: Login with empty username or empty password returns 400', async () => {
            const emptyUser = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: '', password: 'password' },
                status: 400
            });
            assert.equal(emptyUser.data.error, 'Username and password required');

            const emptyPass = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'system_admin', password: '' },
                status: 400
            });
            assert.equal(emptyPass.data.error, 'Username and password required');
        });

        it('T2.2: Login with non-existent username returns 401', async () => {
            const res = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'ghost_user', password: 'password123' },
                status: 401
            });
            assert.equal(res.data.error, 'Invalid credentials');
        });

        it('T2.3: Login with incorrect password returns 401', async () => {
            const res = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'system_admin', password: 'WrongPassword999' },
                status: 401
            });
            assert.equal(res.data.error, 'Invalid credentials');
        });

        it('T2.4: Registration validation rejects username < 3 chars or password < 4 chars', async () => {
            const shortUser = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'ab', password: 'password' },
                status: 400
            });
            assert.ok(shortUser.data.details.some(d => d.includes('at least 3 characters')));

            const shortPass = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'valid_user', password: '12' },
                status: 400
            });
            assert.ok(shortPass.data.details.some(d => d.includes('at least 4 characters')));
        });

        it('T2.5: Registration rejects special characters in username', async () => {
            const res = await testEnv.request('/api/auth/register', {
                method: 'POST',
                body: { username: 'user@name#', password: 'password123' },
                status: 400
            });
            assert.ok(res.data.details.some(d => d.includes('letters, numbers, and underscores')));
        });

        it('T2.6: Request with tampered or invalid JWT Bearer token returns 403', async () => {
            const res = await testEnv.request('/api/auth/me', {
                headers: { Authorization: 'Bearer this.is.an.invalid.token' },
                status: 403
            });
            assert.equal(res.data.error, 'Invalid or expired token');
        });
    });

    describe('Tier 1 & 2: Admin RBAC & User Management', () => {
        let userToken;

        before(async () => {
            const loginRes = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'john_doe', password: 'SecretPassword123' }
            });
            userToken = loginRes.data.token;
        });

        it('T1.6: Regular user receives 403 Forbidden on all /api/admin/users routes', async () => {
            await testEnv.request('/api/admin/users', { token: userToken, status: 403 });
            await testEnv.request('/api/admin/users', {
                token: userToken, method: 'POST', body: { username: 'hacker', password: 'password' }, status: 403
            });
            await testEnv.request('/api/admin/users/1/password', {
                token: userToken, method: 'PUT', body: { password: 'newpassword' }, status: 403
            });
            await testEnv.request('/api/admin/users/1', { token: userToken, method: 'DELETE', status: 403 });
        });

        it('T1.7: Unauthenticated request to /api/admin/users returns 401', async () => {
            await testEnv.request('/api/admin/users', { status: 401 });
        });

        it('T1.8: Admin can list all users and passwords are never exposed', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: testEnv.adminToken,
                status: 200
            });

            assert.ok(Array.isArray(res.data));
            assert.ok(res.data.length >= 2); // system_admin and john_doe
            res.data.forEach(user => {
                assert.ok('id' in user);
                assert.ok('username' in user);
                assert.ok('role' in user);
                assert.equal('password' in user, false, 'Password hash must never be returned in user list');
            });
        });

        it('T1.9: Admin can create new user with explicit role', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: testEnv.adminToken,
                method: 'POST',
                body: { username: 'second_admin', password: 'AdminPassword99!', role: 'admin' },
                status: 201
            });

            assert.equal(res.data.username, 'second_admin');
            assert.equal(res.data.role, 'admin');

            // Verify newly created admin can log in and has admin privileges
            const newAdminLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'second_admin', password: 'AdminPassword99!' },
                status: 200
            });
            assert.equal(newAdminLogin.data.user.role, 'admin');
        });

        it('T2.7: Admin user creation returns 409 Conflict for duplicate username', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: testEnv.adminToken,
                method: 'POST',
                body: { username: 'john_doe', password: 'AnotherPassword', role: 'user' },
                status: 409
            });
            assert.equal(res.data.error, 'User already exists');
        });

        it('T2.8: Admin user creation rejects invalid roles', async () => {
            const res = await testEnv.request('/api/admin/users', {
                token: testEnv.adminToken,
                method: 'POST',
                body: { username: 'invalid_role_user', password: 'password', role: 'superadmin' },
                status: 400
            });
            assert.equal(res.data.error, 'Role must be user or admin');
        });

        it('T1.10: Admin can reset password for another user', async () => {
            // Find john_doe id
            const users = await testEnv.request('/api/admin/users', { token: testEnv.adminToken });
            const john = users.data.find(u => u.username === 'john_doe');
            assert.ok(john, 'john_doe must exist in database');

            const resetRes = await testEnv.request(`/api/admin/users/${john.id}/password`, {
                token: testEnv.adminToken,
                method: 'PUT',
                body: { password: 'NewResetPassword456' },
                status: 200
            });
            assert.equal(resetRes.data.message, 'Password updated');

            // Old password must now fail
            await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'john_doe', password: 'SecretPassword123' },
                status: 401
            });

            // New password must succeed
            const newLogin = await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'john_doe', password: 'NewResetPassword456' },
                status: 200
            });
            assert.ok(newLogin.data.token);
        });

        it('T2.9: Reset password for non-existent user returns 404', async () => {
            const res = await testEnv.request('/api/admin/users/999999/password', {
                token: testEnv.adminToken,
                method: 'PUT',
                body: { password: 'password123' },
                status: 404
            });
            assert.equal(res.data.error, 'User not found');
        });

        it('T1.11: Admin can delete user account', async () => {
            const users = await testEnv.request('/api/admin/users', { token: testEnv.adminToken });
            const secondAdmin = users.data.find(u => u.username === 'second_admin');
            assert.ok(secondAdmin);

            const delRes = await testEnv.request(`/api/admin/users/${secondAdmin.id}`, {
                token: testEnv.adminToken,
                method: 'DELETE',
                status: 200
            });
            assert.equal(delRes.data.message, 'User deleted');

            // Deleted user cannot log in
            await testEnv.request('/api/auth/login', {
                method: 'POST',
                body: { username: 'second_admin', password: 'AdminPassword99!' },
                status: 401
            });
        });

        it('T2.10: Deleting non-existent user ID returns 404', async () => {
            const res = await testEnv.request('/api/admin/users/999999', {
                token: testEnv.adminToken,
                method: 'DELETE',
                status: 404
            });
            assert.equal(res.data.error, 'User not found');
        });
    });
});
