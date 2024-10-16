// db.js
const { Pool } = require('pg');
require('dotenv').config(); // To load environment variables from .env file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessary for Heroku Postgres in production
  },
});

module.exports = pool;
