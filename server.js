// server.js
const express = require('express');
const cors = require('cors');
const { initializeDatabase, closeDatabase } = require('./config/database');
const { setupMiddleware } = require('./middleware/security');
const contactRoutes = require('./routes/contact');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandlers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Add CORS at the very beginning
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(200);
});

// Setup other middleware
setupMiddleware(app);

// Test endpoint to verify CORS
app.get('/api/test', (req, res) => {
  res.json({
    message: 'CORS test successful!',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// Routes - Mount contact routes at /api
app.use('/api', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  try {
    await closeDatabase();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`CORS test: http://localhost:${PORT}/api/test`);
      console.log(`Contact API: http://localhost:${PORT}/api/contact`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();