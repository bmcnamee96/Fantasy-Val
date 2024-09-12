// routes/leagueRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Define the salt rounds for bcrypt
const authenticateToken = require('../middleware/authMiddleware');
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

// API endpoint to create a league
router.post('/create-league', authenticateToken, async (req, res) => {
  logger.info('API request received for create-league'); // Log when the API request is received
  const { league_name, league_pass, description } = req.body;
  const owner_id = req.user.userId; // Get the user ID from the JWT token

  logger.info('Received data for create-league:', { league_name, league_pass, description });

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

    // Initialize draft status
    const currentTurnIndex = -1;
    const draftStarted = false;
    const draftEnded = false;
    
    // Insert draft status entry
    await pool.query(
      'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, $3, $4)', 
      [league_id, currentTurnIndex, draftStarted, draftEnded]
    );

    // Commit the transaction
    await pool.query('COMMIT');

    res.status(201).json({ success: true, league: { league_id, league_name, description, owner_id } });
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    logger.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league', error: error.message });
  }
});

// Join League Endpoint
router.post('/join-league', authenticateToken, async (req, res) => {
  logger.info('API request received for join-league'); // Log when the API request is received
  const { league_name, passcode } = req.body;
  const user_id = req.user.userId; // Get the user ID from the JWT token

  logger.info('Received data for join-league:', { league_name, passcode });

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
    logger.error('Error joining league:', error);
    res.status(500).json({ success: false, message: 'Failed to join league', error: error.message });
  }
});

// Endpoint to create a team
router.post('/create-team', authenticateToken, async (req, res) => {
  const { team_name, league_id, user_id } = req.body;

  if (!team_name || !league_id || !user_id) {
      return res.status(400).json({ success: false, message: 'Team name, league ID, and user ID are required' });
  }

  logger.debug('Request Body:', req.body);

  try {
      logger.debug('Inserting into league_teams table');
      // Insert into league_teams table
      await pool.query('INSERT INTO league_teams (league_id, team_name, user_id) VALUES ($1, $2, $3)', [league_id, team_name, user_id]);
      logger.info('Insert into league_teams table successful');

      res.json({ success: true, message: 'Team created successfully' });
  } catch (error) {
      logger.error('Error creating team:', error);
      res.status(500).json({ success: false, message: 'Failed to create team' });
  }
});

// Leave League Endpoint
router.post('/leave-league', authenticateToken, async (req, res) => {
  logger.info('API request received for leave-league'); // Log when the API request is received
  const { league_name } = req.body;
  const user_id = req.user.userId; // Get the user ID from the JWT token

  logger.info('Received data for leave-league:', { league_name });

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
    logger.error('Error leaving league:', error);
    res.status(500).json({ success: false, message: 'Failed to leave league', error: error.message });
  }
});

// Express route to handle fetching league ID by name
router.get('/get-league-id', authenticateToken, async (req, res) => {
  const leagueName = req.query.leagueName;

  try {
      // Ensure leagueName is provided
      if (!leagueName) {
          return res.status(400).json({ success: false, message: 'League name is required' });
      }

      // Query to get the league ID based on the league name
      const result = await pool.query(
          'SELECT league_id FROM leagues WHERE league_name = $1',
          [leagueName]
      );

      // Check if any rows were returned
      if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'League not found' });
      }

      // Return the league ID
      res.json({ success: true, league_id: result.rows[0].league_id });
  } catch (error) {
      console.error('Error fetching league ID:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch league ID', error: error.message });
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
    logger.error('Error fetching user leagues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get users in a league
router.get('/:leagueId/users', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  logger.info(`Users for league: ${leagueId}`); // Debug log

  if (!leagueId || isNaN(leagueId)) {
    return res.status(400).json({ error: 'Invalid league ID' });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.username
       FROM users u
       JOIN user_leagues ul ON u.user_id = ul.user_id
       WHERE ul.league_id = $1`,
      [leagueId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching league users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get teams in a league
router.get('/:leagueId/teams', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
      // Fetch the teams and players for the specified league
      const result = await db.query(`
          SELECT lt.league_team_id AS teamId, t.team_name AS teamName, ARRAY_AGG(p.player_id) AS players
          FROM league_team_players lt
          JOIN player p ON lt.player_id = p.player_id
          JOIN league_teams lt2 ON lt.league_team_id = lt2.league_team_id
          JOIN teams t ON lt2.team_abrev = t.team_abrev
          WHERE lt2.league_id = $1
          GROUP BY lt.league_team_id, t.team_name
      `, [leagueId]);

      res.json(result.rows);
  } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// API to get the user's team for a specific league
router.get('/my-team/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Assuming the token contains the user ID

  try {
    // Query to get the league_team_id for the user
    const leagueTeamQuery = `
      SELECT league_team_id
      FROM league_teams
      WHERE user_id = $1 AND league_id = $2
    `;

    const leagueTeamResult = await pool.query(leagueTeamQuery, [userId, leagueId]);

    if (leagueTeamResult.rows.length === 0) {
      return res.status(404).json({ error: `No team found for the ${userId} in this league.` });
    }

    const leagueTeamId = leagueTeamResult.rows[0].league_team_id;

    // Query to get the players for the league_team_id
    const playerQuery = `
      SELECT p.player_name, p.role, p.team_abrev
      FROM league_team_players ltp
      JOIN player p ON ltp.player_id = p.player_id
      WHERE ltp.league_team_id = $1
    `;
    const playerResult = await pool.query(playerQuery, [leagueTeamId]);

    // Send the player's data back to the client
    res.json(playerResult.rows);
  } catch (error) {
    console.error('Error fetching team data:', error);
    res.status(500).json({ error: 'An error occurred while fetching team data.' });
  }
});

// Get available players
router.get('/:leagueId/available-players', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
      // Optionally check if the league exists
      const leagueCheck = await pool.query('SELECT 1 FROM leagues WHERE league_id = $1', [leagueId]);
      if (leagueCheck.rowCount === 0) {
          return res.status(404).json({ error: 'League not found' });
      }

      const result = await pool.query(
          `SELECT p.player_id, p.player_name, p.team_abrev, p.role
           FROM player p
           LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = $1
           WHERE dp.player_id IS NULL`,
          [leagueId]
      );

      const availablePlayers = result.rows;
      res.json(availablePlayers);
  } catch (error) {
      logger.error('Error fetching available players:', error);
      res.status(500).json({ error: 'Failed to fetch available players' });
  }
});

// Draft Status
router.get('/:leagueId/draft-status', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
      // Fetch draft status from the database
      const result = await pool.query(
          'SELECT current_turn_index, draft_started, draft_ended FROM draft_status WHERE league_id = $1',
          [leagueId]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Draft status not found' });
      }

      const draftStatus = result.rows[0];
      res.status(200).json(draftStatus);
  } catch (error) {
      logger.error('Error fetching draft status:', error);
      res.status(500).json({ error: 'Failed to fetch draft status' });
  }
});


module.exports = router;
