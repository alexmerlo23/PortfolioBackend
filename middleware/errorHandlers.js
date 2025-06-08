// middleware/errorHandlers.js

const errorHandler = (error, req, res, next) => {
    console.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: isDevelopment ? error.message : 'Invalid input data'
      });
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEOUT') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        details: isDevelopment ? error.message : 'Please try again later'
      });
    }
    
    if (error.message && error.message.includes('CORS')) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'Request not allowed from this origin'
      });
    }
  
    // Database errors
    if (error.code && (error.code.startsWith('EREQUEST') || error.code === 'ELOGIN')) {
      return res.status(503).json({
        error: 'Database connection issue',
        details: 'Please try again later'
      });
    }
  
    // Default server error
    res.status(500).json({
      error: 'Internal server error',
      details: isDevelopment ? error.message : 'Something went wrong',
      ...(isDevelopment && { stack: error.stack })
    });
  };
  
  const notFoundHandler = (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  };
  
  // Async error wrapper
  const asyncHandler = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
  };