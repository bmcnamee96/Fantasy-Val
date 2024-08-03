// routes/authRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const { JWT_SECRET } = require('../utils/auth');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const router = express.Router();

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

// Endpoint to register a new user
router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password || !email) {
    logger.warn('Signup attempt with missing username, password, or email');
    return res.status(400).json({ success: false, message: 'Username, password, and email are required' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING user_id`,
      [username, hashedPassword, email]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });

    logger.info(`User registered: ${username}`);
    res.status(201).json({ token });
  } catch (err) {
    logger.error('Error registering user:', err.message, err.stack);
    res.status(500).send('Error registering user');
  }
});

// Endpoint to sign in a user
router.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    logger.warn('Signin attempt with missing username or password');
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  try {
    const result = await pool.query(
      `SELECT user_id, username, password FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (isValidPassword) {
        const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
        logger.info(`User signed in: ${username}`);
        res.status(200).json({ token, username: user.username });
      } else {
        logger.warn(`Invalid password attempt for user: ${username}`);
        res.status(401).send('Invalid username or password');
      }
    } else {
      logger.warn(`Invalid username attempt: ${username}`);
      res.status(401).send('Invalid username or password');
    }
  } catch (err) {
    logger.error('Error signing in user:', err.message, err.stack);
    res.status(500).send('Error signing in user');
  }
});

// POST endpoint for password recovery initiation
router.post('/recover-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    logger.warn('Password recovery request missing email');
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  logger.info('Password recovery request received for email:', email);

  try {
    const client = await pool.connect();

    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      client.release();
      logger.warn('Email not found in the database:', email);
      return res.status(400).json({ message: 'Email not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');

    await client.query(
      'INSERT INTO password_reset_tokens (email, token) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET token = $2, created_at = NOW()',
      [email, token]
    );
    
    client.release();

    await sendPasswordResetEmail(email, token);

    logger.info('Password recovery email sent to:', email);
    res.status(200).json({ message: 'Password recovery email sent' });
  } catch (error) {
    logger.error('Error handling password recovery:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
