// routes/valStatsRoutes.js

// Dependencies
const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
const pool = require('../db'); // Import the db.js connection

// API endpoint to get player stats
router.get('/player-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;

    if (team_abrev) {
      logger.info(`Received request for player-stats with team_abrev: ${team_abrev}`);
    } else {
      logger.info('Received request for player-stats without team_abrev');
    }

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
        JOIN teams t ON p.team_id = t.team_id
      )
      SELECT * FROM PlayerStats
    `;

    const params = [];
    if (team_abrev) {
      query += ` WHERE team_abrev = $1 ORDER BY total_points DESC`;
      params.push(team_abrev);
    } else {
      query += ` ORDER BY total_points DESC`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error executing query for player-stats:', err.message, err.stack);
    res.status(500).json({ error: 'Error executing query', details: err.message });
  }
});

// API endpoint to get match stats with optional filters for team, split, and week
router.get('/match-stats', async (req, res) => {
  try {
    const { team_abrev, split, week } = req.query;

    logger.info(`Received request for match-stats with filters:`, { team_abrev, split, week });

    let query = `
      WITH SeriesStats AS (
        SELECT 
          sps.player_id,
          sps.series_maps,
          sps.series_kills,
          sps.series_deaths,
          sps.series_assists,
          sps.series_fk,
          sps.series_fd,
          sps.series_clutches,
          sps.series_aces,
          sps.avg_adr_per_series,
          sps.adjusted_points,
          p.player_name,
          t.team_abrev,
          s.week,
          s.split
        FROM series_player_stats sps
        JOIN player p ON sps.player_id = p.player_id
        JOIN teams t ON p.team_id = t.team_id
        JOIN series s ON sps.series_id = s.series_id
      )
      SELECT * FROM SeriesStats
    `;

    const params = [];
    const conditions = [];

    // Add filters to query
    if (team_abrev) {
      conditions.push(`team_abrev = $${conditions.length + 1}`);
      params.push(team_abrev);
    }
    if (split) {
      conditions.push(`split = $${conditions.length + 1}`);
      params.push(split);
    }
    if (week) {
      conditions.push(`week = $${conditions.length + 1}`);
      params.push(week);
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY week ASC, split ASC, player_name ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error executing query for match-stats:', err.message, err.stack);
    res.status(500).json({ error: 'Error executing query', details: err.message });
  }
});

module.exports = router;
