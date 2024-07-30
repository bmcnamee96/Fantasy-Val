// server.js
// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Define the salt rounds for bcrypt
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
const leaguesRouter = require('./routes/leagueRoutes');


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

// Public route example (not protected)
app.get('/api/public-route', (req, res) => {
  res.send('This is a public route');
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
app.use('/', leagueRoutes);
// Use the leagues routes
app.use(leaguesRouter);

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
// #endregion

// #region WebSocket
const WebSocket = require('ws');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients and user IDs
const clients = new Map();

wss.on('connection', (ws, req) => {
    console.log('New client connected');

    // Extract user ID from query parameters or headers
    const userId = new URL(req.url, `ws://${req.headers.host}`).searchParams.get('userId');

    if (userId) {
        clients.set(userId, ws);
        broadcastUserList();
    }

    // Send a welcome message to the new client
    ws.send(JSON.stringify({ message: 'Welcome to the draft' }));

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
          const data = JSON.parse(message);
          console.log('Received message from client:', data);
  
          switch (data.type) {
              case 'draftUpdate':
                  broadcastDraftUpdate(data);
                  break;
              case 'userConnected':
                  // Handle user connection logic if needed
                  break;
              default:
                  console.warn('Unknown message type:', data.type);
          }
      } catch (error) {
          console.error('Error processing message:', error);
      }
  });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(userId);
        broadcastUserList();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcastDraftUpdate(data) {
  const { draftOrder, availablePlayers } = data;
  console.log('Broadcasting draft update:', { draftOrder, availablePlayers });

  const response = { type: 'draftUpdate', draftOrder, availablePlayers };

  clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
      }
  });
}

function broadcastUserList() {
    const userList = Array.from(clients.keys());
    const message = JSON.stringify({ type: 'userListUpdate', users: userList });

    // Broadcast the user list to all connected clients
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

console.log('WebSocket server is running on ws://localhost:8080');
// #endregion

// Draft order and status
app.get('/api/leagues/:leagueId/draft-details', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  console.log('League ID:', leagueId);

  try {
    // Fetch draft order
    const orderResult = await pool.query('SELECT * FROM draft_status WHERE league_id = $1', [leagueId]);
    const draftStatus = orderResult.rows;

    // Fetch drafted players
    const draftedResult = await pool.query('SELECT * FROM drafted_players WHERE league_id = $1', [leagueId]);
    const draftedPlayers = draftedResult.rows;

    res.json({ draftStatus, draftedPlayers });
  } catch (error) {
    console.error('Error fetching draft details:', error);
    res.status(500).json({ error: 'Failed to fetch draft details' });
  }
});

// Get available players for a specific league
app.get('/api/leagues/:leagueId/available-players', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
      const result = await pool.query(
          `SELECT p.player_id, p.player_name, p.team_abrev
           FROM player p
           LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = $1
           WHERE dp.player_id IS NULL`,
          [leagueId] // Passing the leagueId parameter
      );

      const availablePlayers = result.rows;
      res.json(availablePlayers);
  } catch (error) {
      console.error('Error fetching available players:', error);
      res.status(500).json({ error: 'Failed to fetch available players' });
  }
});

// Draft a player
app.post('/api/draft-player', authenticateToken, async (req, res) => {
  const { userId, playerId, leagueId } = req.body;

  try {
    // Update draft status
    await pool.query('UPDATE draft_status SET current_drafter = $1 WHERE league_id = $2', [userId, leagueId]);

    // Insert drafted player
    await pool.query(
      'INSERT INTO drafted_players (league_id, player_id, drafted_by) VALUES ($1, $2, $3)',
      [leagueId, playerId, userId]
    );

    // Remove player from draft pool (if necessary)
    await pool.query('DELETE FROM player_pool WHERE player_id = $1 AND league_id = $2', [playerId, leagueId]);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error drafting player:', error);
    res.status(500).json({ status: 'error', message: 'Failed to draft player' });
  }
});

app.use((req, res, next) => {
  console.log('Authorization header:', req.headers['authorization']);
  next();
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

// API endpoint to create a league
app.post('/api/leagues', authenticateToken, async (req, res) => {
  console.log('API request received'); // Log when the API request is received
  const { league_name, league_pass, description } = req.body;
  const owner_id = req.user.userId; // Get the user ID from the JWT token

  console.log('Received data:', { league_name, league_pass, description });

  try {
    // Ensure all required fields are provided
    if (!league_name || !league_pass || !description || !owner_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Hash the league password
    const hashedPass = await bcrypt.hash(league_pass, saltRounds);

    // Start a transaction
    await pool.query('BEGIN');

    // Create the new league
    const newLeagueResult = await pool.query(
      'INSERT INTO leagues (league_name, league_pass, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING league_id',
      [league_name, hashedPass, description, owner_id]
    );

    const league_id = newLeagueResult.rows[0].league_id;

    // Commit the transaction
    await pool.query('COMMIT');

    res.status(201).json({ success: true, league: { league_id, league_name, description, owner_id } });
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league', error: error.message });
  }
});

// Join League Endpoint
app.post('/api/join-league', authenticateToken, async (req, res) => {
  console.log('API request received'); // Log when the API request is received
  const { league_name, passcode } = req.body;
  const user_id = req.user.userId; // Get the user ID from the JWT token

  console.log('Received data:', { league_name, passcode });

  try {
      // Ensure all required fields are provided
      if (!league_name || !passcode || !user_id) {
          return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      // Start a transaction
      await pool.query('BEGIN');

      // Check if the league exists and get its ID
      const leagueResult = await pool.query(
          'SELECT league_id, league_pass FROM leagues WHERE league_name = $1',
          [league_name]
      );

      if (leagueResult.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'League not found' });
      }

      const league = leagueResult.rows[0];

      // Verify the passcode
      const isPasscodeValid = await bcrypt.compare(passcode, league.league_pass);

      if (!isPasscodeValid) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Incorrect passcode' });
      }

      // Check if the user is already a member of the league
      const membershipCheck = await pool.query(
          'SELECT * FROM user_leagues WHERE league_id = $1 AND user_id = $2',
          [league.league_id, user_id]
      );

      if (membershipCheck.rows.length > 0) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'You are already a member of this league' });
      }

      // Check if the league has reached the maximum number of users (7)
      const userCountResult = await pool.query(
          'SELECT COUNT(*) AS user_count FROM user_leagues WHERE league_id = $1',
          [league.league_id]
      );

      const userCount = parseInt(userCountResult.rows[0].user_count, 10);

      if (userCount >= 7) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'League has reached the maximum number of users (7)' });
      }

      // Add the user to the league
      await pool.query(
          'INSERT INTO user_leagues (user_id, league_id) VALUES ($1, $2)',
          [user_id, league.league_id]
      );

      // Commit the transaction
      await pool.query('COMMIT');

      res.status(200).json({ success: true, message: 'Successfully joined the league' });
  } catch (error) {
      // Rollback the transaction in case of error
      await pool.query('ROLLBACK');
      console.error('Error joining league:', error);
      res.status(500).json({ success: false, message: 'Failed to join league', error: error.message });
  }
});

// Leave League Endpoint
app.post('/api/leave-league', authenticateToken, async (req, res) => {
  console.log('API request received'); // Log when the API request is received
  const { league_name } = req.body;
  const user_id = req.user.userId; // Get the user ID from the JWT token

  console.log('Received data:', { league_name });

  try {
    // Ensure the required field is provided
    if (!league_name || !user_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Start a transaction
    await pool.query('BEGIN');

    // Check if the league exists and get its ID
    const leagueResult = await pool.query(
      'SELECT league_id FROM leagues WHERE league_name = $1',
      [league_name]
    );

    if (leagueResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    const league = leagueResult.rows[0];

    // Check if the user is a member of the league
    const membershipCheck = await pool.query(
      'SELECT * FROM user_leagues WHERE league_id = $1 AND user_id = $2',
      [league.league_id, user_id]
    );

    if (membershipCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'You are not a member of this league' });
    }

    // Remove the user from the league
    await pool.query(
      'DELETE FROM user_leagues WHERE league_id = $1 AND user_id = $2',
      [league.league_id, user_id]
    );

    // Commit the transaction
    await pool.query('COMMIT');

    res.status(200).json({ success: true, message: 'Successfully left the league' });
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error leaving league:', error);
    res.status(500).json({ success: false, message: 'Failed to leave league', error: error.message });
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
          `SELECT l.league_id, l.league_name, l.description
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

// Route to get users in a league
app.get('/api/leagues/:leagueId/users', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  console.log('League ID:', leagueId); // Debug log

  if (!leagueId || isNaN(leagueId)) {
    return res.status(400).send('Invalid league ID');
  }

  try {
    const query = 'SELECT * FROM user_leagues ul JOIN users u ON ul.user_id = u.user_id WHERE ul.league_id = $1';
    const { rows: users } = await pool.query(query, [parseInt(leagueId, 10)]); // Ensure leagueId is an integer

    res.json(users);
  } catch (error) {
    console.error('Error fetching league users:', error);
    res.status(500).send('Failed to fetch league users');
  }
});

// Endpoint to get league details
app.get('/api/leagues/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  console.log('League ID:', leagueId); // Debug log

  if (!leagueId || isNaN(leagueId)) {
    return res.status(400).send('Invalid league ID');
  }

  try {
    const query = 'SELECT league_id, league_name, description FROM leagues WHERE league_id = $1';
    const { rows: leagues } = await pool.query(query, [parseInt(leagueId, 10)]); // Ensure leagueId is an integer

    if (leagues.length === 0) {
      return res.status(404).send('League not found');
    }

    res.json(leagues[0]);
  } catch (error) {
    console.error('Error fetching league details:', error);
    res.status(500).send('Failed to fetch league details');
  }
});

// Endpoint to create a team
app.post('/api/create-team', authenticateToken, async (req, res) => {
  const { team_name, league_id, user_id } = req.body;

  if (!team_name || !league_id || !user_id) {
      return res.status(400).json({ success: false, message: 'Team name, league ID, and user ID are required' });
  }

  console.log('Request Body:', req.body); // Log the request body

  try {
      console.log('Inserting into league_teams table');
      // Insert into league_teams table
      await pool.query('INSERT INTO league_teams (league_id, team_name, user_id) VALUES ($1, $2, $3)', [league_id, team_name, user_id]);
      console.log('Insert into league_teams table successful');

      res.json({ success: true, message: 'Team created successfully' });
  } catch (error) {
      console.error('Error creating team:', error); // Log the full error
      res.status(500).json({ success: false, message: 'Failed to create team' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});