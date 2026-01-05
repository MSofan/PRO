const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve the frontend files

// Configuration
const SPREADSHEET_ID = '11zJ7gDAXikyiRrYGEejRh1UpJOjXSpKAmigxq8ZEWDg';
const KEY_FILE_PATH = 'c:\\Users\\W11\\Desktop\\New folder\\GA\\sheet-1766804649091-2297a555f2a6.json';

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// --- ROUTES ---

// 1. Get All Data (Sync)
app.get('/api/sync', async (req, res) => {
    try {
        // Get all sheet names
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const systemSheets = ['Dashboard', 'Users', 'Sheet1', 'Copy of ICDC', 'Daily Report'];
        const allSheets = meta.data.sheets.map(s => s.properties.title);
        const companies = allSheets.filter(name => !systemSheets.includes(name));

        let allEmployees = [];

        // Fetch data for each company
        for (const company of companies) {
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${company}'!A2:Q1000`,
                });

                const rows = response.data.values || [];
                rows.forEach((row, index) => {
                    if (row[0]) {
                        allEmployees.push({
                            id: row[0],
                            company: company,
                            employeeName: row[1] || '',
                            profession: row[2] || '',
                            contract: row[3] || '',
                            entryPermitStatus: row[4] || '',
                            entryDate: row[5] || '',
                            visaLastDay: row[6] || '',
                            medicalApplication: row[7] || '',
                            medicalResult: row[8] || '',
                            tawjeehSubmission: row[9] || '',
                            iloeNumber: row[10] || '',
                            laborCardNumber: row[11] || '',
                            eidApplication: row[12] || '',
                            eidAppointment: row[13] || '',
                            visaStamp: row[14] || '',
                            visaType: row[15] || '',
                            currentVisaLastDay: row[16] || '',
                            rowIndex: index + 2 // Start from Row 2
                        });
                    }
                });
            } catch (err) {
                console.error(`Error fetching ${company}:`, err.message);
            }
        }

        res.json({ companies, employees: allEmployees });
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Add Employee
app.post('/api/add', async (req, res) => {
    try {
        const { company, rowData } = req.body;
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            // Accessing A1 tells Google to look at the whole sheet and find the last row
            range: `'${company}'!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowData] },
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update Employee
app.post('/api/update', async (req, res) => {
    try {
        const { company, rowIndex, rowData } = req.body;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${company}'!A${rowIndex}:Q${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowData] },
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Delete Employee
app.post('/api/delete', async (req, res) => {
    try {
        const { company, rowIndex } = req.body;

        // Find sheet ID
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties.title === company);
        if (!sheet) throw new Error('Sheet not found');

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // 0-indexed
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Create Company
// 5. Create Company
app.post('/api/create-company', async (req, res) => {
    try {
        const { name } = req.body;

        // Add Sheet
        const sheetReq = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: { properties: { title: name } }
                }]
            }
        });

        const newSheetId = sheetReq.data.replies[0].addSheet.properties.sheetId;

        // Add Headers
        const headers = [
            'ID', 'Employee Name', 'Profession', 'Contract', 'Entry Permit Status',
            'Entry Date', 'Visa Expiry Date', 'Medical Application', 'Medical Result',
            'Tawjeeh Submission', 'ILOE Number', 'Labor Card Number',
            'EID Application', 'EID Appointment', 'Visa Stamp', 'Visa Type', 'Current Visa Last Day'
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${name}'!A1:Q1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] }
        });

        // Format Headers (Bold + Freeze)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                            },
                            fields: "userEnteredFormat(textFormat,backgroundColor)"
                        }
                    },
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: newSheetId,
                                gridProperties: { frozenRowCount: 1 }
                            },
                            fields: "gridProperties.frozenRowCount"
                        }
                    }
                ]
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Delete Company Sheet
app.post('/api/delete-company', async (req, res) => {
    try {
        const { name } = req.body;
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties.title === name);

        if (!sheet) throw new Error('Company sheet not found');

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    deleteSheet: { sheetId: sheet.properties.sheetId }
                }]
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Daily Report Operations
const REPORT_SHEET = 'Daily Report';

// Ensure Daily Report Sheet Exists
async function ensureReportSheet() {
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const exists = meta.data.sheets.find(s => s.properties.title === REPORT_SHEET);

        if (!exists) {
            // Create Sheet
            const sheetReq = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: { requests: [{ addSheet: { properties: { title: REPORT_SHEET } } }] }
            });
            const newSheetId = sheetReq.data.replies[0].addSheet.properties.sheetId;

            // Add Headers
            const headers = ['ID', 'Date', 'Employee Name', 'Company', 'Category', 'Transaction', 'Status', 'Notes', 'Sent By', 'Done By'];
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${REPORT_SHEET}'!A1:J1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [headers] }
            });

            // Format Headers (Bold + Freeze)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            repeatCell: {
                                range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
                                userEnteredFormat: {
                                    textFormat: { bold: true },
                                    backgroundColor: { red: 0.85, green: 0.9, blue: 0.95 }
                                },
                                fields: "userEnteredFormat(textFormat,backgroundColor)"
                            }
                        },
                        { updateSheetProperties: { properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } }
                    ]
                }
            });
        } else {
            // If exists but missing columns, patch header row to include Employee Name, Company
            const resp = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${REPORT_SHEET}'!A1:Z1`
            });
            const current = (resp.data.values && resp.data.values[0]) ? resp.data.values[0] : [];
            const desired = ['ID', 'Date', 'Employee Name', 'Company', 'Category', 'Transaction', 'Status', 'Notes', 'Sent By', 'Done By'];
            const needsUpdate = desired.some((h, i) => (current[i] || '') !== h);
            if (needsUpdate) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${REPORT_SHEET}'!A1:J1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [desired] }
                });
            }
        }
    } catch (e) {
        console.error('Error ensuring report sheet:', e);
    }
}
// Init on load
ensureReportSheet();

app.get('/api/daily-report', async (req, res) => {
    try {
        await ensureReportSheet();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${REPORT_SHEET}'!A2:J1000`, // Data from Row 2
        });

        const rows = response.data.values || [];
        const reports = rows.map((row, index) => ({
            id: row[0],
            date: row[1],
            employeeName: row[2],
            company: row[3],
            category: row[4],
            transaction: row[5],
            status: row[6],
            notes: row[7],
            sentBy: row[8],
            doneBy: row[9],
            // Map legacy 'task' field if missing category/transaction for backward compatibility
            task: row[5] ? row[5] : (row[4] && !row[5] ? row[4] : row[4]), 
            rowIndex: index + 2
        })).filter(r => r.id); // Filter empty

        res.json({ reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper: load all employees across companies
async function loadAllEmployees() {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const systemSheets = ['Dashboard', 'Users', 'Sheet1', 'Copy of ICDC', REPORT_SHEET];
    const allSheets = meta.data.sheets.map(s => s.properties.title);
    const companies = allSheets.filter(name => !systemSheets.includes(name));
    const employees = [];
    for (const company of companies) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${company}'!A2:Q2000`,
            });
            const rows = response.data.values || [];
            rows.forEach((row, index) => {
                if (row[1]) {
                    employees.push({
                        id: row[0],
                        employeeName: row[1],
                        profession: row[2] || '',
                        contract: row[3] || '',
                        entryPermitStatus: row[4] || '',
                        entryDate: row[5] || '',
                        visaLastDay: row[6] || '',
                        medicalApplication: row[7] || '',
                        medicalResult: row[8] || '',
                        tawjeehSubmission: row[9] || '',
                        iloeNumber: row[10] || '',
                        laborCardNumber: row[11] || '',
                        eidApplication: row[12] || '',
                        eidAppointment: row[13] || '',
                        visaStamp: row[14] || '',
                        visaType: row[15] || '',
                        currentVisaLastDay: row[16] || '',
                        company,
                        rowIndex: index + 2
                    });
                }
            });
        } catch (e) {
            console.warn('Load employees failed for', company, e.message);
        }
    }
    return employees;
}

function pickPendingTask(emp) {
    const fields = [
        { key: 'entryPermitStatus', label: 'Entry Permit' },
        { key: 'medicalApplication', label: 'Medical Application' },
        { key: 'medicalResult', label: 'Medical Result' },
        { key: 'tawjeehSubmission', label: 'Tawjeeh Submission' },
        { key: 'eidApplication', label: 'EID Application' },
        { key: 'eidAppointment', label: 'EID Appointment' },
        { key: 'visaStamp', label: 'Visa Stamp' },
        { key: 'laborCardNumber', label: 'Labor Card' },
        { key: 'iloeNumber', label: 'ILOE Number' },
        { key: 'contract', label: 'Contract' }
    ];
    for (const f of fields) {
        const val = (emp[f.key] || '').toString().toLowerCase();
        if (val.includes('pending') || val.includes('under process') || val.includes('underprocess') || val.includes('in process')) {
            return `${f.label}: ${emp[f.key]}`;
        }
    }
    return 'General Follow-up';
}

app.post('/api/daily-report', async (req, res) => {
    try {
        await ensureReportSheet();
        const { id, date, employeeName, category, transaction, task, status, notes, sentBy, doneBy } = req.body;
        const allEmployees = await loadAllEmployees();
        
        // Find employee to fill missing details if needed, but prefer request body
        const emp = allEmployees.find(e => (e.employeeName || '').toLowerCase() === (employeeName || '').toLowerCase());
        
        // Use provided company, fallback to employee's company, fallback to empty
        const company = (req.body.company && req.body.company.trim()) ? req.body.company : (emp ? emp.company : '');
        
        // Handle legacy 'task' field if transaction is missing
        const computedTransaction = transaction && transaction.trim() ? transaction : (task || 'General');
        
        const today = new Date();
        const isoDate = date && date.trim() ? date : today.toISOString().split('T')[0];
        const rowId = id && String(id).trim() ? String(id).trim() : String(Date.now());

        const rowData = [
            rowId, 
            isoDate, 
            employeeName || (emp ? emp.employeeName : ''), 
            company, 
            category || 'Visa Process', // Default category
            computedTransaction, 
            status || 'Pending', 
            notes || '', 
            sentBy || '', 
            doneBy || ''
        ];
 
        if (req.body.rowIndex) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${REPORT_SHEET}'!A${req.body.rowIndex}:J${req.body.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowData] },
            });
        } else {
            console.log('Appending row:', rowData);
            const appendRes = await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${REPORT_SHEET}'!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowData] },
            });
            console.log('Append result:', appendRes.status, appendRes.statusText);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/daily-report/delete', async (req, res) => {
    try {
        const { rowIndex } = req.body;
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties.title === REPORT_SHEET);

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log('✅ Service Account Authentication Enabled');
});
