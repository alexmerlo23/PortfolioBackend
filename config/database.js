// config/database.js
const sql = require('mssql');

// Database configuration
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

const initializeDatabase = async () => {
  try {
    poolPromise = new sql.ConnectionPool(dbConfig);
    await poolPromise.connect();
    console.log('Connected to Azure SQL Database');
    console.log(`Database: ${process.env.DB_DATABASE}`);
    console.log(`Server: ${process.env.DB_SERVER}`);
    return poolPromise;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

const getDatabase = async () => {
  if (!poolPromise) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return poolPromise;
};

const closeDatabase = async () => {
  if (poolPromise) {
    await poolPromise.close();
    poolPromise = null;
    console.log('Database connection pool closed');
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  sql
};