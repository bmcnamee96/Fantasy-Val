// socketio.js

const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { Pool } = require('pg'); // Database connection
const logger = require('./utils/logger');
const clients = new Map();

let draftStarted = false;
let draftEnded = false;
let currentTurnIndex = 0; // Index of the current turn
let turnDuration = 5;
let maxRounds = 6;
let turnTimer = null;
let currentTurnTimer = null; // Variable to store the active timer

// Create a new pool instance for database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// -------------------------------------------------------------------------- //

function getUserIdFromSocketId(socketId) {
  for (let [userId, clientInfo] of clients.entries()) {
      if (clientInfo.socket.id === socketId) {
          return userId; // Return the userId corresponding to this socketId
      }
  }
  return null; // Return null if no userId is found for the given socketId
}

async function getDraftStatus(leagueId) {
  const query = `
      SELECT current_turn_index, draft_started, draft_ended
      FROM draft_status
      WHERE league_id = $1
  `;

  try {
      const result = await pool.query(query, [leagueId]);
      if (result.rows.length === 0) {
          throw new Error(`No draft status found for league ${leagueId}`);
      }

      return result.rows[0]; // Assuming league_id is unique
  } catch (error) {
      console.error('Error fetching draft status:', error);
      return null;
  }
}

async function getAvailablePlayers(leagueId) {
  // Convert leagueId to an integer and check for NaN
  const leagueIdInt = parseInt(leagueId, 10);

  console.log('Fetching available players for leagueId:', leagueIdInt);

  const query = `
      SELECT p.player_id, p.player_name, p.team_abrev, p.role
      FROM player p
      LEFT JOIN drafted_players dp
      ON p.player_id = dp.player_id AND dp.league_id = $1
      WHERE p.team_abrev IN (
          SELECT team_abrev
          FROM league_teams
          WHERE league_id = $1
      ) AND dp.player_id IS NULL
  `;

  try {
      // Execute the query with the integer leagueId
      const result = await pool.query(query, [leagueIdInt]);
      return result.rows.map(player => ({
          id: player.player_id,
          name: player.player_name,
          team_abrev: player.team_abrev,
          role: player.role || 'unknown role'
      }));
  } catch (error) {
      console.error('Error fetching available players:', error);
      return [];
  }
}

async function getUsernameFromId(userId) {
  try {
    const { rows: userRows } = await pool.query(
      `SELECT username 
       FROM users 
       WHERE user_id = $1`,
      [userId]
    );

    if (userRows.length === 0) {
      console.error('User not found:', userId);
      return null; // Return null if user is not found
    }

    return userRows[0].username;
  } catch (error) {
    console.error('Error fetching username:', error);
    throw error; // Propagate the error
  }
}

async function getIdFromUsername(username) {
  try {
    const { rows: userRows } = await pool.query(
      `SELECT user_id 
       FROM users 
       WHERE username = $1`,
      [username]
    );

    if (userRows.length === 0) {
      console.error('User not found:', username);
      return null; // Return null if user is not found
    }

    return userRows[0].user_id; // Correct way to access the user_id field
  } catch (error) {
    console.error('Error fetching user ID:', error);
    throw error; // Propagate the error
  }
}

async function getPlayerNameFromId(playerId) {
  try {
    // Query the database for the player's name
    const { rows: playerRows } = await pool.query(
      `SELECT player_name 
       FROM player 
       WHERE player_id = $1`,
      [playerId]
    );

    // Check if player was found
    if (playerRows.length === 0) {
      console.error('Player not found:', playerId);
      return null; // Return null if player is not found
    }

    // Return the player's name
    return playerRows[0].player_name;
  } catch (error) {
    console.error('Error fetching player name:', error);
    throw error; // Propagate the error
  }
}

async function getTeamAbrevFromPlayerId(playerId) {
  try {
    // Query the database for the player's name
    const { rows: teamAbrevRows } = await pool.query(
      `SELECT team_abrev 
       FROM player 
       WHERE player_id = $1`,
      [playerId]
    );

    // Check if player was found
    if (teamAbrevRows.length === 0) {
      console.error('No team_abrev found for:', playerId);
      return null; // Return null if player is not found
    }

    // Return the player's team
    return teamAbrevRows[0].team_abrev;
  } catch (error) {
    console.error('Error fetching team_abrev:', error);
    throw error; // Propagate the error
  }
}

async function getRoleFromPlayerId(playerId) {
  try {
    // Query the database for the player's name
    const { rows: roleRows } = await pool.query(
      `SELECT role 
       FROM player 
       WHERE player_id = $1`,
      [playerId]
    );

    // Check if player was found
    if (roleRows.length === 0) {
      console.error('No role found for:', playerId);
      return null; // Return null if no role is found
    }

    // Return the player's role
    return roleRows[0].role;
  } catch (error) {
    console.error('Error fetching role:', error);
    throw error; // Propagate the error
  }
}

async function getLeagueTeamId(userId, leagueId) {
  try {
      const leagueIdInt = parseInt(leagueId, 10);

      const result = await pool.query(`
          SELECT lt.league_team_id
          FROM league_teams lt
          JOIN users u ON lt.user_id = u.user_id
          WHERE u.user_id = $1 AND lt.league_id = $2
          LIMIT 1
      `, [userId, leagueIdInt]);

      if (result.rows.length === 0) {
          console.error('League team ID could not be found for user:', { userId, leagueId });
          return null;
      }

      return result.rows[0].league_team_id;
  } catch (error) {
      console.error('Error fetching league team ID:', error);
      return null;
  }
}

async function checkTeamComposition(leagueTeamId, newPlayerRole) {
  try {
      // Get the current team composition by querying the league_team_players table
      const result = await pool.query(`
          SELECT p.role 
          FROM league_team_players ltp
          JOIN player p ON ltp.player_id = p.player_id
          WHERE ltp.league_team_id = $1
      `, [leagueTeamId]);

      // Initialize the role counts
      const roleCount = {
          fragger: 0,
          support: 0,
          anchor: 0,
      };

      // Count the roles in the current team
      result.rows.forEach(row => {
        const role = row.role.toLowerCase(); // Ensure the role is in lowercase for matching
        if (roleCount.hasOwnProperty(role)) {
            roleCount[role]++;
        } else {
            console.error(`Unexpected role: ${role}`);
        }
      });

      // Check if adding the new player would exceed the role limits
      switch (newPlayerRole) {
          case 'Fragger':
              if (roleCount.fragger >= 2) {
                  return false;  // Team already has 2 fraggers
              }
              break;
          case 'Support':
              if (roleCount.support >= 3) {
                  return false;  // Team already has 3 supports
              }
              break;
          case 'Anchor':
              if (roleCount.anchor >= 2) {
                  return false;  // Team already has 2 anchors
              }
              break;
          default:
              throw new Error('Invalid role provided');
      }

      return true;  // Player can be added to the team

  } catch (error) {
      console.error('Error checking team composition:', error);
      return false;
  }
}

async function getTeamLength(leagueTeamId) {
  try {
      // Query to count the number of players in the team
      const result = await pool.query(`
          SELECT COUNT(*) AS player_count
          FROM league_team_players
          WHERE league_team_id = $1
      `, [leagueTeamId]);

      // Extract the count from the result
      const playerCount = parseInt(result.rows[0].player_count, 10);
      return playerCount;

  } catch (error) {
      console.error('Error fetching team length:', error);
      return null;
  }
}

async function getCurrentTurnIndex(leagueId) {
  try {
    // Query the database for the current turn index
    const { rows: statusRows } = await pool.query(
      `SELECT current_turn_index 
       FROM draft_status 
       WHERE league_id = $1`,
      [leagueId]
    );

    // Check if draft status was found
    if (statusRows.length === 0) {
      console.error('Draft status not found for league:', leagueId);
      return null; // Return null if draft status is not found
    }

    // Return the current turn index
    return statusRows[0].current_turn_index;
  } catch (error) {
    console.error('Error fetching current turn index:', error);
    throw error; // Propagate the error
  }
}

async function getDraftOrder(leagueId) {
  try {
    // Query the database for the draft order
    const { rows: orderRows } = await pool.query(
      `SELECT draft_order 
       FROM draft_orders 
       WHERE league_id = $1`,
      [leagueId]
    );

    // Check if draft order was found
    if (orderRows.length === 0) {
      console.error('Draft order not found for league:', leagueId);
      return null; // Return null if draft order is not found
    }

    // Return the draft order (assuming it's stored as JSONB and needs parsing)
    return orderRows[0].draft_order;
  } catch (error) {
    console.error('Error fetching draft order:', error);
    throw error; // Propagate the error
  }
}

async function getTeamNeeds(leagueId, username) {
  try {

    const userId = await getIdFromUsername(username);

    const currentTeam = await getLeagueTeamId(userId, leagueId)
    
    // Fetch the number of players drafted by the team, grouped by their role
    const result = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM drafted_players
      JOIN player ON drafted_players.player_id = player.player_id
      WHERE drafted_players.league_team_id = $1
      GROUP BY role
    `, [currentTeam]);

    // Define the required number of players per role
    const requiredRoles = {
      Fragger: 2,
      Support: 3,
      Anchor: 2
    };

    // Count the drafted players by role
    const draftedCounts = {};
    result.rows.forEach(row => {
      draftedCounts[row.role] = parseInt(row.count, 10);
    });

    // Calculate the needs for each role
    const teamNeeds = {};
    for (const [role, requiredCount] of Object.entries(requiredRoles)) {
      const draftedCount = draftedCounts[role] || 0;
      if (draftedCount < requiredCount) {
        teamNeeds[role] = requiredCount - draftedCount;
      }
    }

    return teamNeeds;

  } catch (error) {
    console.error('Error fetching team needs:', error);
    return null;
  }
}

async function getPlayerRankings() {
  try {
    // Query the database for preseason rankings
    const { rows } = await pool.query(
      `SELECT player_id, preseason_ranking
       FROM player
       WHERE preseason_ranking IS NOT NULL`
    );

    // Format the rankings into a map of player_id to ranking
    const rankings = rows.reduce((acc, row) => {
      acc[row.player_id] = row.preseason_ranking;
      return acc;
    }, {});

    return rankings;
  } catch (error) {
    console.error('Error fetching player rankings:', error);
    return {};
  }
}

// -------------------------------------------------------------------------- //

// draft order functions
function shuffleArray(array) {
  // randomize the users in the league
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
// create a snake draft
// ex. [1, 2, 3, 3, 2, 1, etc]
function generateSnakeDraftOrder(userIds, userMap) {
  const shuffledUserIds = shuffleArray(userIds.slice());
  const draftOrder = [];
  const numRounds = 8; // Number of rounds is 7, set to 8 to make sure the last turn is played through

  for (let round = 0; round < numRounds; round++) {
    if (round % 2 === 0) {
      draftOrder.push(...shuffledUserIds.map(id => userMap[id]));
    } else {
      draftOrder.push(...shuffledUserIds.slice().reverse().map(id => userMap[id]));
    }
  }

  return draftOrder;
}

async function setDraftOrder(leagueId) {
  logger.info(`Setting the draft order for league: ${leagueId}`);

  try {
    // Retrieve all user IDs and usernames for the league
    const userResult = await pool.query(`
      SELECT ul.user_id, u.username 
      FROM user_leagues ul
      JOIN users u ON ul.user_id = u.user_id
      WHERE ul.league_id = $1
    `, [leagueId]);

    if (userResult.rows.length === 0) {
      throw new Error('No users found for league');
    }

    // Map user IDs to usernames
    const userMap = userResult.rows.reduce((acc, row) => {
      acc[row.user_id] = row.username;
      return acc;
    }, {});
    const userIds = Object.keys(userMap);

    // Generate the draft order using the user IDs and map
    const draftOrder = generateSnakeDraftOrder(userIds, userMap);
    logger.debug('Draft Order:', draftOrder);

    // Insert or update the draft order in the database
    await pool.query(
      'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2) ON CONFLICT (league_id) DO UPDATE SET draft_order = EXCLUDED.draft_order',
      [leagueId, JSON.stringify(draftOrder)]
    );

    // Return the draft order
    return draftOrder;

  } catch (error) {
    logger.error('Error setting draft order:', error);
    throw error; // Rethrow to ensure .catch in the call site handles it
  }
}

// -------------------------------------------------------------------------- //

function broadcastUserList(leagueId) {
  // Get the set of socket IDs for the specified league
  const socketIds = Array.from(io.sockets.adapter.rooms.get(leagueId) || []);

  // Map socket IDs to user IDs using the getUserIdFromSocketId function
  const userList = socketIds.map(socketId => getUserIdFromSocketId(socketId)).filter(userId => userId !== null);

  const message = { users: userList };
  logger.debug(`Broadcasting user list for league ${leagueId}:`, message);

  // Emit the updated user list to all clients in the specified league
  io.to(leagueId).emit('userListUpdate', message);
}

function broadcastDraftStatus(leagueId, draftStatus) {
  logger.debug(`Broadcasting draft status for league ${leagueId}:`, draftStatus);
  io.to(leagueId).emit('draftStatusUpdate', draftStatus);
}

function emitDraftStatus(draftStatus) {
  logger.debug(`Broadcasting draft status:`, draftStatus);

  io.emit('draftStatusUpdate', draftStatus);
}

async function emitAvailablePlayers(leagueId) {
  try {
    // Fetch available players for the given leagueId
    const availablePlayers = await getAvailablePlayers(leagueId);

    // Emit the available players to the specified room
    io.to(String(leagueId)).emit('availablePlayersUpdate', { players: availablePlayers });
  } catch (error) {
    console.error('Error fetching or emitting available players:', error);
    // Optionally emit an error event to the room
    io.to(String(leagueId)).emit('availablePlayersError', { error: 'Error fetching players' });
  }
}

function emitDraftMessage(leagueId, message) {
  console.log(message);
  io.to(String(leagueId)).emit('updateMessageArea', message);
}

function broadcastTurnUpdate(leagueId, turnData) {
  console.log(`Broadcasting turn update to league ${leagueId}:`, turnData);
  io.to(String(leagueId)).emit('turnUpdate', turnData);
}

// -------------------------------------------------------------------------- //

async function draftState(socket, leagueId, draftStarted, draftEnded, turnDuration) {
  try {
    let draftStatus = await getDraftStatus(leagueId);
    draftStatus = {
      currentIndex: draftStatus ? draftStatus.current_turn_index : -1,
      draftStarted: draftStatus ? draftStatus.draft_started : false,
      draftEnded: draftStatus ? draftStatus.draft_ended : false
    };
    broadcastDraftStatus(leagueId, draftStatus);

    emitAvailablePlayers(leagueId);

    let remainingTime = turnDuration;

    if (draftStarted && !draftEnded) {
      const turnTimerResult = await checkTurnTimer(leagueId);
      const now = new Date();

      if (turnTimerResult && turnTimerResult.current_turn_start && turnTimerResult.turn_duration > 0) {
        const startTime = new Date(turnTimerResult.current_turn_start);
        const endTime = new Date(startTime.getTime() + turnTimerResult.turn_duration * 1000);

        if (now < endTime) {
          remainingTime = Math.max(0, (endTime - now) / 1000);
        }
      }
    }

    // Emit the remaining time to the client, ensuring it's a valid number
    socket.emit('turnTimeUpdate', { remainingTime: isNaN(remainingTime) ? 45 : remainingTime });

  } catch (error) {
    console.error('Error sending state:', error);
  }
}

async function startDraft(leagueId, turnDuration, io) {
  try {
      // Set draftStarted to true and draftEnded to false
      draftStarted = true;
      draftEnded = false;
      currentTurnIndex = 0;

      // Update the database with the draft started status
      await pool.query(
          'UPDATE draft_status SET draft_started = TRUE, draft_ended = FALSE, current_turn_index = $1 WHERE league_id = $2',
          [currentTurnIndex, leagueId]
      );

      // Start the first turn timer and get the remaining time
      const remainingTime = await startTurnTimer(leagueId, turnDuration, io);

      const draftOrder = await setDraftOrder(leagueId);

      // Emit the 'draftStarted' message to all users in the league with the remaining time, turn
      io.to(leagueId).emit('draftStarted', { 
          message: 'The draft has started!', 
          remainingTime, 
          currentTurnIndex,
          draftOrder
      });

      console.log('Draft started and message emitted to all users.');
  } catch (error) {
      console.error('Error starting the draft:', error);
  }
}

async function startTurnTimer(leagueId, turnDuration, io, currentTurnIndex) {
  const startTime = Date.now();
  const endTime = startTime + turnDuration * 1000;

  // Store the start and end time in the database
  try {
    await pool.query(`
      INSERT INTO turn_timers (league_id, current_turn_start, turn_duration, current_turn_end)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (league_id) DO UPDATE
      SET current_turn_start = EXCLUDED.current_turn_start,
          turn_duration = EXCLUDED.turn_duration,
          current_turn_end = EXCLUDED.current_turn_end
    `, [leagueId, new Date(startTime), turnDuration, new Date(endTime)]);
    console.log('Turn timer initialized.');
  } catch (error) {
    console.error('Error initializing turn timer:', error);
  }

  // Prepare turn data to broadcast
  const turnData = {
    message: `Turn ${currentTurnIndex + 1} has started!`,
    currentTurnIndex,
    remainingTime: turnDuration
  };

  broadcastTurnUpdate(leagueId, turnData);

  // Clear any existing timer
  if (currentTurnTimer) {
    clearTimeout(currentTurnTimer);
  }

  // Set the countdown to end when the turnDuration expires
  currentTurnTimer = setTimeout(async () => {
    await handleTurnEnd(leagueId, io);
    // checkEndOfDraft(currentTurnIndex, leagueId, io);
  }, turnDuration * 1000);
}

async function handleTurnEnd(leagueId, io) {
  try {
    // Fetch the current turn index and draft status
    const [turnIndexResult, draftStatusResult] = await Promise.all([
      pool.query('SELECT current_turn_index FROM draft_status WHERE league_id = $1', [leagueId]),
      pool.query('SELECT draft_ended FROM draft_status WHERE league_id = $1', [leagueId])
    ]);

    // Retrieve the current turn index and draft status
    const currentTurnIndex = turnIndexResult.rows[0]?.current_turn_index;
    const draftEnded = draftStatusResult.rows[0]?.draft_ended;

    // Ensure valid turn index and check if draft has ended
    if (currentTurnIndex === undefined || draftEnded) {
      console.error('Cannot end turn. Invalid turn index or draft already ended.');
      return;
    }

    // Check if a player was drafted this turn
    const draftOccurred = await checkIfDraftOccurred(leagueId, currentTurnIndex);

    if (!draftOccurred) {
      console.log('No draft occured, autodrafting')
      // Autodraft if no player was drafted
      await autodraftPlayer(leagueId, io);

      return // exit the function
    }

    // Increment the current turn index
    const newTurnIndex = currentTurnIndex + 1;

    // Update the current turn index in the database
    await pool.query(`
      UPDATE draft_status 
      SET current_turn_index = $1
      WHERE league_id = $2
    `, [newTurnIndex, leagueId]);

    console.log(`Turn ended. New turn index: ${newTurnIndex}`);

    // Check if the draft has ended or if there are more turns
    const isDraftEnded = await checkEndOfDraft(newTurnIndex, leagueId, io);
    if (!isDraftEnded) {
      // Start the next turn timer if the draft has not ended
      await startTurnTimer(leagueId, turnDuration, io, newTurnIndex);
    }

  } catch (error) {
    console.error('Error ending the turn:', error);
  }
}

async function draftPlayer(userId, leagueId, playerId) {
  try {
      // Parse IDs and validate
      const leagueIdInt = parseInt(leagueId, 10);
      const playerIdInt = parseInt(playerId, 10);

      if (Number.isNaN(leagueIdInt) || Number.isNaN(playerIdInt)) {
          const errorMsg = 'Invalid leagueId or playerId.';
          console.error(errorMsg, { leagueId, playerId });
          return { success: false, message: errorMsg };
      }

      // Fetch username associated with userId
      const username = await getUsernameFromId(userId);
      if (!username) {
          const errorMsg = 'Username could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Fetch the current turn index for the league
      const currentTurnIndex = await getCurrentTurnIndex(leagueIdInt);
      if (currentTurnIndex === null) {
          const errorMsg = 'Current turn index could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Fetch the draft order to get the expected user for the current turn
      const draftOrder = await getDraftOrder(leagueIdInt);
      if (!draftOrder) {
          const errorMsg = 'Draft order could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Determine the username who should be drafting in the current turn
      const currentUsername = draftOrder[currentTurnIndex];

      // Validate the user making the draft
      if (currentUsername !== username) {
          const errorMsg = 'User is not authorized to draft at this turn.';
          console.error(errorMsg, { username, leagueId, playerId });
          return { success: false, message: errorMsg };
      }

      // Fetch player name and role from the player table
      const playerName = await getPlayerNameFromId(playerIdInt);
      const playerRole = await getRoleFromPlayerId(playerIdInt);
      if (!playerName || !playerRole) {
          const errorMsg = 'Player name or role could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Get the league_team_id for the user
      const leagueTeamId = await getLeagueTeamId(userId, leagueIdInt);
      if (!leagueTeamId) {
          const errorMsg = 'League team ID could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Check if the team length allows this draft
      const teamLength = await getTeamLength(leagueTeamId);
      if (teamLength === null) {
          const errorMsg = 'Error fetching team length.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }
      if (teamLength >= 7) {
          const errorMsg = 'Cannot draft this player; team size limit reached.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Check if the team composition allows this draft
      const canDraft = await checkTeamComposition(leagueTeamId, playerRole);
      if (!canDraft) {
          const errorMsg = 'Cannot draft this player; team composition limits exceeded.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Insert into drafted_players table
      await pool.query(
        `INSERT INTO drafted_players (league_id, player_id, league_team_id, turn_index)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (league_id, player_id) DO NOTHING`,
        [leagueIdInt, playerIdInt, leagueTeamId, currentTurnIndex]
    );

      // Insert into league_team_players table
      await pool.query(
          `INSERT INTO league_team_players (league_team_id, player_id)
           VALUES ($1, $2)
           ON CONFLICT (league_team_id, player_id) DO NOTHING`,
          [leagueTeamId, playerIdInt]
      );

      console.log(`Player ${playerIdInt} drafted successfully in league ${leagueIdInt}`);

      // Emit updated list to all clients in the league
      emitAvailablePlayers(leagueId);

      // Fetch team abbreviation for the drafted player
      const teamAbrev = await getTeamAbrevFromPlayerId(playerIdInt);
      if (!teamAbrev) {
          const errorMsg = 'Team abbreviation could not be fetched.';
          console.error(errorMsg);
          return { success: false, message: errorMsg };
      }

      // Emit the drafted player message to all clients
      const draftMessage = `${teamAbrev} ${playerName} was drafted by ${username}`;
      emitDraftMessage(leagueId, draftMessage);

      // Add slight delay before handling turn end to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`Handling turn end for league ${leagueId}`);
      await handleTurnEnd(leagueId, io);

      // Return success message
      return { success: true, message: `Player ${playerIdInt} drafted successfully.` };

  } catch (error) {
      console.error('Error drafting player:', error);
      return { success: false, message: 'An unexpected error occurred while drafting the player.' };
  }
}

async function checkIfDraftOccurred(leagueId, turnIndex) {
  try {
    // Query to check if a draft occurred for this turn in the league
    const result = await pool.query(`
      SELECT COUNT(*) AS draft_count 
      FROM drafted_players 
      WHERE league_id = $1 AND turn_index = $2
    `, [leagueId, turnIndex]);

    // Return true if a draft occurred (at least one player was drafted)
    return result.rows[0].draft_count > 0;
  } catch (error) {
    console.error('Error checking draft occurrence:', error);
    return false;
  }
}

async function autodraftPlayer(leagueId, io) {
  try {
    const leagueIdInt = parseInt(leagueId, 10);
    if (isNaN(leagueIdInt)) {
      throw new Error(`Invalid league ID: ${leagueId}`);
    }

    // Reset variables to ensure fresh data
    let currentUsername = null;
    let teamNeeds = null;
    let availablePlayers = null;

    // Fetch the draft order to get the expected user for the current turn
    const draftOrder = await getDraftOrder(leagueIdInt);
    if (!draftOrder) {
      const errorMsg = 'Draft order could not be fetched.';
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }

    const currentTurnIndex = await getCurrentTurnIndex(leagueId);

    // Determine the username who should be drafting in the current turn
    currentUsername = draftOrder[currentTurnIndex];

    // Fetch the team needs and available players
    teamNeeds = await getTeamNeeds(leagueId, currentUsername);
    console.log(`Team needs for user ${currentUsername}`, teamNeeds);
    availablePlayers = await getAvailablePlayers(leagueId);

    // Shuffle available players to randomize the selection
    const shuffledPlayers = shuffleArray(availablePlayers);

    const userId = await getIdFromUsername(currentUsername);

    // Try to draft a random player that fits the team needs
    for (const player of shuffledPlayers) {
      const roleFits = teamNeeds[player.role] > 0;
      if (roleFits) {
        await draftPlayer(userId, leagueId, player.id);
        console.log(`Autodrafted player ${player.id} for user ${currentUsername} in league ${leagueId}`);
        return;
      }
    }

    console.error('No suitable player found for autodraft.');
  } catch (error) {
    console.error('Error during autodraft:', error);
  }
}

async function checkEndOfDraft(currentTurnIndex, leagueId, io) {
  try {
    // Retrieve all user IDs and usernames for the league
    const userResult = await pool.query(`
      SELECT ul.user_id, u.username 
      FROM user_leagues ul
      JOIN users u ON ul.user_id = u.user_id
      WHERE ul.league_id = $1
    `, [leagueId]);

    // Calculate the number of participants in the draft
    const numParticipants = userResult.rows.length;

    // Calculate the current round
    const currentRound = Math.floor(currentTurnIndex / numParticipants) + 1;
    console.log('Current Round:', currentRound);

    // For testing: end the draft after round 1
    // Adjust to currentRound > 7 for full implementation
    if (currentRound > maxRounds) { 
      endDraft(leagueId, io);
    }
  } catch (error) {
    console.error('Error in checkEndOfDraft:', error);
  }
}

function endDraft(leagueId, io) {
  logger.info(`Ending the draft for league: ${leagueId}`);

    // Clear the running timer
    if (turnTimer) {
      clearTimeout(turnTimer);
      turnTimer = null;
      logger.info('Turn timer cleared.');
    }
  
  // Update draft status in the database
  pool.query(
    'UPDATE draft_status SET draft_ended = TRUE, draft_started = TRUE WHERE league_id = $1',
    [leagueId]
  ).then(() => {
    // Emit draftEnded event to all users with the league dashboard URL
    const dashboardUrl = `http://localhost:3000/league-dashboard.html?leagueId=${leagueId}`;
    io.to(String(leagueId)).emit('draftEnded', { message: 'The draft has ended!', redirectUrl: dashboardUrl });
    logger.info('Draft ended and redirect message emitted to all users.');

    // disconnect all users from the league after the draft has ended
    io.in(leagueId).socketsLeave(leagueId);

    // Cleanup server resources for this league
    cleanupDraftData(leagueId);
  }).catch(error => {
    logger.error('Error ending draft:', error);
  });
}

// I will probably need to do more cleaning up in the future
// for now, I delete the data within the turn_timers table.
function cleanupDraftData(leagueId) {
  // Delete turn timers for this league
  pool.query('DELETE FROM turn_timers WHERE league_id = $1', [leagueId])
    .then(() => {
      logger.info(`Turn timers for league ${leagueId} have been deleted.`);
    })
    .catch(error => {
      logger.error(`Error deleting turn timers for league ${leagueId}:`, error);
    });
}

// -------------------------------------------------------------------------- //

async function getTeamDataForUser(userId, leagueId) {
  try {
    // Query to get the league_team_id for the user
    const leagueTeamQuery = `
      SELECT league_team_id
      FROM league_teams
      WHERE user_id = $1 AND league_id = $2
    `;
    const leagueTeamResult = await pool.query(leagueTeamQuery, [userId, leagueId]);

    if (leagueTeamResult.rows.length === 0) {
      throw new Error('No team found for the user in this league.');
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

    // Return the player's data
    return playerResult.rows; // This will be an array of players
  } catch (error) {
    console.error('Error fetching team data:', error);
    throw error;
  }
}

// -------------------------------------------------------------------------- //

// Starting the Socket.IO server
function startSocketIOServer() {
  io.on('connection', (socket) => {
      const { userId, leagueId } = socket.handshake.query;

      if (userId && leagueId) {
          console.log(`User ${userId} connected to league ${leagueId}`);
          clients.set(userId, { socket, leagueId });
          socket.join(leagueId);

          // 1. Send the list of connected users
          const socketIds = Array.from(io.sockets.adapter.rooms.get(leagueId) || []);
          const userList = socketIds.map(socketId => getUserIdFromSocketId(socketId)).filter(userId => userId !== null);
          // socket.emit('userListUpdate', { users: userList });
          
          // Broadcast the updated user list to all clients in the specified league
          broadcastUserList(leagueId);

          // Fetch and send the current draft state
          try {
            const draftUpdate = draftState(socket, leagueId); // Await the result
            socket.emit('draftUpdate', draftUpdate);
          } catch (error) {
            console.error('Error fetching draft state:', error);
            socket.emit('error', 'Failed to fetch draft state');
          }

          } else {
          logger.error('User ID or League ID missing');
          socket.emit('error', 'User ID or League ID missing');
          socket.disconnect();
          return;
          }

      socket.on('requestMyTeam', async () => {
        try {
          const teamData = await getTeamDataForUser(userId, leagueId);

          // Emit the team data back to the client
          socket.emit('myTeamData', teamData);
        } catch (error) {
          console.error('Error fetching team data:', error);
        }
      });

      // Handle incoming messages from the client
      socket.on('message', async (data) => {
        try {
            logger.debug('Received message from client:', data);

            switch (data.type) {
                case 'startDraft':
                  startDraft(leagueId, turnDuration, io);
                  console.log('startDraft message received on server!')
                  break;

                default:
                    logger.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            logger.error('Error processing message:', error);
            socket.emit('error', 'Invalid message format');
        }
      });

      socket.on('draftPlayer', async (data) => {
        console.log('Draft Requested:', data);
    
        // Ensure data contains necessary fields
        if (data && data.userId && data.leagueId && data.playerId) {
            const result = await draftPlayer(data.userId, data.leagueId, data.playerId);
    
            if (result.success) {
                // Handle successful draft
                socket.emit('draftSuccess', result.message);
            } else {
                // Send the error message to the client
                socket.emit('draftError', result.message);
            }
        } else {
            const errorMsg = 'Invalid draftPlayer data.';
            console.error(errorMsg, data);
            socket.emit('draftError', errorMsg);
        }
      });  

      // Handle disconnection
      socket.on('disconnect', () => {
          console.log(`User ${userId} disconnected from league ${leagueId}`);
          clients.delete(userId);
          broadcastUserList(leagueId);
      });

      // Handle socket errors
      socket.on('error', (error) => {
          logger.error('Socket.IO error:', error);
      });
  });

  server.listen(8080, () => {
      logger.info('Socket.IO server is listening on port 8080');
  });
}

module.exports = startSocketIOServer;

// Ensure this file is only executed if run directly, preventing double-start issues
if (require.main === module) {
startSocketIOServer();
}