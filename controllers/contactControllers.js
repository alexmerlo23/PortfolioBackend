// controllers/contactController.js
const { getDatabase, sql } = require('../config/database');
const emailjs = require('@emailjs/nodejs');

// Initialize EmailJS once when module loads
const initializeEmailJS = () => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  
  if (serviceId && templateId && publicKey && privateKey) {
    emailjs.init({
      publicKey: publicKey,
      privateKey: privateKey, // Must be enabled in EmailJS Account Security settings
      blockList: {
        list: [], // Add blocked emails if needed
      },
      limitRate: {
        throttle: 10000, // 10 seconds between emails (optional)
      },
    });
    console.log('EmailJS initialized successfully');
    return true;
  } else {
    console.warn('EmailJS not initialized - missing environment variables');
    return false;
  }
};

// Initialize on module load
const emailJSConfigured = initializeEmailJS();

const submitContactForm = async (req, res) => {
  const { name, email, message } = req.body;
  
  // Azure-compatible logging with timestamps
  const log = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    console.log(`[${timestamp}] [${level}] ${message}`, data);
  };
  
  log('INFO', '🚀 Contact form submission started', { 
    hasName: !!name, 
    hasEmail: !!email, 
    messageLength: message?.length || 0 
  });
  
  try {
    // EmailJS configuration check
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    
    log('INFO', 'EmailJS Configuration Status', { 
      fullyConfigured: emailJSConfigured,
      hasServiceId: !!serviceId,
      hasTemplateId: !!templateId,
      initialized: emailJSConfigured
    });
    
    const pool = await getDatabase();
    const request = pool.request();
    
    // Prepare email template parameters
    const emailTemplateParams = {
      user_name: name,
      user_email: email,
      message: message,
      to_email: 'alexmerlo23@gmail.com', // Your email
      reply_to: email,
      subject: `New Contact Form Message from ${name}`
    };
    
    log('INFO', 'Email Template Parameters Prepared', {
      user_name: name,
      user_email: email,
      message_length: message.length,
      to_email: 'alexmerlo23@gmail.com'
    });
    
    // Execute database insert and EmailJS simultaneously
    const [dbResult, emailResult] = await Promise.allSettled([
      // Database insertion
      request
        .input('name', sql.NVarChar(100), name)
        .input('email', sql.NVarChar(255), email)
        .input('message', sql.NVarChar(sql.MAX), message)
        .query(`
          INSERT INTO ContactMessages (Name, Email, Message) 
          OUTPUT INSERTED.ID, INSERTED.CreatedAt
          VALUES (@name, @email, @message)
        `),
      
      // EmailJS sending (only if configured and initialized)
      emailJSConfigured 
        ? (async () => {
            log('INFO', 'Attempting to send email via EmailJS (server-side)', {
              serviceId: serviceId,
              templateId: templateId,
              initialized: true
            });
            
            try {
              // Correct server-side usage - keys already set in init()
              const emailResponse = await emailjs.send(
                serviceId, 
                templateId, 
                emailTemplateParams
                // No options parameter needed - keys set in init()
              );
              
              log('INFO', 'EmailJS response received', {
                status: emailResponse.status,
                text: emailResponse.text
              });
              
              return emailResponse;
            } catch (emailError) {
              log('ERROR', 'EmailJS send failed', {
                error: emailError.message,
                status: emailError.status,
                text: emailError.text,
                fullError: emailError
              });
              throw emailError;
            }
          })()
        : Promise.resolve({ 
            status: 'skipped', 
            reason: 'EmailJS not properly configured or initialized'
          })
    ]);
    
    // Check results with detailed logging
    const dbSuccess = dbResult.status === 'fulfilled';
    const emailSuccess = emailResult.status === 'fulfilled';
    
    log('INFO', 'Operation Results', {
      databaseSuccess: dbSuccess,
      emailSuccess: emailSuccess,
      emailSkipped: emailResult.value?.status === 'skipped'
    });
    
    let insertedRecord = null;
    
    if (dbSuccess) {
      insertedRecord = dbResult.value.recordset[0];
      
      log('INFO', 'Contact message saved to database', {
        id: insertedRecord.ID,
        name: name.substring(0, 3) + '***',
        email: email.substring(0, 3) + '***',
        messageLength: message.length,
        timestamp: insertedRecord.CreatedAt,
        ip: req.ip
      });
    } else {
      log('ERROR', 'Database operation failed', {
        error: dbResult.reason?.message || dbResult.reason
      });
    }
    
    if (emailSuccess && emailResult.value.status !== 'skipped') {
      log('INFO', 'Email sent successfully via EmailJS', {
        status: emailResult.value.status,
        text: emailResult.value.text
      });
    } else if (emailResult.value?.status === 'skipped') {
      log('INFO', 'Email sending skipped - configuration incomplete');
    } else {
      log('ERROR', 'EmailJS operation failed', {
        error: emailResult.reason?.message || emailResult.reason,
        status: emailResult.reason?.status,
        text: emailResult.reason?.text
      });
    }
    
    // Determine response based on results
    if (dbSuccess) {
      const responseData = {
        success: true,
        message: 'Contact message sent successfully',
        id: insertedRecord.ID,
        timestamp: insertedRecord.CreatedAt,
        emailSent: emailSuccess && emailResult.value.status !== 'skipped',
        emailConfigured: emailJSConfigured,
        // Debug info - remove in production
        debug: {
          emailJSInitialized: emailJSConfigured,
          emailResult: emailResult.status === 'fulfilled' ? {
            status: emailResult.value.status,
            text: emailResult.value.text,
            wasSkipped: emailResult.value.status === 'skipped'
          } : {
            rejected: true,
            error: emailResult.reason?.message || 'Unknown error',
            status: emailResult.reason?.status,
            text: emailResult.reason?.text
          }
        }
      };
      
      log('INFO', 'Sending success response', responseData);
      res.status(201).json(responseData);
    } else {
      // Database failed
      throw dbResult.reason;
    }
    
  } catch (error) {
    const log = (level, message, data = {}) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level}] ${message}`, data);
    };
    
    log('ERROR', 'Contact Submission Error', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      requestDetails: {
        email: email ? email.substring(0, 3) + '***' : 'unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    // Handle specific database errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEOUT') {
      return res.status(503).json({
        error: 'Database connection issue. Please try again later.'
      });
    }
    
    if (error.code && error.code.startsWith('EREQUEST')) {
      return res.status(500).json({
        error: 'Database query failed. Please try again later.'
      });
    }
    
    // Generic error
    res.status(500).json({
      error: 'Failed to save contact message. Please try again later.'
    });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const pool = await getDatabase();
    const request = pool.request();
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await request.query('SELECT COUNT(*) as total FROM ContactMessages');
    const total = countResult.recordset[0].total;
    
    // Get paginated results
    const result = await request
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT ID, Name, Email, Message, CreatedAt 
        FROM ContactMessages 
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    console.log(`Retrieved ${result.recordset.length} contact messages (page ${page})`);
    
    res.status(200).json({
      success: true,
      messages: result.recordset,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Database error retrieving contact messages:', error);
    res.status(500).json({
      error: 'Failed to retrieve messages'
    });
  }
};

const getContactStats = async (req, res) => {
  try {
    const pool = await getDatabase();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT 
        COUNT(*) as totalMessages,
        COUNT(CASE WHEN CreatedAt >= DATEADD(day, -7, GETDATE()) THEN 1 END) as lastWeek,
        COUNT(CASE WHEN CreatedAt >= DATEADD(day, -30, GETDATE()) THEN 1 END) as lastMonth,
        MAX(CreatedAt) as lastMessage
      FROM ContactMessages
    `);
    
    res.status(200).json({
      success: true,
      stats: result.recordset[0]
    });
    
  } catch (error) {
    console.error('Database error retrieving contact stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
};

module.exports = {
  submitContactForm,
  getContactMessages,
  getContactStats
};