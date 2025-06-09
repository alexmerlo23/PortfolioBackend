// controllers/contactController.js
const { getDatabase, sql } = require('../config/database');
const emailjs = require('@emailjs/nodejs');

const submitContactForm = async (req, res) => {
  const { name, email, message } = req.body;
  
  try {
    // EmailJS configuration from environment variables
    const serviceId = process.env.serviceId;
    const templateId = process.env.templateId;
    const publicKey = process.env.publicKey;
    
    // Log EmailJS configuration (without exposing sensitive data)
    console.log('EmailJS Config:', {
      hasServiceId: !!serviceId,
      hasTemplateId: !!templateId,
      hasPublicKey: !!publicKey
    });
    
    const pool = await getDatabase();
    const request = pool.request();
    
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
      
      // EmailJS sending (only if config is available)
      serviceId && templateId && publicKey 
        ? emailjs.send(serviceId, templateId, {
            user_name: name,
            user_email: email,
            message: message,
            to_email: 'alexmerlo23@gmail.com' // Your email
          }, {
            publicKey: publicKey
          })
        : Promise.resolve({ status: 'skipped', reason: 'EmailJS config missing' })
    ]);
    
    // Check results
    const dbSuccess = dbResult.status === 'fulfilled';
    const emailSuccess = emailResult.status === 'fulfilled';
    
    let insertedRecord = null;
    
    if (dbSuccess) {
      insertedRecord = dbResult.value.recordset[0];
      
      // Log successful database submission
      console.log('Contact message saved:', {
        id: insertedRecord.ID,
        name: name.substring(0, 3) + '***',
        email: email.substring(0, 3) + '***',
        messageLength: message.length,
        timestamp: insertedRecord.CreatedAt,
        ip: req.ip
      });
    } else {
      console.error('Database error:', dbResult.reason);
    }
    
    if (emailSuccess) {
      console.log('Email sent successfully via EmailJS');
    } else {
      console.error('EmailJS error:', emailResult.reason);
    }
    
    // Determine response based on results
    if (dbSuccess) {
      res.status(201).json({
        success: true,
        message: 'Contact message sent successfully',
        id: insertedRecord.ID,
        timestamp: insertedRecord.CreatedAt,
        emailSent: emailSuccess
      });
    } else {
      // Database failed
      throw dbResult.reason;
    }
    
  } catch (error) {
    console.error('Error in contact submission:', {
      error: error.message,
      code: error.code,
      name: error.name,
      email: email ? email.substring(0, 3) + '***' : 'unknown',
      ip: req.ip
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
  // Optional: Add authentication middleware here
  // This endpoint could be used for an admin dashboard
  
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