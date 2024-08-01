//routes/leagueRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Define the salt rounds for bcrypt
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

// API endpoint to create a league
router.post('/create-league', authenticateToken, async (req, res) => {
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

    // Initialize the draft order with an empty array or default value
    const initialDraftOrder = [];

    await pool.query(
      'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2)',
      [league_id, JSON.stringify(initialDraftOrder)]
    );

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
router.post('/join-league', authenticateToken, async (req, res) => {
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
router.post('/leave-league', authenticateToken, async (req, res) => {
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
router.get('/user-leagues', authenticateToken, async (req, res) => {
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
router.get('/:leagueId/users', authenticateToken, async (req, res) => {
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
router.get('/:leagueId', authenticateToken, async (req, res) => {
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

module.exports = router;