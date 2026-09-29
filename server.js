const express = require('express');
const http = require('node:http');
const path = require('node:path');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const { initializeDatabase } = require('./src/config/database');
const apiRoutes = require('./src/routes/apiRoutes');
const orchestrator = require('./src/services/SkillOrchestrator');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize database schema and default records
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Static Frontend Views
app.use(express.static(path.join(__dirname, 'src', 'views')));

// Default route fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'src', 'views', 'index.html'));
});

// WebSocket Server for Real-Time Skill Telemetry & Events
const wss = new WebSocketServer({ server, path: '/ws/events' });
wss.on('connection', (ws) => {
  orchestrator.registerWebSocket(ws);
  ws.send(JSON.stringify({
    event: 'CONNECTED',
    payload: { message: 'Agentic Skill Execution Stream connected.' },
    timestamp: new Date().toISOString()
  }));
});

// Start Server
server.listen(PORT, () => {
  console.log('====================================================');
  console.log('🍧 PÔR DO AÇAÍ - POS & AGENTIC SKILL EXECUTION 🍧');
  console.log('====================================================');
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket de Agentes: ws://localhost:${PORT}/ws/events`);
  console.log('====================================================');
});
