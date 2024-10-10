// routes/leagueRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Define the salt rounds for bcrypt
const authenticateToken = require('../middleware/authMiddleware');
const checkRosterLock = require('../middleware/checkRosterLock');
const logger = require('../utils/logger');
const cron = require('node-cron'); // For scheduling tasks

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

    if (userCount >= 8) {
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

// Endpoint to get the current user's team ID for a league
router.get('/:leagueId/team-id', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Assuming user ID is available from the token

  try {
      // Query to get the user's team ID in the specified league
      const userTeamQuery = `
          SELECT league_team_id
          FROM league_teams
          WHERE league_id = $1 AND user_id = $2
      `;
      const userTeamResult = await pool.query(userTeamQuery, [leagueId, userId]);

      if (userTeamResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Team not found for the current user in this league.' });
      }

      const userTeamId = userTeamResult.rows[0].league_team_id;
      res.status(200).json({ success: true, teamId: userTeamId });
  } catch (error) {
      logger.error('Error fetching user team ID:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user team ID.' });
  }
});

// API Endpoint to Get Team Information for a User
router.get('/:userId/:leagueId/team', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const leagueId = req.params.leagueId;

  try {
    // Fetch the team information for the user
    // Assuming that a user has one team per league
    // Adjust the query based on your actual database schema

    const teamResult = await pool.query(
      `SELECT ltp.league_team_id, ltp.player_id, ltp.starter
       FROM league_team_players ltp
       JOIN league_teams lt ON ltp.league_team_id = lt.league_team_id
       WHERE lt.user_id = $1 AND lt.league_id = $2`,
      [userId, leagueId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'No team found for the user.' });
    }

    const teams = teamResult.rows.map(row => ({
      playerId: row.player_id,
      lineup: row.starter
    }));

    res.json({ teams });
  } catch (error) {
    logger.error('Error fetching team information:', error);
    res.status(500).json({ error: 'Failed to fetch team information.' });
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
    // Check if the league exists
    const leagueCheck = await pool.query('SELECT 1 FROM leagues WHERE league_id = $1', [leagueId]);
    if (leagueCheck.rowCount === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    // Updated SQL query using league_team_players and joining with league_teams
    const result = await pool.query(
      `SELECT p.player_id, p.player_name, p.team_abrev, p.role
       FROM player p
       LEFT JOIN league_team_players ltp ON p.player_id = ltp.player_id
       LEFT JOIN league_teams lt ON ltp.league_team_id = lt.league_team_id AND lt.league_id = $1
       WHERE lt.league_id IS NULL`,
      [leagueId]
    );

    const availablePlayers = result.rows;
    res.json(availablePlayers); // Maintains the same response structure
  } catch (error) {
    logger.error('Error fetching available players:', error);
    res.status(500).json({ error: 'Failed to fetch available players' });
  }
});

// Endpoint to sign a free agent
router.post('/:leagueId/sign-player', authenticateToken, checkRosterLock, async (req, res) => {
  const { leagueId } = req.params;
  const { playerIdToSign, playerIdToDrop } = req.body;
  const userId = req.user.userId; // Assuming user ID is available from the token

  // Validate input
  if (!playerIdToSign || !playerIdToDrop) {
    return res.status(400).json({ success: false, error: 'Missing player IDs.' });
  }

  try {
      // Check if the league exists
      const leagueCheck = await pool.query('SELECT 1 FROM leagues WHERE league_id = $1', [leagueId]);
      if (leagueCheck.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'League not found.' });
      }

      // Fetch the role of the player to sign
      const playerToSignResult = await pool.query(
          `SELECT role FROM player WHERE player_id = $1`,
          [playerIdToSign]
      );
      if (playerToSignResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Player to sign not found.' });
      }
      const roleToSign = playerToSignResult.rows[0].role;

      // Fetch the role and starter status of the player to drop
      const playerToDropResult = await pool.query(
          `SELECT p.role, ltp.starter
           FROM player p
           INNER JOIN league_team_players ltp ON p.player_id = ltp.player_id
           INNER JOIN league_teams lt ON ltp.league_team_id = lt.league_team_id
           WHERE p.player_id = $1 AND lt.league_id = $2 AND lt.user_id = $3`,
          [playerIdToDrop, leagueId, userId]
      );
      if (playerToDropResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Player to drop not found on your team.' });
      }
      const roleToDrop = playerToDropResult.rows[0].role;
      const isStarter = playerToDropResult.rows[0].starter;

      // Ensure roles match
      if (roleToSign !== roleToDrop) {
          return res.status(400).json({ success: false, error: 'Role mismatch. You can only sign a player with the same role as the player you are dropping.' });
      }

      // Start a transaction
      await pool.query('BEGIN');

      // Remove the player to drop from the team
      const removePlayerQuery = `
          DELETE FROM league_team_players
          WHERE player_id = $1 AND league_team_id = (
              SELECT league_team_id FROM league_teams WHERE league_id = $2 AND user_id = $3
          )
      `;
      await pool.query(removePlayerQuery, [playerIdToDrop, leagueId, userId]);

      // Add the player to sign to the team, with the same starter status as the player being dropped
      const addPlayerQuery = `
          INSERT INTO league_team_players (league_team_id, player_id, starter)
          VALUES (
              (SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2),
              $3,
              $4
          )
      `;
      await pool.query(addPlayerQuery, [leagueId, userId, playerIdToSign, isStarter]);

      // Commit the transaction
      await pool.query('COMMIT');

      res.status(200).json({ success: true, message: 'Player signed successfully.' });
  } catch (error) {
      // Rollback in case of error
      await pool.query('ROLLBACK');
      logger.error('Error signing player:', error);
      res.status(500).json({ success: false, error: 'Failed to sign player.' });
  }
});

// Endpoint to get user's bench players
router.get('/:leagueId/bench-players', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Assuming user ID is available from the token

  try {
      // Check if the league exists
      const leagueCheck = await pool.query('SELECT 1 FROM leagues WHERE league_id = $1', [leagueId]);
      if (leagueCheck.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'League not found.' });
      }

      // Fetch bench players where starter is FALSE
      const benchPlayers = await pool.query(
          `SELECT p.player_id, p.player_name, p.team_abrev, p.role
           FROM player p
           INNER JOIN league_team_players ltp ON p.player_id = ltp.player_id
           INNER JOIN league_teams lt ON ltp.league_team_id = lt.league_team_id
           WHERE lt.league_id = $1 AND lt.user_id = $2`,
          [leagueId, userId]
      );

      res.status(200).json({ success: true, availableBenchPlayers: benchPlayers.rows });
  } catch (error) {
      logger.error('Error fetching bench players:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch bench players.' });
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

router.post('/update-lineup', authenticateToken, checkRosterLock, async (req, res) => {
  const { starters } = req.body;
  const userId = req.user.userId; // Get userId from the authenticated token

  // Validate that 'starters' is an array
  if (!Array.isArray(starters)) {
    return res.status(400).json({ success: false, message: 'Invalid request format: starters must be an array' });
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

    // Set all players on the team to bench (starter = false)
    await pool.query(
      'UPDATE league_team_players SET starter = false WHERE league_team_id = $1',
      [leagueTeamId]
    );

    // Update starters (set starter = true)
    if (starters.length > 0) {
      // Use the ANY operator to match player IDs in the array
      await pool.query(
        'UPDATE league_team_players SET starter = true WHERE league_team_id = $1 AND player_id = ANY($2::int[])',
        [leagueTeamId, starters]
      );
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.status(200).json({ success: true, message: 'Lineup updated successfully' });
  } catch (error) {
    // Rollback transaction if an error occurred
    await pool.query('ROLLBACK');
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

// Route to fetch player names by player IDs
router.post('/ids-to-names', async (req, res) => {
  const { playerIds } = req.body; // Get the array of player IDs from the request body

  if (!playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({ error: 'Invalid input, expected an array of player IDs.' });
  }

  try {
      // Query the database for the player names and team abbreviations based on the provided IDs
      const query = `
          SELECT player_id, player_name, team_abrev, role
          FROM player
          WHERE player_id = ANY($1::int[])
      `;
      const result = await pool.query(query, [playerIds]);

      // Create a mapping of player_id to an object containing player_name and team_abrev
      const playerMap = {};
      result.rows.forEach(row => {
          playerMap[row.player_id] = {
              player_name: row.player_name,
              team_abrev: row.team_abrev,  // Return 'Unknown' if team_abrev is null
              role: row.role
          };
      });

      // Return the mapping
      return res.json(playerMap);

  } catch (error) {
      console.error('Error fetching player names and team abbreviations:', error);
      return res.status(500).json({ error: 'Internal server error' });
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

// GET /api/leagues/weeks
router.get('/weeks', authenticateToken, async (req, res) => {
  try {
    // Query the database to get all weeks
    const queryText = 'SELECT week_number, start_date FROM weeks ORDER BY week_number ASC';
    const result = await pool.query(queryText);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'No weeks data found.' });
    }

    // Send the data as JSON
    res.json({ weeks: result.rows });
  } catch (error) {
    console.error('Error fetching weeks data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Get schedule for a league
router.get('/:leagueId/schedule', authenticateToken, async (req, res) => {
  try {
      const leagueId = req.params.leagueId;

      // Fetch schedule from the user_schedule table
      const result = await pool.query(
          `SELECT us.schedule_id, us.week_number, 
                  home_team.league_team_id AS home_team_id, home_user.username AS home_team_name,
                  away_team.league_team_id AS away_team_id, away_user.username AS away_team_name,
                  us.home_team_score, us.away_team_score, us.winner_team_id, us.is_tie
           FROM user_schedule us
           JOIN league_teams home_team ON us.home_team_id = home_team.league_team_id
           JOIN users home_user ON home_team.user_id = home_user.user_id
           JOIN league_teams away_team ON us.away_team_id = away_team.league_team_id
           JOIN users away_user ON away_team.user_id = away_user.user_id
           WHERE us.league_id = $1
           ORDER BY us.week_number ASC, us.schedule_id ASC`,
          [leagueId]
      );

      // Check if the schedule exists
      if (result.rows.length === 0) {
        // Schedule not yet created
        return res.status(200).json({
            success: false,
            message: 'Schedule will be created after the draft!',
            schedule: []
        });
      }

      res.status(200).json({ success: true, schedule: result.rows });
  } catch (error) {
      console.error('Error fetching league schedule:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch league schedule.' });
  }
});

// Endpoint to get the next opponent for the user's team
router.get('/next-opponent/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Extracted from authenticated token

  try {
    // Get the user's team ID in the league
    const teamResult = await pool.query(
      `SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2`,
      [leagueId, userId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found for user in this league.' });
    }

    const leagueTeamId = teamResult.rows[0].league_team_id;

    // Get the current week
    const now = new Date();
    const weekResult = await pool.query(
      `SELECT week_number FROM weeks WHERE start_date <= $1 ORDER BY start_date DESC LIMIT 1`,
      [now]
    );

    if (weekResult.rows.length === 0) {
      return res.status(404).json({ error: 'Current week not found.' });
    }

    const currentWeek = weekResult.rows[0].week_number;

    // Get the next matchup for the team
    const matchupResult = await pool.query(
      `SELECT us.week_number, lt.team_name AS opponent_name
       FROM user_schedule us
       JOIN league_teams lt ON (us.home_team_id = lt.league_team_id OR us.away_team_id = lt.league_team_id)
       WHERE us.league_id = $1
         AND us.week_number >= $2
         AND (us.home_team_id = $3 OR us.away_team_id = $3)
         AND lt.league_team_id != $3
       ORDER BY us.week_number ASC
       LIMIT 1`,
      [leagueId, currentWeek, leagueTeamId]
    );

    if (matchupResult.rows.length === 0) {
      return res.status(404).json({ message: 'No upcoming matchups found.' });
    }

    const nextOpponent = matchupResult.rows[0];

    res.json({
      week_number: nextOpponent.week_number,
      opponent_name: nextOpponent.opponent_name,
    });
  } catch (error) {
    console.error('Error fetching next opponent:', error);
    res.status(500).json({ error: 'An error occurred while fetching the next opponent.' });
  }
});

// Endpoint to get league standings
router.get('/:leagueId/standings', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
          ts.wins,
          ts.losses,
          ts.ties,
          lt.team_name,
          u.username,
          (ts.wins * 3 + ts.ties) AS points
       FROM
          team_standings ts
          INNER JOIN league_teams lt ON ts.league_team_id = lt.league_team_id
          INNER JOIN users u ON lt.user_id = u.user_id
       WHERE
          lt.league_id = $1
       ORDER BY
          points DESC,
          ts.wins DESC,
          ts.ties DESC,
          ts.losses ASC`,
      [leagueId]
    );

    res.status(200).json({ success: true, standings: result.rows });
  } catch (error) {
    console.error('Error fetching league standings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch league standings.' });
  }
});

// Endpoint to create a trade request
router.post('/:leagueId/trade-request', authenticateToken, checkRosterLock, async (req, res) => {
  const { leagueId } = req.params;
  const { senderPlayerId, receiverPlayerId, receiverUserId } = req.body;
  const userId = req.user.userId; // Assuming user ID is available from the token

  // Validate input
  if (!senderPlayerId || !receiverPlayerId || !receiverUserId) {
      return res.status(400).json({ success: false, error: 'Missing required information.' });
  }

  try {
      // Check if the league exists
      const leagueCheck = await pool.query('SELECT 1 FROM leagues WHERE league_id = $1', [leagueId]);
      if (leagueCheck.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'League not found.' });
      }

      // Get the sender's team ID
      const senderTeamResult = await pool.query(
          `SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2`,
          [leagueId, userId]
      );
      if (senderTeamResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Sender team not found.' });
      }
      const senderTeamId = senderTeamResult.rows[0].league_team_id;

      // Get the receiver's team ID
      const receiverTeamResult = await pool.query(
          `SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2`,
          [leagueId, receiverUserId]
      );
      if (receiverTeamResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Receiver team not found.' });
      }
      const receiverTeamId = receiverTeamResult.rows[0].league_team_id;

      // Check if either player is involved in an active trade request
      const activeTradeCheck = await pool.query(
          `SELECT 1 FROM trade_requests 
           WHERE league_id = $1 
           AND status = 'Pending'
           AND (sender_player_id = $2 OR receiver_player_id = $2 OR sender_player_id = $3 OR receiver_player_id = $3)`,
          [leagueId, senderPlayerId, receiverPlayerId]
      );

      if (activeTradeCheck.rowCount > 0) {
          return res.status(400).json({ success: false, error: 'One of the players is already involved in an active trade request.' });
      }

      // Fetch the roles of the players being traded
      const senderPlayerRoleResult = await pool.query(
          `SELECT role FROM player WHERE player_id = $1`,
          [senderPlayerId]
      );
      const receiverPlayerRoleResult = await pool.query(
          `SELECT role FROM player WHERE player_id = $1`,
          [receiverPlayerId]
      );

      if (senderPlayerRoleResult.rowCount === 0 || receiverPlayerRoleResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Player not found.' });
      }
      const senderPlayerRole = senderPlayerRoleResult.rows[0].role;
      const receiverPlayerRole = receiverPlayerRoleResult.rows[0].role;

      // Ensure the roles match
      if (senderPlayerRole !== receiverPlayerRole) {
          return res.status(400).json({ success: false, error: 'Players must have the same role for a trade.' });
      }

      // Insert the trade request into the database
      const insertTradeRequestQuery = `
          INSERT INTO trade_requests (league_id, sender_team_id, receiver_team_id, sender_player_id, receiver_player_id, status)
          VALUES ($1, $2, $3, $4, $5, 'Pending')
          RETURNING trade_request_id
      `;
      const tradeRequestResult = await pool.query(insertTradeRequestQuery, [
          leagueId,
          senderTeamId,
          receiverTeamId,
          senderPlayerId,
          receiverPlayerId
      ]);

      const tradeRequestId = tradeRequestResult.rows[0].trade_request_id;

      // Respond with the success message
      res.status(200).json({ success: true, message: 'Trade request sent successfully.', tradeRequestId });
  } catch (error) {
      logger.error('Error sending trade request:', error);
      res.status(500).json({ success: false, error: 'Failed to send trade request.' });
  }
});

// Endpoint to accept a trade request
router.post('/trade-request/:tradeRequestId/accept', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
      // Start a transaction
      await pool.query('BEGIN');

      // Fetch the trade request details
      const tradeRequestResult = await pool.query(
          `SELECT league_id, sender_team_id, receiver_team_id, sender_player_id, receiver_player_id, status
           FROM trade_requests
           WHERE trade_request_id = $1 AND status = 'Pending'`,
          [tradeRequestId]
      );

      if (tradeRequestResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
      }

      const tradeRequest = tradeRequestResult.rows[0];

      // Ensure the user is the receiver of the trade request
      const receiverTeamResult = await pool.query(
          `SELECT user_id FROM league_teams WHERE league_team_id = $1`,
          [tradeRequest.receiver_team_id]
      );

      if (receiverTeamResult.rowCount === 0 || receiverTeamResult.rows[0].user_id !== userId) {
          return res.status(403).json({ success: false, error: 'You are not authorized to accept this trade request.' });
      }

      // Swap the players between the teams
      const updateSenderTeamQuery = `
          UPDATE league_team_players
          SET player_id = $1
          WHERE player_id = $2 AND league_team_id = $3
      `;
      const updateReceiverTeamQuery = `
          UPDATE league_team_players
          SET player_id = $1
          WHERE player_id = $2 AND league_team_id = $3
      `;
      await pool.query(updateSenderTeamQuery, [tradeRequest.receiver_player_id, tradeRequest.sender_player_id, tradeRequest.sender_team_id]);
      await pool.query(updateReceiverTeamQuery, [tradeRequest.sender_player_id, tradeRequest.receiver_player_id, tradeRequest.receiver_team_id]);

      // Update the trade request status to 'Accepted'
      await pool.query(
          `UPDATE trade_requests SET status = 'Accepted' WHERE trade_request_id = $1`,
          [tradeRequestId]
      );

      // Commit the transaction
      await pool.query('COMMIT');

      res.status(200).json({ success: true, message: 'Trade request accepted.' });
  } catch (error) {
      // Rollback in case of error
      await pool.query('ROLLBACK');
      logger.error('Error accepting trade request:', error);
      res.status(500).json({ success: false, error: 'Failed to accept trade request.' });
  }
});

// Endpoint to reject a trade request
router.post('/trade-request/:tradeRequestId/reject', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
      // Fetch the trade request details
      const tradeRequestResult = await pool.query(
          `SELECT receiver_team_id, status FROM trade_requests WHERE trade_request_id = $1 AND status = 'Pending'`,
          [tradeRequestId]
      );

      if (tradeRequestResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
      }

      // Ensure the user is the receiver of the trade request
      const receiverTeamResult = await pool.query(
          `SELECT user_id FROM league_teams WHERE league_team_id = $1`,
          [tradeRequestResult.rows[0].receiver_team_id]
      );

      if (receiverTeamResult.rowCount === 0 || receiverTeamResult.rows[0].user_id !== userId) {
          return res.status(403).json({ success: false, error: 'You are not authorized to reject this trade request.' });
      }

      // Update the trade request status to 'Rejected'
      await pool.query(
          `UPDATE trade_requests SET status = 'Rejected' WHERE trade_request_id = $1`,
          [tradeRequestId]
      );

      res.status(200).json({ success: true, message: 'Trade request rejected.' });
  } catch (error) {
      logger.error('Error rejecting trade request:', error);
      res.status(500).json({ success: false, error: 'Failed to reject trade request.' });
  }
});

// Endpoint to cancel a trade request
router.post('/trade-request/:tradeRequestId/cancel', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
      // Fetch the trade request details
      const tradeRequestResult = await pool.query(
          `SELECT sender_team_id, status FROM trade_requests WHERE trade_request_id = $1 AND status = 'Pending'`,
          [tradeRequestId]
      );

      if (tradeRequestResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
      }

      // Ensure the user is the sender of the trade request
      const senderTeamResult = await pool.query(
          `SELECT user_id FROM league_teams WHERE league_team_id = $1`,
          [tradeRequestResult.rows[0].sender_team_id]
      );

      if (senderTeamResult.rowCount === 0 || senderTeamResult.rows[0].user_id !== userId) {
          return res.status(403).json({ success: false, error: 'You are not authorized to cancel this trade request.' });
      }

      // Update the trade request status to 'Cancelled'
      await pool.query(
          `UPDATE trade_requests SET status = 'Cancelled' WHERE trade_request_id = $1`,
          [tradeRequestId]
      );

      res.status(200).json({ success: true, message: 'Trade request cancelled successfully.' });
  } catch (error) {
      logger.error('Error cancelling trade request:', error);
      res.status(500).json({ success: false, error: 'Failed to cancel trade request.' });
  }
});

// Endpoint to get active trade requests for a league
router.get('/:leagueId/active-trades', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Assuming user ID is available from the token

  try {
      // Query to get active trade requests involving the user's team in the league
      const activeTradesQuery = `
          SELECT tr.trade_request_id, tr.sender_team_id, tr.receiver_team_id, tr.sender_player_id, tr.receiver_player_id, tr.status, 
                 u1.username as sender_username, u2.username as receiver_username
          FROM trade_requests tr
          INNER JOIN league_teams lt1 ON tr.sender_team_id = lt1.league_team_id
          INNER JOIN league_teams lt2 ON tr.receiver_team_id = lt2.league_team_id
          INNER JOIN users u1 ON lt1.user_id = u1.user_id
          INNER JOIN users u2 ON lt2.user_id = u2.user_id
          WHERE tr.league_id = $1 
            AND tr.status = 'Pending'
            AND (lt1.user_id = $2 OR lt2.user_id = $2)
      `;
      const activeTradesResult = await pool.query(activeTradesQuery, [leagueId, userId]);

      res.status(200).json({ success: true, trades: activeTradesResult.rows });
  } catch (error) {
      logger.error('Error fetching active trades:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch active trades.' });
  }
});

// -------------------------------------------------------------------------- //

async function processWeekIncrement() {
  const now = new Date();

  // Get the current week
  const currentWeekResult = await pool.query(
    `SELECT week_number
     FROM weeks
     WHERE start_date <= $1
     ORDER BY start_date DESC
     LIMIT 1`,
    [now]
  );

  if (currentWeekResult.rows.length === 0) {
    console.log('No current week found.');
    return;
  }

  const currentWeek = parseInt(currentWeekResult.rows[0].week_number, 10);

  // Get last processed week from database
  const lastProcessedWeekResult = await pool.query(
    `SELECT value FROM system_settings WHERE key = 'last_processed_week'`
  );

  let lastProcessedWeek = parseInt(lastProcessedWeekResult.rows[0].value, 10);

  // Check if the week has incremented
  if (currentWeek > lastProcessedWeek) {
    console.log(`Week has incremented from ${lastProcessedWeek} to ${currentWeek}`);

    // Process matchups for the previous week if not the first week
    if (lastProcessedWeek > 0) {
      const dataAvailable = await isPlayerDataAvailableForWeek(lastProcessedWeek);
      if (!dataAvailable) {
        console.log(`Player performance data not available for Week ${lastProcessedWeek}. Skipping processing.`);
        return;
      }

      await processMatchupsForAllLeagues(lastProcessedWeek);
    }

    // Update lastProcessedWeek in database
    await pool.query(
      `UPDATE system_settings SET value = $1 WHERE key = 'last_processed_week'`,
      [currentWeek]
    );
  } else {
    console.log(`Week has not changed. Current week: ${currentWeek}`);
  }
}

async function processMatchupsForAllLeagues(weekNumber) {
  // Fetch all active leagues
  const leaguesResult = await pool.query(
    `SELECT league_id FROM leagues`
  );

  const leagues = leaguesResult.rows;

  for (const league of leagues) {
    await processMatchupsForWeek(league.league_id, weekNumber);
  }
}

async function processMatchupsForWeek(leagueId, weekNumber) {
  try {
    // Fetch all matchups for the given league and week
    const result = await pool.query(
      `SELECT schedule_id, home_team_id, away_team_id
       FROM user_schedule
       WHERE league_id = $1 AND week_number = $2`,
      [leagueId, weekNumber]
    );

    const matchups = result.rows;

    // Process each matchup
    for (const matchup of matchups) {
      await processSingleMatchup(matchup, weekNumber);
    }

    console.log(`Matchups for League ${leagueId}, Week ${weekNumber} processed successfully.`);
  } catch (error) {
    console.error(`Error processing matchups for League ${leagueId}, Week ${weekNumber}:`, error);
    throw error;
  }
}

async function processSingleMatchup(matchup, weekNumber) {
  const { schedule_id, home_team_id, away_team_id } = matchup;

  // Fetch starters for both teams
  const homeStarters = await getStartersForTeam(home_team_id);
  const awayStarters = await getStartersForTeam(away_team_id);

  // Fetch player performance data
  const allPlayerIds = [...homeStarters, ...awayStarters];
  const performanceData = await getPlayersPerformance(allPlayerIds, weekNumber);

  // Calculate total points
  const homePoints = calculateTotalPoints(homeStarters, performanceData);
  const awayPoints = calculateTotalPoints(awayStarters, performanceData);

  // Determine winner
  let winnerTeamId = null;
  let isTie = false;
  if (homePoints > awayPoints) {
    winnerTeamId = home_team_id;
  } else if (awayPoints > homePoints) {
    winnerTeamId = away_team_id;
  } else {
    isTie = true;
  }

  // Update matchup record in the database
  await pool.query(
    `UPDATE user_schedule
     SET home_team_score = $1,
         away_team_score = $2,
         winner_team_id = $3,
         is_tie = $4
     WHERE schedule_id = $5`,
    [homePoints, awayPoints, winnerTeamId, isTie, schedule_id]
  );

  // Optionally, update team standings
  await updateTeamStandings(home_team_id, homePoints, awayPoints);
  await updateTeamStandings(away_team_id, awayPoints, homePoints);
}

async function getStartersForTeam(leagueTeamId) {
  const result = await pool.query(
    `SELECT player_id
     FROM league_team_players
     WHERE league_team_id = $1 AND starter = true`,
    [leagueTeamId]
  );
  return result.rows.map(row => row.player_id);
}

async function getPlayersPerformance(playerIds, weekNumber) {
  const result = await pool.query(
    `SELECT sps.player_id, sps.adjusted_points AS points
     FROM series_player_stats sps
     JOIN series s ON sps.series_id = s.series_id
     WHERE sps.player_id = ANY($1::int[]) AND s.week = $2`,
    [playerIds, weekNumber]
  );
  
  const performanceData = {};
  result.rows.forEach(row => {
    performanceData[row.player_id] = row.points;
  });

  return performanceData;
}

function calculateTotalPoints(starters, performanceData) {
  let totalPoints = 0;
  starters.forEach(playerId => {
    totalPoints += performanceData[playerId] || 0;
  });
  return totalPoints;
}

async function updateTeamStandings(teamId, teamPoints, opponentPoints) {
  // Fetch current standings
  const result = await pool.query(
    `SELECT wins, losses, ties
     FROM team_standings
     WHERE league_team_id = $1`,
    [teamId]
  );

  let { wins, losses, ties } = result.rows[0] || { wins: 0, losses: 0, ties: 0 };

  // Update standings based on match result
  if (teamPoints > opponentPoints) {
    wins += 1;
  } else if (teamPoints < opponentPoints) {
    losses += 1;
  } else {
    ties += 1;
  }

  // Upsert the standings
  await pool.query(
    `INSERT INTO team_standings (league_team_id, wins, losses, ties)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (league_team_id) DO UPDATE
     SET wins = EXCLUDED.wins,
         losses = EXCLUDED.losses,
         ties = EXCLUDED.ties`,
    [teamId, wins, losses, ties]
  );
}

// Scheduled Task to Process Week Increments and Matchups ('0 1 * * MON' - every Monday at 1 am)
cron.schedule('0 1 * * MON', async () => {
  try {
    await processWeekIncrement();
  } catch (error) {
    console.error('Error in week increment task:', error);
  }
});

async function isPlayerDataAvailableForWeek(weekNumber) {
  const result = await pool.query(
    `SELECT COUNT(*) FROM player_stats ps
     JOIN series s ON ps.series_id = s.series_id
     WHERE s.week = $1`,
    [weekNumber]
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

// -------------------------------------------------------------------------- //

module.exports = router;
