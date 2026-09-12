require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initializeDatabase } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const accountRoutes = require('./routes/accountRoutes');


const app = express();
const PORT = process.env.PORT || 8001;

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for SPA
    crossOriginEmbedderPolicy: false
}));

// ─── CORS ──────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// ─── Compression ───────────────────────────────────────────────
app.use(compression());

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// ─── Body Parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger (Dev Only) ─────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            console.log(`  ${req.method} ${req.path}`);
        }
        next();
    });
}

// ─── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/admin', accountRoutes);


// ─── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ─── Server Information ────────────────────────────────────────
app.get('/api/info', (req, res) => {
    res.json({
        name: 'AAI VABO IT Asset Manager',
        version: '2.0.0',
        node: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
    });
});

// ─── Serve Frontend Static Files ───────────────────────────────
app.use(express.static(path.join(__dirname, 'Public'), {
    maxAge: 0,        // No browser caching — always validate with server
    etag: true,       // Use ETags for efficient conditional requests
    lastModified: true
}));

// ─── 404 / SPA Fallback ───────────────────────────────────────
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.use(notFound);

// ─── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────
async function start() {
    await initializeDatabase();

    const server = app.listen(PORT, () => {
        console.log('');
        console.log('  ╔══════════════════════════════════════════╗');
        console.log('  ║   AAI VABO IT Asset Manager v2.0.0      ║');
        console.log('  ╠══════════════════════════════════════════╣');
        console.log(`  ║   🌐 http://localhost:${PORT}              ║`);
        console.log(`  ║   📁 Environment: ${(process.env.NODE_ENV || 'development').padEnd(18)}  ║`);
        console.log('  ║   Accounts: /accounts.html              ║');
        console.log('  ╚══════════════════════════════════════════╝');
        console.log('');
    });

    // ─── Graceful Shutdown ─────────────────────────────────────
    const shutdown = (signal) => {
        console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
        server.close(() => {
            const { db } = require('./config/db');
            db.close(() => {
                console.log('✅ Database connection closed.');
                process.exit(0);
            });
        });
        // Force shutdown after 10 seconds
        setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
