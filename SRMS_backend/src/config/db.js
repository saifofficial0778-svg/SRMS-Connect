const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10), 
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 30,
  queueLimit: 0,
  connectTimeout: 20000 
});

module.exports = pool.promise(); 