// routes/valStatsRoutes.js

// Dependencies
const express = require('express');
const { Pool } = require('pg');
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

// API endpoint to get player stats
router.get('/player-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;
    if (team_abrev) {
      logger.info(`Received request for player-stats with team_abrev: ${team_abrev}`); // Log request details
    } else {
      logger.info('Received request for player-stats without team_abrev'); // Log request details
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
    logger.error('Error executing query for player-stats:', err.message, err.stack); // Log error details
    res.status(500).send('Error executing query');
  }
});

// API endpoint to get match stats
router.get('/match-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;
    if (team_abrev) {
      logger.info(`Received request for match-stats with team_abrev: ${team_abrev}`); // Log request details
    } else {
      logger.info('Received request for match-stats without team_abrev'); // Log request details
    }

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
    logger.error('Error executing query for match-stats:', err.message, err.stack); // Log error details
    res.status(500).json({ error: 'Error executing query' }); // Send JSON error response
  }
});

module.exports = router;