// middleware/security.js
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const express = require('express');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'https://alexsportfoliowebsite.netlify.app',
      'https://orange-coast-0ff57da0f.6.azurestaticapps.net', // Your actual frontend URL
    ].filter(Boolean);
    
    // Check if origin matches any allowed origin (including regex patterns)
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Rate limiting for contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many contact form submissions from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests in count
  skip: (req, res) => res.statusCode < 400
});

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

const setupMiddleware = (app) => {
  // Trust proxy if behind reverse proxy (for rate limiting and CORS)
  app.set('trust proxy', 1);

  // CORS - Apply this FIRST before other middleware
  app.use(cors(corsOptions));

  // Handle preflight requests explicitly
  app.options('*', cors(corsOptions));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // General rate limiting
  app.use(generalLimiter);

  console.log('Security middleware configured');
  console.log('CORS origins:', corsOptions.origin);
};

module.exports = {
  setupMiddleware,
  contactLimiter
};