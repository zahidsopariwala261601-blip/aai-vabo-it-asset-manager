function errorHandler(err, req, res, next) {
    console.error(`❌ [${new Date().toISOString()}] ${err.message}`);

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

function notFound(req, res) {
    // Check if request is for API
    if (req.path.toLowerCase().startsWith('/api')) {
        return res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
    }
    
    // For non-API routes, serve the SPA
    const path = require('path');
    const publicPath = path.join(__dirname, '..', 'Public', 'index.html');
    
    // Safety check if file exists, otherwise send plain 404
    const fs = require('fs');
    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else {
        res.status(404).send('Not Found');
    }
}

module.exports = { errorHandler, notFound };
