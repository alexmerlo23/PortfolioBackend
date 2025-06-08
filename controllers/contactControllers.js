// controllers/contactController.js
const { getDatabase, sql } = require('../config/database');

const submitContactForm = async (req, res) => {
  const { name, email, message } = req.body;
  
  try {
    const pool = await getDatabase();
    const request = pool.request();
    
    // Insert contact message into database
    const result = await request
      .input('name', sql.NVarChar(100), name)
      .input('email', sql.NVarChar(255), email)
      .input('message', sql.NVarChar(sql.MAX), message)
      .query(`
        INSERT INTO ContactMessages (Name, Email, Message) 
        OUTPUT INSERTED.ID, INSERTED.CreatedAt
        VALUES (@name, @email, @message)
      `);
    
    const insertedRecord = result.recordset[0];
    
    // Log successful submission (with privacy protection)
    console.log('Contact message saved:', {
      id: insertedRecord.ID,
      name: name.substring(0, 3) + '***',
      email: email.substring(0, 3) + '***',
      messageLength: message.length,
      timestamp: insertedRecord.CreatedAt,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Contact message sent successfully',
      id: insertedRecord.ID,
      timestamp: insertedRecord.CreatedAt
    });
    
  } catch (error) {
    console.error('Database error in contact submission:', {
      error: error.message,
      code: error.code,
      name: error.name,
      email: email.substring(0, 3) + '***',
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
    
    // Generic database error
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