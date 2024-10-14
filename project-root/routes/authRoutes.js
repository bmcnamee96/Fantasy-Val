// #region Dependencies
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const { JWT_SECRET } = require('../utils/auth');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Endpoint to register a new user
router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password || !email) {
    logger.warn('Signup attempt with missing username, password, or email');
    return res.status(400).json({ success: false, message: 'Username, password, and email are required' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, email }])
      .select('user_id');

    if (error) {
      throw error;
    }

    const user = data[0];
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
    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, password')
      .eq('username', username)
      .single(); // Fetch single record

    if (error || !data) {
      logger.warn(`Invalid username attempt: ${username}`);
      return res.status(401).send('Invalid username or password');
    }

    const user = data;
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (isValidPassword) {
      const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
      logger.info(`User signed in: ${username}`);
      res.status(200).json({ token, username: user.username });
    } else {
      logger.warn(`Invalid password attempt for user: ${username}`);
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
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single(); // Fetch single record

    if (error || !data) {
      logger.warn('Email not found in the database:', email);
      return res.status(400).json({ message: 'Email not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .upsert([{ email, token, created_at: new Date() }], { onConflict: ['email'] });

    if (tokenError) {
      throw tokenError;
    }

    await sendPasswordResetEmail(email, token);

    logger.info('Password recovery email sent to:', email);
    res.status(200).json({ message: 'Password recovery email sent' });
  } catch (error) {
    logger.error('Error handling password recovery:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
