// routes/contact.js
const express = require('express');
const { contactLimiter } = require('../middleware/security');
const { validateContactForm } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandlers');
const { 
  submitContactForm, 
  getContactMessages, 
  getContactStats 
} = require('../controllers/contactController');

const router = express.Router();

// POST /api/contact - Submit contact form
router.post('/contact', 
  contactLimiter,
  validateContactForm,
  asyncHandler(submitContactForm)
);

// GET /api/contact/messages - Get all contact messages (Admin endpoint)
// Note: In production, add authentication middleware here
router.get('/contact/messages', 
  asyncHandler(getContactMessages)
);

// GET /api/contact/stats - Get contact form statistics
router.get('/contact/stats',
  asyncHandler(getContactStats)
);

// Test endpoint for API connectivity
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;