const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('./services/emailService.js');
const path = require('path');
const { expressjwt: expressJwt } = require('express-jwt');
const { JWT_SECRET } = require('./utils/auth'); // Import your JWT secret
const League = require('./models/leagues.js');
const leagueRoutes = require('./routes/leagueRoutes.js');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./middleware/authMiddleware'); // Adjust path if necessary


const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// JWT Middleware - Apply only to specific routes
app.use(expressJwt({
  secret: JWT_SECRET,
  algorithms: ['HS256']
}).unless({
  path: [
    '/',
    '/index.html', // Exclude index.html
    '/api/signup', 
    '/api/signin',
    '/api/recover-password', // Assuming you want this to be public as well
    '/api/player-stats', // Assuming you want this to be public as well
    '/api/match-stats'  // Assuming you want this to be public as well
  ]
}));

// Add this middleware to extract userId from JWT
app.use((req, res, next) => {
  if (req.user) {
    req.userId = req.user.userId; // Ensure this matches the JWT payload
  } else {
    req.userId = null;
  }
  next();
});

// Routes
app.use('/', leagueRoutes);

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

// Error handling middleware for JWT
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('Invalid or missing token');
  } else {
    next(err);
  }
});

// Endpoint to register a new user
app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING user_id`,
      [username, hashedPassword, email]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token });
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
        const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, username: user.username });
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

      const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userResult.rowCount === 0) {
          client.release();
          console.log('Email not found in the database');
          return res.status(400).json({ message: 'Email not found' });
      }

      const token = crypto.randomBytes(20).toString('hex');

      await client.query(
        'INSERT INTO password_reset_tokens (email, token) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET token = $2, created_at = NOW()',
        [email, token]
      );
      
      client.release();

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
      const result = await pool.query(query, [team_abrev]);
      res.json(result.rows);
    } else {
      query += ` ORDER BY total_points DESC`;
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Error executing query:', err.message, err.stack);
    res.status(500).send('Error executing query');
  }
});

// API endpoint to get match stats
app.get('/api/match-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;
    console.log('Received team_abrev:', team_abrev); // Debug log

    let query = `
      WITH SeriesStats AS (
        SELECT 
          s.week,
          s.split,
          p.player_name,
          p.team_abrev,
          sps.series_maps,
          sps.series_kills,
          sps.series_deaths,
          sps.series_assists,
          sps.series_fk,
          sps.series_fd,
          sps.series_clutches,
          sps.series_aces,
          sps.avg_adr_per_series,
          sps.adjusted_points
        FROM series_player_stats AS sps
        JOIN series s ON sps.series_id = s.series_id
        JOIN player p ON sps.player_id = p.player_id
        ORDER BY s.week ASC, sps.series_id ASC, p.team_abrev ASC
      )
      SELECT * FROM SeriesStats
    `;

    if (team_abrev) {
      query += ` WHERE team_abrev = $1`;
      const result = await pool.query(query, [team_abrev]);
      res.json(result.rows);
    } else {
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Error executing query:', err.message, err.stack);
    res.status(500).json({ error: 'Error executing query' }); // Send JSON error response
  }
});

// #region Dashboard Endpoint
app.post('/api/leagues', async (req, res) => {
  console.log('API request received'); // Log when the API request is received
  const { league_name, description, owner_id } = req.body;

  console.log('Received data:', { league_name, description });
  
  try {
    // Ensure all required fields are provided
    if (!league_name || !description || !owner_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Create the new league
    const newLeague = await League.create({
      league_name,
      description,
      owner_id
    });

    res.status(201).json({ success: true, league: newLeague });
  } catch (error) {
    console.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league', error: error.message });
  }
});

// Endpoint to get leagues for a user
app.get('/api/user-leagues', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID found' });
  }

  try {
      const result = await pool.query(
          `SELECT l.league_name, l.description
           FROM leagues l
           JOIN user_leagues ul ON l.league_id = ul.league_id
           WHERE ul.user_id = $1`,
          [userId]
      );

      res.json(result.rows);
  } catch (error) {
      console.error('Error fetching user leagues:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// #endregion

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
