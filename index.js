require('dotenv').config();
// Basic health check to see if we are alive even without vars
console.log('[Server] Starting boot sequence...');
const express = require('express');
const cors = require('cors');
const pluggyRoutes = require('./api/pluggy');

const app = express();
const PORT = process.env.PORT || 3001;
const { limiter, securityHeaders } = require('./middleware/security');

// Security Middleware
app.use(securityHeaders);
// Permissive CORS for production/mobile access
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-requested-with'],
    credentials: true
}));

// Body parser with size limit
app.use(express.json({ limit: '50mb' })); // Increased for potential transaction batching

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/pluggy', pluggyRoutes);
app.use('/api/asaas', require('./api/asaas'));

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`
    Aplicativo Controlar está rodando na porta ${PORT}  
    
    Endpoints rodando:
    • POST /api/pluggy/sync
    • GET  /api/pluggy/items/:id
    • POST /api/pluggy/create-item
    • GET  /api/pluggy/connectors 
    • POST /api/asaas/webhook
    • GET  /health  
  `);
});

module.exports = app;
