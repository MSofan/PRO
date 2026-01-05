
// ===== HISTORY & AI =====

// History
function addToHistory(emp) {
    // Remove if exists
    recentHistory = recentHistory.filter(h => !(h.id === emp.id && h.company === emp.company));
    // Add to top
    recentHistory.unshift({
        id: emp.id,
        name: emp.employeeName,
        company: emp.company,
        timestamp: new Date()
    });
    // Limit to 10
    if (recentHistory.length > 10) recentHistory.pop();
    renderHistory();
}

function toggleHistory() {
    const p = document.getElementById('historyPanel');
    p.classList.toggle('active');
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (recentHistory.length === 0) {
        list.innerHTML = '<li style="color:#888; text-align:center;">No recent items</li>';
        return;
    }
    list.innerHTML = recentHistory.map(h => `
        <li onclick="openEditModal('${h.id}', '${h.company}')">
            <div>
                <strong>${h.name}</strong><br>
                <small>${h.company}</small>
            </div>
            <span style="font-size:0.8em; color:#888;">${h.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </li>
    `).join('');
}

// AI Chat
function toggleChat() {
    const p = document.getElementById('chatPanel');
    const isActive = p.classList.toggle('active');
    if (isActive && document.getElementById('chatMessages').children.length === 0) {
        addBotMessage("Hello! I'm your AI Assistant. I can help you analyze employee data, find pending tasks, or suggest actions. What would you like to do?");
    }
}

function handleChatKey(e) {
    if (e.key === 'Enter') sendAiMessage();
}

function sendAiMessage() {
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;
    
    addUserMessage(msg);
    input.value = '';
    
    // Simulate thinking
    setTimeout(() => {
        processAiCommand(msg);
    }, 600);
}

function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = text;
    document.getElementById('chatMessages').appendChild(div);
    scrollToBottom();
}

function addBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.textContent = text;
    document.getElementById('chatMessages').appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const c = document.getElementById('chatMessages');
    c.scrollTop = c.scrollHeight;
}

function processAiCommand(cmd) {
    const lower = cmd.toLowerCase();
    
    if (lower.includes('pending') || lower.includes('visa')) {
        let count = 0;
        let details = [];
        employees.forEach(e => {
            const p = getPendingFields(e);
            if (p.length > 0) {
                count++;
                if (count <= 3) details.push(`${e.employeeName} (${p.map(x => x.label).join(', ')})`);
            }
        });
        
        let reply = `I found ${count} employees with pending actions.`;
        if (count > 0) {
            reply += ` Here are a few: ${details.join('; ')}.`;
            if (count > 3) reply += ` And ${count - 3} more.`;
            reply += " You can view them in the 'Pending Actions' tab.";
        }
        addBotMessage(reply);
        return;
    }
    
    if (lower.includes('summary') || lower.includes('report') || lower.includes('count')) {
        addBotMessage(`Current Status:
- Total Employees: ${employees.length}
- Companies: ${companies.length}
- Active (Approved): ${employees.filter(e => e.entryPermitStatus === 'Approved').length}
- Pending Entry: ${employees.filter(e => e.entryPermitStatus === 'Pending').length}
`);
        return;
    }
    
    if (lower.includes('add') && lower.includes('employee')) {
        addBotMessage("I can open the Add Employee form for you.");
        openAddModal();
        return;
    }

    if (lower.includes('sync')) {
        addBotMessage("Syncing data with Google Sheets...");
        syncData();
        return;
    }

    addBotMessage("I'm still learning! Try asking about 'pending actions', 'summary', or say 'sync' to update data.");
}
