/* ═══════════════════════════════════════════════════════════════
   UI Rendering Module
   ═══════════════════════════════════════════════════════════════ */

// ─── Dashboard ─────────────────────────────────────────────────
function renderDashboard(stats, transactions, assets = []) {
    // Animated stat counters
    animateCounter(document.getElementById('stat-total'), stats.total || 0);
    animateCounter(document.getElementById('stat-stock'), stats.inStock || 0);
    animateCounter(document.getElementById('stat-issued'), stats.assigned || 0);
    animateCounter(document.getElementById('stat-utilization'), stats.total ? Math.round((stats.assigned || 0) / stats.total * 100) : 0);

    document.getElementById('current-date').textContent = getCurrentDateStr();

    // Recent Activity
    renderRecentActivity(transactions);

    // Pie Chart
    renderPieChart(stats.categories || {});
    renderReadiness(stats);
    renderDepartmentAllocation(assets);
}

function escapeDashboardText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderReadiness(stats) {
    const total = Number(stats.total) || 0;
    const stock = Number(stats.inStock) || 0;
    const assigned = Number(stats.assigned) || 0;
    const other = Math.max(0, total - stock - assigned);
    const percent = total ? Math.round(stock / total * 100) : 0;
    document.getElementById('readiness-percent').textContent = `${percent}%`;
    const segments = [
        { label: 'In store', count: stock, color: '#56dec0' },
        { label: 'Issued', count: assigned, color: '#7eafff' },
        { label: 'Other status', count: other, color: '#b7a3fa' }
    ];
    const track = document.getElementById('readiness-track');
    track.innerHTML = segments.filter(item => item.count > 0).map(item =>
        `<span style="flex:${item.count};background:${item.color}"></span>`).join('');
    track.setAttribute('aria-label', total ? segments.map(item => `${item.count} ${item.label.toLowerCase()}`).join(', ') : 'No registered assets');
    document.getElementById('readiness-legend').innerHTML = segments.map(item =>
        `<div><i class="legend-dot" style="background:${item.color}"></i>${item.label}<strong>${item.count}</strong></div>`).join('');
}

function renderDepartmentAllocation(assets) {
    const counts = new Map();
    assets.forEach(asset => {
        const department = (asset.assigned_dept || '').trim();
        if (department) counts.set(department, (counts.get(department) || 0) + 1);
    });
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
    const container = document.getElementById('department-bars');
    container.replaceChildren();
    if (!top.length) {
        container.innerHTML = '<p class="empty-insight">Assign a department to an asset to see its allocation here.</p>';
        return;
    }
    top.forEach(([department, count]) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'department-row';
        row.setAttribute('aria-label', `${department}: ${count} assets. View inventory.`);
        row.innerHTML = `<div class="department-label"><span>${escapeDashboardText(department)}</span><strong>${count} assets</strong></div><div class="department-track"><span style="width:${count / top[0][1] * 100}%"></span></div>`;
        row.addEventListener('click', () => filterByDepartment(department));
        container.appendChild(row);
    });
}

function renderRecentActivity(transactions) {
    const container = document.getElementById('recent-activity');
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px; font-style:italic;">No recent activity</p>';
        return;
    }

    container.innerHTML = transactions.slice(0, 6).map(t => `
        <div class="activity-item">
            <div class="activity-icon ${t.type === 'handover' ? 'activity-handover' : 'activity-takeover'}">
                ${t.type === 'handover' ? '→' : '←'}
            </div>
            <div class="activity-text">
                <div class="activity-title">${escapeDashboardText(t.asset_names || 'Asset')}</div>
                <div class="activity-sub">${escapeDashboardText(t.employee_name || '-')} · ${escapeDashboardText(formatDate(t.timestamp))}</div>
            </div>
            <span class="activity-status">${t.type === 'handover' ? 'Handover' : 'Takeover'}</span>
        </div>
    `).join('');
}

function renderPieChart(categories) {
    const sorted = Object.entries(categories).sort((a, b) => Number(b[1]) - Number(a[1]));
    const labels = sorted.map(([label]) => label);
    const values = sorted.map(([, value]) => Number(value) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const pie = document.getElementById('pie-chart');
    const legend = document.getElementById('pie-legend');
    document.getElementById('chart-total').textContent = total;
    pie.setAttribute('aria-label', total ? `Category distribution: ${labels.map((label, i) => `${label}: ${values[i]}`).join(', ')}` : 'No registered assets');

    if (total === 0) {
        pie.style.background = 'rgba(255,255,255,0.03)';
        legend.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No data</span>';
        return;
    }

    const colors = ['#56dec0', '#7eafff', '#b7a3fa', '#f2bf74', '#69cfde', '#f28e9b', '#a9c785', '#c796cb'];
    let current = 0;
    const segments = labels.map((l, i) => {
        const deg = (values[i] / total) * 360;
        const str = `${colors[i % colors.length]} ${current}deg ${current + deg}deg`;
        current += deg;
        return str;
    });

    pie.style.background = `conic-gradient(${segments.join(', ')})`;
    legend.innerHTML = labels.map((l, i) => `
        <div class="legend-item">
            <div class="legend-dot" style="background:${colors[i % colors.length]}"></div>
            <span title="${escapeDashboardText(l)}">${escapeDashboardText(l)}</span><strong>${values[i]}</strong>
        </div>
    `).join('');
}

// ─── Inventory ─────────────────────────────────────────────────
function renderInventory(assets, searchQuery) {
    const q = (searchQuery || '').toLowerCase();
    const filtered = q
        ? assets.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.serial_number || '').toLowerCase().includes(q) ||
            (a.asset_tag || '').toLowerCase().includes(q) ||
            (a.current_user || '').toLowerCase().includes(q) ||
            (a.ip_address || '').toLowerCase().includes(q) ||
            (a.hostname || '').toLowerCase().includes(q) ||
            (a.make || '').toLowerCase().includes(q) ||
            (a.assigned_dept || '').toLowerCase().includes(q) ||
            (a.assigned_desig || '').toLowerCase().includes(q) ||
            (a.model || '').toLowerCase().includes(q) ||
            (a.remark || '').toLowerCase().includes(q) ||
            (a.warranty_expiry || '').toLowerCase().includes(q)
        )
        : assets;

    const tbody = document.getElementById('inventory-table');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic;">No assets found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((a, idx) => `
        <tr>
            <td style="font-weight:600; color:var(--text-muted); text-align:center;">${idx + 1}</td>
            <td class="cell-primary">${a.name || '-'}</td>
            <td class="cell-mono" style="font-size: calc(0.7rem * var(--font-scale, 1)); color:var(--accent-cyan);">${a.asset_tag || '-'}</td>
            <td>${a.make || '-'}</td>
            <td>${a.model || '-'}</td>
            <td class="cell-mono">${a.serial_number || '-'}</td>
            <td class="cell-mono" style="font-size: calc(0.75rem * var(--font-scale, 1));">${a.ip_address || '-'}</td>
            <td class="cell-mono" style="font-size: calc(0.75rem * var(--font-scale, 1));">${a.hostname || '-'}</td>
            <td style="font-weight:500;">${a.current_user || '-'}</td>
            <td style="font-size: calc(0.8rem * var(--font-scale, 1));">${a.assigned_desig || '-'}</td>
            <td style="font-size: calc(0.8rem * var(--font-scale, 1));">${a.assigned_dept || '-'}</td>
            <td style="font-size: calc(0.8rem * var(--font-scale, 1)); font-weight:600; color:var(--accent-blue);">${a.year_of_purchase || '-'}</td>
            <td style="font-size: calc(0.75rem * var(--font-scale, 1)); color:var(--text-muted);">${a.warranty_expiry || '-'}</td>
            <td>
                <span class="badge ${a.status === 'In Stock' ? 'badge-green' : 'badge-blue'}">
                    <span class="badge-dot"></span>
                    ${a.status}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="viewAssetTrail(${a.id})" title="View History Trail" style="color:var(--accent-purple);">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                </button>
                <button class="btn-icon" onclick="editAsset(${a.id})" title="Edit">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="btn-icon" onclick="confirmDeleteAsset(${a.id})" title="Delete" style="color:var(--accent-red);">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

// ─── Selectable Assets (for Handover/Takeover) ─────────────────
function renderSelectable(assets, selectedIds, transactionType, searchQuery) {
    const q = (searchQuery || '').toLowerCase();
    const filtered = assets.filter(a => {
        const matchType = transactionType === 'handover' ? a.status === 'In Stock' : a.status === 'Assigned';
        const matchSearch = 
            (a.name || '').toLowerCase().includes(q) || 
            (a.serial_number || '').toLowerCase().includes(q) ||
            (a.ip_address || '').toLowerCase().includes(q) ||
            (a.assigned_dept || '').toLowerCase().includes(q) ||
            (a.assigned_desig || '').toLowerCase().includes(q) ||
            (a.current_user || '').toLowerCase().includes(q) ||
            String(a.year_of_purchase || '').includes(q);
        return matchType && matchSearch;
    });

    const container = document.getElementById('selectable-assets');
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:30px; text-align:center; color:var(--text-muted); font-style:italic;">No matching assets</div>';
        return;
    }

    container.innerHTML = filtered.map(a => `
        <div class="selectable-item ${selectedIds.includes(a.id) ? 'selected' : ''}" onclick="toggleAsset(${a.id})">
            <div>
                <div class="item-name">${a.name}</div>
                <div class="item-detail">
                    ${a.serial_number}
                    ${a.ip_address ? ' • ' + a.ip_address : ''}
                    ${a.assigned_dept ? ' • ' + a.assigned_dept : ''}
                    ${a.current_user && a.current_user !== 'IT Store' ? ' • ' + a.current_user : ''}
                </div>
            </div>
            <div class="check-circle"></div>
        </div>
    `).join('');
}

// ─── Print Logs ────────────────────────────────────────────────
function renderPrintLogs(logs) {
    const tbody = document.getElementById('print-logs-table');
    if (!tbody) return;
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic;">No print history found</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr>
            <td style="font-family:monospace; font-size:0.75rem; color:var(--text-muted);">${formatDateTime(l.print_timestamp)}</td>
            <td>
                <span class="badge ${l.action_type === 'Reprint' ? 'badge-amber' : 'badge-green'}">
                    ${l.action_type.toUpperCase()}
                </span>
            </td>
            <td>
                <div style="font-weight:500;">${l.printed_by}</div>
                <div class="cell-small">${l.printed_by_dept || ''}</div>
            </td>
            <td>
                <div style="font-size:0.8rem;">${l.system_hostname || 'Unknown'}</div>
                <div class="cell-small">${l.system_ip || ''}</div>
            </td>
            <td class="cell-mono" style="font-size:0.75rem;">${l.ref_no || '-'}</td>
            <td><span class="badge" style="background:rgba(255,255,255,0.05);">${l.doc_type || 'N/A'}</span></td>
        </tr>
    `).join('');
}

// ─── History ───────────────────────────────────────────────────
function renderHistory(transactions) {
    const tbody = document.getElementById('history-table');
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic;">No transaction history</td></tr>`;
        return;
    }

    // Show/hide Actions column based on admin role
    const user = getUser();
    const isAdmin = user?.role === 'admin';
    document.getElementById('history-actions-col')?.classList.toggle('hidden', !isAdmin);

    tbody.innerHTML = transactions.map(t => {
        const wasEdited = t.last_edited_by && t.last_edited_by !== '';
        const editedBadge = wasEdited
            ? `<span class="badge" style="background:rgba(248,113,113,0.15); color:var(--accent-red); font-size:0.6rem; margin-left:6px; vertical-align:middle;">EDITED</span>`
            : '';
        const editedMeta = wasEdited
            ? `<div style="font-size:0.7rem; color:var(--accent-red); margin-top:3px;">Edited by ${t.last_edited_by} · ${formatDateTime(t.last_edited_at)}</div>`
            : '';
        const actionCell = isAdmin
            ? `<td>
                <div style="display:flex; gap:8px;">
                    <button class="btn-icon" onclick="openAuditEditModal(${t.id})" title="Edit Audit Record" style="color:var(--accent-amber);">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="btn-icon" onclick="reprintFromLog(${t.id})" title="Reprint Document" style="color:var(--accent-blue);">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                    </button>
                    <button class="btn-icon" onclick="confirmDeleteAuditLog(${t.id})" title="Delete Audit Log" style="color:var(--accent-red);">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
               </td>`
            : '';

        return `
        <tr>
            <td style="font-family:monospace; font-size: calc(0.75rem * var(--font-scale, 1)); color:var(--text-muted);">${formatDateTime(t.timestamp)}${editedBadge}${editedMeta}</td>
            <td>
                <span class="badge ${t.type === 'handover' ? 'badge-amber' : 'badge-green'}">
                    ${t.type.toUpperCase()}
                </span>
            </td>
            <td class="cell-primary" style="max-width:250px; overflow:hidden; text-overflow:ellipsis;">${t.asset_names || '-'}</td>
            <td>
                <div style="font-weight:500;">${t.employee_name || '-'}</div>
                <div class="cell-small">${t.employee_dept || ''}</div>
            </td>
            <td class="cell-mono" style="font-size: calc(0.75rem * var(--font-scale, 1));">${t.ref_no || '-'}</td>
            <td style="font-size: calc(0.75rem * var(--font-scale, 1)); color:var(--text-muted); max-width:150px; overflow:hidden; text-overflow:ellipsis;">${t.remark || '-'}</td>
            ${actionCell}
        </tr>`;
    }).join('');
}

// ─── Print Transaction — AAI Vadodara Airport Format ───────────
function printTransaction(data, items, existingWin = null) {
    const isHandover = data.type === 'handover';
    const docTitle = isHandover
        ? 'IT Hardware list at Vadodara Airport - Handover'
        : 'IT Hardware list at Vadodara Airport - Takeover';

    // Format date for display
    const dateFormatted = data.date
        ? new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    // Notes section — ONLY for Handover
    const notesHTML = isHandover ? `
        <div style="margin-top:28px;">
            <p style="font-weight:bold; font-size: calc(12px * var(--font-scale, 1)); margin-bottom:8px;">Note:</p>
            <ul style="font-size: calc(11px * var(--font-scale, 1)); line-height:1.8; padding-left:18px; margin:0;">
                <li>This IT Asset is property of AAI Vadodara Airport.</li>
                <li>Individual are responsible for any physical damage to the IT Asset. Physical Damage does not cover in warranty period.</li>
                <li>This asset is given temporarily.</li>
                <li>You do not change IP Address and Security and Antivirus setting of IT Asset, any change in above invite possible malware in IT Asset.</li>
                <li>Individual are requested to strictly not to put any object above IT Asset and Keyboard.</li>
                <li>IT assets wholly owned by AAI may also not be allowed to be carried by the executives due to difficulty in maintaining and tracking the IT asset which may invite audit observations in future.</li>
                <li>All IT assets will be issued strictly on individual employee's name and on his transfer, he/she is required to give proper handing over/ taking over, in the absence of which no NOC will be issued as per IT Policy of Airports Authority of India.</li>
                <li>In case of theft of IT asset issues to an employee, employee shall register an FIR and shall share the copy of the FIR to IT directorate for record. If FIR is not submitted, employee shall pay the amount as per IT Policy of Airports Authority of India, after that only IT directorate shall issue the NOC. Theft cases will be dealt as per AAI Theft Policy.</li>
            </ul>
        </div>
    ` : '';

    // Who is Handover by / Takeover by — uses LIVE data from the form, never hardcoded
    const handoverBy = {
        name:  isHandover ? data.issuer_name    : data.employee_name,
        desig: isHandover ? data.issuer_desig   : data.employee_desig,
        dept:  isHandover ? data.issuer_dept     : data.employee_dept
    };
    const takeoverBy = {
        name:  isHandover ? data.employee_name  : data.issuer_name,
        desig: isHandover ? data.employee_desig : data.issuer_desig,
        dept:  isHandover ? data.employee_dept   : data.issuer_dept
    };

    const sessionInfo = data.session || {};
    const isReprint = sessionInfo.action === 'Reprint';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${isReprint ? '[REPRINT] ' : ''}${docTitle}</title>
        <style>
            @page { margin: 10mm; size: A4 landscape; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: calc(12px * var(--font-scale, 1)); color: #111; line-height: 1.5; position: relative; }
            .doc { padding: 10px; }
            .doc-title { text-align: center; font-size: calc(15px * var(--font-scale, 1)); font-weight: bold; text-decoration: underline; margin-bottom: 16px; }
            .reprint-watermark { 
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 80px; color: rgba(0,0,0,0.05); font-weight: bold; pointer-events: none; z-index: -1;
                border: 10px solid rgba(0,0,0,0.05); padding: 20px; text-transform: uppercase;
            }
            .ref-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .ref-table td { border: 1px solid #000; padding: 6px 10px; font-size: calc(12px * var(--font-scale, 1)); }
            .asset-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .asset-table th, .asset-table td { border: 1px solid #000; padding: 5px 8px; font-size: calc(11px * var(--font-scale, 1)); text-align: left; vertical-align: top; }
            .asset-table th { background: #f0f0f0; font-weight: bold; text-align: center; white-space: nowrap; }
            .asset-table td:first-child { text-align: center; }
            .sig-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
            .sig-table td { border: 1px solid #000; padding: 6px 12px; font-size: calc(12px * var(--font-scale, 1)); width: 50%; vertical-align: top; }
            .sig-table .sig-header { font-weight: bold; text-align: center; background: #f0f0f0; }
            .session-footer { margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 9px; color: #666; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
    </head>
    <body>
        ${isReprint ? '<div class="reprint-watermark">REPRINT</div>' : ''}
        <div class="doc">
            <!-- Title -->
            <p class="doc-title">${isReprint ? '[REPRINT] ' : ''}${docTitle}</p>

            <!-- Ref No. and Date -->
            <table class="ref-table">
                <tr>
                    <td style="width:60%;"><strong>Ref No.</strong> ${data.ref_no || 'AAI/VABO/IT/2026/'}</td>
                    <td style="width:40%;"><strong>Date:</strong> ${dateFormatted}</td>
                </tr>
                ${data.remark ? `<tr><td colspan="2"><strong>Transaction Remark:</strong> ${data.remark}</td></tr>` : ''}
            </table>

            <!-- Asset Table -->
            <table class="asset-table">
                <thead>
                    <tr>
                        <th>SR NO.</th>
                        <th>Hardware Name</th>
                        <th>Serial Number</th>
                        <th>Make</th>
                        <th>Model</th>
                        <th>Monitor Details</th>
                        <th>Charger S.N.</th>
                        <th>IP Address</th>
                        <th>Hostname</th>
                        <th>Current Holder</th>
                        <th>Remark</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, i) => {
                        const monitorDetails = [item.monitor_make, item.monitor_serial].filter(Boolean).join(' / ') || '-';
                        return `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${(item.name || '').toUpperCase()}</td>
                            <td>${item.serial_number || ''}</td>
                            <td>${(item.make || '').toUpperCase()}</td>
                            <td>${(item.model || '').toUpperCase()}</td>
                            <td>${monitorDetails}</td>
                            <td>${item.charger_serial || '-'}</td>
                            <td>${isHandover ? (data.new_ip_address || '-') : 'Cleared'}</td>
                            <td>${isHandover ? (data.new_hostname || '-') : 'Cleared'}</td>
                            <td>${isHandover ? 'IT Store' : (item.current_user || '')}</td>
                            <td>${item.remark || '-'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <!-- Notes — Handover ONLY -->
            ${notesHTML}

            <!-- Signature Block -->
            <table class="sig-table">
                <tr>
                    <td class="sig-header">Handover by</td>
                    <td class="sig-header">Takeover by</td>
                </tr>
                <tr>
                    <td>Name: ${handoverBy.name || ''}</td>
                    <td>Name: ${takeoverBy.name || ''}</td>
                </tr>
                <tr>
                    <td>Designation: ${handoverBy.desig || ''}</td>
                    <td>Designation: ${takeoverBy.desig || ''}</td>
                </tr>
                <tr>
                    <td>Department: ${handoverBy.dept || ''}</td>
                    <td>Department: ${takeoverBy.dept || ''}</td>
                </tr>
                <tr>
                    <td style="padding-top:40px;">Signature: ___________________</td>
                    <td style="padding-top:40px;">Signature: ___________________</td>
                </tr>
            </table>

            ${isReprint ? `
            <div class="session-footer">
                <div style="font-style:italic; font-size:8px;">* This is a reprinted copy of a historical record. Original transaction date: ${dateFormatted}</div>
            </div>` : ''}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.focus();
                    window.print();
                }, 250);
            };
        </script>
    </body>
    </html>`;

    const win = existingWin || window.open('', '_blank', 'height=800,width=900');
    if (!win) {
        toast('Popup blocked! Please allow popups for this site to view the PDF.', 'error');
        return;
    }
    
    win.document.open();
    win.document.write(html);
    win.document.close();
}


// ─── Employees ─────────────────────────────────────────────────
function renderEmployees(employees, assets, searchQuery) {
    const q = (searchQuery || '').toLowerCase();
    const sortSelect = document.getElementById('employees-sort');
    const sortOrder = sortSelect ? sortSelect.value : 'default';
    
    // Group assets by employee name
    const assetsByEmployee = {};
    (assets || []).forEach(a => {
        if (a.current_user && a.current_user !== 'IT Store') {
            if (!assetsByEmployee[a.current_user]) {
                assetsByEmployee[a.current_user] = [];
            }
            assetsByEmployee[a.current_user].push(a);
        }
    });

    // Map employees and attach their assets
    let employeeData = employees.map(emp => {
        const empAssets = assetsByEmployee[emp.name] || [];
        const maxYear = empAssets.reduce((max, a) => Math.max(max, a.year_of_purchase || 0), 0);
        
        return {
            ...emp,
            maxYear,
            assetList: empAssets.map(a => `
                <div style="margin-bottom: 2px;">
                    <b>${a.name}</b> (${a.serial_number}) 
                    <span style="font-size: 0.75rem; color: var(--accent-blue); font-weight: 600;">(${a.year_of_purchase || '-'})</span>
                </div>
            `).join('')
        };
    });

    // Filter
    employeeData = employeeData.filter(emp => 
        (emp.name || '').toLowerCase().includes(q) || 
        (emp.department || '').toLowerCase().includes(q) || 
        (emp.designation || '').toLowerCase().includes(q) ||
        (emp.assetList || '').toLowerCase().includes(q)
    );

    // Sort
    if (sortOrder !== 'default') {
        const priorities = [
            { regex: /\b(ed|executive director)\b/i, rank: 1 },
            { regex: /\b(gm|general manager)\b/i, rank: 2 },
            { regex: /\b(jgm|jt\.?\s*gm|joint general manager)\b/i, rank: 3 },
            { regex: /\b(dgm|deputy general manager)\b/i, rank: 4 },
            { regex: /\b(agm|assistant general manager)\b/i, rank: 5 },
            { regex: /\b(sm|senior manager|sr\.?\s*manager)\b/i, rank: 6 },
            { regex: /\b(mgr|manager)\b/i, rank: 7 },
            { regex: /\b(am|assistant manager)\b/i, rank: 8 },
            { regex: /\b(je|junior executive)\b/i, rank: 9 },
            { regex: /\b(sr\.?\s*superintendent\s*\(sg\))\b/i, rank: 10 },
            { regex: /\b(sr\.?\s*superintendent)\b/i, rank: 11 },
            { regex: /\b(superintendent)\b/i, rank: 12 },
            { regex: /\b(supervisor)\b/i, rank: 13 },
            { regex: /\b(sr\.?\s*assistant)\b/i, rank: 14 },
            { regex: /\b(assistant)\b/i, rank: 15 },
            { regex: /\b(jr\.?\s*assistant)\b/i, rank: 16 },
            { regex: /\b(sr\.?\s*attendant)\b/i, rank: 17 },
            { regex: /\b(attendant)\b/i, rank: 18 },
            { regex: /\b(jr\.?\s*attendant)\b/i, rank: 19 }
        ];
        
        const getPriority = (desig) => {
            const d = (desig || '').trim();
            for (const p of priorities) {
                if (p.regex.test(d)) return p.rank;
            }
            return 99;
        };

        employeeData.sort((a, b) => {
            if (sortOrder.startsWith('designation')) {
                const pA = getPriority(a.designation);
                const pB = getPriority(b.designation);
                if (pA !== pB) return sortOrder === 'designation-asc' ? pA - pB : pB - pA;
                
                if (sortOrder.includes('year')) {
                    const yRes = (b.maxYear || 0) - (a.maxYear || 0);
                    return sortOrder.endsWith('new') ? yRes : -yRes;
                }
                return a.name.localeCompare(b.name);
            }
            
            if (sortOrder.startsWith('dept')) {
                const dRes = (a.department || '').localeCompare(b.department || '');
                if (dRes !== 0) return sortOrder === 'dept-asc' ? dRes : -dRes;
                if (sortOrder === 'dept-year') return (b.maxYear || 0) - (a.maxYear || 0);
                return a.name.localeCompare(b.name);
            }
            
            if (sortOrder.startsWith('year')) {
                const yRes = (a.maxYear || 0) - (b.maxYear || 0);
                return sortOrder === 'year-asc' ? yRes : -yRes;
            }
            
            if (sortOrder.startsWith('name')) {
                const nRes = a.name.localeCompare(b.name);
                return sortOrder === 'name-asc' ? nRes : -nRes;
            }
            return 0;
        });
    }

    const tbody = document.getElementById('employees-table');
    if (!tbody) return;

    if (employeeData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic;">No employees found</td></tr>';
        return;
    }

    tbody.innerHTML = employeeData.map(emp => `
        <tr>
            <td style="font-weight:600; color:var(--text-main);">${emp.name}</td>
            <td style="font-size: calc(0.85rem * var(--font-scale, 1));">${emp.designation || '-'}</td>
            <td style="font-size: calc(0.85rem * var(--font-scale, 1));">${emp.department || '-'}</td>
            <td style="font-size: calc(0.8rem * var(--font-scale, 1));">${emp.assetList || '<span style="color:var(--text-muted); font-style:italic;">No assets</span>'}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" onclick="viewEmployeeTrail('${emp.name.replace(/'/g, "\\'")}')" title="View Employee Trail" style="color:var(--accent-blue);">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                    </button>
                    <button class="btn-icon" onclick="editEmployee(${emp.id})" title="Edit Employee">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="btn-icon" onclick="confirmDeleteEmployee(${emp.id})" title="Delete Employee" style="color:var(--accent-red);">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}
