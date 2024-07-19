const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('./services/emailService.js');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Example route for serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

// Endpoint to register a new user
app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    await pool.query(
      `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING user_id`,
      [username, hashedPassword, email]
    );
    res.status(201).send('User registered successfully');
  } catch (err) {
    console.error('Error registering user:', err.message, err.stack);
    res.status(500).send('Error registering user');
  }
});

// Endpoint to sign in a user
app.post('/api/signin', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT user_id, username, password FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (isValidPassword) {
        res.status(200).json({ username: user.username });
      } else {
        res.status(401).send('Invalid username or password');
      }
    } else {
      res.status(401).send('Invalid username or password');
    }
  } catch (err) {
    console.error('Error signing in user:', err.message, err.stack);
    res.status(500).send('Error signing in user');
  }
});

// POST endpoint for password recovery initiation
app.post('/api/recover-password', async (req, res) => {
  const { email } = req.body;
  console.log('Email:', email); // Log the extracted email
  console.log('Password recovery request received:', req.body); // Log the request body
  try {
      const client = await pool.connect();

      // Check if the email exists in the database
      const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userResult.rowCount === 0) {
          client.release();
          console.log('Email not found in the database');
          return res.status(400).json({ message: 'Email not found' });
      }

      // Generate a token
      const token = crypto.randomBytes(20).toString('hex');

      // Insert token into the database
      await client.query(
        'INSERT INTO password_reset_tokens (email, token) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET token = $2, created_at = NOW()',
        [email, token]
      );
      
      client.release();

    // Call the email service function to send the password reset email
    await sendPasswordResetEmail(email, token);

    res.status(200).json({ message: 'Password recovery email sent' });
  } catch (error) {
    console.error('Error handling password recovery:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint to get player stats
app.get('/api/player-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;
    console.log('Received team_abrev:', team_abrev); // Debug log
    let query = `
      WITH PlayerStats AS (
        SELECT 
          p.player_name,
          t.team_abrev,
          ts.total_maps_played,
          ts.total_kills,
          ts.total_deaths,
          ts.total_assists,
          ts.total_fk,
          ts.total_fd,
          ts.total_clutches,
          ts.total_aces,
          ts.total_adr,
          ROUND(CAST(ts.total_points AS NUMERIC), 2) AS total_points
        FROM total_stats ts
        JOIN player p ON ts.player_id = p.player_id
        JOIN teams t ON p.team_abrev = t.team_abrev
      )
      SELECT * FROM PlayerStats
    `;
    if (team_abrev) {
      query += ` WHERE team_abrev = $1 ORDER BY total_points DESC`;
      result = await pool.query(query, [team_abrev]);
    } else {
      query += ` ORDER BY total_points DESC`;
      result = await pool.query(query);
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err.message, err.stack);
    res.status(500).send('Error executing query');
  }
});

// API endpoint to get worst players
app.get('/api/worst-players', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH PlayerStats AS (
        SELECT 
          p.player_name, 
          ROUND(CAST(
            (SUM(ps.kills) * 1) +
            (SUM(ps.assists) * 0.5) - 
            (SUM(ps.deaths) * 0.5) + 
            (SUM(ps.fk) * 2) - 
            (SUM(ps.fd) * 1) + 
            (SUM(ps.clutches) * 2) + 
            (SUM(ps.aces) * 3) + 
            (ROUND(CAST(AVG(ps.adr) AS numeric), 2) * 0.1)
          AS numeric), 2) AS points
        FROM 
          players p
        JOIN 
          player_stats ps 
        ON 
          p.player_id = ps.player_id
        GROUP BY 
          p.player_name
      )
      SELECT 
        player_name,
        points
      FROM 
        PlayerStats
      ORDER BY 
        points ASC
      LIMIT 5;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err.message, err.stack);
    res.status(500).send('Error executing query');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
