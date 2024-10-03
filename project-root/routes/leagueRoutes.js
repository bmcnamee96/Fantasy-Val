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
  const { league_name, league_pass, description, team_name } = req.body;
  const owner_id = req.user.userId; // Get the user ID from the JWT token

  try {
    // Ensure all required fields are provided
    if (!league_name || !league_pass || !description || !owner_id || !team_name) {
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

    // Insert team into league_teams table
    await pool.query(
      'INSERT INTO league_teams (league_id, team_name, user_id) VALUES ($1, $2, $3)',
      [league_id, team_name, owner_id]
    );

    // Commit the transaction
    await pool.query('COMMIT');

    res.status(201).json({ success: true, league: { league_id, league_name, description, owner_id }, team: { team_name, owner_id } });
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    logger.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league and team', error: error.message });
  }
});

// Join League and Create Team Endpoint
router.post('/join-league', authenticateToken, async (req, res) => {
  logger.info('API request received for join-league'); // Log when the API request is received
  const { league_name, passcode, team_name } = req.body;
  const user_id = req.user.userId; // Get the user ID from the JWT token

  try {
    // Ensure all required fields are provided
    if (!league_name || !passcode || !user_id || !team_name) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Start a transaction
    await pool.query('BEGIN');

    // Check if the league exists and get its ID and password
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

    // Check if the team name is unique within the league
    const teamNameCheck = await pool.query(
      'SELECT * FROM league_teams WHERE league_id = $1 AND LOWER(team_name) = LOWER($2)',
      [league.league_id, team_name]
    );

    if (teamNameCheck.rows.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Team name already exists within this league' });
    }

    // Add the user to the league
    await pool.query(
      'INSERT INTO user_leagues (user_id, league_id) VALUES ($1, $2)',
      [user_id, league.league_id]
    );

    // Create the team for the user within the league
    await pool.query(
      'INSERT INTO league_teams (league_id, team_name, user_id) VALUES ($1, $2, $3)',
      [league.league_id, team_name, user_id]
    );

    // Commit the transaction
    await pool.query('COMMIT');

    res.status(200).json({ success: true, message: 'Successfully joined the league and created a team' });
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    logger.error('Error joining league and creating team:', error);
    res.status(500).json({ success: false, message: 'Failed to join league or create team', error: error.message });
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

// API Endpoint to fetch the user's team data with points for the current week
router.get('/my-team/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Extracted from the authenticated token
  const currentWeek = parseInt(req.query.week, 10); // Retrieve 'week' from query parameters

  // Validate 'currentWeek'
  if (isNaN(currentWeek)) {
    return res.status(400).json({ error: 'Invalid or missing "week" query parameter.' });
  }

  try {
    // 1. Fetch the 'league_team_id' for the user and league
    const leagueTeamQuery = `
      SELECT league_team_id
      FROM league_teams
      WHERE user_id = $1 AND league_id = $2
    `;
    const leagueTeamResult = await pool.query(leagueTeamQuery, [userId, leagueId]);

    if (leagueTeamResult.rows.length === 0) {
      return res.status(404).json({ error: 'No team found for the user in this league.' });
    }

    const leagueTeamId = leagueTeamResult.rows[0].league_team_id;

    // 2. Fetch players along with their points for the current week
    const playersQuery = `
      SELECT 
          p.player_name, 
          p.role, 
          p.team_abrev, 
          COALESCE(SUM(sps.adjusted_points), 0) AS points, 
          ltp.starter
      FROM 
          league_team_players ltp
      JOIN 
          player p ON ltp.player_id = p.player_id
      LEFT JOIN 
          series_player_stats sps 
          ON p.player_id = sps.player_id 
          AND sps.week = $2
      WHERE 
          ltp.league_team_id = $1
      GROUP BY 
          p.player_name, p.role, p.team_abrev, ltp.starter;
    `;
    const playersResult = await pool.query(playersQuery, [leagueTeamId, currentWeek]);

    // 4. Format the points to have two decimal places before sending to the client
    const formattedPlayers = playersResult.rows.map(player => ({
      player_name: player.player_name,
      role: player.role,
      team_abrev: player.team_abrev,
      points: parseFloat(player.points.toFixed(2)), // Ensures two decimal places
      starter: player.starter
    }));

    // 5. Send the formatted player's data back to the client
    res.json(formattedPlayers);
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

router.post('/update-lineup', authenticateToken, async (req, res) => {
  const { starters, bench } = req.body;
  const userId = req.user.userId; // Get userId from the authenticated token

  if (!Array.isArray(starters) || !Array.isArray(bench)) {
    return res.status(400).json({ success: false, message: 'Invalid request format' });
  }

  try {
      // Get the user's league_team_id
      const leagueTeamResult = await pool.query(
          'SELECT league_team_id FROM league_teams WHERE user_id = $1',
          [userId]
      );

      if (leagueTeamResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Team not found for user' });
      }

      const leagueTeamId = leagueTeamResult.rows[0].league_team_id;

      // Begin transaction
      await pool.query('BEGIN');

      // Update all players to bench (default)
      await pool.query(
          'UPDATE league_team_players SET starter = false WHERE league_team_id = $1',
          [leagueTeamId]
      );

      // Update starters (set starter = true)
      if (starters.length > 0) {
          const starterPlaceholders = starters.map((_, idx) => `$${idx + 1}`).join(', ');
          await pool.query(
              `UPDATE league_team_players SET starter = true WHERE league_team_id = $${starters.length + 1} AND player_id IN (${starterPlaceholders})`,
              [...starters, leagueTeamId]
          );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.status(200).json({ success: true, message: 'Lineup updated successfully' });
  } catch (error) {
      await pool.query('ROLLBACK'); // Rollback transaction on error
      console.error('Error updating lineup:', error);
      res.status(500).json({ success: false, message: 'Failed to update lineup' });
  }
});

router.post('/player-names-to-id', async (req, res) => {
  const { playerNames } = req.body;

  if (!Array.isArray(playerNames) || playerNames.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid player names' });
  }

  try {
      const placeholders = playerNames.map((_, idx) => `$${idx + 1}`).join(', ');
      const query = `SELECT player_id, player_name FROM player WHERE player_name IN (${placeholders})`;
      const result = await pool.query(query, playerNames);

      const playerMap = result.rows.reduce((acc, row) => {
          acc[row.player_name] = row.player_id;
          return acc;
      }, {});

      res.status(200).json({ success: true, playerMap });
  } catch (error) {
      console.error('Error fetching player IDs:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch player IDs' });
  }
});

router.get('/current-week', async (req, res) => {
  try {
      const now = new Date(); // Current server time in UTC

      const result = await pool.query(
          `SELECT week_number FROM weeks WHERE start_date <= $1 ORDER BY start_date DESC LIMIT 1`,
          [now]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ message: 'No current week found.' });
      }

      const currentWeek = result.rows[0].week_number;
      res.json({ currentWeek });
  } catch (error) {
      console.error('Error fetching current week:', error);
      res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
