const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients and their WebSocket connections
const connectedClients = new Map();
const clientSockets = new Map(); // clientId -> WebSocket

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register') {
                const clientId = data.clientId;
                clientSockets.set(clientId, ws);
                connectedClients.set(clientId, {
                    ...data.clientInfo,
                    id: clientId,
                    status: 'online',
                    lastSeen: new Date()
                });
                
                console.log(`Client registered: ${clientId}`);
                ws.send(JSON.stringify({
                    type: 'registered',
                    clientId: clientId,
                    success: true
                }));
                
                // Update clients list in main storage
                clients.set(clientId, connectedClients.get(clientId));
            }
            
            if (data.type === 'execution_result') {
                const execution = executions.get(data.executionId);
                if (execution) {
                    execution.status = data.status;
                    execution.output = data.output;
                    execution.error = data.error;
                    execution.runtime = data.runtime;
                    console.log(`Execution ${data.executionId} completed`);
                }
            }
            
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        // Find and remove disconnected client
        for (const [clientId, socket] of clientSockets.entries()) {
            if (socket === ws) {
                clientSockets.delete(clientId);
                if (connectedClients.has(clientId)) {
                    const client = connectedClients.get(clientId);
                    client.status = 'offline';
                    clients.set(clientId, client);
                }
                console.log(`Client disconnected: ${clientId}`);
                break;
            }
        }
    });
});

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
    
    // Try to send command to real client via WebSocket
    const clientSocket = clientSockets.get(clientId);
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
            type: 'execute',
            executionId: executionId,
            code: code,
            language: language || 'cmd'
        }));
    } else {
        // Fallback to simulation for mock clients
        setTimeout(() => {
            const result = simulateCommand(code, clientId);
            execution.status = result.error ? 'failed' : 'completed';
            execution.output = result.output;
            execution.error = result.error;
            execution.runtime = result.runtime;
        }, 1000 + Math.random() * 2000);
    }
    
    res.json(execution);
});

app.get('/api/executions/:id', (req, res) => {
    const execution = executions.get(req.params.id);
    if (!execution) {
        return res.status(404).json({ message: 'Execution not found' });
    }
    res.json(execution);
});

const path = require('path');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export both app and server for Vercel
module.exports = app;
module.exports.server = server;
