//routes/draftRoutes.js

// #region Dependencies
const express = require('express');
const { Pool } = require('pg');
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

// Endpoint to create a team
router.post('/create-team', authenticateToken, async (req, res) => {
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

// Get draft order for a specific league
router.get('/leagues/:leagueId/draft-order', authenticateToken, async (req, res) => {
    const { leagueId } = req.params;
    console.log(`Fetching draft order for league: ${leagueId}`);
  
    try {
        const result = await pool.query('SELECT draft_order FROM draft_orders WHERE league_id = $1', [leagueId]);
        console.log('Query result:', result.rows);
  
        if (result.rows.length === 0) {
            console.log('Draft order not found');
            return res.status(404).json({ error: 'Draft order not found' });
        }
  
        const draftOrder = result.rows[0].draft_order;
        console.log('Draft order:', draftOrder);
  
        res.json(draftOrder);
    } catch (error) {
        console.error('Error fetching draft order:', error);
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
      console.error('Error fetching league details:', error);
      res.status(500).json({ error: 'Failed to fetch league details' });
  }
});

// Get available players for a specific league
router.get('/leagues/:leagueId/available-players', authenticateToken, async (req, res) => {
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
  
// Update draft status for a specific league
router.post('/leagues/:leagueId/draft-status', authenticateToken, async (req, res) => {
const { leagueId } = req.params;
const { currentTurnIndex, draftStarted, draftEnded } = req.body;

try {
    // Check if draft status exists
    const existingStatus = await pool.query('SELECT * FROM draft_status WHERE league_id = $1', [leagueId]);

    if (existingStatus.rows.length === 0) {
        // Insert new draft status if not exists
        await pool.query(
            'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, $3, $4)',
            [leagueId, currentTurnIndex, draftStarted, draftEnded]
        );
    } else {
        // Update existing draft status
        await pool.query(
            'UPDATE draft_status SET current_turn_index = $1, draft_started = $2, draft_ended = $3 WHERE league_id = $4',
            [currentTurnIndex, draftStarted, draftEnded, leagueId]
        );
    }

    res.status(200).json({ message: 'Draft status updated successfully' });
} catch (error) {
    console.error('Error updating draft status:', error);
    res.status(500).json({ error: 'Failed to update draft status' });
}
});
  
// Draft a player
router.post('/draft-player', authenticateToken, async (req, res) => {
const { userId, playerId, leagueId } = req.body;

try {
    // Insert drafted player
    await pool.query(
        'INSERT INTO drafted_players (league_id, player_id, drafted_by) VALUES ($1, $2, $3)',
        [leagueId, playerId, userId]
    );

    // Update league_team_players table
    await pool.query(
        'INSERT INTO league_team_players (league_team_id, player_id) VALUES ((SELECT league_team_id FROM league_teams WHERE league_id = $1 AND user_id = $2), $3)',
        [leagueId, userId, playerId]
    );

    res.json({ status: 'success' });
} catch (error) {
    console.error('Error drafting player:', error);
    res.status(500).json({ status: 'error', message: 'Failed to draft player' });
}
});
  
router.post('/leagues/:leagueId/end-draft', authenticateToken, async (req, res) => {
const { leagueId } = req.params;

try {
    await pool.query(
        'UPDATE draft_status SET draft_ended = TRUE WHERE league_id = $1',
        [leagueId]
    );

    res.status(200).json({ message: 'Draft ended successfully' });
} catch (error) {
    console.error('Error ending the draft:', error);
    res.status(500).json({ error: 'Failed to end the draft' });
}
});

module.exports = router;