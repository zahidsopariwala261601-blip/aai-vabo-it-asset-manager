/* ═══════════════════════════════════════════════════════════════
   Main App Controller
   ═══════════════════════════════════════════════════════════════ */

// ─── State ─────────────────────────────────────────────────────
let allAssets = [];
let allTransactions = [];
let currentAssetTrail = [];
let currentEmployeeTrail = [];
let currentTrailAsset = null;
let currentTrailEmpName = '';
let selectedAssetIds = [];
let currentTransactionType = 'handover';
let editingAssetId = null;
let currentView = 'dashboard';
let sortColumn = null;
let sortDirection = 'asc';
let currentAssetFilter = 'all';
let currentInventoryGrouping = 'type';
let holderProfiles = new Map();
let allEmployees = [];
let allPrintLogs = [];

// ─── Loader Functions ──────────────────────────────────────────
function showLoader(text = 'Processing...') {
    const overlay = document.getElementById('loader-overlay');
    const statusText = document.getElementById('loader-status');
    if (overlay && statusText) {
        statusText.textContent = text;
        overlay.classList.add('active');
    }
}

function hideLoader() {
    const overlay = document.getElementById('loader-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Mobile navigation shares the desktop sidebar and supports keyboard dismissal.
function setNavigation(open, restoreFocus = true) {
    document.body.classList.toggle('navigation-open', open);
    document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
    document.getElementById('nav-scrim').hidden = !open;
    document.querySelector('.main-area').inert = open;
    if (open) document.querySelector('.nav-close').focus();
    else if (restoreFocus && window.matchMedia('(max-width: 768px)').matches) document.getElementById('menu-toggle').focus();
}

function setSyncState(state, text) {
    const indicator = document.getElementById('sync-state');
    indicator.dataset.state = state;
    indicator.textContent = text;
}

// ─── Theme Toggle ──────────────────────────────────────────────
function applyFontScaling(size) {
    const scales = { small: 0.9, medium: 1, large: 1.15, auto: 1 };
    const selected = Object.prototype.hasOwnProperty.call(scales, size) ? size : 'auto';
    document.documentElement.style.setProperty('--font-scale', scales[selected]);
    localStorage.setItem('vabo-font-size', selected);
    ['small', 'medium', 'large'].forEach(value => {
        const button = document.getElementById(`font-btn-${value}`);
        const active = value === (selected === 'auto' ? 'medium' : selected);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const themeText = document.getElementById('theme-text');

    if (isLight) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
        themeText.textContent = 'Dark Mode';
        localStorage.setItem('vabo-theme', 'light');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        themeText.textContent = 'Light Mode';
        localStorage.setItem('vabo-theme', 'dark');
    }
}

// ─── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('navigation-open')) return;
        if (event.key === 'Escape') setNavigation(false);
        if (event.key === 'Tab') {
            const controls = [...document.querySelectorAll('.sidebar button, .sidebar a, .sidebar [tabindex="0"]')].filter(el => el.getClientRects().length);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    window.matchMedia('(max-width: 768px)').addEventListener('change', () => setNavigation(false, false));
    // Existing category cards and theme control also work from the keyboard.
    document.querySelectorAll('.type-card, .theme-toggle').forEach(card => {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
        });
    });
    // Initialize Theme
    const savedTheme = localStorage.getItem('vabo-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('sun-icon').classList.remove('hidden');
        document.getElementById('moon-icon').classList.add('hidden');
        document.getElementById('theme-text').textContent = 'Dark Mode';
    }

    // Hide loading screen after small delay
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 400);

        // Initialize Font Scaling
        const savedFontSize = localStorage.getItem('vabo-font-size') || 'auto';
        if(typeof applyFontScaling === 'function') applyFontScaling(savedFontSize);

        // Check if user is already logged in
        const token = getToken();
        const user = getUser();
        if (token && user) {
            showApp(user);
        } else {
            showAuth();
        }
    }, 800);

    // Event listeners
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);

    // Debounced search
    const inventorySearch = document.getElementById('inventory-search');
    if (inventorySearch) {
        inventorySearch.addEventListener('input', debounce(() => {
            applyCurrentInventoryView();
        }, 250));
    }

    const empSearch = document.getElementById('employees-search');
    if (empSearch) {
        empSearch.addEventListener('input', debounce(() => {
            renderEmployees(allEmployees, allAssets, empSearch.value);
        }, 250));
    }
    const assetSearch = document.getElementById('asset-search');
    if (assetSearch) {
        assetSearch.addEventListener('input', debounce(() => {
            renderSelectable(allAssets, selectedAssetIds, currentTransactionType, assetSearch.value);
        }, 250));
    }

    const holderInput = document.getElementById('in-holder');
    if (holderInput) {
        holderInput.addEventListener('input', handleHolderInput);
        holderInput.addEventListener('change', handleHolderInput);
        holderInput.addEventListener('blur', handleHolderInput);
    }
});

// ─── Auth Flow ─────────────────────────────────────────────────
function showAuth() {
    setNavigation(false, false);
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    toggleAuth('login');
}

function showApp(user) {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-display').textContent = user.username;
    document.getElementById('workspace-avatar').textContent = user.username.slice(0, 2).toUpperCase();
    loadData(true);
}

function toggleAuth(mode) {
    document.getElementById('login-view').classList.toggle('hidden', mode !== 'login');
    document.getElementById('register-view').classList.toggle('hidden', mode !== 'register');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) return toast('Enter username and password', 'warning');

    showLoader('Authenticating...');
    try {
        const data = await apiLogin(username, password);
        toast(`Welcome back, ${data.user.username}!`, 'success');
        showApp(data.user);
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!username || !password) return toast('Fill all fields', 'warning');
    if (password !== confirm) return toast('Passwords do not match', 'error');
    if (password.length < 4) return toast('Password must be at least 4 characters', 'warning');

    showLoader('Creating Account...');
    try {
        const data = await apiRegister(username, password);
        toast('Account created! Welcome!', 'success');
        showApp(data.user);
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function logout() {
    clearToken();
    showAuth();
    toast('Logged out', 'info');
}

// ─── Data Loading ──────────────────────────────────────────────
async function loadData(showProcess = false) {
    setSyncState('loading', 'Syncing data…');
    if (showProcess) showLoader('Synchronizing Data...');
    try {
        const [assetsRes, transRes, stats, employeesRes, printLogsRes] = await Promise.all([
            apiGetAllAssets(),
            apiGetTransactions(),
            apiGetStats(),
            apiGetEmployees(),
            apiGetPrintLogs()
        ]);

        allAssets = assetsRes || [];
        allTransactions = transRes?.data || [];
        allEmployees = employeesRes || [];
        allPrintLogs = printLogsRes || [];
        
        rebuildHolderProfiles(allAssets);
        rebuildEmployeeSuggestions(allEmployees);
        renderDepartmentTiles(allAssets);

        renderDashboard(stats, allTransactions, allAssets);
        updateTypeCounts();
        applyCurrentInventoryView();
        renderHistory(allTransactions);
        renderEmployees(allEmployees, allAssets, '');
        renderPrintLogs(allPrintLogs);
        setSyncState('ready', `Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (err) {
        console.warn('Data load warning:', err);
        setSyncState('error', 'Refresh needed');
        toast('Could not refresh data: ' + err.message, 'error');
    } finally {
        if (showProcess) hideLoader();
    }
}

// ─── Navigation ────────────────────────────────────────────────
function switchView(view) {
    setNavigation(false, false);
    currentView = view;

    // Hide all views
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));

    // Deactivate all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Route 'inventory' sidebar click to the type selector
    let targetId = view;
    if (view === 'inventory') {
        targetId = 'inventory-select';
        updateTypeCounts();
    }
    if (view === 'takeover') targetId = 'handover';

    document.getElementById('view-' + targetId)?.classList.remove('hidden');

    // Activate button
    const btnId = (view === 'inventory-select' || view === 'inventory') ? 'inventory' : (view === 'ai' ? 'ai' : view);
    const btn = document.getElementById('btn-' + btnId);
    if (btn) btn.classList.add('active');

    // View specific triggers
    if (view === 'print-logs') renderPrintLogs(allPrintLogs);
    if (view === 'history') renderHistory(allTransactions);

    // Setup transaction view
    if (view === 'handover' || view === 'takeover') {
        currentTransactionType = view;
        document.getElementById('trans-title').textContent = view === 'handover' ? 'Asset Handover' : 'Asset Takeover';
        document.getElementById('form-ref').value  = `AAI/VABO/IT/${new Date().getFullYear()}/`;
        document.getElementById('form-date').value = getTodayISO();

        // Clear ALL fields — fresh start every time
        ['form-name', 'form-desig', 'form-dept',
         'form-issuer', 'form-issuer-desig', 'form-issuer-dept',
         'form-ip', 'form-hostname', 'form-trans-remark'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Toggle sections based on type
        const netSection = document.getElementById('network-section');
        const takeNotice = document.getElementById('takeover-notice');
        if (view === 'handover') {
            netSection?.classList.remove('hidden');
            takeNotice?.classList.add('hidden');
        } else {
            netSection?.classList.add('hidden');
            takeNotice?.classList.remove('hidden');
        }

        selectedAssetIds = [];
        rebuildEmployeeSuggestions(allEmployees);
        renderSelectable(allAssets, selectedAssetIds, currentTransactionType, '');
    }

    if (view === 'employees') {
        document.getElementById('employees-search').value = '';
        renderEmployees(allEmployees, allAssets, '');
    }
}

// ─── Asset Type Filter ─────────────────────────────────────────
function filterByType(type) {
    setNavigation(false, false);
    currentView = 'inventory';
    currentInventoryGrouping = 'type';
    currentAssetFilter = type;

    // Show the inventory view (not the selector)
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-inventory')?.classList.remove('hidden');

    // Keep inventory nav button active
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-inventory')?.classList.add('active');

    // Update title
    const typeLabels = { 'all': 'All Assets', 'PC': 'Desktop / PC', 'Laptop': 'Laptops', 'Printer': 'Printers', 'UPS': 'UPS Units', 'SCANNER': 'Scanners', 'AIO': 'AIO (ALL IN ONE)' };
    document.getElementById('inventory-title').textContent = typeLabels[type] || 'Asset Inventory';
    document.getElementById('inventory-subtitle').textContent = type === 'all' ? 'All registered IT assets' : `Filtered by: ${type}`;

    // Filter and render
    const filtered = type === 'all' ? allAssets :
        allAssets.filter(a => a.name?.toLowerCase() === type.toLowerCase());

    renderInventory(filtered, '');
    document.getElementById('inventory-search').value = '';
}

function filterByDepartment(department) {
    setNavigation(false, false);
    currentView = 'inventory';
    currentInventoryGrouping = 'department';
    currentAssetFilter = department;

    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-inventory')?.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-inventory')?.classList.add('active');

    document.getElementById('inventory-title').textContent = department;
    document.getElementById('inventory-subtitle').textContent = `Assets assigned to department: ${department}`;

    const filtered = allAssets.filter(a => (a.assigned_dept || '').trim().toLowerCase() === department.toLowerCase());
    renderInventory(filtered, '');
    document.getElementById('inventory-search').value = '';
}

function applyCurrentInventoryView() {
    const searchValue = document.getElementById('inventory-search')?.value || '';

    if (currentView !== 'inventory' && currentView !== 'inventory-select' && currentView !== 'department-select') {
        return;
    }

    if (currentInventoryGrouping === 'department' && currentAssetFilter && currentAssetFilter !== 'all') {
        document.getElementById('inventory-title').textContent = currentAssetFilter;
        document.getElementById('inventory-subtitle').textContent = `Assets assigned to department: ${currentAssetFilter}`;
        const filtered = allAssets.filter(a => (a.assigned_dept || '').trim().toLowerCase() === currentAssetFilter.toLowerCase());
        renderInventory(filtered, searchValue);
        return;
    }

    const typeLabels = { 'all': 'All Assets', 'PC': 'Desktop / PC', 'Laptop': 'Laptops', 'Printer': 'Printers', 'UPS': 'UPS Units', 'SCANNER': 'Scanners', 'AIO': 'AIO (ALL IN ONE)' };
    const activeType = currentAssetFilter || 'all';
    document.getElementById('inventory-title').textContent = typeLabels[activeType] || 'Asset Inventory';
    document.getElementById('inventory-subtitle').textContent = activeType === 'all' ? 'All registered IT assets' : `Filtered by: ${activeType}`;
    const filtered = activeType === 'all'
        ? allAssets
        : allAssets.filter(a => a.name?.toLowerCase() === activeType.toLowerCase());
    renderInventory(filtered, searchValue);
}

function updateTypeCounts() {
    const known = ['PC', 'Laptop', 'Printer', 'UPS', 'SCANNER', 'AIO'];
    const counts = { all: allAssets.length, pc: 0, laptop: 0, printer: 0, ups: 0, scanner: 0, aio: 0 };
    const departments = new Set();

    allAssets.forEach(a => {
        const name = (a.name || '').toLowerCase();
        const dept = (a.assigned_dept || '').trim();
        if (name === 'pc') counts.pc++;
        else if (name === 'laptop') counts.laptop++;
        else if (name === 'printer') counts.printer++;
        else if (name === 'ups') counts.ups++;
        else if (name === 'scanner') counts.scanner++;
        else if (name === 'aio') counts.aio++;
        if (dept) departments.add(dept.toLowerCase());
    });

    // Animate counters on the cards
    animateCounter(document.getElementById('count-all'), counts.all);
    animateCounter(document.getElementById('count-pc'), counts.pc);
    animateCounter(document.getElementById('count-laptop'), counts.laptop);
    animateCounter(document.getElementById('count-printer'), counts.printer);
    animateCounter(document.getElementById('count-ups'), counts.ups);
    animateCounter(document.getElementById('count-scanner'), counts.scanner);
    animateCounter(document.getElementById('count-aio'), counts.aio);
    animateCounter(document.getElementById('count-departments'), departments.size);
}

function renderDepartmentTiles(assets) {
    const container = document.getElementById('department-selector-grid');
    if (!container) return;

    const counts = new Map();
    assets.forEach((asset) => {
        const department = (asset.assigned_dept || '').trim();
        if (!department) return;
        counts.set(department, (counts.get(department) || 0) + 1);
    });

    const departments = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    if (departments.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; text-align:center; color:var(--text-muted);">
                No departments found in current asset data.
            </div>
        `;
        return;
    }

    container.innerHTML = departments.map(([department, count]) => `
        <div class="type-card type-card-department" onclick="filterByDepartment('${department.replace(/'/g, "\\'")}')">
            <div class="type-card-icon">
                <svg viewBox="0 0 24 24" width="36" height="36">
                    <path fill="currentColor"
                        d="M3 5h18v2H3V5zm2 4h14v10H5V9zm3 2v2h2v-2H8zm0 4v2h2v-2H8zm4-4v2h2v-2h-2zm0 4v2h2v-2h-2z" />
                </svg>
            </div>
            <div class="type-card-label">${department}</div>
            <div class="type-card-count">${count}</div>
        </div>
    `).join('');
}

function goBackToInventorySelector() {
    switchView(currentInventoryGrouping === 'department' ? 'department-select' : 'inventory-select');
}

function rebuildHolderProfiles(assets) {
    holderProfiles = new Map();

    [...assets]
        .sort((a, b) => new Date(b.last_update || 0) - new Date(a.last_update || 0))
        .forEach((asset) => {
            const holder = (asset.current_user || '').trim();
            if (!holder || holder.toLowerCase() === 'it store' || holderProfiles.has(holder.toLowerCase())) {
                return;
            }

            holderProfiles.set(holder.toLowerCase(), {
                name: holder,
                designation: (asset.assigned_desig || '').trim(),
                department: (asset.assigned_dept || '').trim()
            });
        });

    const datalist = document.getElementById('holder-suggestions');
    if (!datalist) return;

    datalist.innerHTML = [...holderProfiles.values()]
        .map((profile) => `<option value="${profile.name.replace(/"/g, '&quot;')}"></option>`)
        .join('');
}

function handleHolderInput() {
    const holder = document.getElementById('in-holder')?.value.trim();
    if (!holder) return;

    const profile = holderProfiles.get(holder.toLowerCase());
    if (!profile) return;

    const desigInput = document.getElementById('in-desig');
    const deptInput = document.getElementById('in-dept');

    if (desigInput && !desigInput.value.trim()) {
        desigInput.value = profile.designation;
    }
    if (deptInput && !deptInput.value.trim()) {
        deptInput.value = profile.department;
    }
}

// ─── Inventory Sort ────────────────────────────────────────────
function sortInventory(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    // Map column keys to asset fields
    const fieldMap = {
        'name': 'name',
        'make': 'make',
        'model': 'model',
        'serial': 'serial_number',
        'ip': 'ip_address',
        'hostname': 'hostname',
        'remark': 'remark',
        'monitor': 'monitor_serial',
        'charger': 'charger_serial',
        'holder': 'current_user',
        'desig': 'assigned_desig',
        'dept': 'assigned_dept',
        'status': 'status'
    };
    const field = fieldMap[column];
    if (!field) return;

    allAssets.sort((a, b) => {
        const va = (a[field] || '').toLowerCase();
        const vb = (b[field] || '').toLowerCase();
        if (va < vb) return sortDirection === 'asc' ? -1 : 1;
        if (va > vb) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderInventory(allAssets, document.getElementById('inventory-search')?.value || '');

    // Update header arrows
    document.querySelectorAll('#view-inventory thead th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === column) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

// ─── Asset CRUD ────────────────────────────────────────────────
function checkAssetType() {
    const name = (document.getElementById('in-name').value || '').toLowerCase();
    const charger = document.getElementById('in-charger');
    const monMake = document.getElementById('in-monitor-make');
    const monSerial = document.getElementById('in-monitor-serial');
    const keyboardMake = document.getElementById('in-keyboard-make');
    const mouseMake = document.getElementById('in-mouse-make');
    const kva = document.getElementById('in-kva');

    // Charger — laptops only
    charger.classList.toggle('hidden', !name.includes('laptop'));
    charger.classList.toggle('input-highlight', name.includes('laptop'));

    // Monitor fields — PC/AIO/Desktop
    const showMonitor = name.includes('pc') || name.includes('desktop') || name.includes('computer') || name.includes('aio');
    monMake.classList.toggle('hidden', !showMonitor);
    monSerial.classList.toggle('hidden', !showMonitor);
    if (showMonitor) {
        monMake.classList.add('input-highlight');
        monSerial.classList.add('input-highlight');
    } else {
        monMake.classList.remove('input-highlight');
        monSerial.classList.remove('input-highlight');
    }

    // Keyboard/Mouse — PC/Desktop/Laptop
    const showKbMouse = name.includes('pc') || name.includes('desktop') || name.includes('computer') || name.includes('laptop') || name.includes('aio');
    keyboardMake.classList.toggle('hidden', !showKbMouse);
    mouseMake.classList.toggle('hidden', !showKbMouse);

    // KVA — UPS only
    kva.classList.toggle('hidden', !name.includes('ups'));
    if (name.includes('ups')) kva.classList.add('input-highlight');
    else kva.classList.remove('input-highlight');
}

async function saveAsset() {
    const name = document.getElementById('in-name').value.trim();
    const serial = document.getElementById('in-serial').value.trim();
    if (!name || !serial) return toast('Name and Serial Number are required', 'warning');

    const holder = document.getElementById('in-holder').value.trim();
    const data = {
        name,
        serial_number: serial,
        asset_tag: document.getElementById('in-asset-tag').value.trim(),
        charger_serial: document.getElementById('in-charger').value.trim(),
        monitor_make: document.getElementById('in-monitor-make').value.trim(),
        monitor_serial: document.getElementById('in-monitor-serial').value.trim(),
        keyboard_make: document.getElementById('in-keyboard-make').value.trim(),
        mouse_make: document.getElementById('in-mouse-make').value.trim(),
        make: document.getElementById('in-make').value.trim(),
        model: document.getElementById('in-model').value.trim(),
        ip_address: document.getElementById('in-ip').value.trim(),
        hostname: document.getElementById('in-hostname').value.trim(),
        current_user: holder || 'IT Store',
        contractual_user_name: document.getElementById('in-contractual-user').value.trim(),
        assigned_dept: document.getElementById('in-dept').value.trim(),
        assigned_desig: document.getElementById('in-desig').value.trim(),
        employee_id: document.getElementById('in-employee-id').value || null,
        year_of_purchase: document.getElementById('in-year').value.trim() || null,
        kva: document.getElementById('in-kva').value.trim(),
        warranty_expiry: document.getElementById('in-warranty').value.trim(),
        remark: document.getElementById('in-remark').value.trim()
    };

    showLoader(editingAssetId ? 'Updating Asset...' : 'Registering Asset...');
    try {
        if (editingAssetId) {
            await apiUpdateAsset(editingAssetId, data);
            toast('Asset updated successfully', 'success');
        } else {
            await apiCreateAsset(data);
            toast('Asset registered successfully', 'success');
        }
        resetForm();
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function editAsset(id) {
    const a = allAssets.find(x => x.id === id);
    if (!a) return;

    editingAssetId = id;
    document.getElementById('in-name').value = a.name || '';
    document.getElementById('in-serial').value = a.serial_number || '';
    document.getElementById('in-asset-tag').value = a.asset_tag || '';
    document.getElementById('in-charger').value = a.charger_serial || '';
    document.getElementById('in-monitor-make').value = a.monitor_make || '';
    document.getElementById('in-monitor-serial').value = a.monitor_serial || '';
    document.getElementById('in-keyboard-make').value = a.keyboard_make || '';
    document.getElementById('in-mouse-make').value = a.mouse_make || '';
    document.getElementById('in-make').value = a.make || '';
    document.getElementById('in-model').value = a.model || '';
    document.getElementById('in-ip').value = a.ip_address || '';
    document.getElementById('in-hostname').value = a.hostname || '';
    document.getElementById('in-holder').value = a.current_user || '';
    document.getElementById('in-contractual-user').value = a.contractual_user_name || '';
    document.getElementById('in-employee-id').value = a.employee_id || '';
    document.getElementById('in-dept').value = a.assigned_dept || '';
    document.getElementById('in-desig').value = a.assigned_desig || '';
    document.getElementById('in-year').value = a.year_of_purchase || '';
    document.getElementById('in-kva').value = a.kva || '';
    document.getElementById('in-warranty').value = a.warranty_expiry || '';
    document.getElementById('in-remark').value = a.remark || '';
    handleHolderInput();

    checkAssetType();

    document.getElementById('btn-save-asset').textContent = '✏️ Update Asset';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    document.getElementById('form-header').textContent = 'EDITING ASSET';

    document.getElementById('view-inventory').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    editingAssetId = null;
    document.querySelectorAll('#view-inventory .form-input').forEach(i => i.value = '');
    const empIdField = document.getElementById('in-employee-id');
    if (empIdField) empIdField.value = '';
    document.getElementById('in-charger').classList.add('hidden');
    document.getElementById('in-monitor-make').classList.add('hidden');
    document.getElementById('in-monitor-serial').classList.add('hidden');
    document.getElementById('in-keyboard-make').classList.add('hidden');
    document.getElementById('in-mouse-make').classList.add('hidden');
    document.getElementById('in-kva').classList.add('hidden');
    document.getElementById('btn-save-asset').textContent = '💾 Register Asset';
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    document.getElementById('form-header').textContent = 'NEW REGISTRATION';
}

async function reprintFromLog(transId) {
    const t = allTransactions.find(x => x.id === transId);
    if (!t) return toast('Transaction not found', 'error');

    const confirmed = confirm('Are you sure you want to reprint this document?');
    if (!confirmed) return;

    let printWin = window.open('', '_blank', 'height=800,width=900');
    if (printWin) {
        printWin.document.write('<div style="font-family:sans-serif; padding:20px; text-align:center;">Preparing Document...</div>');
    }

    showLoader('Processing Reprint...');
    try {
        const session = await getSessionDetails('Reprint');
        
        // Prepare data for printing — use the ORIGINAL record data
        const printData = {
            ...t,
            session
        };

        // Assets in the transaction
        const assetIds = JSON.parse(t.asset_ids || '[]');
        const items = allAssets.filter(a => assetIds.includes(a.id) || assetIds.includes(String(a.id)));

        // Trigger print
        printTransaction(printData, items, printWin);

        // Log the reprint action to the backend
        await apiLogPrint({
            transaction_id: t.id,
            action_type: 'Reprint',
            system_ip: session.ip,
            system_hostname: session.hostname,
            ref_no: t.ref_no,
            doc_type: t.type
        });

        toast('Reprint logged successfully', 'success');
    } catch (err) {
        if (printWin) printWin.close();
        toast('Error during reprint: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function getSessionDetails(actionType) {
    const user = getUser();
    const now = new Date();
    
    // Fallback if department is not available in session
    const dept = user?.department || 'IT Department'; 

    // Capture system info (limited by browser security, using best effort)
    let ip = 'Local-IP';
    try {
        // Fetch public IP with a strict timeout to prevent printing delays
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (res) {
            const data = await res.json();
            ip = data.ip;
        }
    } catch (e) { /* ignore or timeout */ }

    return {
        action: actionType,
        user: user?.username || 'Unknown',
        dept: dept,
        hostname: window.location.hostname || 'Localhost',
        ip: ip,
        time: now.toLocaleString('en-IN')
    };
}

function confirmDeleteAsset(id) {
    if (confirm('Are you sure you want to delete this asset permanently?')) {
        deleteAssetById(id);
    }
}

async function deleteAssetById(id) {
    try {
        await apiDeleteAsset(id);
        toast('Asset deleted', 'info');
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ─── Transaction Flow ──────────────────────────────────────────
function toggleAsset(id) {
    if (selectedAssetIds.includes(id)) {
        selectedAssetIds = selectedAssetIds.filter(i => i !== id);
    } else {
        selectedAssetIds.push(id);
        // Auto-fill for takeover
        if (currentTransactionType === 'takeover') {
            const asset = allAssets.find(a => a.id === id);
            if (asset) {
                if (asset.current_user) document.getElementById('form-name').value = asset.current_user;
            }
        }
    }
    renderSelectable(allAssets, selectedAssetIds, currentTransactionType, document.getElementById('asset-search')?.value || '');
}

async function submitTransaction(method) {
    if (selectedAssetIds.length === 0) return toast('Select at least one asset', 'warning');

    const empName      = document.getElementById('form-name').value.trim();
    const empDesig     = document.getElementById('form-desig').value.trim();
    const empDept      = document.getElementById('form-dept').value.trim();
    const issuerName   = document.getElementById('form-issuer').value.trim();
    const issuerDesig  = document.getElementById('form-issuer-desig').value.trim();
    const issuerDept   = document.getElementById('form-issuer-dept').value.trim();
    
    const newIP       = document.getElementById('form-ip').value.trim();
    const newHostname = document.getElementById('form-hostname').value.trim();

    if (!empName)    return toast('Employee / Receiver Name is required', 'warning');
    if (!issuerName) return toast('Issuer Name is required', 'warning');

    // Network validation for handover
    if (currentTransactionType === 'handover') {
        if (!newHostname) return toast('Hostname is required for handover', 'warning');
        if (newIP && !isValidIPv4(newIP)) return toast('Please enter a valid IP address', 'warning');
    }

    // Validate both came from DB (desig fields will be non-empty if correctly selected)
    if (!empDesig)   return toast('Select a valid Employee from the suggestions list', 'warning');
    if (!issuerDesig) return toast('Select a valid Issuer from the suggestions list', 'warning');

    let printWin = null;
    if (method === 'print') {
        printWin = window.open('', '_blank', 'height=800,width=900');
        if (printWin) {
            printWin.document.write('<div style="font-family:sans-serif; padding:20px; text-align:center;">Generating Document, please wait...</div>');
        } else {
            toast('Popup blocked! Please allow popups for this site.', 'error');
            return;
        }
    }

    const selectedItems = allAssets.filter(a => selectedAssetIds.includes(a.id));
    const data = {
        type:           currentTransactionType,
        asset_ids:      selectedAssetIds,
        asset_names:    selectedItems.map(a => a.name).join(', '),
        ref_no:         document.getElementById('form-ref').value,
        date:           document.getElementById('form-date').value,
        employee_name:  empName,
        employee_desig: empDesig,
        employee_dept:  empDept,
        employee_id:    document.getElementById('form-employee-id').value || null,
        issuer_name:    issuerName,
        issuer_desig:   issuerDesig,
        issuer_dept:    issuerDept,
        issuer_id:      document.getElementById('form-issuer-id').value || null,
        remark:         document.getElementById('form-trans-remark').value.trim(),
        new_ip_address: newIP,
        new_hostname:   newHostname
    };

    showLoader(method === 'print' ? 'Generating Document...' : 'Recording Transaction...');
    try {
        // Note: AI Validation removed to ensure instant document generation

        const response = await apiCreateTransaction(data);
        const transId = response.id;
        toast('Transaction recorded successfully!', 'success');
        
        if (method === 'print') {
            const session = await getSessionDetails('Print');
            const printData = { ...data, session };
            printTransaction(printData, selectedItems, printWin);
            
            // Log the print action
            await apiLogPrint({
                transaction_id: transId,
                action_type: 'Print',
                system_ip: session.ip,
                system_hostname: session.hostname,
                ref_no: data.ref_no,
                doc_type: data.type
            });
        }
        
        loadData();
        switchView('dashboard');
    } catch (err) {
        if (printWin) printWin.close();
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ─── Import/Export ──────────────────────────────────────────────
function exportCSV() {
    if (allAssets.length === 0) return toast('No data to export', 'warning');
    showLoader('Exporting CSV...');
    setTimeout(() => {
        downloadCSV(allAssets);
        toast('CSV exported!', 'success');
        hideLoader();
    }, 500);
}

function backupData() {
    showLoader('Creating Backup...');
    setTimeout(() => {
        downloadJSON({ assets: allAssets, transactions: allTransactions });
        toast('Backup downloaded!', 'success');
        hideLoader();
    }, 500);
}

let importedRecords = [];

function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    importedRecords = [];
}

function importCSV(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
        toast('Please upload a valid CSV file', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const rows = parseCSV(e.target.result);
            if (rows.length === 0) {
                toast('No valid data found in CSV', 'error');
                return;
            }

            importedRecords = rows;
            showImportPreview(rows);
            document.getElementById('import-modal').classList.remove('hidden');
        } catch (err) {
            toast('Failed to process CSV: ' + err.message, 'error');
        }
        input.value = '';
    };
    reader.readAsText(file);
}

function showImportPreview(records) {
    const tbody = document.getElementById('import-preview-body');
    const totalEl = document.getElementById('stat-import-total');
    const successEl = document.getElementById('stat-import-success');
    const failedEl = document.getElementById('stat-import-failed');
    const logContainer = document.getElementById('import-log');
    const logContent = document.getElementById('import-log-content');
    const downloadBtn = document.getElementById('btn-download-error-log');

    tbody.innerHTML = '';
    logContent.innerHTML = '';
    
    let successCount = 0;
    let failedCount = 0;
    const failedRecords = [];

    records.forEach((row, index) => {
        if (row._isValid) successCount++;
        else {
            failedCount++;
            failedRecords.push({ line: index + 2, ...row });
        }

        // Limit preview to first 50 rows for performance
        if (index < 50) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="status-badge ${row._isValid ? 'status-success' : 'status-error'}">${row._isValid ? 'Valid' : 'Invalid'}</span></td>
                <td>${row.name}</td>
                <td>${row.serial_number}</td>
                <td>${row.current_user}</td>
                <td>${row.assigned_desig}</td>
                <td>${row._isValid ? '✅' : '❌'}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    totalEl.textContent = records.length;
    successEl.textContent = successCount;
    failedEl.textContent = failedCount;

    if (failedCount > 0) {
        logContainer.classList.remove('hidden');
        failedRecords.slice(0, 20).forEach(f => {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.textContent = `Line ${f.line}: ${f._errors.join(', ')}`;
            logContent.appendChild(div);
        });
        if (failedCount > 20) {
            const more = document.createElement('div');
            more.style.padding = '5px';
            more.style.fontSize = '0.75rem';
            more.textContent = `... and ${failedCount - 20} more errors.`;
            logContent.appendChild(more);
        }
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = () => downloadErrorReport(failedRecords);
    } else {
        logContainer.classList.add('hidden');
        downloadBtn.classList.add('hidden');
    }

    document.getElementById('btn-confirm-import').onclick = () => finalizeImport(records.filter(r => r._isValid));
}

async function finalizeImport(cleanRecords) {
    if (cleanRecords.length === 0) return toast('No valid records to import', 'warning');

    showLoader(`Importing ${cleanRecords.length} records...`);
    try {
        const result = await apiBulkImport(cleanRecords);
        toast(`Import Complete: ${result.imported} records successful!`, 'success');
        closeImportModal();
        loadData();
    } catch (err) {
        toast('Finalization failed: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

function downloadErrorReport(failedRecords) {
    let csv = 'Line,Asset_Type,Serial,Holder,Designation,Errors\n';
    failedRecords.forEach(f => {
        const esc = (v) => `"${(v || '').replace(/"/g, '""')}"`;
        csv += `${f.line},${esc(f.name)},${esc(f.serial_number)},${esc(f.current_user)},${esc(f.assigned_desig)},${esc(f._errors.join('; '))}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Import_Errors_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
}


// ─── Global Autocomplete System ────────────────────────────────
// Single floating dropdown attached to <body> — avoids all overflow/z-index issues
let _acDropdown = null;
let _acCurrentInput = null;

function _getAcDropdown() {
    if (!_acDropdown) {
        _acDropdown = document.createElement('div');
        _acDropdown.id = 'global-ac-dropdown';
        _acDropdown.style.cssText = [
            'position:fixed',
            'z-index:99999',
            'background:#1a1f2e',
            'border:1px solid rgba(255,255,255,0.12)',
            'border-radius:10px',
            'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
            'max-height:220px',
            'overflow-y:auto',
            'display:none',
            'min-width:200px'
        ].join(';');
        document.body.appendChild(_acDropdown);

        // Close when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (_acCurrentInput && !_acCurrentInput.contains(e.target) && !_acDropdown.contains(e.target)) {
                _hideAcDropdown();
            }
        });
    }
    return _acDropdown;
}

function _showAcDropdown(inputEl, matches, onSelect) {
    const drop = _getAcDropdown();
    _acCurrentInput = inputEl;

    if (matches.length === 0) { _hideAcDropdown(); return; }

    drop.innerHTML = matches.map(emp => `
        <div class="ac-item"
            style="padding:10px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);
                   display:flex; flex-direction:column; gap:2px; transition:background 0.15s;">
            <span style="font-weight:600; font-size:0.88rem; color:#e8eaf6;">${emp.name}</span>
            <span style="font-size:0.72rem; color:#8892a4;">
                ${emp.designation || '—'} ${emp.department ? '&nbsp;·&nbsp;' + emp.department : ''}
            </span>
        </div>
    `).join('');

    drop.querySelectorAll('.ac-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => el.style.background = 'rgba(66,133,244,0.15)');
        el.addEventListener('mouseleave', () => el.style.background = '');
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onSelect(matches[i]);
            _hideAcDropdown();
        });
    });

    // Position below the input
    const rect = inputEl.getBoundingClientRect();
    drop.style.left   = rect.left + 'px';
    drop.style.top    = (rect.bottom + 2) + 'px';
    drop.style.width  = rect.width + 'px';
    drop.style.display = 'block';
}

function _hideAcDropdown() {
    if (_acDropdown) _acDropdown.style.display = 'none';
    _acCurrentInput = null;
}

function _wireAutocomplete(inputEl, desigEl, deptEl, empList, hiddenIdEl = null) {
    if (!inputEl) return;

    function search(q) {
        const lower = q.toLowerCase();
        return lower.length < 1
            ? empList.slice(0, 40)
            : empList.filter(e =>
                e.name.toLowerCase().includes(lower) ||
                (e.designation || '').toLowerCase().includes(lower) ||
                (e.department  || '').toLowerCase().includes(lower)
            );
    }

    function applySelection(emp) {
        inputEl.value = emp.name;
        if (desigEl) desigEl.value = emp.designation || '';
        if (deptEl)  deptEl.value  = emp.department  || '';
        if (hiddenIdEl) hiddenIdEl.value = emp.id;
        _hideAcDropdown();
    }

    function clearFields() {
        inputEl.value = '';
        if (desigEl) desigEl.value = '';
        if (deptEl)  deptEl.value  = '';
        if (hiddenIdEl) hiddenIdEl.value = '';
    }

    // On every keystroke: clear auto-fill and show suggestions
    inputEl.oninput = () => {
        if (desigEl) desigEl.value = '';
        if (deptEl)  deptEl.value  = '';
        if (hiddenIdEl) hiddenIdEl.value = '';
        _showAcDropdown(inputEl, search(inputEl.value), applySelection);
    };

    // On focus: show suggestions
    inputEl.onfocus = () => {
        _showAcDropdown(inputEl, search(inputEl.value), applySelection);
    };

    // On blur: validate — must match an employee in the list exactly
    inputEl.onblur = () => {
        setTimeout(() => {
            _hideAcDropdown();
            const typed = inputEl.value.trim().toLowerCase();
            if (!typed) return;

            // "IT Store" is a special allowed value for Assets
            if (inputEl.id === 'in-holder' && typed === 'it store') {
                inputEl.value = 'IT Store';
                if (desigEl) desigEl.value = '';
                if (deptEl)  deptEl.value  = '';
                if (hiddenIdEl) hiddenIdEl.value = '';
                return;
            }

            const match = empList.find(e => e.name.toLowerCase() === typed);
            if (match) {
                // Exact match — ensure fields are filled
                inputEl.value = match.name;
                if (desigEl) desigEl.value = match.designation || '';
                if (deptEl)  deptEl.value  = match.department  || '';
                if (hiddenIdEl) hiddenIdEl.value = match.id;
            } else {
                // No match — clear everything and warn
                clearFields();
                toast('Please select a valid name from the dropdown list', 'warning');
            }
        }, 180);
    };
}

function rebuildEmployeeSuggestions(employees) {
    const empList = employees || [];
    _wireAutocomplete(
        document.getElementById('form-name'),
        document.getElementById('form-desig'),
        document.getElementById('form-dept'),
        empList,
        document.getElementById('form-employee-id')
    );
    _wireAutocomplete(
        document.getElementById('form-issuer'),
        document.getElementById('form-issuer-desig'),
        document.getElementById('form-issuer-dept'),
        empList,
        document.getElementById('form-issuer-id')
    );
    _wireAutocomplete(
        document.getElementById('in-holder'),
        document.getElementById('in-desig'),
        document.getElementById('in-dept'),
        empList,
        document.getElementById('in-employee-id')
    );
}

// ─── Employee Management ───────────────────────────────────────
function filterEmployees() {
    const query = document.getElementById('employees-search').value;
    renderEmployees(allEmployees, allAssets, query);
}

function openEmployeeModal(empId = null) {
    const modal = document.getElementById('employee-modal');
    const title = document.getElementById('employee-modal-title');
    const form = document.getElementById('employee-form');
    
    form.reset();
    document.getElementById('emp-id').value = '';
    
    if (empId) {
        const emp = allEmployees.find(e => e.id === empId);
        if (emp) {
            title.textContent = '👤 Edit Employee';
            document.getElementById('emp-id').value = emp.id;
            document.getElementById('emp-name').value = emp.name;
            document.getElementById('emp-designation').value = emp.designation;
            document.getElementById('emp-department').value = emp.department;
            document.getElementById('emp-save-btn').textContent = 'Update Employee';
        }
    } else {
        title.textContent = '👤 Add Employee';
        document.getElementById('emp-save-btn').textContent = 'Save Employee';
    }
    
    modal.classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

async function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('emp-id').value;
    const data = {
        name: document.getElementById('emp-name').value.trim(),
        designation: document.getElementById('emp-designation').value.trim(),
        department: document.getElementById('emp-department').value.trim()
    };

    try {
        if (id) {
            await apiUpdateEmployee(id, data);
            toast('Employee updated successfully', 'success');
        } else {
            await apiCreateEmployee(data);
            toast('Employee added successfully', 'success');
        }
        closeEmployeeModal();
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    }
}

function editEmployee(id) {
    openEmployeeModal(id);
}

async function confirmDeleteEmployee(id) {
    const emp = allEmployees.find(e => e.id === id);
    if (!emp) return;

    if (confirm(`Are you sure you want to delete employee "${emp.name}"? This will not affect past transaction records.`)) {
        try {
            await apiDeleteEmployee(id);
            toast('Employee deleted', 'success');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    }
}


// ─── Audit Log Editing (Admin Only) ───────────────────────────
function confirmDeleteAuditLog(id) {
    const t = allTransactions.find(x => x.id === id);
    if (t) {
        const msg = `⚠ LINKED DELETION WARNING\n\n` +
                    `This audit log is linked with Asset Trail, Employee Trail, and Transaction History.\n` +
                    `Deleting it will automatically update all connected records to maintain consistency.\n\n` +
                    `Do you want to continue?`;
        if (!confirm(msg)) return;
    }

    document.getElementById('audit-delete-id').value = id;
    document.getElementById('audit-delete-reason').value = '';
    document.getElementById('audit-delete-modal').classList.remove('hidden');
}

function closeAuditDeleteModal() {
    document.getElementById('audit-delete-modal').classList.add('hidden');
}

async function submitDeleteAuditLog() {
    const id = document.getElementById('audit-delete-id').value;
    const reason = document.getElementById('audit-delete-reason').value.trim();
    
    if (!reason) {
        return toast('Reason for deletion is mandatory', 'warning');
    }

    try {
        await apiDeleteTransaction(id, reason);
        toast('Audit log record deleted', 'success');
        closeAuditDeleteModal();
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    }
}

function filterHistory() {
    const q = (document.getElementById('history-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('history-type-filter')?.value || 'all';

    const filtered = allTransactions.filter(t => {
        const matchType = typeFilter === 'all' || t.type === typeFilter;
        const matchQ = !q
            || (t.employee_name || '').toLowerCase().includes(q)
            || (t.asset_names || '').toLowerCase().includes(q)
            || (t.ref_no || '').toLowerCase().includes(q)
            || (t.employee_dept || '').toLowerCase().includes(q)
            || (t.issuer_name || '').toLowerCase().includes(q);
        return matchType && matchQ;
    });
    renderHistory(filtered);
}

function openAuditEditModal(transId) {
    const t = allTransactions.find(x => x.id === transId);
    if (!t) return toast('Record not found', 'error');

    document.getElementById('audit-edit-id').value = t.id;
    document.getElementById('audit-edit-employee-name').value  = t.employee_name  || '';
    document.getElementById('audit-edit-employee-desig').value = t.employee_desig || '';
    document.getElementById('audit-edit-employee-dept').value  = t.employee_dept  || '';
    document.getElementById('audit-edit-issuer-name').value    = t.issuer_name    || '';
    document.getElementById('audit-edit-issuer-desig').value   = t.issuer_desig   || '';
    document.getElementById('audit-edit-issuer-dept').value    = t.issuer_dept    || '';
    document.getElementById('audit-edit-ref').value            = t.ref_no         || '';
    document.getElementById('audit-edit-date').value           = t.date           || '';
    document.getElementById('audit-edit-asset-names').value    = t.asset_names    || '';
    document.getElementById('audit-edit-remark').value         = t.remark         || '';

    // Convert SQLite datetime to datetime-local format (YYYY-MM-DDTHH:mm)
    if (t.timestamp) {
        const ts = t.timestamp.replace(' ', 'T').substring(0, 16);
        document.getElementById('audit-edit-timestamp').value = ts;
    }

    // Render change history if any
    const histDiv = document.getElementById('audit-edit-history');
    const histList = document.getElementById('audit-edit-history-list');
    let history = [];
    try { history = JSON.parse(t.edit_history || '[]'); } catch {}

    if (history.length > 0) {
        histDiv.style.display = 'block';
        histList.innerHTML = history.map(h => `
            <div style="padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:6px; border:1px solid var(--glass-border);">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
                    <b style="color:var(--accent-red)">${h.edited_by}</b> &mdash; ${formatDateTime(h.edited_at)}
                </div>
                ${Object.entries(h.changes).map(([field, ch]) => `
                    <div style="font-size:0.72rem; color:var(--text-secondary);">
                        <b>${field}</b>: 
                        <span style="color:var(--accent-red); text-decoration:line-through;">${ch.old || '(empty)'}</span>
                        &rarr; <span style="color:var(--accent-green);">${ch.new || '(empty)'}</span>
                    </div>`).join('')}
            </div>`).join('');
    } else {
        histDiv.style.display = 'none';
    }

    document.getElementById('audit-edit-modal').classList.remove('hidden');
}

function closeAuditEditModal() {
    document.getElementById('audit-edit-modal').classList.add('hidden');
}

async function submitAuditEdit() {
    const id = document.getElementById('audit-edit-id').value;
    if (!id) return;

    const confirmed = confirm(
        '⚠ Are you sure you want to modify this audit record?\n\n' +
        'This action is permanent and your username will be recorded as the editor.'
    );
    if (!confirmed) return;

    const tsRaw = document.getElementById('audit-edit-timestamp').value;
    // Convert datetime-local back to SQLite format
    const ts = tsRaw ? tsRaw.replace('T', ' ') + ':00' : undefined;

    const data = {
        employee_name:  document.getElementById('audit-edit-employee-name').value.trim(),
        employee_desig: document.getElementById('audit-edit-employee-desig').value.trim(),
        employee_dept:  document.getElementById('audit-edit-employee-dept').value.trim(),
        issuer_name:    document.getElementById('audit-edit-issuer-name').value.trim(),
        issuer_desig:   document.getElementById('audit-edit-issuer-desig').value.trim(),
        issuer_dept:    document.getElementById('audit-edit-issuer-dept').value.trim(),
        ref_no:         document.getElementById('audit-edit-ref').value.trim(),
        date:           document.getElementById('audit-edit-date').value,
        asset_names:    document.getElementById('audit-edit-asset-names').value.trim(),
        remark:         document.getElementById('audit-edit-remark').value.trim(),
        timestamp:      ts
    };

    showLoader('Updating Audit Record...');
    try {
        const result = await apiUpdateTransaction(id, data);
        toast(`Audit record updated — ${result.change_count} field(s) changed`, 'success');
        closeAuditEditModal();
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ─── Employee Trail Tracking ───────────────────────────────────
async function viewEmployeeTrail(empName) {
    const emp = allEmployees.find(e => e.name === empName);
    const meta = document.getElementById('emp-trail-meta');
    
    currentTrailEmpName = empName;
    document.getElementById('emp-trail-title').textContent = empName;

    if (emp) {
        meta.textContent = `${emp.designation || '-'} | ${emp.department || '-'}`;
    } else {
        meta.textContent = 'External / Unknown Employee';
    }

    document.getElementById('emp-trail-filter').value = '';

    showLoader('Loading Employee Trail...');
    try {
        currentEmployeeTrail = await apiGetEmployeeTrail(empName);
        renderEmployeeTrail(empName, currentEmployeeTrail);
        document.getElementById('emp-trail-modal').classList.remove('hidden');
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function renderEmployeeTrail(empName, trail, filter = '') {
    const currentDiv = document.getElementById('emp-trail-current');
    const listDiv = document.getElementById('emp-trail-list');
    const q = filter.toLowerCase();

    // Active Assignments (Case-insensitive match)
    const currentAssets = allAssets.filter(a => 
        (a.current_user || '').trim().toLowerCase() === empName.trim().toLowerCase()
    );

    if (currentAssets.length > 0) {
        currentDiv.innerHTML = `
            <div class="glass-card" style="padding:16px; background:rgba(66,133,244,0.05); border:1px solid rgba(66,133,244,0.2);">
                <div style="font-weight:700; color:var(--accent-blue); margin-bottom:12px; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
                    <div style="width:8px; height:8px; background:var(--accent-blue); border-radius:50%; box-shadow:0 0 8px var(--accent-blue);"></div>
                    Active Assignments (${currentAssets.length})
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:12px;">
                    ${currentAssets.map(a => `
                        <div style="background:var(--glass-bg); border:1px solid var(--glass-border); padding:12px; border-radius:10px; border-left: 4px solid var(--accent-blue);">
                            <div style="display:flex; justify-content:space-between; align-items:start;">
                                <div style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${a.name}</div>
                                <span class="badge badge-blue" style="font-size:0.6rem;">${a.status}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin:4px 0;">
                                <div>${a.make || '-'} ${a.model || '-'}</div>
                                <div style="font-family:monospace;">S/N: ${a.serial_number}</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:8px;">
                                <span style="font-size:0.7rem; color:var(--accent-blue); font-weight:600;">IP: ${a.ip_address || 'N/A'}</span>
                                <span style="font-size:0.7rem; color:var(--text-muted);">PURCHASED: ${a.year_of_purchase || '-'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        currentDiv.innerHTML = `
            <div class="glass-card" style="padding:20px; text-align:center; color:var(--text-muted); font-style:italic; border:1px dashed var(--glass-border);">
                No active assets currently assigned to ${empName}
            </div>
        `;
    }

    // History Timeline
    const filtered = q 
        ? trail.filter(t => 
            (t.asset_names || '').toLowerCase().includes(q) || 
            (t.ref_no || '').toLowerCase().includes(q) ||
            (t.type || '').toLowerCase().includes(q) ||
            (t.issuer_name || '').toLowerCase().includes(q))
        : trail;

    if (!filtered || filtered.length === 0) {
        listDiv.innerHTML = `
            <div style="padding:40px; text-align:center;">
                <div style="font-size:2rem; margin-bottom:10px; opacity:0.2;">📜</div>
                <h3 style="color:var(--text-muted);">No history found</h3>
                <p style="font-size:0.8rem; color:var(--text-muted);">No transaction records match the current criteria.</p>
            </div>`;
        return;
    }

    listDiv.innerHTML = filtered.map((t, index) => {
        const isHandover = t.type === 'handover';
        
        // Try to get technical details for assets in this transaction
        let assetDetailsHtml = '';
        try {
            const ids = JSON.parse(t.asset_ids);
            const assets = ids.map(id => allAssets.find(a => a.id === id)).filter(Boolean);
            if (assets.length > 0) {
                assetDetailsHtml = `
                    <div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.1); border-radius:6px; display:flex; flex-wrap:wrap; gap:10px;">
                        ${assets.map(a => `
                            <div style="font-size:0.7rem; line-height:1.2;">
                                <div style="font-weight:700; color:var(--text-secondary);">${a.name}</div>
                                <div style="color:var(--text-muted);">${a.make || '-'} ${a.model || '-'}</div>
                                <div style="font-family:monospace; color:var(--accent-blue);">${a.serial_number}</div>
                            </div>
                        `).join('<div style="width:1px; background:rgba(255,255,255,0.05);"></div>')}
                    </div>
                `;
            }
        } catch (e) {}

        return `
            <div class="trail-step ${t.type}" style="margin-left: 20px;">
                <div class="trail-dot" style="width:12px; height:12px; left:-26px;"></div>
                <div class="trail-card" style="padding:15px; border-left: 3px solid ${isHandover ? 'var(--accent-amber)' : 'var(--accent-green)'}">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                        <div>
                            <span class="badge ${isHandover ? 'badge-amber' : 'badge-green'}" style="font-size:0.65rem; margin-bottom:4px;">
                                ${isHandover ? '📥 RECEIVED BY EMPLOYEE' : '📤 RETURNED BY EMPLOYEE'}
                            </span>
                            <div style="font-weight:700; font-size:1rem; color:var(--text-secondary);">${t.asset_names}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${formatDateTime(t.timestamp)}</div>
                            <div style="font-size:0.7rem; color:var(--accent-blue); margin-top:2px; font-family:monospace;">REF: ${t.ref_no || 'N/A'}</div>
                        </div>
                    </div>
                    
                    ${assetDetailsHtml}

                    <div style="margin-top:12px; display:flex; align-items:center; gap:15px; font-size:0.85rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
                        <div style="flex:1;">
                            <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Issued / Handled By</div>
                            <div style="font-weight:600; color:var(--text-main);">${t.issuer_name || 'N/A'}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${t.issuer_desig || ''} (${t.issuer_dept || ''})</div>
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Official Date</div>
                            <div style="font-weight:600; color:var(--text-secondary);">${t.date || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterEmpTrail() {
    const q = document.getElementById('emp-trail-filter').value;
    renderEmployeeTrail(currentTrailEmpName, currentEmployeeTrail, q);
}

function closeEmpTrailModal() {
    document.getElementById('emp-trail-modal').classList.add('hidden');
}

function printEmpTrail() {
    const empName = currentTrailEmpName;
    const trail = currentEmployeeTrail;
    if (!trail) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Employee History - ${empName}</title>
        <style>
            @page { margin: 20mm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .info { margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #eee; }
            .footer { margin-top: 50px; font-size: 10px; text-align: right; color: #666; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>AIRPORTS AUTHORITY OF INDIA, VADODARA AIRPORT</h1>
            <h2>Employee IT Asset Assignment History</h2>
        </div>
        
        <div class="info">
            <strong>Employee Name:</strong> ${empName}<br>
            <strong>Report Date:</strong> ${new Date().toLocaleDateString()}
        </div>

        <h3>TRANSACTION LOG</h3>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Transaction Type</th>
                    <th>Asset(s) Involved</th>
                    <th>Reference Number</th>
                    <th>Handled By</th>
                </tr>
            </thead>
            <tbody>
                ${trail.map(t => `
                    <tr>
                        <td>${formatDateTime(t.timestamp)}</td>
                        <td><strong>${t.type.toUpperCase()}</strong></td>
                        <td>${t.asset_names}</td>
                        <td>${t.ref_no || '-'}</td>
                        <td>${t.issuer_name}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            This is a system generated report. Page 1 of 1
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
    } else {
        toast('Popup blocked! Please allow popups for this site.', 'error');
    }
}

// ─── Asset Trail Tracking ──────────────────────────────────────
async function viewAssetTrail(assetId) {
    const asset = allAssets.find(a => a.id === assetId);
    if (!asset) return;

    currentTrailAsset = asset;
    const modal = document.getElementById('trail-modal');
    const title = document.getElementById('trail-modal-title');
    const subtitle = document.getElementById('trail-modal-subtitle');
    const container = document.getElementById('trail-content');

    title.textContent = `Trail: ${asset.name}`;
    subtitle.textContent = `Serial: ${asset.serial_number} | Model: ${asset.model}`;
    container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Loading trail...</div>';
    
    document.getElementById('trail-filter').value = '';
    modal.classList.remove('hidden');

    showLoader('Loading Asset Trail...');
    try {
        currentAssetTrail = await apiGetAssetTrail(assetId);
        renderTrail(currentAssetTrail, asset);
    } catch (err) {
        toast('Failed to load asset trail', 'error');
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--accent-red);">${err.message}</div>`;
    } finally {
        hideLoader();
    }
}

function closeTrailModal() {
    document.getElementById('trail-modal').classList.add('hidden');
}

function renderTrail(trail, asset, filter = '') {
    const container = document.getElementById('trail-content');
    const q = filter.toLowerCase();
    
    const filtered = q 
        ? trail.filter(t => 
            t.employee_name.toLowerCase().includes(q) || 
            t.issuer_name.toLowerCase().includes(q) || 
            (t.ref_no || '').toLowerCase().includes(q) ||
            t.asset_names.toLowerCase().includes(q))
        : trail;

    if (!filtered || filtered.length === 0) {
        container.innerHTML = `
            <div style="padding:60px 40px; text-align:center;">
                <div style="font-size:3rem; margin-bottom:15px; opacity:0.3;">📋</div>
                <h3 style="color:var(--text-secondary);">No history found</h3>
                <p style="color:var(--text-muted); font-size:0.85rem;">This asset has no recorded transactions matching your search.</p>
            </div>`;
        return;
    }

    // Technical Specs Header
    const specsHtml = `
        <div class="glass-card" style="margin: 20px 0; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border);">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px;">
                <div>
                    <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Technical Specs</div>
                    <div style="font-weight:600; font-size:1.1rem; color:var(--accent-blue);">${asset.name}</div>
                    <div style="font-size:0.85rem;">${asset.make} ${asset.model}</div>
                </div>
                <div>
                    <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Network & ID</div>
                    <div style="font-family:monospace; font-size:0.9rem;">IP: ${asset.ip_address || 'N/A'}</div>
                    <div style="font-family:monospace; font-size:0.85rem;">Host: ${asset.hostname || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Identifiers</div>
                    <div style="font-family:monospace; font-size:0.85rem;">Tag: ${asset.asset_tag || 'N/A'}</div>
                    <div style="font-family:monospace; font-size:0.85rem;">S/N: ${asset.serial_number}</div>
                    <div style="font-family:monospace; font-size:0.85rem;">MAC: ${asset.mac_address || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Status</div>
                    <span class="badge ${asset.status === 'In Stock' ? 'badge-green' : 'badge-blue'}">${asset.status}</span>
                    <div style="font-size:0.8rem; margin-top:4px;">Warranty: ${asset.warranty_status || 'Active'}</div>
                </div>
            </div>
        </div>
        <div style="font-weight:700; color:var(--text-secondary); margin: 30px 0 15px; font-size:0.9rem; text-transform:uppercase; letter-spacing:2px; text-align:center;">
            ─── Transaction Timeline ───
        </div>
    `;

    container.innerHTML = specsHtml + filtered.map((t, index) => {
        const isHandover = t.type === 'handover';
        const fromName = isHandover ? (t.issuer_name || 'IT Store') : (t.employee_name || 'User');
        const fromInfo = isHandover ? (t.issuer_desig || 'Administrator') : (t.employee_desig || 'Staff');
        
        const toName = isHandover ? (t.employee_name || 'User') : (t.issuer_name || 'IT Store');
        const toInfo = isHandover ? (t.employee_desig || 'Staff') : (t.issuer_desig || 'Administrator');

        const isLast = index === filtered.length - 1;

        return `
            <div class="trail-step ${t.type}">
                <div class="trail-dot" ${isLast ? 'style="background:var(--accent-blue); border-color:white; box-shadow:0 0 15px var(--accent-blue-glow);"' : ''}></div>
                <div class="trail-card" ${isLast ? 'style="border-color:var(--accent-blue-glow); background:rgba(66,133,244,0.05);"' : ''}>
                    <div class="trail-header">
                        <span class="trail-type" style="color: ${isHandover ? 'var(--accent-amber)' : 'var(--accent-green)'}">
                            ${t.type === 'handover' ? '📤 Handover' : '📥 Takeover'}
                        </span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${isLast ? '<span class="badge badge-blue" style="font-size:0.6rem; padding:2px 8px;">CURRENT STATUS</span>' : ''}
                            <span class="trail-date">${formatDateTime(t.timestamp)}</span>
                        </div>
                    </div>
                    <div class="trail-user-info">
                        <div class="trail-user-box">
                            <div class="trail-label">From</div>
                            <div class="trail-name">${fromName}</div>
                            <div class="trail-meta">${fromInfo}</div>
                        </div>
                        <div class="trail-arrow">
                            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/></svg>
                        </div>
                        <div class="trail-user-box" ${isLast && isHandover ? 'style="background:rgba(66,133,244,0.1); border-radius:8px; padding:5px; margin:-5px;"' : ''}>
                            <div class="trail-label">To</div>
                            <div class="trail-name">${toName}</div>
                            <div class="trail-meta">${toInfo}</div>
                        </div>
                    </div>
                    <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.05); padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>Ref: ${t.ref_no || 'N/A'}</span>
                        <div style="display:flex; gap:10px;">
                            <span class="badge badge-ghost" style="font-size:0.65rem;">${t.asset_names}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterTrail() {
    const q = document.getElementById('trail-filter').value;
    renderTrail(currentAssetTrail, currentTrailAsset, q);
}

function printTrail() {
    const asset = currentTrailAsset;
    const trail = currentAssetTrail;
    if (!asset || !trail) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Asset Trail - ${asset.serial_number}</title>
        <style>
            @page { margin: 20mm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; }
            .specs div { margin-bottom: 5px; }
            .timeline-title { font-weight: bold; font-size: 14px; text-decoration: underline; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #eee; }
            .status-assigned { color: blue; font-weight: bold; }
            .status-stock { color: green; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; text-align: right; color: #666; border-top: 1px dashed #ccc; padding-top: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>AIRPORTS AUTHORITY OF INDIA, VADODARA AIRPORT</h1>
            <h2>Full Asset Life-Cycle Trail Report</h2>
        </div>
        
        <div class="timeline-title">TECHNICAL SPECIFICATIONS</div>
        <div class="specs">
            <div><strong>Asset Name:</strong> ${asset.name}</div>
            <div><strong>Brand/Model:</strong> ${asset.make} / ${asset.model}</div>
            <div><strong>Serial Number:</strong> ${asset.serial_number}</div>
            <div><strong>IP Address:</strong> ${asset.ip_address || 'N/A'}</div>
            <div><strong>Hostname:</strong> ${asset.hostname || 'N/A'}</div>
            <div><strong>MAC Address:</strong> ${asset.mac_address || 'N/A'}</div>
            <div><strong>Purchase Year:</strong> ${asset.year_of_purchase || 'N/A'}</div>
            <div><strong>Current Status:</strong> ${asset.status}</div>
            <div><strong>Current User:</strong> ${asset.current_user}</div>
            <div><strong>Warranty:</strong> ${asset.warranty_status || 'Active'}</div>
        </div>

        <div class="timeline-title">TRANSACTION HISTORY (CHRONOLOGICAL)</div>
        <table>
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Action</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Reference No</th>
                    <th>Assets Involved</th>
                    <th>Transaction Remark</th>
                </tr>
            </thead>
            <tbody>
                ${trail.map(t => `
                    <tr>
                        <td>${formatDateTime(t.timestamp)}</td>
                        <td><strong>${t.type.toUpperCase()}</strong></td>
                        <td>${t.type === 'handover' ? t.issuer_name : t.employee_name}</td>
                        <td>${t.type === 'handover' ? t.employee_name : t.issuer_name}</td>
                        <td style="font-family:monospace;">${t.ref_no || '-'}</td>
                        <td>${t.asset_names}</td>
                        <td>${t.remark || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            Report Generated on: ${new Date().toLocaleString()} | System: AAI Asset Manager v2.0
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

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        toast('Popup blocked! Please allow popups for this site.', 'error');
    }
}

function printEmpTrail() {
    const empName = currentTrailEmpName;
    const trail = currentEmployeeTrail;
    if (!trail) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Employee History - ${empName}</title>
        <style>
            @page { margin: 20mm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .info { margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #eee; }
            .footer { margin-top: 50px; font-size: 10px; text-align: right; color: #666; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>AIRPORTS AUTHORITY OF INDIA, VADODARA AIRPORT</h1>
            <h2>Employee IT Asset Assignment History</h2>
        </div>
        
        <div class="info">
            <strong>Employee Name:</strong> ${empName}<br>
            <strong>Report Date:</strong> ${new Date().toLocaleDateString()}
        </div>

        <h3>TRANSACTION LOG</h3>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Transaction Type</th>
                    <th>Asset(s) Involved</th>
                    <th>Reference Number</th>
                    <th>Transaction Remark</th>
                    <th>Handled By</th>
                </tr>
            </thead>
            <tbody>
                ${trail.map(t => `
                    <tr>
                        <td>${formatDateTime(t.timestamp)}</td>
                        <td><strong>${t.type.toUpperCase()}</strong></td>
                        <td>${t.asset_names}</td>
                        <td>${t.ref_no || '-'}</td>
                        <td>${t.remark || '-'}</td>
                        <td>${t.issuer_name}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            This is a system generated report. Page 1 of 1
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

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        toast('Popup blocked! Please allow popups for this site.', 'error');
    }
}

window.addEventListener('resize', debounce(() => {
    if(!localStorage.getItem('vabo-font-size') || localStorage.getItem('vabo-font-size') === 'auto') {
        applyFontScaling('auto');
    }
}, 250));

// ─── Multi-Asset Entry Wizard ───────────────────────────────────
let wizardCurrentStep = 1;
let wizardSelectedCategories = [];
let wizardAssetData = [];

const WIZARD_CATEGORIES = ['PC', 'AIO', 'Laptop', 'Printer', 'UPS', 'SCANNER', 'Monitor', 'Keyboard', 'Mouse'];

function openWizard() {
    wizardCurrentStep = 1;
    wizardSelectedCategories = [];
    wizardAssetData = [];

    document.getElementById('view-wizard').classList.remove('hidden');
    document.getElementById('view-inventory').classList.add('hidden');

    // Reset all step contents
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`wizard-step-${i}`);
        if (stepEl) stepEl.classList.toggle('hidden', i !== 1);
    }
    
    // Clear employee input fields
    const empInput = document.getElementById('wizard-emp-name');
    if (empInput) empInput.value = '';
    const empIdEl = document.getElementById('wizard-emp-id');
    if (empIdEl) empIdEl.value = '';
    const empDesigEl = document.getElementById('wizard-emp-desig');
    if (empDesigEl) empDesigEl.value = '';
    const empDeptEl = document.getElementById('wizard-emp-dept');
    if (empDeptEl) empDeptEl.value = '';
    const physHolderEl = document.getElementById('wizard-physical-holder');
    if (physHolderEl) physHolderEl.value = '';

    updateWizardStepIndicator();
    updateWizardButtons();

    // Build category grid
    const grid = document.getElementById('wizard-category-grid');
    grid.innerHTML = WIZARD_CATEGORIES.map(cat => `
        <div class="wizard-cat-card" onclick="toggleWizardCategory('${cat}')" id="wcat-${cat}" style="padding:16px; border:1px solid var(--glass-border); border-radius:10px; text-align:center; cursor:pointer; transition:all 0.2s;">
            <div style="font-size:1.2rem; margin-bottom:6px;">${getCategoryIcon(cat)}</div>
            <div style="font-size:0.85rem; font-weight:600;">${cat}</div>
        </div>
    `).join('');

    // Wire up employee autocomplete for wizard
    if (empInput) {
        _wireAutocomplete(
            empInput,
            document.getElementById('wizard-emp-desig'),
            document.getElementById('wizard-emp-dept'),
            allEmployees,
            document.getElementById('wizard-emp-id')
        );
    }
}

function getCategoryIcon(cat) {
    const icons = { PC: '🖥', AIO: '🖥', Laptop: '💻', Printer: '🖨', UPS: '🔋', SCANNER: '📷', Monitor: '🖵', Keyboard: '⌨', Mouse: '🖱' };
    return icons[cat] || '📦';
}

function toggleWizardCategory(cat) {
    const idx = wizardSelectedCategories.indexOf(cat);
    if (idx === -1) {
        wizardSelectedCategories.push(cat);
        document.getElementById(`wcat-${cat}`).style.borderColor = 'var(--accent-blue)';
        document.getElementById(`wcat-${cat}`).style.background = 'rgba(66,133,244,0.1)';
    } else {
        wizardSelectedCategories.splice(idx, 1);
        document.getElementById(`wcat-${cat}`).style.borderColor = 'var(--glass-border)';
        document.getElementById(`wcat-${cat}`).style.background = '';
    }
}

function supportsNetworkAndTag(cat) {
    const catLower = (cat || '').toLowerCase();
    // PC, AIO, Laptop, Printer, Scanner support network IP/Hostname and Asset Tag
    return ['pc', 'aio', 'laptop', 'printer', 'scanner'].some(type => catLower.includes(type));
}

function buildWizardAssetForms() {
    const container = document.getElementById('wizard-asset-forms');
    container.innerHTML = wizardSelectedCategories.map((cat, i) => {
        const hasNetAndTag = supportsNetworkAndTag(cat);
        const isLaptop = cat.toLowerCase().includes('laptop');
        const isPcAio = cat.toLowerCase().includes('pc') || cat.toLowerCase().includes('aio');

        return `
        <div style="border:1px solid var(--glass-border); border-radius:10px; padding:16px; background:rgba(255,255,255,0.02);">
            <div class="section-title" style="font-size:0.75rem; margin-bottom:12px; color:var(--accent-blue); display:flex; justify-content:space-between; align-items:center;">
                <span>${getCategoryIcon(cat)} ${cat.toUpperCase()} SPECIFICATIONS</span>
                ${hasNetAndTag ? `<span style="font-size:0.7rem; font-weight:400; color:var(--text-muted);">Includes Network &amp; Asset Tag</span>` : ''}
            </div>
            
            <div class="form-grid" style="gap:10px;">
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Serial Number <span style="color:var(--accent-red);">*</span></label>
                    <input class="form-input wiz-serial" data-idx="${i}" placeholder="e.g. SN-123456" required>
                </div>
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Make</label>
                    <input class="form-input wiz-make" data-idx="${i}" placeholder="e.g. Dell / HP / Lenovo">
                </div>
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Model</label>
                    <input class="form-input wiz-model" data-idx="${i}" placeholder="e.g. Latitude 5540">
                </div>

                ${isLaptop ? `
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Charger Serial</label>
                    <input class="form-input wiz-charger" data-idx="${i}" id="wiz-charger-${i}" placeholder="e.g. CHG-98765">
                </div>` : ''}

                ${isPcAio ? `
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Monitor Make</label>
                    <input class="form-input wiz-monmake" data-idx="${i}" id="wiz-monmake-${i}" placeholder="e.g. Dell">
                </div>
                <div>
                    <label class="form-label" style="font-size:0.78rem;">Monitor Serial</label>
                    <input class="form-input wiz-monserial" data-idx="${i}" id="wiz-monserial-${i}" placeholder="e.g. MON-54321">
                </div>` : ''}

                ${hasNetAndTag ? `
                <div style="grid-column:1/-1; border-top:1px dashed var(--glass-border); margin-top:6px; padding-top:10px;">
                    <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">Network &amp; Asset Unique Tag</div>
                    <div class="form-grid" style="gap:10px;">
                        <div>
                            <label class="form-label" style="font-size:0.78rem;">IP Address</label>
                            <input class="form-input wiz-ip" data-idx="${i}" id="wiz-ip-${i}" placeholder="e.g. 192.168.1.50">
                        </div>
                        <div>
                            <label class="form-label" style="font-size:0.78rem;">Hostname</label>
                            <input class="form-input wiz-hostname" data-idx="${i}" id="wiz-hostname-${i}" placeholder="e.g. VABO-PC-01">
                        </div>
                        <div>
                            <label class="form-label" style="font-size:0.78rem;">Asset Tag (Unique ID)</label>
                            <input class="form-input wiz-tag" data-idx="${i}" id="wiz-tag-${i}" placeholder="Auto-generated if left blank">
                        </div>
                    </div>
                </div>` : ''}

                <div style="grid-column:1/-1;">
                    <label class="form-label" style="font-size:0.78rem;">Remark</label>
                    <input class="form-input wiz-remark" data-idx="${i}" placeholder="Optional notes or condition details">
                </div>
            </div>
        </div>`;
    }).join('');
}

function buildWizardReview() {
    const empName = document.getElementById('wizard-emp-name').value.trim();
    const empDesig = document.getElementById('wizard-emp-desig').value.trim();
    const empDept = document.getElementById('wizard-emp-dept').value.trim();
    const physicalHolder = document.getElementById('wizard-physical-holder')?.value.trim() || '';

    let assetsHtml = wizardSelectedCategories.map((cat, i) => {
        const serial = document.querySelector(`.wiz-serial[data-idx="${i}"]`)?.value.trim() || 'No serial';
        const make = document.querySelector(`.wiz-make[data-idx="${i}"]`)?.value.trim() || '-';
        const model = document.querySelector(`.wiz-model[data-idx="${i}"]`)?.value.trim() || '-';
        const ip = document.querySelector(`#wiz-ip-${i}`)?.value.trim() || '';
        const hostname = document.querySelector(`#wiz-hostname-${i}`)?.value.trim() || '';
        const tag = document.querySelector(`#wiz-tag-${i}`)?.value.trim() || '';

        let netTagInfo = [];
        if (tag) netTagInfo.push(`Tag: <strong>${tag}</strong>`);
        if (ip) netTagInfo.push(`IP: ${ip}`);
        if (hostname) netTagInfo.push(`Host: ${hostname}`);

        return `
        <div style="padding:10px 14px; border:1px solid var(--glass-border); border-radius:8px; margin-bottom:8px; background:rgba(255,255,255,0.01);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:700; color:var(--accent-blue);">${getCategoryIcon(cat)} ${cat}</span>
                <span style="font-size:0.8rem; font-family:monospace; color:var(--text-muted);">${serial}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
                ${make} ${model}
            </div>
            ${netTagInfo.length > 0 ? `<div style="font-size:0.78rem; color:var(--accent-green); margin-top:4px;">${netTagInfo.join(' · ')}</div>` : ''}
        </div>`;
    }).join('');

    document.getElementById('wizard-review-content').innerHTML = `
        <div style="margin-bottom:16px;">
            <div class="section-title" style="font-size:0.7rem; margin-bottom:8px;">EMPLOYEE INFORMATION</div>
            <div style="padding:12px; border:1px solid var(--glass-border); border-radius:8px; background:rgba(66,133,244,0.03);">
                <div style="font-weight:700; font-size:0.95rem;">${empName}</div>
                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">${empDesig || '-'} · ${empDept || '-'}</div>
                ${physicalHolder ? `<div style="font-size:0.8rem; color:var(--accent-purple); margin-top:4px;">👤 Physical Holder: <strong>${physicalHolder}</strong></div>` : ''}
            </div>
        </div>
        <div>
            <div class="section-title" style="font-size:0.7rem; margin-bottom:8px;">ASSIGNED ASSETS (${wizardSelectedCategories.length})</div>
            ${assetsHtml}
        </div>
    `;
}

function updateWizardStepIndicator() {
    const steps = ['Employee Information', 'Hardware Categories', 'Specifications & Network', 'Review & Save'];
    document.querySelectorAll('.wizard-step-indicator').forEach(el => {
        const step = parseInt(el.dataset.step);
        el.classList.toggle('active', step === wizardCurrentStep);
        el.classList.toggle('completed', step < wizardCurrentStep);
    });
    document.getElementById('wizard-step-label').textContent = `Step ${wizardCurrentStep} of 4 — ${steps[wizardCurrentStep - 1]}`;
}

function updateWizardButtons() {
    document.getElementById('wizard-prev-btn').style.display = wizardCurrentStep > 1 ? 'inline-block' : 'none';
    const nextBtn = document.getElementById('wizard-next-btn');
    if (wizardCurrentStep === 4) {
        nextBtn.textContent = '✅ Save All Assets';
        nextBtn.onclick = submitWizard;
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.onclick = wizardNext;
    }
}

function wizardNext() {
    // Validation per step
    if (wizardCurrentStep === 1) {
        const empName = document.getElementById('wizard-emp-name').value.trim();
        if (!empName) return toast('Please select an employee', 'warning');
    }
    if (wizardCurrentStep === 2) {
        if (wizardSelectedCategories.length === 0) return toast('Select at least one hardware category', 'warning');
        buildWizardAssetForms();
    }
    if (wizardCurrentStep === 3) {
        // Validate serial numbers
        const serials = document.querySelectorAll('.wiz-serial');
        for (let s of serials) {
            if (!s.value.trim()) return toast('All serial numbers are required', 'warning');
        }
        buildWizardReview();
    }

    document.getElementById(`wizard-step-${wizardCurrentStep}`).classList.add('hidden');
    wizardCurrentStep++;
    document.getElementById(`wizard-step-${wizardCurrentStep}`).classList.remove('hidden');
    updateWizardStepIndicator();
    updateWizardButtons();
}

function wizardPrev() {
    document.getElementById(`wizard-step-${wizardCurrentStep}`).classList.add('hidden');
    wizardCurrentStep--;
    document.getElementById(`wizard-step-${wizardCurrentStep}`).classList.remove('hidden');
    updateWizardStepIndicator();
    updateWizardButtons();
}

async function submitWizard() {
    const empName = document.getElementById('wizard-emp-name').value.trim();
    const empId = document.getElementById('wizard-emp-id').value || null;
    const empDesig = document.getElementById('wizard-emp-desig').value.trim();
    const empDept = document.getElementById('wizard-emp-dept').value.trim();
    const physicalHolder = document.getElementById('wizard-physical-holder')?.value.trim() || '';

    if (!empName) return toast('Employee is required', 'warning');

    const assets = wizardSelectedCategories.map((cat, i) => ({
        name: cat,
        serial_number: document.querySelector(`.wiz-serial[data-idx="${i}"]`)?.value.trim() || '',
        make: document.querySelector(`.wiz-make[data-idx="${i}"]`)?.value.trim() || '',
        model: document.querySelector(`.wiz-model[data-idx="${i}"]`)?.value.trim() || '',
        charger_serial: document.querySelector(`#wiz-charger-${i}`)?.value.trim() || '',
        monitor_make: document.querySelector(`#wiz-monmake-${i}`)?.value.trim() || '',
        monitor_serial: document.querySelector(`#wiz-monserial-${i}`)?.value.trim() || '',
        ip_address: document.querySelector(`#wiz-ip-${i}`)?.value.trim() || '',
        hostname: document.querySelector(`#wiz-hostname-${i}`)?.value.trim() || '',
        asset_tag: document.querySelector(`#wiz-tag-${i}`)?.value.trim() || '',
        remark: document.querySelector(`.wiz-remark[data-idx="${i}"]`)?.value.trim() || ''
    }));

    showLoader('Registering Assets...');
    try {
        const result = await apiWizardSubmit({
            employee: {
                name: empName,
                id: empId,
                designation: empDesig,
                department: empDept,
                physical_holder: physicalHolder
            },
            assets
        });
        toast(result.message, 'success');
        closeWizard();
        loadData();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function closeWizard() {
    document.getElementById('view-wizard').classList.add('hidden');
    switchView('inventory-select');
}
