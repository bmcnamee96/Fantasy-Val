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

// Function to get userId from socketId
function getUserIdFromSocketId(socketId) {
  for (let [userId, clientInfo] of clients.entries()) {
      if (clientInfo.socket.id === socketId) {
          return userId; // Return the userId corresponding to this socketId
      }
  }
  return null; // Return null if no userId is found for the given socketId
}

// Broadcast the user list within a specific league (room)
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

// Function to get draft status from the database
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

// Function to broadcast draft status
function broadcastDraftStatus(leagueId) {
  const draftStatus = {
      currentIndex: currentTurnIndex,
      draftStarted: draftStarted,
      draftEnded: draftEnded
  };

  logger.debug(`Broadcasting draft status for league ${leagueId}:`, draftStatus);
  io.to(leagueId).emit('draftStatusUpdate', draftStatus);
}

async function draftState(socket, leagueId) {
  try {
      // Fetch and send the current draft status
      const draftStatus = await getDraftStatus(leagueId);
      socket.emit('draftStatusUpdate', {
        currentIndex: draftStatus ? draftStatus.current_turn_index : 0,
        draftStarted: draftStatus ? draftStatus.draft_started : false,
        draftEnded: draftStatus ? draftStatus.draft_ended : false
      });

      // Send the available players
      const availablePlayers = await getAvailablePlayers(leagueId);
      socket.emit('availablePlayersUpdate', { players: availablePlayers });

      // Check the remaining time of the current turn
      if (draftStarted && !draftEnded) {
        const turnTimerResult = await checkTurnTimer(leagueId); // Ensure this is awaited if it's a promise

        const now = new Date();
        let remainingTime = 0;

        if (turnTimerResult && turnTimerResult.rows && turnTimerResult.rows.length > 0) {
          const turnEndTime = new Date(turnTimerResult.rows[0].turn_end_time);

          if (now < turnEndTime) {
            remainingTime = Math.max(0, (turnEndTime - now) / 1000); // Remaining time in seconds
          }
        }

          socket.emit('turnTimeUpdate', { remainingTime });
        } else {
          // If the draft hasn't started or has ended, you may want to set remainingTime to 0 or another value
          socket.emit('turnTimeUpdate', { remainingTime: 45 });
        }

  } catch (error) {
      console.error('Error sending state:', error);
  }
}

async function startTurnTimer(leagueId, turnDuration) {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + turnDuration * 45 * 1000); // Duration in milliseconds

  try {
      await pool.query(`
          INSERT INTO turn_timers (league_id, turn_start_time, turn_end_time)
          VALUES ($1, $2, $3)
          ON CONFLICT (league_id) DO UPDATE
          SET turn_start_time = EXCLUDED.turn_start_time, turn_end_time = EXCLUDED.turn_end_time
      `, [leagueId, startTime, endTime]);
  } catch (error) {
      console.error('Error initializing turn timer:', error);
  }
}

async function checkTurnTimer(leagueId) {
  try {
      const result = await pool.query(`
          SELECT turn_end_time FROM turn_timers WHERE league_id = $1
      `, [leagueId]);

      if (result.rows.length > 0) {
          const turnEndTime = new Date(result.rows[0].turn_end_time);
          const now = new Date();

          if (now >= turnEndTime) {
              console.log('Turn expired');
          }
      }
  } catch (error) {
      console.error('Error checking turn timer:', error);
  }
}

async function handleTurnExpiry(leagueId) {
  // Move to the next turn
  currentTurnIndex = (currentTurnIndex + 1) % MAX_TURNS;

  try {
      await pool.query(`
          UPDATE draft_status
          SET current_turn_index = $1
          WHERE league_id = $2
      `, [currentTurnIndex, leagueId]);

      // Broadcast updated draft status
      broadcastDraftStatus(leagueId);

      // Start a new turn timer if needed
      startTurnTimer(leagueId, TURN_DURATION);
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

          // Send the current draft state
          // draftStatusUpdate
          // availablePlayersUpdate
          const draftUpdate = draftState(socket, leagueId);
          socket.emit('draftUpdate', draftUpdate);

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
                    draftStarted = true;
                    draftEnded = false;
                    currentTurnIndex = 0;

                    // Update the database
                    await pool.query(
                        'UPDATE draft_status SET draft_started = TRUE, draft_ended = FALSE, current_turn_index = $1 WHERE league_id = $2',
                        [currentTurnIndex, leagueId]
                    );

                    broadcastDraftStatus(leagueId);
                    break;

                case 'endDraft':
                    draftEnded = true;

                    // Update the database
                    await pool.query(
                        'UPDATE draft_status SET draft_ended = TRUE WHERE league_id = $1',
                        [leagueId]
                    );

                    broadcastDraftStatus(leagueId);
                    break;

                case 'nextTurn':
                    if (!draftEnded) {
                        currentTurnIndex = (currentTurnIndex + 1) % MAX_TURNS;

                        // Update the database
                        await pool.query(
                            'UPDATE draft_status SET current_turn_index = $1 WHERE league_id = $2',
                            [currentTurnIndex, leagueId]
                        );

                        broadcastDraftStatus(leagueId);
                    }
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