/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

// Toast notification system
function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        error: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        info: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
        warning: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('toast-exit');
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

// Date formatting
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    } catch { return dateStr; }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return dateStr; }
}

function getCurrentDateStr() {
    return new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    });
}

function isValidIPv4(ip) {
    const pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return pattern.test(ip);
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

// Debounce
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Animate counter
function animateCounter(element, target) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.textContent = target;
        return;
    }
    const duration = 600;
    const start = parseInt(element.textContent) || 0;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        element.textContent = Math.round(start + diff * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ─── CSV Import System ──────────────────────────────────────────

const DESIGNATION_MAPPING = {
    'EXECUTIVE DIRECTOR': 'ED',
    'ED': 'ED',
    'GENERAL MANAGER': 'GM',
    'GM': 'GM',
    'JOINT GENERAL MANAGER': 'JGM',
    'JT. GENERAL MANAGER': 'JGM',
    'JGM': 'JGM',
    'JT. GM': 'JGM',
    'DEPUTY GENERAL MANAGER': 'DGM',
    'DGM': 'DGM',
    'ASSISTANT GENERAL MANAGER': 'AGM',
    'AGM': 'AGM',
    'SR. MANAGER': 'SM',
    'SM': 'SM',
    'MANAGER': 'MGR',
    'MGR': 'MGR',
    'ASSISTANT MANAGER': 'AM',
    'AM': 'AM',
    'JUNIOR EXECUTIVE': 'JE',
    'JE': 'JE',
    'SR. SUPERINTENDENT (SG)': 'SR. SUPERINTENDENT (SG)',
    'SR. SUPERINTENDENT': 'SR. SUPERINTENDENT',
    'SUPERINTENDENT': 'SUPERINTENDENT',
    'SUPERVISOR': 'SUPERVISOR',
    'SR. ASSISTANT': 'SR. ASSISTANT',
    'ASSISTANT': 'ASSISTANT',
    'JR. ASSISTANT': 'JR. ASSISTANT',
    'SR. ATTENDANT': 'SR. ATTENDANT',
    'ATTENDANT': 'ATTENDANT',
    'JR. ATTENDANT': 'JR. ATTENDANT',
    'MANEGAR': 'MGR',
    'COMPUTER OPEARTOR': 'COMPUTER OPERATOR',
    'COMP.OP': 'COMPUTER OPERATOR',
    'APPRENTISE': 'APPRENTICE'
};

const ALLOWED_DESIGNATIONS = [
    'ED', 'GM', 'JGM', 'DGM', 'AGM', 'SM', 'MGR', 'AM', 'JE',
    'SR. SUPERINTENDENT (SG)', 'SR. SUPERINTENDENT', 'SUPERINTENDENT', 'SUPERVISOR',
    'SR. ASSISTANT', 'ASSISTANT', 'JR. ASSISTANT', 'SR. ATTENDANT', 'ATTENDANT', 'JR. ATTENDANT',
    'COMPUTER OPERATOR', 'APPRENTICE'
];

function cleanDesignation(val) {
    if (!val) return '';
    const upper = val.toString().trim().toUpperCase();
    
    // Try direct mapping
    if (DESIGNATION_MAPPING[upper]) return DESIGNATION_MAPPING[upper];
    
    // Try fuzzy mapping (contains keyword)
    for (const [key, target] of Object.entries(DESIGNATION_MAPPING)) {
        if (upper.includes(key)) return target;
    }
    
    return upper; // Return original if no match
}

function validateAssetRecord(row) {
    const errors = [];
    
    if (!row.name || row.name === 'Unknown') errors.push('Missing Asset Type/Name');
    if (!row.serial_number) errors.push('Missing Serial Number');
    if (!row.current_user) errors.push('Missing Holder Name');
    
    const cleanedDesig = cleanDesignation(row.assigned_desig);
    if (cleanedDesig && !ALLOWED_DESIGNATIONS.includes(cleanedDesig)) {
        errors.push(`Invalid Designation: ${cleanedDesig}`);
    }

    if (row.year_of_purchase) {
        const year = parseInt(row.year_of_purchase);
        const curYear = new Date().getFullYear();
        if (isNaN(year) || year < 2000 || year > curYear) {
            errors.push(`Invalid Year: ${row.year_of_purchase} (Must be 2000-${curYear})`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleanedDesig
    };
}

// CSV parser (handles quoted values and empty fields)
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = [];

    // Proper CSV line parser — handles quotes and preserves empty fields
    function splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim()); // last field
        return result;
    }

    for (let i = 1; i < lines.length; i++) {
        const values = splitCSVLine(lines[i]);

        // Flexible header lookup — matches if header contains the keyword
        // Robust header lookup — prioritizes exact matches to avoid mapping 'Serial' to 'Monitor Serial'
        const getVal = (...names) => {
            const lowerHeaders = headers.map(h => h.toLowerCase());
            const searchNames = names.map(n => n.toLowerCase());

            // 1. Try exact matches first for all names
            for (const name of searchNames) {
                const idx = lowerHeaders.indexOf(name);
                if (idx !== -1 && values[idx] !== undefined) return values[idx];
            }

            // 2. Try partial matches only if no exact match found
            for (const name of searchNames) {
                const idx = lowerHeaders.findIndex(h => h.includes(name));
                if (idx !== -1 && values[idx] !== undefined) return values[idx];
            }
            return '';
        };

        const rawRecord = {
            name: getVal('Asset Type', 'Name', 'Item') || 'Unknown',
            asset_tag: getVal('Asset_Tag', 'Asset Tag', 'Tag'),
            serial_number: getVal('Serial_No', 'Serial No.', 'Serial No', 'Serial'),
            charger_serial: getVal('Charger Serial No.', 'Charger Serial', 'Charger_Serial', 'Charger'),
            monitor_make: getVal('Monitor Make', 'Monitor_Make'),
            monitor_serial: getVal('Monitor Serial Number', 'Monitor Serial', 'Monitor_Serial'),
            keyboard_make: getVal('Keyboard_Make', 'Keyboard Make', 'Keyboard'),
            mouse_make: getVal('Mouse_Make', 'Mouse Make', 'Mouse'),
            make: getVal('Make'),
            model: getVal('Model'),
            ip_address: getVal('IP Address', 'IP_Address', 'IP'),
            hostname: getVal('Hostname', 'Host Name'),
            current_user: getVal('Current Holder Name', 'Current Holder', 'Current_Holder', 'Holder') || 'IT Store',
            contractual_user_name: getVal('Physical_Asset_Holder', 'Physical Asset Holder', 'Contractual User', 'Contractual_User', 'Contractual'),
            assigned_dept: getVal('Department', 'Dept'),
            assigned_desig: getVal('Designation', 'Desig'),
            employee_id: getVal('Employee_ID', 'Employee ID', 'Employee') || null,
            status: getVal('Status'),
            remark: getVal('Remark'),
            year_of_purchase: getVal('Year_of_Purchase', 'Year of Purchase', 'Purchase Year', 'Year'),
            kva: getVal('KVA', 'Kva'),
            warranty_expiry: getVal('Warranty_Expiry', 'Warranty Expiry', 'Warranty')
        };

        // Auto-Cleaning
        const validation = validateAssetRecord(rawRecord);
        rawRecord.assigned_desig = validation.cleanedDesig || rawRecord.assigned_desig;
        rawRecord._isValid = validation.isValid;
        rawRecord._errors = validation.errors;

        rows.push(rawRecord);
    }
    return rows;
}

// Export to CSV (client-side)
function downloadCSV(data, filename) {
    let csv = 'ID,Asset_Tag,Asset Type,Serial,Charger_Serial,Monitor_Make,Monitor_Serial,Keyboard_Make,Mouse_Make,Make,Model,IP,Hostname,Holder,Physical_Asset_Holder,Department,Designation,Year_of_Purchase\n';
    data.forEach(a => {
        const esc = (v) => `"${(v === null || v === undefined ? '' : String(v)).replace(/"/g, '""')}"`;
        csv += [
            a.id !== undefined && a.id !== null ? a.id : '',
            esc(a.asset_tag),
            esc(a.name),
            esc(a.serial_number),
            esc(a.charger_serial),
            esc(a.monitor_make),
            esc(a.monitor_serial),
            esc(a.keyboard_make),
            esc(a.mouse_make),
            esc(a.make),
            esc(a.model),
            esc(a.ip_address),
            esc(a.hostname),
            esc(a.current_user),
            esc(a.contractual_user_name),
            esc(a.assigned_dept),
            esc(a.assigned_desig),
            a.year_of_purchase || ''
        ].join(',') + '\n';
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || `Inventory_${getTodayISO()}.csv`;
    a.click(); URL.revokeObjectURL(url);
}

// Backup to JSON
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || `Backup_${getTodayISO()}.json`;
    a.click();
}
