// routes/contact.js
const express = require('express');
const { contactLimiter } = require('../middleware/security');
const { validateContactForm } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandlers');
const { 
  submitContactForm, 
  getContactMessages, 
  getContactStats 
} = require('../controllers/contactControllers');

const router = express.Router();

// POST /api/contact - Submit contact form
// Changed from '/contact' to '/' since we're already under '/api/contact'
router.post('/', 
  contactLimiter,
  validateContactForm,
  asyncHandler(submitContactForm)
);

// GET /api/contact/messages - Get all contact messages (Admin endpoint)
router.get('/messages', 
  asyncHandler(getContactMessages)
);

// GET /api/contact/stats - Get contact form statistics
router.get('/stats',
  asyncHandler(getContactStats)
);

// Test endpoint for API connectivity
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Contact API is working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;