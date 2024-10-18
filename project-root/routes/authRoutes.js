const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail } = require('../services/emailService');
const { JWT_SECRET, REFRESH_TOKEN_SECRET } = require('../utils/auth');
const logger = require('../utils/logger');
const pool = require('../db'); // Database connection

const router = express.Router();

// Helper Functions to Generate Tokens
function generateAccessToken(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
  console.log('Access Token:', token); // Log token for debugging
  return token;
}

async function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
  );

  console.log('Refresh Token:', token); // Log token for debugging
  return token;
}

// #endregion

// Signup Endpoint
router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        logger.warn('Signup attempt with missing username, password, or email');
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING user_id`,
            [username, hashedPassword, email]
        );

        const user = result.rows[0];
        logger.info(`User registered: ${username}`);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        logger.error('Error registering user:', error.message);
        res.status(500).send('Error registering user');
    }
});

// Signin Endpoint with Access and Refresh Token Generation
router.post('/signin', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT user_id, password FROM users WHERE username = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user.user_id);

        const refreshToken = await generateRefreshToken(user.user_id);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Send both access token and username in the response
        res.status(200).json({ 
          accessToken: accessToken, 
          username: username 
        });
    } catch (error) {
        logger.error('Error signing in:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh Token Endpoint
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
  }

  try {
      // Query the database to verify the refresh token
      const result = await pool.query(
          `SELECT user_id, expires_at, is_valid 
           FROM refresh_tokens 
           WHERE token = $1`,
          [refreshToken]
      );

      // Check if the token exists and is valid
      if (result.rows.length === 0 || !result.rows[0].is_valid) {
          res.clearCookie('refreshToken');  // Clear the cookie if invalid
          return res.status(403).json({ error: 'Invalid or expired refresh token' });
      }

      const tokenData = result.rows[0];

      // Check if the token has expired
      if (new Date() > tokenData.expires_at) {
          res.clearCookie('refreshToken');  // Clear the cookie if expired
          return res.status(401).json({ error: 'Refresh token expired' });
      }

      // Generate a new access token
      const newAccessToken = generateAccessToken(tokenData.user_id);

      // Return the new access token
      res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
      logger.error('Error refreshing token:', error.message);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout Endpoint to Invalidate Refresh Token
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.cookies;

    try {
        await pool.query(`UPDATE refresh_tokens SET is_valid = FALSE WHERE token = $1`, [refreshToken]);

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
        });

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Error during logout:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Password Recovery Endpoint
router.post('/recover-password', async (req, res) => {
    const { email } = req.body;

    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

        if (result.rowCount === 0) {
            return res.status(400).json({ message: 'Email not found' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        await pool.query(
            `INSERT INTO password_reset_tokens (email, token) VALUES ($1, $2) 
             ON CONFLICT (email) DO UPDATE SET token = $2, created_at = NOW()`,
            [email, token]
        );

        await sendPasswordResetEmail(email, token);
        res.status(200).json({ message: 'Password recovery email sent' });
    } catch (error) {
        logger.error('Error handling password recovery:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
