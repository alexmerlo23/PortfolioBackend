// middleware/validation.js

const validateContactForm = (req, res, next) => {
    const { name, email, message } = req.body;
    
    // Check if all required fields are present
    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'All fields (name, email, message) are required',
        missing: {
          name: !name,
          email: !email,
          message: !message
        }
      });
    }
    
    // Type validation
    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return res.status(400).json({
        error: 'All fields must be strings'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }
    
    // Validate field lengths
    if (name.length > 100) {
      return res.status(400).json({
        error: 'Name must be less than 100 characters'
      });
    }
    
    if (name.length < 2) {
      return res.status(400).json({
        error: 'Name must be at least 2 characters long'
      });
    }
    
    if (email.length > 255) {
      return res.status(400).json({
        error: 'Email must be less than 255 characters'
      });
    }
    
    if (message.length > 4000) {
      return res.status(400).json({
        error: 'Message must be less than 4000 characters'
      });
    }
    
    if (message.length < 10) {
      return res.status(400).json({
        error: 'Message must be at least 10 characters long'
      });
    }
    
    // Sanitize inputs (basic XSS prevention)
    req.body.name = name.trim().replace(/[<>]/g, '');
    req.body.email = email.trim().toLowerCase();
    req.body.message = message.trim().replace(/[<>]/g, '');
    
    // Additional validation: check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i
    ];
    
    const allText = `${req.body.name} ${req.body.email} ${req.body.message}`;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(allText)) {
        return res.status(400).json({
          error: 'Invalid characters detected in form data'
        });
      }
    }
    
    console.log('Contact form validation passed for:', {
      name: req.body.name,
      email: req.body.email.substring(0, 3) + '***', // Log partial email for privacy
      messageLength: req.body.message.length
    });
    
    next();
  };
  
  module.exports = {
    validateContactForm
  };