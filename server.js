// server.js
const express = require('express');
const { initializeDatabase, closeDatabase } = require('./config/database');
const { setupMiddleware } = require('./middleware/security');
const contactRoutes = require('./routes/contact');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandlers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Setup middleware
setupMiddleware(app);

// Routes - Mount contact routes under /api/contact
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Portfolio Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      contact: '/api/contact',
      contactMessages: '/api/contact/messages',
      contactStats: '/api/contact/stats',
      contactTest: '/api/contact/test'
    }
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
      console.log(`Contact API: http://localhost:${PORT}/api/contact`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();