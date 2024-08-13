// routes/draftRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
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

// Endpoint to get user information
router.get('/users', authenticateToken, async (req, res) => {
    try {
        // Query the database for all users
        const result = await pool.query('SELECT user_id, username FROM users');
        
        // Send the list of users as JSON
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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

// Get draft order for a specific league
router.get('/leagues/:leagueId/draft-order', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;
    logger.info(`Fetching draft order for league: ${leagueId}`);
  
    try {
        const result = await pool.query('SELECT draft_order FROM draft_orders WHERE league_id = $1', [leagueId]);
        logger.debug('Query result:', result.rows);
  
        if (result.rows.length === 0) {
            logger.warn('Draft order not found');
            return res.status(404).json({ error: 'Draft order not found' });
        }
  
        const draftOrder = result.rows[0].draft_order;
  
        res.json(draftOrder);
    } catch (error) {
        logger.error('Error fetching draft order:', error);
        res.status(500).json({ error: 'Failed to fetch draft order' });
    }
});

// Get league details
router.get('/leagues/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
      // Fetch league details
      const result = await pool.query('SELECT * FROM leagues WHERE league_id = $1', [leagueId]);
      const league = result.rows[0];

      if (league) {
          res.json(league);
      } else {
          res.status(404).json({ error: 'League not found' });
      }
  } catch (error) {
      logger.error('Error fetching league details:', error);
      res.status(500).json({ error: 'Failed to fetch league details' });
  }
});

// get all player details
router.get('/players/:playerId', async (req, res) => {
    const { playerId } = req.params;

    try {
        const result = await pool.query('SELECT player_name, team_abrev FROM player WHERE player_id = $1', [playerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching player details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get available players
router.get('/leagues/:leagueId/available-players', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;
  
    try {
        const result = await pool.query(
            `SELECT p.player_id, p.player_name, p.team_abrev, p.role
             FROM player p
             LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = $1
             WHERE dp.player_id IS NULL`,
            [leagueId] // Passing the leagueId parameter
        );
  
        const availablePlayers = result.rows;
        res.json(availablePlayers);
    } catch (error) {
        logger.error('Error fetching available players:', error);
        res.status(500).json({ error: 'Failed to fetch available players' });
    }
});

// Start Draft
router.post('/leagues/:leagueId/start-draft', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;

    try {
        console.log(`Starting draft for league ${leagueId}`);

        // Check and initialize draft status
        const existingStatus = await pool.query('SELECT * FROM draft_status WHERE league_id = $1', [leagueId]);

        if (existingStatus.rows.length === 0) {
            // Create a new entry with initial values
            console.log('Draft status not found. Creating new entry.');
            await pool.query(
                'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, $3, $4)',
                [leagueId, 0, true, false] // Initialize currentTurnIndex to 0
            );
        } else {
            // Update the existing draft status
            console.log('Draft status found. Updating existing entry.');
            await pool.query(
                'UPDATE draft_status SET draft_started = TRUE, current_turn_index = $1 WHERE league_id = $2',
                [0, leagueId] // Ensure currentTurnIndex is set to 0
            );
        }

        // Send WebSocket message to clients to start the draft
        console.log(`Sending WebSocket message to start draft for league ${leagueId}`);
        ws.send(JSON.stringify({
            type: 'startDraft',
            leagueId: leagueId
        }));

        res.status(200).json({ message: 'Draft started successfully' });
    } catch (error) {
        logger.error('Error starting draft:', error);
        res.status(500).json({ error: 'Failed to start draft' });
    }
});

// Draft Status
router.post('/leagues/:leagueId/draft-status', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;
    const { currentTurnIndex, draftStarted, draftEnded } = req.body;

    // Validate input data
    if (typeof currentTurnIndex !== 'number' || typeof draftStarted !== 'boolean' || typeof draftEnded !== 'boolean') {
        logger.error('Invalid input data:', { currentTurnIndex, draftStarted, draftEnded });
        return res.status(400).json({ error: 'Invalid input data' });
    }

    try {
        // Fetch the number of users in the league
        const usersResult = await pool.query('SELECT COUNT(user_id) AS user_count FROM user_leagues WHERE league_id = $1', [leagueId]);
        const numberOfUsers = usersResult.rows[0].user_count;

        // Calculate the current round based on the number of users
        const turnsPerRound = numberOfUsers; // Each round consists of one turn per user
        const roundNumber = Math.floor((currentTurnIndex-1) / turnsPerRound) + 1;

        // Check if draft status already exists
        const existingStatus = await pool.query('SELECT * FROM draft_status WHERE league_id = $1', [leagueId]);

        // Insert or update draft status
        if (existingStatus.rows.length === 0) {
            await pool.query(
                'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, $3, $4)',
                [leagueId, currentTurnIndex, draftStarted, draftEnded]
            );
        } else {
            await pool.query(
                'UPDATE draft_status SET current_turn_index = $1, draft_started = $2, draft_ended = $3 WHERE league_id = $4',
                [currentTurnIndex, draftStarted, draftEnded, leagueId]
            );
        }

        logger.info(`League ${leagueId}: Current Round ${roundNumber}, Current Turn Index ${currentTurnIndex}`);

        res.status(200).json({ message: 'Draft status updated successfully', round: roundNumber });
    } catch (error) {
        logger.error('Error updating draft status:', error);
        res.status(500).json({ error: 'Failed to update draft status' });
    }
});
  
// Draft a player
router.post('/draft-player', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId, playerId, leagueId } = req.body;

        // Validate the input data
        if (!userId || !playerId || !leagueId) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        // Start a transaction
        await client.query('BEGIN');

        // Ensure league_team_id is fetched correctly
        const leagueTeamResult = await client.query(
            'SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2',
            [leagueId, userId]
        );

        if (leagueTeamResult.rows.length === 0) {
            throw new Error('League team not found');
        }

        const leagueTeamId = leagueTeamResult.rows[0].league_team_id;

        // Insert drafted player
        await client.query(
            'INSERT INTO drafted_players (league_id, player_id, league_team_id) VALUES ($1, $2, $3)',
            [leagueId, playerId, leagueTeamId]
        );

        // Update league_team_players table
        await client.query(
            'INSERT INTO league_team_players (league_team_id, player_id) VALUES ($1, $2)',
            [leagueTeamId, playerId]
        );

        // Commit transaction
        await client.query('COMMIT');

        // Fetch updated draft state
        const availablePlayers = await AvailablePlayers(leagueId);
        const draftOrder = await DraftOrder(leagueId);

        // Broadcast to all clients
        io.to(leagueId).emit('draftUpdate', { 
            availablePlayers, 
            draftOrder, 
            playerId, 
            userId 
        });

        res.json({ status: 'success' });
    } catch (error) {
        // Rollback transaction in case of an error
        await client.query('ROLLBACK');
        logger.error('Error drafting player:', error.message, error.stack);
        res.status(500).json({ status: 'error', message: 'Failed to draft player', error: error.message });
    } finally {
        client.release(); // Release the client back to the pool
    }
});
  
// Endpoint to get all players for a specific team
router.get('/teams/:teamId/players', authenticateToken, async (req, res) => {
    const { teamId } = req.params;

    try {
        const result = await pool.query(`
            SELECT p.player_id, p.player_name, p.team_abrev
            FROM league_team_players ltp
            JOIN player p ON ltp.player_id = p.player_id
            WHERE ltp.league_team_id = $1
        `, [teamId]);

        res.json({ players: result.rows });
    } catch (err) {
        console.error('Error fetching team players:', err);
        res.status(500).json({ error: 'Failed to fetch team players' });
    }
});

// End Draft
router.post('/leagues/:leagueId/end-draft', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;

    try {
        await pool.query(
            'UPDATE draft_status SET draft_ended = TRUE WHERE league_id = $1',
            [leagueId]
        );

        // Notify all clients that the draft has ended
        broadcastToLeague(leagueId, { type: 'draftEnded' });

        res.status(200).json({ message: 'Draft ended successfully' });
    } catch (error) {
        logger.error('Error ending the draft:', error);
        res.status(500).json({ error: 'Failed to end the draft' });
    }
});

module.exports = router;
