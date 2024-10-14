// routes/leagueRoutes.js

// #region Dependencies
const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Define the salt rounds for bcrypt
const authenticateToken = require('../middleware/authMiddleware');
const checkRosterLock = require('../middleware/checkRosterLock');
const { isWithinRosterLockPeriod } = require('../utils/timeUtils');
const logger = require('../utils/logger');
const cron = require('node-cron'); // For scheduling tasks
const { createClient } = require('@supabase/supabase-js'); // Supabase client

const router = express.Router();

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// API endpoint to create a league
router.post('/create-league', authenticateToken, async (req, res) => {
  logger.info('API request received for create-league');
  const { league_name, league_pass, description, team_name } = req.body;
  const owner_id = req.user.userId; // Get the user ID from the JWT token

  try {
    if (!league_name || !league_pass || !description || !owner_id || !team_name) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const hashedPass = await bcrypt.hash(league_pass, saltRounds);

    const { data: newLeague, error: leagueError } = await supabase
      .from('leagues')
      .insert([{ league_name, league_pass: hashedPass, description, owner_id }])
      .select();

    if (leagueError) throw leagueError;

    const league_id = newLeague[0].league_id;

    const initialDraftOrder = [];

    await supabase
      .from('draft_orders')
      .insert([{ league_id, draft_order: JSON.stringify(initialDraftOrder) }]);

    await supabase
      .from('draft_status')
      .insert([{ league_id, current_turn_index: -1, draft_started: false, draft_ended: false }]);

    await supabase
      .from('league_teams')
      .insert([{ league_id, team_name, user_id: owner_id }]);

    res.status(201).json({ success: true, league: { league_id, league_name, description, owner_id }, team: { team_name, owner_id } });
  } catch (error) {
    logger.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league and team', error: error.message });
  }
});

// Join League and Create Team Endpoint
router.post('/join-league', authenticateToken, async (req, res) => {
  const { league_name, passcode, team_name } = req.body;
  const user_id = req.user.userId;

  try {
    if (!league_name || !passcode || !user_id || !team_name) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id, league_pass')
      .eq('league_name', league_name)
      .single();

    if (leagueError || !league) {
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    const isPasscodeValid = await bcrypt.compare(passcode, league.league_pass);
    if (!isPasscodeValid) {
      return res.status(400).json({ success: false, message: 'Incorrect passcode' });
    }

    const { data: existingMembership, error: membershipError } = await supabase
      .from('user_leagues')
      .select('*')
      .eq('league_id', league.league_id)
      .eq('user_id', user_id)
      .single();

    if (existingMembership) {
      return res.status(400).json({ success: false, message: 'You are already a member of this league' });
    }

    const { data: userCountData } = await supabase
      .from('user_leagues')
      .select('user_id', { count: 'exact' })
      .eq('league_id', league.league_id);

    if (userCountData.length >= 8) {
      return res.status(400).json({ success: false, message: 'League has reached the maximum number of users (7)' });
    }

    const { data: teamNameCheck } = await supabase
      .from('league_teams')
      .select('*')
      .eq('league_id', league.league_id)
      .ilike('team_name', team_name)
      .single();

    if (teamNameCheck) {
      return res.status(400).json({ success: false, message: 'Team name already exists within this league' });
    }

    await supabase.from('user_leagues').insert([{ user_id, league_id: league.league_id }]);

    await supabase.from('league_teams').insert([{ league_id: league.league_id, team_name, user_id }]);

    res.status(200).json({ success: true, message: 'Successfully joined the league and created a team' });
  } catch (error) {
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

    // Fetch the league by league_name
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('league_name', league_name)
      .single();

    if (leagueError || !league) {
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    // Check if the user is a member of the league
    const { data: membership, error: membershipError } = await supabase
      .from('user_leagues')
      .select('*')
      .eq('league_id', league.league_id)
      .eq('user_id', user_id)
      .single();

    if (membershipError || !membership) {
      return res.status(400).json({ success: false, message: 'You are not a member of this league' });
    }

    // Remove the user from the league
    const { error: deleteError } = await supabase
      .from('user_leagues')
      .delete()
      .eq('league_id', league.league_id)
      .eq('user_id', user_id);

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({ success: true, message: 'Successfully left the league' });
  } catch (error) {
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
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('league_name', leagueName)
      .single();

    if (leagueError || !league) {
      return res.status(404).json({ success: false, message: 'League not found' });
    }

    // Return the league ID
    res.json({ success: true, league_id: league.league_id });
  } catch (error) {
    logger.error('Error fetching league ID:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch league ID', error: error.message });
  }
});

router.get('/user-leagues', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: No user ID found' });
  }

  try {
    // Fetch leagues that the user is part of using Supabase
    const { data, error } = await supabase
      .from('user_leagues')
      .select('league_id, leagues (league_name, description)')
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching user leagues:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Map the response data to format the result
    const leagues = data.map(league => ({
      league_id: league.league_id,
      league_name: league.leagues.league_name,
      description: league.leagues.description,
    }));

    res.json(leagues);
  } catch (error) {
    logger.error('Error fetching user leagues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get the current user's team ID for a league
router.get('/:leagueId/team-id', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId; // Assuming user ID is available from the token

  try {
    // Query to get the user's team ID in the specified league
    const { data: userTeam, error } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (error || !userTeam) {
      return res.status(404).json({ success: false, error: 'Team not found for the current user in this league.' });
    }

    res.status(200).json({ success: true, teamId: userTeam.league_team_id });
  } catch (error) {
    logger.error('Error fetching user team ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user team ID.' });
  }
});

// API Endpoint to Get Team Information for a User
router.get('/:userId/:leagueId/team', authenticateToken, async (req, res) => {
  const { userId, leagueId } = req.params;

  try {
    // Fetch the team information for the user
    const { data: teamResult, error } = await supabase
      .from('league_team_players')
      .select('league_team_id, player_id, starter')
      .eq('league_teams.user_id', userId)
      .eq('league_teams.league_id', leagueId)
      .join('league_teams', 'league_team_players.league_team_id', 'league_teams.league_team_id');

    if (error || teamResult.length === 0) {
      return res.status(404).json({ error: 'No team found for the user.' });
    }

    const teams = teamResult.map(row => ({
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
    const { data: leagueTeamResult, error: teamError } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .single();

    if (teamError || !leagueTeamResult) {
      return res.status(404).json({ error: 'No team found for the user in this league.' });
    }

    const leagueTeamId = leagueTeamResult.league_team_id;

    // 2. Fetch players along with their points for the current week
    const { data: playersResult, error: playerError } = await supabase
      .from('league_team_players')
      .select('player.player_name, player.role, player.team_abrev, SUM(series_player_stats.adjusted_points) AS points, league_team_players.starter')
      .leftJoin('player', 'league_team_players.player_id', 'player.player_id')
      .leftJoin('series_player_stats', 'player.player_id', 'series_player_stats.player_id')
      .eq('league_team_players.league_team_id', leagueTeamId)
      .eq('series_player_stats.week', currentWeek)
      .group('player.player_name, player.role, player.team_abrev, league_team_players.starter');

    if (playerError) {
      throw playerError;
    }

    // 4. Format the points to have two decimal places before sending to the client
    const formattedPlayers = playersResult.map(player => ({
      player_name: player.player_name,
      role: player.role,
      team_abrev: player.team_abrev,
      points: parseFloat(player.points?.toFixed(2) || '0.00'),
      starter: player.starter
    }));

    // 5. Send the formatted player's data back to the client
    res.json(formattedPlayers);
  } catch (error) {
    logger.error('Error fetching team data:', error);
    res.status(500).json({ error: 'An error occurred while fetching team data.' });
  }
});

// Get available players
router.get('/:leagueId/available-players', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
    // Check if the league exists
    const { data: leagueCheck, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (leagueError || !leagueCheck) {
      return res.status(404).json({ error: 'League not found' });
    }

    // Fetch available players not assigned to any team in the league
    const { data: availablePlayers, error: playerError } = await supabase
      .from('player')
      .select('player_id, player_name, team_abrev, role')
      .not('player_id', 'in', supabase
        .from('league_team_players')
        .select('player_id')
        .eq('league_id', leagueId)
      );

    if (playerError) {
      throw playerError;
    }

    res.json(availablePlayers);
  } catch (error) {
    logger.error('Error fetching available players:', error);
    res.status(500).json({ error: 'Failed to fetch available players' });
  }
});

// Endpoint to sign a free agent
router.post('/:leagueId/sign-player', authenticateToken, checkRosterLock, async (req, res) => {
  const { leagueId } = req.params;
  const { playerIdToSign, playerIdToDrop } = req.body;
  const userId = req.user.userId;

  if (!playerIdToSign || !playerIdToDrop) {
    return res.status(400).json({ success: false, error: 'Missing player IDs.' });
  }

  try {
    // Check if the league exists
    const { data: leagueCheck, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (leagueError || !leagueCheck) {
      return res.status(404).json({ success: false, error: 'League not found.' });
    }

    // Fetch the role of the player to sign
    const { data: playerToSign, error: signError } = await supabase
      .from('player')
      .select('role')
      .eq('player_id', playerIdToSign)
      .single();

    if (signError || !playerToSign) {
      return res.status(404).json({ success: false, error: 'Player to sign not found.' });
    }

    const roleToSign = playerToSign.role;

    // Fetch the role and starter status of the player to drop
    const { data: playerToDrop, error: dropError } = await supabase
      .from('league_team_players')
      .select('player.role, starter')
      .eq('player_id', playerIdToDrop)
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (dropError || !playerToDrop) {
      return res.status(404).json({ success: false, error: 'Player to drop not found on your team.' });
    }

    const roleToDrop = playerToDrop.role;
    const isStarter = playerToDrop.starter;

    // Ensure roles match
    if (roleToSign !== roleToDrop) {
      return res.status(400).json({ success: false, error: 'Role mismatch. You can only sign a player with the same role as the player you are dropping.' });
    }

    // Start transaction
    const { error: transactionError } = await supabase
      .rpc('begin', {}); // Start transaction equivalent

    if (transactionError) throw transactionError;

    // Remove the player to drop
    const { error: removeError } = await supabase
      .from('league_team_players')
      .delete()
      .eq('player_id', playerIdToDrop)
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    if (removeError) throw removeError;

    // Add the player to sign with the same starter status
    const { error: addError } = await supabase
      .from('league_team_players')
      .insert([{ league_team_id: leagueId, player_id: playerIdToSign, starter: isStarter }]);

    if (addError) throw addError;

    // Commit transaction
    await supabase.rpc('commit', {});

    res.status(200).json({ success: true, message: 'Player signed successfully.' });
  } catch (error) {
    // Rollback in case of error
    await supabase.rpc('rollback', {}); // Rollback transaction equivalent
    logger.error('Error signing player:', error);
    res.status(500).json({ success: false, error: 'Failed to sign player.' });
  }
});

// Endpoint to get user's bench players
router.get('/:leagueId/bench-players', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the league exists
    const { data: leagueCheck, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (leagueError || !leagueCheck) {
      return res.status(404).json({ success: false, error: 'League not found.' });
    }

    // Fetch bench players where starter is FALSE
    const { data: benchPlayers, error: benchError } = await supabase
      .from('player')
      .select('player_id, player_name, team_abrev, role')
      .eq('league_team_players.league_id', leagueId)
      .eq('league_teams.user_id', userId)
      .eq('league_team_players.starter', false)
      .join('league_team_players', 'player.player_id', 'league_team_players.player_id')
      .join('league_teams', 'league_team_players.league_team_id', 'league_teams.league_team_id');

    if (benchError) {
      throw benchError;
    }

    res.status(200).json({ success: true, availableBenchPlayers: benchPlayers });
  } catch (error) {
    logger.error('Error fetching bench players:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bench players.' });
  }
});

// Draft Status
router.get('/:leagueId/draft-status', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
    const { data: draftStatus, error } = await supabase
      .from('draft_status')
      .select('current_turn_index, draft_started, draft_ended')
      .eq('league_id', leagueId)
      .single();

    if (error || !draftStatus) {
      return res.status(404).json({ error: 'Draft status not found' });
    }

    res.status(200).json(draftStatus);
  } catch (error) {
    logger.error('Error fetching draft status:', error);
    res.status(500).json({ error: 'Failed to fetch draft status' });
  }
});

// Update Lineup
router.post('/update-lineup', authenticateToken, checkRosterLock, async (req, res) => {
  const { starters } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(starters)) {
    return res.status(400).json({ success: false, message: 'Invalid request format: starters must be an array' });
  }

  try {
    // Get the user's league_team_id
    const { data: leagueTeam, error: teamError } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('user_id', userId)
      .single();

    if (teamError || !leagueTeam) {
      return res.status(404).json({ success: false, message: 'Team not found for user' });
    }

    const leagueTeamId = leagueTeam.league_team_id;

    // Begin transaction
    const { error: transactionError } = await supabase.rpc('begin');

    if (transactionError) throw transactionError;

    // Set all players on the team to bench (starter = false)
    const { error: benchError } = await supabase
      .from('league_team_players')
      .update({ starter: false })
      .eq('league_team_id', leagueTeamId);

    if (benchError) throw benchError;

    // Update starters (set starter = true)
    if (starters.length > 0) {
      const { error: starterError } = await supabase
        .from('league_team_players')
        .update({ starter: true })
        .eq('league_team_id', leagueTeamId)
        .in('player_id', starters);

      if (starterError) throw starterError;
    }

    // Commit transaction
    await supabase.rpc('commit');

    res.status(200).json({ success: true, message: 'Lineup updated successfully' });
  } catch (error) {
    // Rollback transaction if an error occurred
    await supabase.rpc('rollback');
    logger.error('Error updating lineup:', error);
    res.status(500).json({ success: false, message: 'Failed to update lineup' });
  }
});

// Player Names to ID
router.post('/player-names-to-id', async (req, res) => {
  const { playerNames } = req.body;

  if (!Array.isArray(playerNames) || playerNames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid player names' });
  }

  try {
    const { data: players, error } = await supabase
      .from('player')
      .select('player_id, player_name')
      .in('player_name', playerNames);

    if (error) {
      throw error;
    }

    const playerMap = players.reduce((acc, player) => {
      acc[player.player_name] = player.player_id;
      return acc;
    }, {});

    res.status(200).json({ success: true, playerMap });
  } catch (error) {
    logger.error('Error fetching player IDs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch player IDs' });
  }
});

// IDs to Names
router.post('/ids-to-names', async (req, res) => {
  const { playerIds } = req.body;

  if (!Array.isArray(playerIds)) {
    return res.status(400).json({ error: 'Invalid input, expected an array of player IDs.' });
  }

  try {
    const { data: players, error } = await supabase
      .from('player')
      .select('player_id, player_name, team_abrev, role')
      .in('player_id', playerIds);

    if (error) {
      throw error;
    }

    const playerMap = players.reduce((acc, player) => {
      acc[player.player_id] = {
        player_name: player.player_name,
        team_abrev: player.team_abrev,
        role: player.role,
      };
      return acc;
    }, {});

    res.status(200).json(playerMap);
  } catch (error) {
    logger.error('Error fetching player names:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current week
router.get('/current-week', async (req, res) => {
  try {
    const now = new Date(); // Current server time in UTC

    const { data: weekData, error } = await supabase
      .from('weeks')
      .select('week_number')
      .lte('start_date', now)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !weekData) {
      return res.status(404).json({ message: 'No current week found.' });
    }

    const currentWeek = weekData.week_number;
    res.json({ currentWeek });
  } catch (error) {
    console.error('Error fetching current week:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Get all weeks
router.get('/weeks', authenticateToken, async (req, res) => {
  try {
    const { data: weeks, error } = await supabase
      .from('weeks')
      .select('week_number, start_date')
      .order('week_number', { ascending: true });

    if (error || !weeks.length) {
      return res.status(404).json({ message: 'No weeks data found.' });
    }

    res.json({ weeks });
  } catch (error) {
    console.error('Error fetching weeks data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Get schedule for a league
router.get('/:leagueId/schedule', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
    const { data: schedule, error } = await supabase
      .from('user_schedule')
      .select(`
        schedule_id, 
        week_number,
        home_team:league_teams(league_team_id, users(username)),
        away_team:league_teams(league_team_id, users(username)),
        home_team_score, 
        away_team_score, 
        winner_team_id, 
        is_tie
      `)
      .eq('league_id', leagueId)
      .order('week_number', { ascending: true })
      .order('schedule_id', { ascending: true });

    if (error || !schedule.length) {
      return res.status(200).json({
        success: false,
        message: 'Schedule will be created after the draft!',
        schedule: [],
      });
    }

    res.status(200).json({ success: true, schedule });
  } catch (error) {
    console.error('Error fetching league schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch league schedule.' });
  }
});

// Get the current week's opponents for the user's team in a league
router.get('/next-opponent/:leagueId', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId;

  try {
    // Get the user's team ID in the league
    const { data: teamData, error: teamError } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (teamError || !teamData) {
      return res.status(404).json({ error: 'Team not found for user in this league.' });
    }

    const leagueTeamId = teamData.league_team_id;

    // Get the current week
    const now = new Date();
    const { data: weekData, error: weekError } = await supabase
      .from('weeks')
      .select('week_number')
      .lte('start_date', now)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (weekError || !weekData) {
      return res.status(404).json({ error: 'Current week not found.' });
    }

    const currentWeek = weekData.week_number;

    // Get matchups for the current week
    const { data: matchups, error: matchupError } = await supabase
      .from('user_schedule')
      .select(`
        week_number, 
        lt:league_teams(team_name)
      `)
      .eq('league_id', leagueId)
      .eq('week_number', currentWeek)
      .or(`home_team_id.eq.${leagueTeamId},away_team_id.eq.${leagueTeamId}`)
      .neq('lt.league_team_id', leagueTeamId)
      .order('week_number', { ascending: true });

    if (matchupError || !matchups.length) {
      return res.status(404).json({ message: 'No upcoming matchups found for the current week.' });
    }

    const opponents = matchups.map((row) => ({
      week_number: row.week_number,
      opponent_name: row.lt.team_name,
    }));

    res.json({ opponents });
  } catch (error) {
    console.error('Error fetching current week opponents:', error);
    res.status(500).json({ error: 'An error occurred while fetching the current week opponents.' });
  }
});

// Endpoint to get league standings
router.get('/:leagueId/standings', authenticateToken, async (req, res) => {
  const { leagueId } = req.params;

  try {
    // Query to get standings data
    const { data: standings, error } = await supabase
      .from('team_standings')
      .select(`
        wins,
        losses,
        ties,
        league_teams(team_name, users(username))
      `)
      .eq('league_teams.league_id', leagueId)
      .order('wins', { ascending: false })
      .order('ties', { ascending: false })
      .order('losses', { ascending: true });

    if (error) {
      throw error;
    }

    // Calculate points (wins * 3 + ties) in the application layer
    const formattedStandings = standings.map(team => ({
      ...team,
      points: team.wins * 3 + team.ties, // Calculate points
    }));

    res.status(200).json({ success: true, standings: formattedStandings });
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
    // Get the sender's and receiver's team IDs
    const { data: senderTeam, error: senderError } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    const { data: receiverTeam, error: receiverError } = await supabase
      .from('league_teams')
      .select('league_team_id')
      .eq('league_id', leagueId)
      .eq('user_id', receiverUserId)
      .single();

    if (senderError || !senderTeam) {
      return res.status(404).json({ success: false, error: 'Sender team not found.' });
    }

    if (receiverError || !receiverTeam) {
      return res.status(404).json({ success: false, error: 'Receiver team not found.' });
    }

    // Check if the players are already involved in an active trade request
    const { data: activeTrade, error: activeTradeError } = await supabase
      .from('trade_requests')
      .select('*')
      .eq('league_id', leagueId)
      .eq('status', 'Pending')
      .or(`sender_player_id.eq.${senderPlayerId},receiver_player_id.eq.${senderPlayerId},sender_player_id.eq.${receiverPlayerId},receiver_player_id.eq.${receiverPlayerId}`);

    if (activeTrade.length > 0) {
      return res.status(400).json({ success: false, error: 'One of the players is already involved in an active trade request.' });
    }

    // Fetch roles of the players being traded
    const { data: senderRole, error: senderRoleError } = await supabase
      .from('player')
      .select('role')
      .eq('player_id', senderPlayerId)
      .single();

    const { data: receiverRole, error: receiverRoleError } = await supabase
      .from('player')
      .select('role')
      .eq('player_id', receiverPlayerId)
      .single();

    if (senderRoleError || receiverRoleError || senderRole.role !== receiverRole.role) {
      return res.status(400).json({ success: false, error: 'Players must have the same role for a trade.' });
    }

    // Insert the trade request
    const { data: tradeRequest, error: tradeRequestError } = await supabase
      .from('trade_requests')
      .insert({
        league_id: leagueId,
        sender_team_id: senderTeam.league_team_id,
        receiver_team_id: receiverTeam.league_team_id,
        sender_player_id: senderPlayerId,
        receiver_player_id: receiverPlayerId,
        status: 'Pending'
      })
      .select('trade_request_id')
      .single();

    if (tradeRequestError) {
      throw tradeRequestError;
    }

    res.status(200).json({ success: true, message: 'Trade request sent successfully.', tradeRequestId: tradeRequest.trade_request_id });
  } catch (error) {
    console.error('Error sending trade request:', error);
    res.status(500).json({ success: false, error: 'Failed to send trade request.' });
  }
});

// Endpoint to accept a trade request
router.post('/trade-request/:tradeRequestId/accept', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
    // Fetch the trade request details
    const { data: tradeRequest, error: tradeRequestError } = await supabase
      .from('trade_requests')
      .select('*')
      .eq('trade_request_id', tradeRequestId)
      .eq('status', 'Pending')
      .single();

    if (tradeRequestError || !tradeRequest) {
      return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
    }

    // Ensure the user is the receiver of the trade request
    const { data: receiverTeam, error: receiverTeamError } = await supabase
      .from('league_teams')
      .select('user_id')
      .eq('league_team_id', tradeRequest.receiver_team_id)
      .single();

    if (receiverTeamError || receiverTeam.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'You are not authorized to accept this trade request.' });
    }

    // Start a transaction
    const { error: transactionError } = await supabase
      .rpc('start_transaction');

    // Swap the players between the teams
    const { error: senderUpdateError } = await supabase
      .from('league_team_players')
      .update({ player_id: tradeRequest.receiver_player_id })
      .eq('player_id', tradeRequest.sender_player_id)
      .eq('league_team_id', tradeRequest.sender_team_id);

    const { error: receiverUpdateError } = await supabase
      .from('league_team_players')
      .update({ player_id: tradeRequest.sender_player_id })
      .eq('player_id', tradeRequest.receiver_player_id)
      .eq('league_team_id', tradeRequest.receiver_team_id);

    if (senderUpdateError || receiverUpdateError) {
      throw senderUpdateError || receiverUpdateError;
    }

    // Update the trade request status to 'Accepted'
    const { error: updateStatusError } = await supabase
      .from('trade_requests')
      .update({ status: 'Accepted' })
      .eq('trade_request_id', tradeRequestId);

    if (updateStatusError) {
      throw updateStatusError;
    }

    // Commit the transaction
    const { error: commitError } = await supabase
      .rpc('commit_transaction');

    res.status(200).json({ success: true, message: 'Trade request accepted.' });
  } catch (error) {
    // Rollback in case of error
    const { error: rollbackError } = await supabase
      .rpc('rollback_transaction');

    console.error('Error accepting trade request:', error);
    res.status(500).json({ success: false, error: 'Failed to accept trade request.' });
  }
});

// Endpoint to reject a trade request
router.post('/trade-request/:tradeRequestId/reject', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
    // Fetch the trade request details
    const { data: tradeRequest, error: tradeRequestError } = await supabase
      .from('trade_requests')
      .select('receiver_team_id, status')
      .eq('trade_request_id', tradeRequestId)
      .eq('status', 'Pending')
      .single();

    if (tradeRequestError || !tradeRequest) {
      return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
    }

    // Ensure the user is the receiver of the trade request
    const { data: receiverTeam, error: receiverTeamError } = await supabase
      .from('league_teams')
      .select('user_id')
      .eq('league_team_id', tradeRequest.receiver_team_id)
      .single();

    if (receiverTeamError || receiverTeam.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'You are not authorized to reject this trade request.' });
    }

    // Update the trade request status to 'Rejected'
    const { error: updateStatusError } = await supabase
      .from('trade_requests')
      .update({ status: 'Rejected' })
      .eq('trade_request_id', tradeRequestId);

    if (updateStatusError) {
      throw updateStatusError;
    }

    res.status(200).json({ success: true, message: 'Trade request rejected.' });
  } catch (error) {
    console.error('Error rejecting trade request:', error);
    res.status(500).json({ success: false, error: 'Failed to reject trade request.' });
  }
});

// Endpoint to cancel a trade request
router.post('/trade-request/:tradeRequestId/cancel', authenticateToken, checkRosterLock, async (req, res) => {
  const { tradeRequestId } = req.params;
  const userId = req.user.userId;

  try {
    // Fetch the trade request details
    const { data: tradeRequest, error: tradeRequestError } = await supabase
      .from('trade_requests')
      .select('sender_team_id, status')
      .eq('trade_request_id', tradeRequestId)
      .eq('status', 'Pending')
      .single();

    if (tradeRequestError || !tradeRequest) {
      return res.status(404).json({ success: false, error: 'Trade request not found or already processed.' });
    }

    // Ensure the user is the sender of the trade request
    const { data: senderTeam, error: senderTeamError } = await supabase
      .from('league_teams')
      .select('user_id')
      .eq('league_team_id', tradeRequest.sender_team_id)
      .single();

    if (senderTeamError || senderTeam.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'You are not authorized to cancel this trade request.' });
    }

    // Update the trade request status to 'Cancelled'
    const { error: updateStatusError } = await supabase
      .from('trade_requests')
      .update({ status: 'Cancelled' })
      .eq('trade_request_id', tradeRequestId);

    if (updateStatusError) {
      throw updateStatusError;
    }

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
    const { data: activeTrades, error: activeTradesError } = await supabase
      .from('trade_requests')
      .select(`
        trade_request_id,
        sender_team_id,
        receiver_team_id,
        sender_player_id,
        receiver_player_id,
        status,
        sender_team:league_teams!trade_requests_sender_team_id_fkey(user_id, user:users(username)),
        receiver_team:league_teams!trade_requests_receiver_team_id_fkey(user_id, user:users(username))
      `)
      .eq('league_id', leagueId)
      .eq('status', 'Pending')
      .or(`sender_team.user_id.eq.${userId},receiver_team.user_id.eq.${userId}`);

    if (activeTradesError) {
      throw activeTradesError;
    }

    if (!activeTrades || activeTrades.length === 0) {
      return res.status(200).json({ success: true, trades: [] });
    }

    // Format the trade requests data
    const formattedTrades = activeTrades.map(trade => ({
      trade_request_id: trade.trade_request_id,
      sender_team_id: trade.sender_team_id,
      receiver_team_id: trade.receiver_team_id,
      sender_player_id: trade.sender_player_id,
      receiver_player_id: trade.receiver_player_id,
      status: trade.status,
      sender_username: trade.sender_team?.user?.username || 'Unknown',
      receiver_username: trade.receiver_team?.user?.username || 'Unknown',
    }));

    res.status(200).json({ success: true, trades: formattedTrades });
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

// Scheduled Task to Process Data Every 15 Minutes From Friday 5 PM EST to Sunday 11:59 PM EST
cron.schedule('*/15 * * * *', async () => {
  try {
    // Check if we are within the roster lock period (Friday 5 PM to Sunday 11:59 PM EST)
    if (isWithinRosterLockPeriod()) {
      await processWeekIncrement(); // Perform your processing logic
      console.log('Week increment processed successfully.');
    } else {
      console.log('Not within the weekend processing window.');
    }
  } catch (error) {
    console.error('Error in weekend data processing task:', error);
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
