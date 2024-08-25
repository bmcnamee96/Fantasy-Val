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
let turnDuration = 45;


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
      const result = await pool.query(query, [leagueId]);
      return result.rows.map(player => ({
          id: player.player_id,
          name: player.player_name,
          team_abrev: player.team_abrev,
          role: player.role || 'unknown role' // Default to 'unknown role' if not available
      }));
  } catch (error) {
      console.error('Error fetching available players:', error);
      return [];
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

function setDraftOrder(leagueId) {
  logger.info(`Setting the draft order for league: ${leagueId}`);

  let draftOrder = [];

  // select all userIds and usernames from the correct league
  return pool.query(`
    SELECT ul.user_id, u.username 
    FROM user_leagues ul
    JOIN users u ON ul.user_id = u.user_id
    WHERE ul.league_id = $1
  `, [leagueId])
    .then(result => {
      const userMap = result.rows.reduce((acc, row) => {
        acc[row.user_id] = row.username;
        return acc;
      }, {});
      const userIds = Object.keys(userMap);
      console.log(userIds);

      if (userIds.length === 0) {
        throw new Error('No users found for league');
      }

      draftOrder = generateSnakeDraftOrder(userIds, userMap);
      logger.debug('Draft Order:', draftOrder);

      return pool.query(
        'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2) ON CONFLICT (league_id) DO UPDATE SET draft_order = EXCLUDED.draft_order',
        [leagueId, JSON.stringify(draftOrder)]
      ).then(() => {
        return pool.query(
          'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, TRUE, FALSE) ON CONFLICT (league_id) DO UPDATE SET draft_started = TRUE, current_turn_index = EXCLUDED.current_turn_index',
          [leagueId, 0]
        ).then(() => draftOrder); // Return draftOrder to use in next then block
      });
    })
    .catch(error => {
      logger.error('Error setting draft order:', error);
      throw error; // Rethrow to ensure .catch in the call site handles it
    });
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

function emitAvailablePlayers(availablePlayers) {
  logger.debug('Broadcasting available players:', availablePlayers)

  io.emit('availablePlayersUpdate', { players: availablePlayers });
}

function broadcastTurnUpdate(leagueId, turnData) {
  io.to(leagueId).emit('turnUpdate', turnData);
}

function broadcastTurnTimeUpdate(league_id, timeData) {
  io.to(leagueId).emit('turnTimeUpdate', timeData);
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
    emitDraftStatus(draftStatus);

    const availablePlayers = await getAvailablePlayers(leagueId);
    emitAvailablePlayers(availablePlayers);

    if (draftStarted && !draftEnded) {
      const turnTimerResult = await checkTurnTimer(leagueId);
      const now = new Date();
      let remainingTime = turnDuration;

      if (turnTimerResult) {
        const startTime = new Date(turnTimerResult.current_turn_start);
        const endTime = new Date(startTime.getTime() + turnTimerResult.turn_duration * 1000);

        if (now < endTime) {
          remainingTime = Math.max(0, (endTime - now) / 1000);
        }
      }
      socket.emit('turnTimeUpdate', { remainingTime });
    } else {
      socket.emit('turnTimeUpdate', { remainingTime: 45 });
    }

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
      const remainingTime = await initializeTurnTimer(leagueId, turnDuration, io);

      // Emit the 'draftStarted' message to all users in the league with the remaining time, turn, and round
      io.to(leagueId).emit('draftStarted', { 
        message: 'The draft has started!', 
        remainingTime, 
        currentTurnIndex
      });

      console.log('Draft started and message emitted to all users.');
  } catch (error) {
      console.error('Error starting the draft:', error);
  }
}

async function initializeTurnTimer(leagueId, turnDuration) {
  const startTime = new Date();

  try {
    // Insert or update the turn timer in the database
    await pool.query(`
        INSERT INTO turn_timers (league_id, current_turn_start, turn_duration)
        VALUES ($1, $2, $3)
        ON CONFLICT (league_id) DO UPDATE
        SET current_turn_start = EXCLUDED.current_turn_start, turn_duration = EXCLUDED.turn_duration
    `, [leagueId, startTime, turnDuration]);

    console.log('Turn timer initialized.');
  } catch (error) {
    console.error('Error initializing turn timer:', error);
  }
}

async function checkTurnTimer(leagueId) {
  const query = `
    SELECT current_turn_start,
           turn_duration
    FROM turn_timers
    WHERE league_id = $1;
  `;

  try {
    const result = await pool.query(query, [leagueId]);

    if (result.rows.length > 0) {
      const { current_turn_start, turn_duration } = result.rows[0];
      const now = new Date();
      const startTime = new Date(current_turn_start);
      const endTime = new Date(startTime.getTime() + turn_duration * 1000); // Duration in milliseconds

      // Calculate the remaining time
      const remainingTime = Math.max(0, (endTime - now) / 1000); // Remaining time in seconds

      // Return remaining time
      return { remainingTime, endTime };

    } else {
      console.error(`No turn timer found for league ${leagueId}`);
      return null; // Return null if no timer is found
    }
  } catch (error) {
    console.error('Error checking turn timer:', error);
    return null; // Handle errors gracefully and return null
  }
}

const maxTurns = 49;

async function handleTurnExpiry(leagueId, io) {
  currentTurnIndex = (currentTurnIndex + 1) % maxTurns;

  try {
      await pool.query(`
          UPDATE draft_status
          SET current_turn_index = $1
          WHERE league_id = $2
      `, [currentTurnIndex, leagueId]);

      // Initialize the next turn timer
      const turnDuration = 45; // You can customize this duration
      await initializeTurnTimer(leagueId, turnDuration);

      // Notify all clients of the new turn and reset the countdown
      io.to(leagueId).emit('turnUpdate', {
          currentTurnIndex,
          turnDuration
      });

      console.log(`Turn expired. Moving to next user: ${currentTurnIndex}`);

  } catch (error) {
      console.error('Error handling turn expiry:', error);
  }
}

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
          socket.emit('userListUpdate', { users: userList });
          
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

      // Handle incoming messages from the client
      socket.on('message', async (data) => {
        try {
            logger.debug('Received message from client:', data);

            switch (data.type) {
                case 'startDraft':
                  startDraft(leagueId, turnDuration, io);
                  console.log('startDraft message received on server!')
                  break;

                case 'endDraft':

                    break;

                case 'nextTurn':

                    break;

                default:
                    logger.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            logger.error('Error processing message:', error);
            socket.emit('error', 'Invalid message format');
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