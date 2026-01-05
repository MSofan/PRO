// ===== CONFIGURATION =====
const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.apiUrl) ? CONFIG.apiUrl : 'http://localhost:3000/api';

// ===== WORKFLOW CONFIGURATION =====
const WORKFLOW_CONFIG = {
    CATEGORIES: {
        VISA_PROCESS: 'Visa Process',
        VISA_RENEW: 'Visa Renew',
        VISA_DONE: 'Visa Done',
        CANCELLATION: 'Cancellation',
        OTHER: 'Other'
    },
    STATUS: {
        PENDING: 'Pending',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled'
    },
    FIELD_MAP: [
        { key: 'contract', label: 'Contract' },
        { key: 'entryPermitStatus', label: 'Entry Permit' },
        { key: 'entryDate', label: 'Entry Date' }, // Added for flow logic
        { key: 'medicalApplication', label: 'Medical Application' },
        { key: 'medicalResult', label: 'Medical Result' },
        { key: 'eidApplication', label: 'EID Application' },
        { key: 'eidAppointment', label: 'EID Appointment' },
        { key: 'tawjeehSubmission', label: 'Tawjeeh Submission' },
        { key: 'visaStamp', label: 'Visa Stamp' },
        { key: 'laborCardNumber', label: 'Labor Card' },
        { key: 'iloeNumber', label: 'ILOE Number' }
    ],
    // Defines the logical progression of steps
    PROCESS_ORDER: [
        'contract',
        'entryPermitStatus',
        'entryDate', // Usually manual, but part of flow
        'medicalApplication',
        'medicalResult',
        'eidApplication',
        'visaStamp',
        'laborCardNumber'
    ]
};

// ===== GLOBAL STATE =====
let employees = [];
let companies = [];
let dailyReports = [];
let deleteEmployeeData = null;
let deleteCompanyName = null;
let currentStatusFilter = 'All';
let currentSort = { column: 'id', direction: 'asc' };
let selectedIds = new Set();
let currentView = 'employees';
let recentHistory = []; // Stores objects { id, name, timestamp }

// ===== MOCK DATA =====
function loadTestData() {
    console.log('Using Test Data');
    companies = ['TechCorp', 'BuildIt', 'HealthPlus'];

    // Create diverse employees to test all workflow states
    employees = [
        { id: '1', employeeName: 'Jhon Doe', company: 'TechCorp', profession: 'Developer', contract: 'Full-time', entryPermitStatus: 'Approved', entryDate: '', visaLastDay: '', medicalApplication: '', medicalResult: '', eidApplication: '', visaStamp: '', rowIndex: 2 },
        { id: '2', employeeName: 'Jane Smith', company: 'TechCorp', profession: 'Designer', contract: 'Part-time', entryPermitStatus: 'Pending', entryDate: '', visaLastDay: '', medicalApplication: '', medicalResult: '', rowIndex: 3 },
        { id: '3', employeeName: 'Bob Maker', company: 'BuildIt', profession: 'Engineer', contract: 'Contract', entryPermitStatus: 'Approved', entryDate: '2025-01-01', medicalApplication: 'Completed', medicalResult: 'Fit', eidApplication: '', visaStamp: '', rowIndex: 2 },
        { id: '4', employeeName: 'Alice Nurse', company: 'HealthPlus', profession: 'Nurse', contract: 'Full-time', entryPermitStatus: 'Approved', entryDate: '2024-12-01', medicalApplication: 'Completed', medicalResult: 'Fit', eidApplication: 'Applied', visaStamp: '', visaLastDay: '2026-03-01', rowIndex: 2 },
        { id: '5', employeeName: 'Expiring Guy', company: 'TechCorp', profession: 'Manager', contract: 'Full-time', entryPermitStatus: 'Approved', entryDate: '2023-01-01', visaLastDay: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], medicalApplication: 'Completed', medicalResult: 'Fit', eidApplication: 'Done', visaStamp: 'Done', rowIndex: 4 }
    ];

    // Add some daily reports
    dailyReports = [
        { id: '101', date: new Date().toISOString().split('T')[0], employeeName: 'Jhon Doe', company: 'TechCorp', task: 'Entry Permit', status: 'Completed', rowIndex: 2 },
        { id: '102', date: new Date().toISOString().split('T')[0], employeeName: 'Jane Smith', company: 'TechCorp', task: 'Entry Permit', status: 'Pending', rowIndex: 3 }
    ];

    updateStats();
    updateCompanyFilter();
    renderEmployees();
    renderCompaniesView();
    renderDailyReportsPage();
    renderPendingActionsPage();
    showNotification('Test Data Loaded', 'success');
}

// ===== INITIALIZATION =====
window.addEventListener('load', () => {
    initTheme();
    // Default to employees view
    switchView('employees');
    // initializeApp(); // Skip auto-sync for now to avoid errors if server is offline
    showNotification('Ready. Click "Test Data"', 'info');
});

// ===== THEME =====
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initializeApp() {
    console.log('🚀 Initializing Employee Management System...');
    loadFromCache();
    fetch(`${API_URL}/sync`)
        .then(() => {
            updateConnectionStatus(true);
            showNotification('Connected to Server', 'success');
            syncData();
        })
        .catch(err => {
            console.error(err);
            updateConnectionStatus(false);
            showNotification('Server Offline. Using Cache.', 'warning');
        });
    switchView(currentView);
}

// ===== CACHE =====
function saveToCache() {
    try {
        const data = { employees, companies, timestamp: Date.now() };
        localStorage.setItem('appData', JSON.stringify(data));
    } catch (e) { console.error(e); }
}
function loadFromCache() {
    try {
        const c = localStorage.getItem('appData');
        if (c) {
            const d = JSON.parse(c);
            employees = d.employees || []; companies = d.companies || [];
            updateStats(); updateCompanyFilter(); renderEmployees();
        }
    } catch (e) { console.error(e); }
}

// ===== SYNC =====
async function syncData() {
    showLoading(true);
    try {
        const res = await fetch(`${API_URL}/sync`);
        if (!res.ok) throw new Error('Net Error');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        companies = data.companies || []; employees = data.employees || [];
        saveToCache();
        updateStats(); updateCompanyFilter(); renderEmployees(); renderCompaniesView();
        const now = new Date();
        const ls = document.getElementById('lastSync'); if (ls) ls.textContent = now.toLocaleTimeString();
        showNotification(`Synced ${employees.length} items`, 'success');
        updateConnectionStatus(true);
    } catch (err) {
        console.error(err);
        showNotification('Sync failed: ' + err.message, 'error');
        updateConnectionStatus(false);
    } finally { showLoading(false); }
}

async function callApi(ep, body) {
    const res = await fetch(`${API_URL}/${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const r = await res.json();
    if (r.error) throw new Error(r.error);
    return r;
}

// ===== COMPANY & DAILY REPORT =====
function openCompanyModal() {
    document.getElementById('companyModal').classList.add('active');
    setTimeout(() => document.getElementById('newCompanyName').focus(), 100);
}
function closeCompanyModal() {
    document.getElementById('companyModal').classList.remove('active');
    document.getElementById('newCompanyName').value = '';
}

async function saveNewCompany(e) {
    e.preventDefault();
    const name = document.getElementById('newCompanyName').value.trim();
    if (!name) return;
    if (companies.includes(name)) { showNotification('Company already exists!', 'error'); return; }

    closeCompanyModal();
    showLoading(true);
    try {
        await callApi('create-company', { name });
        showNotification('Company Created!', 'success');
        await syncData();
    } catch (e) {
        showNotification(e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function promptDeleteCompany() {
    const c = document.getElementById('companyFilter').value;
    if (!c || !companies.includes(c)) { showNotification('Select a company first', 'warning'); return; }
    deleteCompanyName = c;
    document.getElementById('deleteCompanyText').textContent = `Delete company "${c}"? This will remove its sheet tab.`;
    document.getElementById('deleteCompanyModal').classList.add('active');
}
function closeDeleteCompanyModal() { document.getElementById('deleteCompanyModal').classList.remove('active'); }
async function confirmDeleteCompany() {
    if (!deleteCompanyName) return;
    closeDeleteCompanyModal();
    showLoading(true);
    try {
        await callApi('delete-company', { name: deleteCompanyName });
        showNotification(`Deleted "${deleteCompanyName}"`, 'success');
        document.getElementById('companyFilter').value = '';
        deleteCompanyName = null;
        await syncData();
    } catch (e) { showNotification(e.message, 'error'); } finally { showLoading(false); }
}

// --- Daily Report ---
function openDailyReportModal() {
    document.getElementById('dailyReportModal').classList.add('active');
    document.getElementById('reportDate').valueAsDate = new Date();
    loadDailyReports();
    // Populate employee names
    const dl = document.getElementById('reportEmployeeName');
    dl.innerHTML = '<option value="">Select Employee</option>' + [...new Set(employees.map(e => e.employeeName))].sort().map(n => `<option value="${n}">${n}</option>`).join('');

    // Auto company & Task fill
    const co = document.getElementById('reportCompany');
    const taskInput = document.getElementById('reportTask');
    const taskList = document.getElementById('taskSuggestions');
    const categorySelect = document.getElementById('reportCategory');

    dl.onchange = () => {
        const name = dl.value;
        const emp = employees.find(e => (e.employeeName || '') === name);
        if (emp) {
            co.value = emp.company;
            // Check for Smart Actions
            const actions = getSmartActions(emp);

            // Clear previous suggestions
            taskList.innerHTML = '';

            if (actions.length > 0) {
                // Populate datalist
                actions.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.label;
                    taskList.appendChild(opt);
                });

                // Auto-select the first one
                if (!taskInput.value) {
                    taskInput.value = actions[0].label;

                    // Logic to set Daily Report Status
                    const type = actions[0].type;
                    const statusField = document.getElementById('reportStatus');

                    if (type === 'prediction') statusField.value = WORKFLOW_CONFIG.STATUS.PENDING;
                    else if (type === 'expiry') statusField.value = WORKFLOW_CONFIG.STATUS.PENDING; // Renewing
                    else statusField.value = WORKFLOW_CONFIG.STATUS.IN_PROGRESS; // pending fields usually mean in progress
                }

                // Smart Category Selection
                if (!categorySelect.value) {
                    categorySelect.value = WORKFLOW_CONFIG.CATEGORIES.VISA_PROCESS;
                }

                showNotification(`Found ${actions.length} smart suggestions`, 'info');
            } else {
                if (!taskInput.value) taskInput.value = '';
            }
        } else {
            co.value = '';
            taskInput.value = '';
            taskList.innerHTML = '';
        }
    };

    // When Task Input Changes (User selects from datalist or types)
    taskInput.addEventListener('change', () => {
        const name = dl.value;
        let label = taskInput.value;
        if (label.includes(':')) label = label.split(':')[0].trim();
        taskInput.value = label;

        const emp = employees.find(e => (e.employeeName || '') === name);

        if (emp && label) {
            const fieldMap = WORKFLOW_CONFIG.FIELD_MAP.find(f => f.label === label);
            if (fieldMap) {
                const currentVal = (emp[fieldMap.key] || '').toLowerCase();
                const statusField = document.getElementById('reportStatus');

                if (currentVal.includes('pending')) statusField.value = WORKFLOW_CONFIG.STATUS.PENDING;
                else if (currentVal.includes('process') || currentVal.includes('applied')) statusField.value = WORKFLOW_CONFIG.STATUS.IN_PROGRESS;
                else if (currentVal.includes('done') || currentVal.includes('fit') || currentVal.includes('approved')) statusField.value = WORKFLOW_CONFIG.STATUS.COMPLETED;
            }
        }
    });
}

// Edit Daily Task
function openEditDailyTask(rId) {
    const r = dailyReports.find(x => x.id == rId || x.rowIndex == rId);
    if (!r) return;

    document.getElementById('dailyReportModal').classList.add('active');
    document.getElementById('reportDate').value = r.date;
    document.getElementById('reportEmployeeName').value = r.employeeName;
    document.getElementById('reportCompany').value = r.company;

    // Set Category (default to Visa Process if missing for legacy compatibility)
    const cat = r.category || WORKFLOW_CONFIG.CATEGORIES.VISA_PROCESS;
    document.getElementById('reportCategory').value = Object.values(WORKFLOW_CONFIG.CATEGORIES).includes(cat) ? cat : WORKFLOW_CONFIG.CATEGORIES.OTHER;

    // Set Transaction (Label)
    document.getElementById('reportTask').value = r.transaction || r.task; // fallback

    document.getElementById('reportStatus').value = r.status;
    document.getElementById('reportNotes').value = r.notes || '';
    document.getElementById('reportSentBy').value = r.sentBy || '';
    document.getElementById('reportDoneBy').value = r.doneBy || '';

    // Set hidden ID for edit mode
    document.getElementById('reportId').value = r.id;
    document.getElementById('reportRowIndex').value = r.rowIndex;

    // Trigger change to populate suggestions but don't overwrite if value exists
    document.getElementById('reportEmployeeName').dispatchEvent(new Event('change'));
}

// Menu Pin
function toggleMenuPin() {
    const m = document.getElementById('viewMenu');
    const b = document.getElementById('pinMenuBtn');
    m.classList.toggle('sticky-menu');
    if (m.classList.contains('sticky-menu')) {
        b.style.transform = 'rotate(45deg)';
        b.style.color = 'var(--primary)';
        // Ensure it's visible if scrolled
        const rect = m.getBoundingClientRect();
        if (rect.top < 80) m.scrollIntoView({ behavior: 'smooth' });
    } else {
        b.style.transform = 'rotate(0deg)';
        b.style.color = 'inherit';
    }
}
function closeDailyReportModal() { document.getElementById('dailyReportModal').classList.remove('active'); }

async function loadDailyReports() {
    try {
        const res = await fetch(`${API_URL}/daily-report`);
        const d = await res.json();
        dailyReports = d.reports || [];
        renderDailyReports();
    } catch (e) { console.error(e); }
}

function renderDailyReports() {
    const tbody = document.getElementById('dailyReportBody');
    const sorted = [...dailyReports].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(r => `
        <tr>
            <td>${r.date}</td>
            <!-- <td>${r.category || '-'}</td> -->
            <td>${r.task}</td>
            <td>${r.employeeName || '-'}</td>
            <td>${r.company || '-'}</td>
            <td><span class="badge ${r.status === 'Completed' ? 'success' : (r.status === 'In Progress' ? 'warning' : '')}">${r.status}</span></td>
            <td>${r.notes || '-'}</td>
            <td>${r.sentBy || '-'}</td>
            <td>${r.doneBy || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openEditDailyTask('${r.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDailyReport(${r.rowIndex})">🗑️</button>
            </td>
        </tr>
    `).join('');
}
function renderDailyReportsPage() {
    const tbody = document.getElementById('dailyReportTableBody');
    const sorted = [...dailyReports].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(r => `
        <tr>
            <td>${r.date}</td>
            <td>${r.task}</td>
            <td>${r.employeeName || '-'}</td>
            <td>${r.company || '-'}</td>
            <td><span class="badge ${r.status === 'Completed' ? 'success' : (r.status === 'In Progress' ? 'warning' : (r.status === 'Pending' ? 'warning' : ''))}">${r.status}</span></td>
            <td>${r.notes || '-'}</td>
            <td>${r.sentBy || '-'}</td>
            <td>${r.doneBy || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openEditDailyTask('${r.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDailyReport(${r.rowIndex})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function saveDailyReport(e) {
    e.preventDefault();
    const task = {
        id: document.getElementById('reportId').value || Date.now().toString(),
        date: document.getElementById('reportDate').value,
        employeeName: document.getElementById('reportEmployeeName').value,
        company: document.getElementById('reportCompany').value,
        category: document.getElementById('reportCategory').value,
        transaction: document.getElementById('reportTask').value,
        task: document.getElementById('reportTask').value, // Backward compat
        status: document.getElementById('reportStatus').value,
        notes: document.getElementById('reportNotes').value,
        sentBy: document.getElementById('reportSentBy').value,
        doneBy: document.getElementById('reportDoneBy').value,
        rowIndex: document.getElementById('reportRowIndex').value || undefined
    };

    // Validation: Duplicate Active Task Check
    const reportIdField = document.getElementById('reportId');
    const isEdit = !!(reportIdField && reportIdField.value);

    // Ensure Task Label is clean
    if (task.transaction && task.transaction.includes(':')) {
        task.transaction = task.transaction.split(':')[0].trim();
        task.task = task.transaction;
    }

    if (!isEdit && task.status !== 'Completed' && task.status !== 'Cancelled') {
        const duplicate = dailyReports.find(r =>
            r.employeeName === task.employeeName &&
            r.company === task.company &&
            r.transaction === task.transaction &&
            r.status !== 'Completed' &&
            r.status !== 'Cancelled'
        );
        if (duplicate) {
            showNotification('An active task for this transaction already exists.', 'error');
            return;
        }
    }

    showLoading(true);
    try {
        await callApi('daily-report', task);

        // --- AUTOMATED WORKFLOW ACTIONS ---
        // Updated: Runs for ANY status change to keep records in sync
        const label = task.transaction;
        const emp = employees.find(e => e.employeeName === task.employeeName && e.company === task.company);

        if (emp && label) {
            // Find mapped key
            const fieldMap = WORKFLOW_CONFIG.FIELD_MAP.find(f => f.label === label);

            if (fieldMap) {
                let suggestedValue = 'Completed';
                if (label.includes('Result')) suggestedValue = 'Fit';
                if (label.includes('Permit') || label.includes('Status')) suggestedValue = 'Approved';
                if (label.includes('Date')) suggestedValue = new Date().toISOString().split('T')[0];

                const newValue = prompt(`Workflow Action: Updating "${label}" for ${emp.employeeName}.\nEnter new value:`, suggestedValue);

                if (newValue) {
                    const updatedData = { ...emp };
                    updatedData[fieldMap.key] = newValue;

                    // 2. Trigger Next Step (Auto-fill pending)
                    const currentStepIndex = WORKFLOW_CONFIG.PROCESS_ORDER.indexOf(fieldMap.key);
                    let nextStepUpdateMsg = '';

                    if (currentStepIndex !== -1 && currentStepIndex < WORKFLOW_CONFIG.PROCESS_ORDER.length - 1) {
                        const nextKey = WORKFLOW_CONFIG.PROCESS_ORDER[currentStepIndex + 1];
                        const nextLabel = WORKFLOW_CONFIG.FIELD_MAP.find(f => f.key === nextKey)?.label || nextKey;

                        // Only auto-fill if it's a status field (simple heuristic: not date/number)
                        // We avoid overriding if it already has a value
                        const currentNextVal = updatedData[nextKey];
                        const isStatusField = !nextKey.toLowerCase().includes('date') && !nextKey.toLowerCase().includes('number');

                        if (nextKey && isStatusField && (!currentNextVal || currentNextVal === '')) {
                            updatedData[nextKey] = 'Pending';
                            nextStepUpdateMsg = ` + Set ${nextLabel} to Pending`;
                        }
                    }

                    const rowData = [
                        updatedData.id, updatedData.employeeName, updatedData.profession, updatedData.contract,
                        updatedData.entryPermitStatus, updatedData.entryDate, updatedData.visaLastDay,
                        updatedData.medicalApplication, updatedData.medicalResult, updatedData.tawjeehSubmission,
                        updatedData.iloeNumber, updatedData.laborCardNumber, updatedData.eidApplication,
                        updatedData.eidAppointment, updatedData.visaStamp, updatedData.visaType,
                        updatedData.currentVisaLastDay
                    ];

                    await callApi('update', { company: emp.company, rowIndex: emp.rowIndex, rowData });

                    // 3. Update Local State (Crucial for immediate UI refresh)
                    // We must update the 'employees' array in memory so that renderPendingActionsPage() sees the new status immediately
                    const empIndex = employees.findIndex(e => e.id === updatedData.id && e.company === updatedData.company);
                    if (empIndex !== -1) {
                        employees[empIndex] = updatedData;
                    }

                    showNotification(`Record Updated: ${label} -> ${newValue}${nextStepUpdateMsg}`, 'success');

                    // 4. Refresh Pending Actions UI if active
                    if (currentView === 'pending') {
                        renderPendingActionsPage();
                    }
                }
            }
        }
        // ------------------------------------------------

        const form = document.getElementById('dailyReportForm');
        if (form) form.reset();

        const reportId = document.getElementById('reportId');
        if (reportId) reportId.value = '';

        const rowIndex = document.getElementById('reportRowIndex');
        if (rowIndex) rowIndex.value = '';

        const reportDate = document.getElementById('reportDate');
        if (reportDate) reportDate.valueAsDate = new Date();

        await loadDailyReports();
        renderDailyReportsPage();

        showNotification(isEdit ? 'Task Updated Successfully' : 'Task Added Successfully', 'success');
    } catch (err) {
        console.error('Save Error:', err);
        const msg = err.message || (typeof err === 'string' ? err : 'Unknown error saving report');
        showNotification(msg, 'error');
    } finally { showLoading(false); }
}

async function deleteDailyReport(rowIndex) {
    if (!confirm('Delete this task?')) return;
    showLoading(true);
    try {
        await callApi('daily-report/delete', { rowIndex });
        await loadDailyReports();
        renderDailyReportsPage();
        showNotification('Task deleted successfully', 'success');
    } catch (e) {
        showNotification(e.message, 'error');
    } finally {
        showLoading(false);
    }
}


// ===== CRUD =====
async function createEmployee(data) {
    // ... same logic as before ...
    try {
        const company = data.company;

        // Validation: Check for duplicate name in the same company (Robust check)
        const exists = employees.some(e =>
            (e.employeeName || '').toLowerCase().trim() === (data.employeeName || '').toLowerCase().trim() &&
            e.company === company
        );
        if (exists) throw new Error(`Employee "${data.employeeName}" already exists in ${company}.`);

        const currentEmployees = employees.filter(e => e.company === company);
        const nextId = currentEmployees.length > 0 ? Math.max(...currentEmployees.map(e => parseInt(e.id))) + 1 : 1;
        const rowData = [
            nextId, data.employeeName, data.profession, data.contract,
            data.entryPermitStatus, data.entryDate, data.visaLastDay,
            data.medicalApplication, data.medicalResult, data.tawjeehSubmission,
            data.iloeNumber, data.laborCardNumber, data.eidApplication,
            data.eidAppointment, data.visaStamp, data.visaType, data.currentVisaLastDay
        ];
        await callApi('add', { company, rowData });
        showNotification('Added!', 'success');
        await syncData();
    } catch (e) { showNotification(e.message, 'error'); }
}
async function updateEmployee(data) {
    try {
        const emp = employees.find(e => e.id == data.id && e.company === data.company);
        if (!emp) throw new Error('Not found');
        const rowData = [
            data.id, data.employeeName, data.profession, data.contract,
            data.entryPermitStatus, data.entryDate, data.visaLastDay,
            data.medicalApplication, data.medicalResult, data.tawjeehSubmission,
            data.iloeNumber, data.laborCardNumber, data.eidApplication,
            data.eidAppointment, data.visaStamp, data.visaType, data.currentVisaLastDay
        ];
        await callApi('update', { company: data.company, rowIndex: emp.rowIndex, rowData });
        showNotification('Updated!', 'success');
        await syncData();
    } catch (e) { showNotification(e.message, 'error'); }
}
async function deleteEmployee(id, company) {
    try {
        const emp = employees.find(e => e.id == id && e.company === company);
        if (!emp) throw new Error('Not found');
        await callApi('delete', { company, rowIndex: emp.rowIndex });
        showNotification('Deleted!', 'success');
        await syncData();
    } catch (e) { showNotification(e.message, 'error'); }
}

// ===== UI =====
// ===== UI =====
function updateStats() {
    const elTotal = document.getElementById('totalEmployees');
    const elCos = document.getElementById('totalCompanies');
    // Safe check if elements exist (in case dashboard is hidden/removed)
    if (document.getElementById('dashTotal')) document.getElementById('dashTotal').textContent = employees.length;
    if (document.getElementById('dashCompanies')) document.getElementById('dashCompanies').textContent = companies.length;
    if (document.getElementById('dashActive')) document.getElementById('dashActive').textContent = employees.filter(e => e.entryPermitStatus === 'Approved').length;
    if (document.getElementById('dashPending')) document.getElementById('dashPending').textContent = employees.reduce((acc, e) => acc + getSmartActions(e).length, 0);

    // Also update header stats if they exist there
    if (elTotal) elTotal.textContent = employees.length;
    if (elCos) elCos.textContent = companies.length;
}

function updateCompanyFilter() {
    const select = document.getElementById('companyFilter');
    const formSelect = document.getElementById('companyName');
    
    if (!select || !formSelect) return;

    const old = select.value;
    select.innerHTML = '<option value="">All Companies</option>';
    formSelect.innerHTML = '<option value="">Select Company</option>';
    companies.forEach(c => {
        select.add(new Option(c, c));
        formSelect.add(new Option(c, c));
    });
    if (companies.includes(old)) select.value = old;
    renderCompaniesView();
    renderPendingActionsPage();
}

// Multi Select UI
function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    const vis = getFilteredEmployees();
    if (checked) vis.forEach(e => selectedIds.add(e.id + '|' + e.company));
    else selectedIds.clear();
    renderEmployees();
    updateBulkActionsUI();
}
function toggleSelect(id, co) {
    const k = id + '|' + co;
    if (selectedIds.has(k)) selectedIds.delete(k); else selectedIds.add(k);
    updateBulkActionsUI();
    document.getElementById('selectAll').checked = selectedIds.size === getFilteredEmployees().length && selectedIds.size > 0;
}
function updateBulkActionsUI() {
    const c = selectedIds.size;
    const b = document.getElementById('bulkActions');
    if (c > 0) { b.style.display = 'flex'; document.getElementById('selectedCount').textContent = c; }
    else { b.style.display = 'none'; document.getElementById('selectAll').checked = false; }
}

async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return;
    showLoading(true);
    let n = 0;
    try {
        for (const k of selectedIds) {
            const [id, co] = k.split('|');
            const e = employees.find(x => x.id == id && x.company == co);
            if (e) { await callApi('delete', { company: co, rowIndex: e.rowIndex }); n++; }
        }
        showNotification(`Deleted ${n} items`, 'success');
        selectedIds.clear(); await syncData();
    } catch (e) { showNotification(e.message, 'error'); } finally { showLoading(false); }
}
async function bulkUpdateStatus(s) {
    showLoading(true);
    let n = 0;
    try {
        for (const k of selectedIds) {
            const [id, co] = k.split('|');
            const e = employees.find(x => x.id == id && x.company == co);
            if (e) {
                const d = [e.id, e.employeeName, e.profession, e.contract, s, e.entryDate, e.visaLastDay, e.medicalApplication, e.medicalResult, e.tawjeehSubmission, e.iloeNumber, e.laborCardNumber, e.eidApplication, e.eidAppointment, e.visaStamp, e.visaType, e.currentVisaLastDay];
                await callApi('update', { company: co, rowIndex: e.rowIndex, rowData: d }); n++;
            }
        }
        showNotification(`Updated ${n} items`, 'success');
        selectedIds.clear(); await syncData();
    } catch (e) { showNotification(e.message, 'error'); } finally { showLoading(false); }
}

// Rendering
function renderEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    const data = getFilteredEmployees();
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="no-data">No data</td></tr>'; return; }
    tbody.innerHTML = data.map(e => `
        <tr class="${selectedIds.has(e.id + '|' + e.company) ? 'selected-row' : ''}">
            <td style="text-align:center"><input type="checkbox" onchange="toggleSelect('${e.id}','${e.company}')" ${selectedIds.has(e.id + '|' + e.company) ? 'checked' : ''}></td>
            <!-- Hiding ID display as requested -->
            <td style="display:none">${e.id}</td> 
            <td>${e.employeeName}</td>
            <td>${e.company}</td>
            <td>${e.profession}</td>
            <td>${e.contract}</td>
            <td><span class="badge ${getStatusClass(e.entryPermitStatus)}">${e.entryPermitStatus}</span></td>
            <td>${e.entryDate}</td>
            <td>${e.visaLastDay}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="openEditModal('${e.id}','${e.company}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="openDeleteModal('${e.id}','${e.company}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
    updateBulkActionsUI();
}
function renderCompaniesView() {
    const tbody = document.getElementById('companiesTableBody');
    if (!tbody) return;
    if (companies.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="no-data">No companies</td></tr>'; return; }
    const rows = companies.map(c => {
        const emps = employees.filter(e => e.company === c);
        const pending = emps.reduce((acc, e) => acc + getSmartActions(e).length, 0);
        return `
            <tr>
                <td>${c}</td>
                <td>${emps.length}</td>
                <td>${pending}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="openDeleteCompanyModal('${c}')">🗑️ Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    tbody.innerHTML = rows;
}
function openDeleteCompanyModal(name) {
    deleteCompanyName = name;
    document.getElementById('deleteCompanyText').textContent = `Delete company "${name}"? This will remove its sheet tab.`;
    document.getElementById('deleteCompanyModal').classList.add('active');
}

function getFilteredEmployees() {
    const searchInput = document.getElementById('searchInput');
    const companyFilter = document.getElementById('companyFilter');
    
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    const c = companyFilter ? companyFilter.value : '';

    let r = employees.filter(e => {
        const m1 = !q || e.employeeName.toLowerCase().includes(q) || e.id.toString().includes(q);
        const m2 = !c || e.company === c;
        const m3 = currentStatusFilter === 'All' || e.entryPermitStatus === currentStatusFilter;
        return m1 && m2 && m3;
    });
    const { column: k, direction: D } = currentSort;
    const d = D === 'asc' ? 1 : -1;
    r.sort((a, b) => {
        if (k === 'id') return (parseInt(a.id) - parseInt(b.id)) * d;
        return (a[k] || '').toString().localeCompare(b[k] || '') * d;
    });
    return r;
}
function filterByStatus(s) { currentStatusFilter = s; showNotification(`Filter: ${s}`); renderEmployees(); }
function sortTable(c) {
    if (currentSort.column === c) currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    else { currentSort.column = c; currentSort.direction = 'asc'; }
    renderEmployees();
}
function filterEmployees() { renderEmployees(); }
function getStatusClass(s) { return ({ 'Approved': 'success', 'Pending': 'warning', 'Rejected': 'danger' })[s] || ''; }

// Modals
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Employee';
    document.getElementById('editMode').value = 'false';
    document.getElementById('employeeForm').reset();
    const f = document.getElementById('companyFilter').value;
    if (f) document.getElementById('companyName').value = f;
    document.getElementById('employeeModal').classList.add('active');
}
function openEditModal(id, co) {
    const e = employees.find(x => x.id == id && x.company == co);
    if (!e) return;

    // Add to History
    addToHistory(e);

    document.getElementById('modalTitle').textContent = 'Edit Employee';
    document.getElementById('editMode').value = 'true';
    document.getElementById('employeeId').value = e.id;
    // ... fill fields ...
    document.getElementById('employeeName').value = e.employeeName;
    document.getElementById('companyName').value = e.company;
    document.getElementById('profession').value = e.profession;
    document.getElementById('contract').value = e.contract;
    document.getElementById('visaType').value = e.visaType || '';
    toggleVisaFields(); // Show/Hide based on value
    document.getElementById('currentVisaLastDay').value = e.currentVisaLastDay || '';

    document.getElementById('entryPermitStatus').value = e.entryPermitStatus;
    document.getElementById('entryDate').value = e.entryDate;
    document.getElementById('visaLastDay').value = e.visaLastDay; // Read-only
    document.getElementById('medicalApplication').value = e.medicalApplication;
    document.getElementById('medicalResult').value = e.medicalResult;
    document.getElementById('tawjeehSubmission').value = e.tawjeehSubmission;
    document.getElementById('iloeNumber').value = e.iloeNumber;
    document.getElementById('laborCardNumber').value = e.laborCardNumber;
    document.getElementById('eidApplication').value = e.eidApplication;
    document.getElementById('eidAppointment').value = e.eidAppointment;
    document.getElementById('visaStamp').value = e.visaStamp;

    document.getElementById('employeeModal').classList.add('active');
}
function closeModal() { document.getElementById('employeeModal').classList.remove('active'); }
function openDeleteModal(id, co) { deleteEmployeeData = { id, company: co }; document.getElementById('deleteModal').classList.add('active'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('active'); }
async function confirmDelete() { if (deleteEmployeeData) { closeModal(); await deleteEmployee(deleteEmployeeData.id, deleteEmployeeData.company); } }
async function saveEmployee(e) {
    e.preventDefault();
    if (!validateEmployeeForm()) return;

    showLoading(true); closeModal();
    const isEdit = document.getElementById('editMode').value === 'true';
    const data = {
        id: document.getElementById('employeeId').value,
        company: document.getElementById('companyName').value,
        employeeName: document.getElementById('employeeName').value,
        profession: document.getElementById('profession').value,
        contract: document.getElementById('contract').value,
        visaType: document.getElementById('visaType').value,
        currentVisaLastDay: document.getElementById('currentVisaLastDay').value,
        entryPermitStatus: document.getElementById('entryPermitStatus').value,
        entryDate: document.getElementById('entryDate').value,
        visaLastDay: document.getElementById('visaLastDay').value,
        medicalApplication: document.getElementById('medicalApplication').value,
        medicalResult: document.getElementById('medicalResult').value,
        tawjeehSubmission: document.getElementById('tawjeehSubmission').value,
        iloeNumber: document.getElementById('iloeNumber').value,
        laborCardNumber: document.getElementById('laborCardNumber').value,
        eidApplication: document.getElementById('eidApplication').value,
        eidAppointment: document.getElementById('eidAppointment').value,
        visaStamp: document.getElementById('visaStamp').value
    };
    try { if (isEdit) await updateEmployee(data); else await createEmployee(data); }
    catch (err) { console.error(err); } finally { showLoading(false); }
}

// Utils
function updateConnectionStatus(c) {
    const t = document.querySelector('#connectionStatus .status-text');
    const d = document.querySelector('#connectionStatus .status-dot');
    if (c) { d.classList.add('connected'); t.textContent = 'Server Online'; }
    else { d.classList.remove('connected'); t.textContent = 'Server Offline'; }
}
function showNotification(m, t = 'info') {
    const n = document.getElementById('notification');
    n.textContent = m; n.className = `notification ${t} show`;
    setTimeout(() => n.classList.remove('show'), 3000);
}
function showLoading(s) {
    const o = document.getElementById('loadingOverlay');
    if (s) o.classList.add('active'); else o.classList.remove('active');
}
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };

// View switcher
function switchView(view) {
    currentView = view;
    document.getElementById('employeesSection').style.display = view === 'employees' ? '' : 'none';
    document.getElementById('companiesSection').style.display = view === 'companies' ? '' : 'none';
    document.getElementById('dailySection').style.display = view === 'daily' ? '' : 'none';
    document.getElementById('pendingSection').style.display = view === 'pending' ? '' : 'none';
    if (view === 'daily') { loadDailyReports().then(renderDailyReportsPage); }
    if (view === 'companies') { renderCompaniesView(); }
    if (view === 'pending') { renderPendingActionsPage(); }
    if (view === 'dashboard') { updateDashboard(); document.getElementById('dashboardSection').style.display = 'block'; }
}

// ===== DRAGGABLE FAB LOGIC =====
const fab = document.getElementById('fabContainer');
const fabMain = document.getElementById('fabMainBtn');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

// Toggle Menu
fabMain.addEventListener('click', (e) => {
    if (!isDragging) {
        fab.classList.toggle('active');
        // Close panels if closing menu
        if (!fab.classList.contains('active')) {
            document.getElementById('historyPanel').classList.remove('active');
            document.getElementById('chatPanel').classList.remove('active');
        }
    }
});

// Dragging
fabMain.addEventListener('mousedown', dragStart);
fabMain.addEventListener('touchstart', dragStart, { passive: false });

function dragStart(e) {
    // Only drag if not clicking the button to toggle
    // Actually, let's distinguish click vs drag by movement threshold
    isDragging = false;

    if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    } else {
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault(); // Prevent text selection
    }

    const rect = fab.getBoundingClientRect();
    // We set left/top instead of bottom/right for dragging stability
    // Convert current fixed bottom/right to top/left
    if (!fab.style.left) {
        fab.style.left = rect.left + 'px';
        fab.style.top = rect.top + 'px';
        fab.style.bottom = 'auto';
        fab.style.right = 'auto';
    }

    initialLeft = parseFloat(fab.style.left || rect.left);
    initialTop = parseFloat(fab.style.top || rect.top);

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
}

function drag(e) {
    let clientX, clientY;
    if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true; // Threshold

    if (isDragging) {
        fab.style.left = (initialLeft + dx) + 'px';
        fab.style.top = (initialTop + dy) + 'px';
        e.preventDefault(); // Prevent scroll on mobile
    }
}

function dragEnd(e) {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);

    if (isDragging) {
        // Snap to edge logic could go here
        // Update panels position relative to FAB
        updatePanelPositions();
    }
}

function updatePanelPositions() {
    // Keep panels near the FAB
    const rect = fab.getBoundingClientRect();
    const panels = document.querySelectorAll('.fab-panel');
    panels.forEach(p => {
        // Position to the left of FAB if on right side, else right
        const onRight = rect.left > window.innerWidth / 2;
        if (onRight) {
            p.style.left = 'auto';
            p.style.right = (window.innerWidth - rect.left + 20) + 'px';
        } else {
            p.style.right = 'auto';
            p.style.left = (rect.right + 20) + 'px';
        }

        // Position vertically aligned with bottom
        p.style.bottom = (window.innerHeight - rect.bottom) + 'px';
        p.style.top = 'auto';
    });
}

// Call once on init
window.addEventListener('resize', updatePanelPositions);

// Toggle functions for menu items
function toggleHistory() {
    const p = document.getElementById('historyPanel');
    const isActive = p.classList.contains('active');
    // Close others
    document.querySelectorAll('.fab-panel').forEach(x => x.classList.remove('active'));

    if (!isActive) {
        updatePanelPositions();
        p.classList.add('active');
        renderHistory();
    }
}

function toggleChat() {
    const p = document.getElementById('chatPanel');
    const isActive = p.classList.contains('active');
    document.querySelectorAll('.fab-panel').forEach(x => x.classList.remove('active'));

    if (!isActive) {
        updatePanelPositions();
        p.classList.add('active');
        // Focus input
        setTimeout(() => document.getElementById('aiInput').focus(), 100);
    }
}

function addToHistory(emp) {
    // Add to start, remove dupes, keep max 10
    recentHistory = recentHistory.filter(h => h.id !== emp.id);
    recentHistory.unshift({ id: emp.id, name: emp.employeeName, timestamp: new Date(), company: emp.company });
    if (recentHistory.length > 10) recentHistory.pop();
    renderHistory();
}

function renderHistory() {
    const l = document.getElementById('historyList');
    if (!l) return;
    if (recentHistory.length === 0) { l.innerHTML = '<li style="color:#888; padding:10px;">No recent history</li>'; return; }
    l.innerHTML = recentHistory.map(h => `
        <li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${h.name}</strong><br>
                <small>${h.company}</small>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('${h.id}', '${h.company}')">Open</button>
        </li>
    `).join('');
}


// ===== DASHBOARD =====
function updateDashboard() {
    const active = employees.filter(e => e.entryPermitStatus === 'Approved').length;
    const pending = employees.reduce((acc, e) => acc + getSmartActions(e).length, 0);

    // 1. Main Stats (Real Data)
    document.getElementById('dashTotal').textContent = employees.length;
    document.getElementById('dashCompanies').textContent = companies.length;
    document.getElementById('dashActive').textContent = active;
    document.getElementById('dashPending').textContent = pending;

    // 2. Company Breakdown (New Feature: "show the category per each company")
    const companyStats = {};
    employees.forEach(e => {
        if (!companyStats[e.company]) companyStats[e.company] = { total: 0, categories: {} };
        companyStats[e.company].total++;
    });

    // Let's build a new section for "Company Workflows"
    // "Visa Process", "Renew", "Done" counts per company.

    const wfDiv = document.getElementById('dashWorkflow');
    let wfHtml = '';

    companies.forEach(c => {
        // Count active workflows for this company from Daily Reports
        const companyReports = dailyReports.filter(r => r.company === c && r.status !== 'Completed' && r.status !== 'Cancelled');
        const catCounts = { 'Visa Process': 0, 'Visa Renew': 0, 'Visa Done': 0, 'Cancellation': 0, 'Other': 0 };

        companyReports.forEach(r => {
            const cat = r.category || 'Other';
            if (catCounts[cat] !== undefined) catCounts[cat]++; else catCounts['Other']++;
        });

        // Only show if there's activity
        if (companyReports.length > 0) {
            wfHtml += `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; width: 100%;">
                    <h4 style="margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${c}</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${Object.entries(catCounts).map(([k, v]) => v > 0 ? `
                            <div style="background: white; padding: 8px 15px; border-radius: 20px; border: 1px solid #eee; font-size: 0.9rem;">
                                <strong>${v}</strong> ${k}
                            </div>
                        ` : '').join('')}
                    </div>
                </div>
            `;
        }
    });

    if (!wfHtml) wfHtml = '<p style="color:#888">No active workflows.</p>';
    wfDiv.innerHTML = wfHtml;

    // Expiries logic remains...
    const today = new Date();
    const next30 = new Date();
    next30.setDate(today.getDate() + 30);

    const expiries = [];
    employees.forEach(e => {
        // Check Visa Last Day (New)
        if (e.visaLastDay) {
            const d = new Date(e.visaLastDay);
            if (d >= today && d <= next30) expiries.push({ name: e.employeeName, type: 'Visa (New)', date: d, priority: d < new Date(today.getTime() + 7 * 86400000) ? 'high' : 'medium' });
        }
        // Check Current Visa Last Day
        if (e.currentVisaLastDay) {
            const d = new Date(e.currentVisaLastDay);
            if (d >= today && d <= next30) expiries.push({ name: e.employeeName, type: 'Visa (Current)', date: d, priority: d < new Date(today.getTime() + 7 * 86400000) ? 'high' : 'medium' });
        }
    });

    const expDiv = document.getElementById('dashExpiries');
    if (expiries.length === 0) {
        expDiv.innerHTML = '<p style="color: #888;">No upcoming expiries.</p>';
    } else {
        expiries.sort((a, b) => a.date - b.date);
        expDiv.innerHTML = expiries.map(x => `
            <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: ${x.priority === 'high' ? '#fff0f0' : 'white'}">
                <div>
                    <strong>${x.name}</strong><br>
                    <small>${x.type}</small>
                </div>
                <div style="text-align: right;">
                    <span style="color: ${x.priority === 'high' ? 'red' : 'orange'}">${x.date.toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }
}

// ===== EMPLOYEE FORM LOGIC =====
function toggleVisaFields() {
    const type = document.getElementById('visaType').value;
    const currentVisaField = document.getElementById('currentVisaField');
    const currentVisaInput = document.getElementById('currentVisaLastDay');

    if (type === 'Inside UAE') {
        currentVisaField.style.display = 'block';
        currentVisaInput.readOnly = false;
        currentVisaInput.style.backgroundColor = '';
    } else {
        currentVisaField.style.display = 'none';
        currentVisaInput.value = '';
    }
}

function calcVisaLastDay() {
    const entryInput = document.getElementById('entryDate');
    const entry = entryInput.valueAsDate;

    if (entry) {
        const d = new Date(entry);
        d.setDate(d.getDate() + 60);
        document.getElementById('visaLastDay').value = d.toISOString().split('T')[0];
    }
}

function validateEmployeeForm() {
    const type = document.getElementById('visaType').value;
    if (type === 'Inside UAE') {
        const current = document.getElementById('currentVisaLastDay').value;
        const entryStatus = document.getElementById('entryPermitStatus').value;

        if (!current && entryStatus) {
            alert('For Inside UAE, "Current Visa Inside Last Day" must be filled before setting Entry Permit Status.');
            return false;
        }
    }
    return true;
}

// Smart Actions / Auto Prediction
function getSmartActions(emp) {
    const actions = [];
    const today = new Date();

    // 1. Expiry Checks
    if (emp.visaLastDay) {
        const expiry = new Date(emp.visaLastDay);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 60 && daysLeft > 0) {
            actions.push({ label: 'Visa Expiry', value: `Expires in ${daysLeft} days`, type: 'expiry', priority: daysLeft < 30 ? 'high' : 'medium' });
        } else if (daysLeft <= 0) {
            actions.push({ label: 'Visa Expired', value: `Expired ${Math.abs(daysLeft)} days ago`, type: 'expiry', priority: 'critical' });
        }
    }

    // 2. Workflow Predictions & Auto-Fill Pending
    // Entry Permit Flow
    if (emp.entryPermitStatus === 'Approved') {
        if (!emp.entryDate)
            actions.push({ label: 'Entry Date', value: 'Pending Entry', type: 'prediction', priority: 'high' });
        else if (!emp.medicalApplication || emp.medicalApplication === 'Not Started')
            actions.push({ label: 'Medical Application', value: 'To Do', type: 'prediction', priority: 'high' });
    }

    // Medical Flow
    if (emp.medicalApplication === 'Completed' || emp.medicalApplication === 'Applied') {
        if (!emp.medicalResult || emp.medicalResult === 'Pending')
            actions.push({ label: 'Medical Result', value: 'Awaiting Result', type: 'prediction', priority: 'medium' });
    }

    // EID Flow
    if ((emp.medicalResult === 'Fit' || emp.medicalResult === 'Pass') && (!emp.eidApplication || emp.eidApplication === 'Not Started')) {
        actions.push({ label: 'EID Application', value: 'To Do', type: 'prediction', priority: 'high' });
    }

    // Visa Stamp Flow
    if (emp.eidApplication && emp.medicalResult === 'Fit' && (!emp.visaStamp || emp.visaStamp === 'Not Started')) {
        actions.push({ label: 'Visa Stamp', value: 'To Do', type: 'prediction', priority: 'medium' });
    }

    // 3. Explicit Pending Statuses (User Entered)
    const pendingFields = [
        { key: 'entryPermitStatus', label: 'Entry Permit' },
        { key: 'medicalApplication', label: 'Medical Application' },
        { key: 'medicalResult', label: 'Medical Result' },
        { key: 'tawjeehSubmission', label: 'Tawjeeh Submission' },
        { key: 'eidApplication', label: 'EID Application' },
        { key: 'eidAppointment', label: 'EID Appointment' },
        { key: 'visaStamp', label: 'Visa Stamp' },
        { key: 'laborCardNumber', label: 'Labor Card' },
        { key: 'iloeNumber', label: 'ILOE Number' }
    ];

    for (const f of pendingFields) {
        let val = (emp[f.key] || '').toString();
        const lowerVal = val.toLowerCase();

        // Skip if Completed/Approved
        if (lowerVal.includes('approved') || lowerVal.includes('completed') || lowerVal.includes('fit') || lowerVal.includes('done')) continue;

        // Include if explicitly marked Pending/Process OR if it matches a Prediction logic above that resulted in "To Do"
        if (lowerVal.includes('pending') || lowerVal.includes('process') || lowerVal.includes('applied')) {
            // Avoid duplicates if prediction already caught it
            if (!actions.some(a => a.label === f.label)) {
                actions.push({ label: f.label, value: val, type: 'pending', priority: 'medium' });
            }
        }
    }

    return actions;
}

function renderPendingActionsPage() {
    const tbody = document.getElementById('pendingActionsBody');
    if (!tbody) return;

    const allActions = [];

    employees.forEach(e => {
        const actions = getSmartActions(e);
        actions.forEach(a => {
            allActions.push({ ...a, empName: e.employeeName, company: e.company, empId: e.id });
        });
    });

    if (allActions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data"><div class="no-data-message"><span class="icon">✨</span><p>All caught up! No pending actions.</p></div></td></tr>';
        return;
    }

    // Sort by priority
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    allActions.sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99));

    tbody.innerHTML = allActions.map(a => `
        <tr class="action-row ${a.priority}">
            <td><strong>${a.empName}</strong></td>
            <td>${a.company}</td>
            <td>
                <span class="badge ${a.type === 'expiry' ? 'danger' : (a.type === 'prediction' ? 'info' : 'warning')}">
                    ${a.label}
                </span>
            </td>
            <td>${a.value}</td>
            <td>
                <button class="btn btn-sm btn-primary" 
                    onclick="addPendingToReport('${a.empId}','${a.company}','${a.label}','${a.value}')">
                    ⚡ Acts
                </button>
            </td>
        </tr>
    `).join('');
}
function addPendingToReport(empId, company, label, value) {
    const emp = employees.find(x => x.id == empId && x.company == company);
    if (!emp) return;

    openDailyReportModal();

    // Pre-fill form
    const empInput = document.getElementById('reportEmployeeName');
    empInput.value = emp.employeeName;

    document.getElementById('reportCompany').value = company;
    document.getElementById('reportTask').value = label; // Just the label

    // Smart Status based on value
    const val = (value || '').toLowerCase();
    let status = WORKFLOW_CONFIG.STATUS.PENDING;
    if (val.includes('process') || val.includes('applied')) status = WORKFLOW_CONFIG.STATUS.IN_PROGRESS;
    else if (val.includes('done') || val.includes('fit') || val.includes('approved')) status = WORKFLOW_CONFIG.STATUS.COMPLETED;

    document.getElementById('reportStatus').value = status;
    document.getElementById('reportSentBy').value = 'System';

    // Trigger input event to ensure any dependent logic runs (though we set company manually)
    empInput.dispatchEvent(new Event('change'));

    showNotification('Form pre-filled. Please save to add.', 'info');
}
