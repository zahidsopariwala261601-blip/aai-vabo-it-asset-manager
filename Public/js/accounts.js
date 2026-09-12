async function accountRequest(url, options = {}) {
    const token = localStorage.getItem('aai_token');
    if (!token) throw new Error('Sign in to the inventory app with an administrator account first.');
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    // Global Auto-Uppercase for all text input fields (doesn't matter Caps Lock on or off)
    document.addEventListener('input', event => {
        const el = event.target;
        if (el && el.tagName && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            const type = (el.type || 'text').toLowerCase();
            if (!['password', 'file', 'checkbox', 'radio', 'hidden', 'submit', 'button', 'color', 'date', 'datetime-local'].includes(type)) {
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const upper = el.value.toUpperCase();
                if (el.value !== upper) {
                    el.value = upper;
                    if (start !== null && end !== null) {
                        try { el.setSelectionRange(start, end); } catch (e) {}
                    }
                }
            }
        }
    });

    document.body.classList.toggle('light-mode', localStorage.getItem('vabo-theme') === 'light');
    loadUsers();

    // Hide initial loader
    setTimeout(() => {
        document.getElementById('loader-overlay').style.display = 'none';
    }, 800);

    // Form Submissions
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
    document.getElementById('reset-password-form').addEventListener('submit', handleResetPassword);
});

async function loadUsers() {
    try {
        const users = await accountRequest('/api/admin/users');
        document.getElementById('account-status').textContent = '';
        
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = '';
        
        document.getElementById('total-users').textContent = users.length;

        users.forEach(user => {
            const tr = document.createElement('tr');
            [user.id, user.username].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                tr.appendChild(cell);
            });
            const roleCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `role-badge ${user.role === 'admin' ? 'admin' : 'user'}`;
            badge.textContent = user.role;
            roleCell.appendChild(badge);
            tr.appendChild(roleCell);
            const actions = document.createElement('td');
            const reset = document.createElement('button');
            reset.className = 'btn btn-secondary btn-sm';
            reset.textContent = 'Reset PW';
            reset.onclick = () => showResetPasswordModal(user.id, user.username);
            const remove = document.createElement('button');
            remove.className = 'btn btn-danger btn-sm';
            remove.textContent = 'Delete';
            remove.onclick = () => deleteUser(user.id, user.username);
            actions.append(reset, remove);
            tr.appendChild(actions);
            tbody.appendChild(tr);
        });
    } catch (err) {
        document.getElementById('account-status').textContent = err.message;
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    try {
        await accountRequest('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        
        alert('User created successfully');
        hideModals();
        loadUsers();
    } catch (err) {
        alert(err.message);
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const id = document.getElementById('reset-user-id').value;
    const password = document.getElementById('reset-password').value;

    try {
        await accountRequest(`/api/admin/users/${id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        alert('Password updated successfully');
        hideModals();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteUser(id, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
        await accountRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
        
        loadUsers();
    } catch (err) {
        alert(err.message);
    }
}

// Modal UI Helpers
function showAddUserModal() {
    document.getElementById('add-user-form').reset();
    document.getElementById('add-user-modal').classList.remove('hidden');
    document.getElementById('modal-backdrop').classList.remove('hidden');
}

function showResetPasswordModal(id, username) {
    document.getElementById('reset-user-id').value = id;
    document.getElementById('reset-user-display').textContent = `Setting new password for: ${username}`;
    document.getElementById('reset-password').value = '';
    document.getElementById('reset-password-modal').classList.remove('hidden');
    document.getElementById('modal-backdrop').classList.remove('hidden');
}

function hideModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-backdrop').classList.add('hidden');
}
