const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// In-memory storage
const clients = new Map([
    ['client-1', { id: 'client-1', name: 'Production Server', ip: '192.168.1.100', os: 'Windows Server 2019', status: 'online', lastSeen: new Date() }],
    ['client-2', { id: 'client-2', name: 'Development VM', ip: '192.168.1.101', os: 'Windows 11', status: 'online', lastSeen: new Date() }],
    ['client-3', { id: 'client-3', name: 'Testing Container', ip: '192.168.1.102', os: 'Ubuntu 22.04', status: 'online', lastSeen: new Date() }],
    ['client-4', { id: 'client-4', name: 'Staging Server', ip: '192.168.1.103', os: 'CentOS 8', status: 'offline', lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000) }]
]);

const executions = new Map();

// Mock command simulation
function simulateCommand(code, clientId) {
    const startTime = Date.now();
    const commands = code.toLowerCase().split('\n').filter(cmd => cmd.trim());
    
    let output = '';
    
    commands.forEach((command) => {
        const cmd = command.trim();
        
        if (cmd.startsWith('dir') || cmd.startsWith('ls')) {
            output += `Directory of C:\\Users\\Administrator\n\n`;
            output += `01/15/2024  02:30 PM    <DIR>          .\n`;
            output += `01/15/2024  02:30 PM    <DIR>          ..\n`;
            output += `01/10/2024  10:15 AM             1,234  server.js\n`;
            output += `01/12/2024  03:45 PM             5,678  client.py\n`;
            output += `01/14/2024  11:20 AM    <DIR>          Documents\n`;
            output += `01/13/2024  09:30 AM    <DIR>          Desktop\n`;
            output += `               2 File(s)          6,912 bytes\n`;
            output += `               4 Dir(s)  15,728,640,000 bytes free\n\n`;
            
        } else if (cmd.startsWith('echo')) {
            const message = cmd.replace('echo', '').trim().replace(/['"]/g, '');
            output += `${message}\n\n`;
            
        } else if (cmd.includes('ipconfig')) {
            output += `Windows IP Configuration\n\n`;
            output += `Ethernet adapter Ethernet:\n\n`;
            output += `   Connection-specific DNS Suffix  . : \n`;
            output += `   IPv4 Address. . . . . . . . . . . : 192.168.1.100\n`;
            output += `   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n`;
            output += `   Default Gateway . . . . . . . . . : 192.168.1.1\n\n`;
            
        } else if (cmd.includes('systeminfo')) {
            const client = clients.get(clientId);
            output += `Host Name:                 ${client?.name.replace(/\s+/g, '-').toUpperCase() || 'SERVER-01'}\n`;
            output += `OS Name:                   Windows Server 2019\n`;
            output += `OS Version:                10.0.17763 N/A Build 17763\n`;
            output += `System Type:               x64-based PC\n`;
            output += `Total Physical Memory:     8,192 MB\n`;
            output += `Available Physical Memory: 4,096 MB\n`;
            output += `Processor(s):              1 Processor(s) Installed.\n`;
            output += `                          [01]: Intel64 Family 6 Model 142 Stepping 10 GenuineIntel ~2400 Mhz\n\n`;
            
        } else if (cmd.includes('whoami')) {
            output += `SERVER-01\\Administrator\n\n`;
            
        } else if (cmd.includes('ping')) {
            const target = cmd.split(' ').pop() || 'google.com';
            output += `Pinging ${target} [142.250.191.14] with 32 bytes of data:\n\n`;
            output += `Reply from 142.250.191.14: bytes=32 time=23ms TTL=57\n`;
            output += `Reply from 142.250.191.14: bytes=32 time=25ms TTL=57\n`;
            output += `Reply from 142.250.191.14: bytes=32 time=24ms TTL=57\n`;
            output += `Reply from 142.250.191.14: bytes=32 time=22ms TTL=57\n\n`;
            output += `Ping statistics for 142.250.191.14:\n`;
            output += `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\n`;
            output += `Approximate round trip times in milli-seconds:\n`;
            output += `    Minimum = 22ms, Maximum = 25ms, Average = 23ms\n\n`;
            
        } else if (cmd.includes('tasklist')) {
            output += `Image Name                     PID Session Name        Session#    Mem Usage\n`;
            output += `========================= ======== ================ =========== ============\n`;
            output += `System Idle Process              0 Services                   0          8 K\n`;
            output += `System                           4 Services                   0        228 K\n`;
            output += `smss.exe                       324 Services                   0      1,036 K\n`;
            output += `csrss.exe                      424 Services                   0      4,176 K\n`;
            output += `winlogon.exe                   448 Services                   0      2,912 K\n`;
            output += `services.exe                   492 Services                   0      6,320 K\n`;
            output += `lsass.exe                      504 Services                   0     12,456 K\n\n`;
            
        } else {
            output += `'${cmd}' is not recognized as an internal or external command,\n`;
            output += `operable program or batch file.\n\n`;
        }
    });
    
    const runtime = ((Date.now() - startTime) + Math.random() * 1000) / 1000;
    
    return {
        output: output.trim(),
        error: code.includes('error') ? 'Command execution failed' : null,
        runtime: `${runtime.toFixed(2)}s`
    };
}

// API Routes
app.get('/api/clients', (req, res) => {
    const clientArray = Array.from(clients.values());
    res.json(clientArray);
});

app.get('/api/clients/:id', (req, res) => {
    const client = clients.get(req.params.id);
    if (!client) {
        return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
});

app.post('/api/execute', (req, res) => {
    const { clientId, language, code } = req.body;
    
    if (!clientId || !code) {
        return res.status(400).json({ message: 'Client ID and code are required' });
    }
    
    const client = clients.get(clientId);
    if (!client) {
        return res.status(404).json({ message: 'Client not found' });
    }
    
    if (client.status !== 'online') {
        return res.status(400).json({ message: 'Client is not online' });
    }
    
    const executionId = uuidv4();
    const execution = {
        id: executionId,
        clientId,
        language: language || 'cmd',
        code,
        status: 'running',
        output: null,
        error: null,
        runtime: null,
        executedAt: new Date().toISOString()
    };
    
    executions.set(executionId, execution);
    
    // Simulate execution with delay
    setTimeout(() => {
        const result = simulateCommand(code, clientId);
        execution.status = result.error ? 'failed' : 'completed';
        execution.output = result.output;
        execution.error = result.error;
        execution.runtime = result.runtime;
    }, 1000 + Math.random() * 2000);
    
    res.json(execution);
});

app.get('/api/executions/:id', (req, res) => {
    const execution = executions.get(req.params.id);
    if (!execution) {
        return res.status(404).json({ message: 'Execution not found' });
    }
    res.json(execution);
});

// Serve static files for root path
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote Code Executor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            background: #0a0a0a;
            color: #ffffff;
            height: 100vh;
            display: flex;
        }
        
        .sidebar {
            width: 300px;
            background: #1a1a1a;
            border-right: 1px solid #333;
            padding: 20px;
        }
        
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: #1a1a1a;
            padding: 20px;
            border-bottom: 1px solid #333;
        }
        
        .title {
            color: #4a9eff;
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .editor-container {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .editor-header {
            background: #1a1a1a;
            padding: 10px 20px;
            border-bottom: 1px solid #333;
            font-size: 14px;
            color: #ccc;
        }
        
        .editor {
            flex: 1;
            background: #000;
            color: #00ff00;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            border: none;
            outline: none;
            resize: none;
        }
        
        .controls {
            background: #1a1a1a;
            padding: 15px 20px;
            border-bottom: 1px solid #333;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .btn {
            background: #4a9eff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
        }
        
        .btn:hover {
            background: #357abd;
        }
        
        .btn:disabled {
            background: #666;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background: #666;
        }
        
        .btn-secondary:hover {
            background: #777;
        }
        
        .output-container {
            height: 300px;
            display: flex;
            flex-direction: column;
        }
        
        .output-header {
            background: #1a1a1a;
            padding: 10px 20px;
            border-bottom: 1px solid #333;
            font-size: 14px;
            color: #ccc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .output {
            flex: 1;
            background: #000;
            color: #00ff00;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        
        .client-item {
            background: #2a2a2a;
            border: 2px solid transparent;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .client-item:hover {
            background: #333;
        }
        
        .client-item.selected {
            border-color: #4a9eff;
            background: #2a3a4a;
        }
        
        .client-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .client-info {
            font-size: 12px;
            color: #ccc;
        }
        
        .status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 10px;
        }
        
        .status.online {
            background: #22c55e;
            color: white;
        }
        
        .status.offline {
            background: #ef4444;
            color: white;
        }
        
        .loading {
            color: #4a9eff;
        }
        
        .error {
            color: #ef4444;
        }
        
        .status-bar {
            background: #1a1a1a;
            padding: 10px 20px;
            border-top: 1px solid #333;
            font-size: 12px;
            color: #ccc;
            display: flex;
            justify-content: space-between;
        }
        
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #333;
            border-top: 2px solid #4a9eff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2 style="color: #4a9eff; margin-bottom: 20px;">🖥️ Remote Clients</h2>
        <div id="clients-list">
            <!-- Clients will be loaded here -->
        </div>
    </div>
    
    <div class="main-content">
        <div class="header">
            <div class="title">⚡ Remote Code Executor</div>
            <div id="connection-status" style="color: #ccc;">Loading clients...</div>
        </div>
        
        <div class="editor-container">
            <div class="editor-header">Command Input</div>
            <textarea id="code-editor" class="editor" placeholder="# Enter your commands here
# Examples:
dir
echo Hello World
ipconfig
systeminfo
whoami
ping google.com">dir
echo "Hello World"
ipconfig
systeminfo</textarea>
        </div>
        
        <div class="controls">
            <button id="execute-btn" class="btn">Execute Commands (Ctrl+Enter)</button>
            <button id="clear-editor-btn" class="btn btn-secondary">Clear Editor</button>
            <button id="clear-output-btn" class="btn btn-secondary">Clear Output</button>
            <div style="margin-left: auto; font-size: 14px;" id="status-text">Ready</div>
        </div>
        
        <div class="output-container">
            <div class="output-header">
                <span>Command Output</span>
                <span id="execution-status"></span>
            </div>
            <div id="output" class="output">C:\\> Ready to execute commands...</div>
        </div>
        
        <div class="status-bar">
            <span id="client-status">No client selected</span>
            <span id="exec-count">Executions: 0</span>
        </div>
    </div>

    <script>
        let clients = [];
        let selectedClient = null;
        let currentExecution = null;
        let isExecuting = false;
        let execCount = 0;

        // Load clients on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadClients();
            setupEventListeners();
        });

        function setupEventListeners() {
            document.getElementById('execute-btn').addEventListener('click', executeCode);
            document.getElementById('clear-editor-btn').addEventListener('click', () => {
                document.getElementById('code-editor').value = '';
            });
            document.getElementById('clear-output-btn').addEventListener('click', () => {
                document.getElementById('output').textContent = 'C:\\\\> Ready to execute commands...';
            });
            
            // Ctrl+Enter to execute
            document.getElementById('code-editor').addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.key === 'Enter') {
                    executeCode();
                }
            });
        }

        async function loadClients() {
            try {
                const response = await fetch('/api/clients');
                if (response.ok) {
                    clients = await response.json();
                    renderClients();
                    
                    // Auto-select first online client
                    const firstOnline = clients.find(c => c.status === 'online');
                    if (firstOnline) {
                        selectClient(firstOnline);
                    }
                } else {
                    document.getElementById('connection-status').textContent = 'Failed to load clients';
                }
            } catch (error) {
                document.getElementById('connection-status').textContent = 'Connection error';
            }
        }

        function renderClients() {
            const container = document.getElementById('clients-list');
            container.innerHTML = '';
            
            clients.forEach(client => {
                const item = document.createElement('div');
                item.className = 'client-item';
                item.innerHTML = \`
                    <div class="client-name">
                        \${client.name}
                        <span class="status \${client.status}">\${client.status.toUpperCase()}</span>
                    </div>
                    <div class="client-info">\${client.ip} • \${client.os}</div>
                \`;
                
                item.addEventListener('click', () => selectClient(client));
                container.appendChild(item);
            });
        }

        function selectClient(client) {
            selectedClient = client;
            
            // Update UI
            document.querySelectorAll('.client-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            event.currentTarget?.classList.add('selected');
            
            document.getElementById('connection-status').textContent = \`Connected to: \${client.name} (\${client.ip})\`;
            document.getElementById('client-status').textContent = \`Connected to \${client.name}\`;
            
            // Enable/disable execute button
            const executeBtn = document.getElementById('execute-btn');
            executeBtn.disabled = client.status !== 'online';
        }

        async function executeCode() {
            if (!selectedClient || isExecuting) return;
            
            const code = document.getElementById('code-editor').value.trim();
            if (!code) return;
            
            setExecuting(true);
            
            try {
                const response = await fetch('/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId: selectedClient.id,
                        language: 'cmd',
                        code: code
                    })
                });
                
                if (response.ok) {
                    const execution = await response.json();
                    currentExecution = execution;
                    
                    // Show executing status
                    document.getElementById('output').innerHTML = \`<span class="loading">C:\\\\> Executing command on \${selectedClient.name}...\\nPlease wait...</span>\`;
                    
                    // Poll for results
                    pollExecution(execution.id);
                } else {
                    throw new Error('Execution failed');
                }
            } catch (error) {
                document.getElementById('output').innerHTML = \`<span class="error">Error: \${error.message}</span>\`;
                setExecuting(false);
            }
        }

        async function pollExecution(executionId) {
            try {
                const response = await fetch(\`/api/executions/\${executionId}\`);
                if (response.ok) {
                    const execution = await response.json();
                    currentExecution = execution;
                    
                    if (execution.status === 'completed' || execution.status === 'failed') {
                        displayResult(execution);
                        setExecuting(false);
                        execCount++;
                        document.getElementById('exec-count').textContent = \`Executions: \${execCount}\`;
                    } else if (execution.status === 'running') {
                        setTimeout(() => pollExecution(executionId), 1000);
                    }
                }
            } catch (error) {
                document.getElementById('output').innerHTML = \`<span class="error">Polling failed: \${error.message}</span>\`;
                setExecuting(false);
            }
        }

        function displayResult(execution) {
            let output = \`C:\\\\> \${execution.code.split('\\n')[0]}\\n\\n\`;
            
            if (execution.output) {
                output += execution.output + '\\n\\n';
            }
            
            if (execution.error) {
                output += \`Error: \${execution.error}\\n\\n\`;
            }
            
            output += \`C:\\\\> Command \${execution.status}\`;
            if (execution.runtime) {
                output += \` in \${execution.runtime}\`;
            }
            
            document.getElementById('output').textContent = output;
        }

        function setExecuting(executing) {
            isExecuting = executing;
            const executeBtn = document.getElementById('execute-btn');
            const statusElement = document.getElementById('execution-status');
            
            if (executing) {
                executeBtn.innerHTML = '<span class="spinner"></span>Executing...';
                executeBtn.disabled = true;
                document.getElementById('status-text').textContent = 'Executing...';
                statusElement.innerHTML = '<span class="spinner"></span>Executing...';
            } else {
                executeBtn.innerHTML = 'Execute Commands (Ctrl+Enter)';
                executeBtn.disabled = !selectedClient || selectedClient.status !== 'online';
                document.getElementById('status-text').textContent = 'Ready';
                statusElement.textContent = '';
            }
        }
    </script>
</body>
</html>
    `);
});

module.exports = app;
