// Dependencies
const express = require('express');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// API endpoint to get player stats
router.get('/player-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;

    if (team_abrev) {
      logger.info(`Received request for player-stats with team_abrev: ${team_abrev}`);
    } else {
      logger.info('Received request for player-stats without team_abrev');
    }

    // Query to get player stats and team abbreviation
    let query = supabase
      .from('total_stats')
      .select(`
        player_id,
        total_maps_played,
        total_kills,
        total_deaths,
        total_assists,
        total_fk,
        total_fd,
        total_clutches,
        total_aces,
        total_adr,
        total_points,
        player (
          player_name,
          team_id
        )
      `)
      .order('total_points', { ascending: false });

    const { data: playerStats, error: playerError } = await query;

    if (playerError) {
      logger.error('Supabase query error for player-stats:', playerError.message);
      throw playerError;
    }

    // Now we need to get the team abbreviation separately
    const teamIds = playerStats.map(stat => stat.player.team_id);
    
    // Query to get team abbreviations based on team IDs
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select(`
        team_id,
        team_abrev
      `)
      .in('team_id', teamIds);  // Fetch for multiple teams

    if (teamError) {
      logger.error('Supabase query error for team-abrev:', teamError.message);
      throw teamError;
    }

    // Map team abbreviations back to player stats
    const teamMap = teams.reduce((acc, team) => {
      acc[team.team_id] = team.team_abrev;
      return acc;
    }, {});

    const roundedStats = playerStats.map(stat => ({
      ...stat,
      team_abrev: teamMap[stat.player.team_id],  // Map the team abbreviation back to player stats
      total_points: parseFloat(stat.total_points.toFixed(2)),
    }));

    res.json(roundedStats);
  } catch (err) {
    logger.error('Error executing query for player-stats:', err.message, err.stack);
    res.status(500).json({ error: 'Error executing query', details: err.message });
  }
});

// API endpoint to get match stats
router.get('/match-stats', async (req, res) => {
  try {
    const { team_abrev } = req.query;

    if (team_abrev) {
      logger.info(`Received request for match-stats with team_abrev: ${team_abrev}`);
    } else {
      logger.info('Received request for match-stats without team_abrev');
    }

    // First, fetch match stats data
    let query = supabase
      .from('series_player_stats')
      .select(`
        player_id,
        series_maps,
        series_kills,
        series_deaths,
        series_assists,
        series_fk,
        series_fd,
        series_clutches,
        series_aces,
        avg_adr_per_series,
        adjusted_points,
        series_id
      `)
      .order('series_id', { ascending: true });

    if (team_abrev) {
      // If filtering by team abbreviation, we'll handle that later after fetching the teams
      logger.info(`Will filter by team_abrev later: ${team_abrev}`);
    }

    const { data: matchStats, error: matchStatsError } = await query;

    if (matchStatsError) {
      logger.error('Supabase query error for match-stats:', matchStatsError.message);
      throw matchStatsError;
    }

    // Now we need to get player and team data based on the player_id from matchStats
    const playerIds = matchStats.map(stat => stat.player_id);

    const { data: players, error: playersError } = await supabase
      .from('player')
      .select('player_id, team_id, player_name')
      .in('player_id', playerIds);  // Fetch for multiple players

    if (playersError) {
      logger.error('Supabase query error for players:', playersError.message);
      throw playersError;
    }

    // Extract team_ids from the players
    const teamIds = players.map(player => player.team_id);

    // Fetch the team abbreviations for the relevant teams
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('team_id, team_abrev')
      .in('team_id', teamIds);

    if (teamError) {
      logger.error('Supabase query error for team-abrev:', teamError.message);
      throw teamError;
    }

    // Map team abbreviations back to the players
    const teamMap = teams.reduce((acc, team) => {
      acc[team.team_id] = team.team_abrev;
      return acc;
    }, {});

    // Map player data back to match stats and attach the relevant team abbreviation
    const enrichedMatchStats = matchStats.map(stat => {
      const player = players.find(p => p.player_id === stat.player_id);
      const teamAbrev = teamMap[player.team_id];

      return {
        ...stat,
        player_name: player.player_name,
        team_abrev: teamAbrev,
      };
    });

    // If filtering by team_abrev, apply the filter here
    const filteredStats = team_abrev
      ? enrichedMatchStats.filter(stat => stat.team_abrev === team_abrev)
      : enrichedMatchStats;

    res.json(filteredStats);
  } catch (err) {
    logger.error('Error executing query for match-stats:', err.message, err.stack);
    res.status(500).json({ error: 'Error executing query', details: err.message });
  }
});

module.exports = router;
