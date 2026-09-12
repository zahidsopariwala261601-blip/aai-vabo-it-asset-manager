/* ═══════════════════════════════════════════════════════════════
   API Service Layer — JWT-backed API client
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';

function getToken() {
    return localStorage.getItem('aai_token');
}

function setToken(token) {
    localStorage.setItem('aai_token', token);
}

function clearToken() {
    localStorage.removeItem('aai_token');
    localStorage.removeItem('aai_user');
}

function getUser() {
    const u = localStorage.getItem('aai_user');
    return u ? JSON.parse(u) : null;
}

function setUser(user) {
    localStorage.setItem('aai_user', JSON.stringify(user));
}

async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const res = await fetch(`${API}${url}`, { ...options, headers });

        // Special handling for 401/403
        // If we're ALREADY on the login page (url contains 'login'), don't clear and redirect
        // as the server is likely just telling us the credentials were wrong.
        if ((res.status === 401 || res.status === 403) && !url.includes('/login')) {
            clearToken();
            showAuth();
            throw new Error('Session expired. Please login again.');
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error(`Server returned non-JSON response (${res.status}). The server might be misconfigured or offline.`);
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || data.details?.join(', ') || 'Request failed');
        }
        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch') {
            throw new Error('Server is offline. Check your connection.');
        }
        throw err;
    }
}

// ─── Auth API ──────────────────────────────────────────────────
async function apiLogin(username, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    setUser(data.user);
    return data;
}

async function apiRegister(username, password) {
    const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    setUser(data.user);
    return data;
}

// ─── Assets API ────────────────────────────────────────────────
async function apiGetAssets(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/assets${qs ? '?' + qs : ''}`);
}

async function apiGetAllAssets() {
    return apiRequest('/assets/all');
}

async function apiGetStats() {
    return apiRequest('/assets/stats');
}

async function apiCreateAsset(data) {
    return apiRequest('/assets', { method: 'POST', body: JSON.stringify(data) });
}

async function apiUpdateAsset(id, data) {
    return apiRequest(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiDeleteAsset(id) {
    return apiRequest(`/assets/${id}`, { method: 'DELETE' });
}

async function apiBulkImport(assets) {
    return apiRequest('/assets/bulk', { method: 'POST', body: JSON.stringify({ assets }) });
}

async function apiWizardSubmit(data) {
    return apiRequest('/assets/wizard', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Transactions API ──────────────────────────────────────────
async function apiGetTransactions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/transactions${qs ? '?' + qs : ''}`);
}

async function apiCreateTransaction(data) {
    return apiRequest('/transactions', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Employees API ─────────────────────────────────────────────
async function apiGetEmployees() {
    return apiRequest('/employees');
}

async function apiCreateEmployee(data) {
    return apiRequest('/employees', { method: 'POST', body: JSON.stringify(data) });
}

async function apiUpdateEmployee(id, data) {
    return apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiDeleteEmployee(id) {
    return apiRequest(`/employees/${id}`, { method: 'DELETE' });
}

async function apiGetAssetTrail(assetId) {
    return apiRequest(`/transactions/asset/${assetId}`);
}

async function apiUpdateTransaction(id, data) {
    return apiRequest(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiLogPrint(data) {
    return apiRequest('/transactions/print-logs', { method: 'POST', body: JSON.stringify(data) });
}

async function apiGetPrintLogs() {
    return apiRequest('/transactions/print-logs');
}

async function apiGetEmployeeTrail(name) {
    return apiRequest(`/transactions/employee/${encodeURIComponent(name)}`);
}

async function apiDeleteTransaction(id, reason) {
    return apiRequest(`/transactions/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
}


