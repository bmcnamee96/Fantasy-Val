// socketio.js

const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { Pool } = require('pg'); // Database connection
const { JWT_SECRET } = require('./utils/auth');
const logger = require('./utils/logger');
const users = {};

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

// Helper functions and constants
const TURN_DURATION = 15000; // 5 seconds for testing
const TIME_UPDATE_INTERVAL = 1000; // Update every second

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generateSnakeDraftOrder(userIds, userMap) {
  const shuffledUserIds = shuffleArray(userIds.slice());
  const draftOrder = [];
  const numRounds = 8; // Number of rounds

  for (let round = 0; round < numRounds; round++) {
    if (round % 2 === 0) {
      draftOrder.push(...shuffledUserIds.map(id => userMap[id]));
    } else {
      draftOrder.push(...shuffledUserIds.slice().reverse().map(id => userMap[id]));
    }
  }

  return draftOrder;
}

const clients = new Map();
let draftTimers = {};
let intervalId;

// Broadcast user list
function broadcastUserList() {
    const userList = Array.from(clients.keys());
    const message = { users: userList };
    logger.debug('Broadcasting user list:', message);

    io.emit('userListUpdate', message); // Emit to all connected clients
}

function setDraftOrder(leagueId) {
  logger.info(`Setting the draft order for league: ${leagueId}`);

  let draftOrder = [];

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

// Broadcast to league
function broadcastToLeague(leagueId, message) {
  io.to(leagueId).emit('leagueMessage', message);
}

// Initialize a timer for each user's turn
function startUserTurn(leagueId, userId, turnIndex) {
  logger.info(`Starting turn for user ${userId} in league ${leagueId} with turnIndex ${turnIndex}`);

  if (draftTimers[userId]) {
    clearTimeout(draftTimers[userId]);
  }

  const response = { type: 'userTurn', userId, turnIndex, remainingTime: TURN_DURATION / 1000 };
  broadcastToLeague(leagueId, response);

  draftTimers[userId] = setTimeout(() => {
    logger.info(`Time's up for user ${userId} in league ${leagueId}`);
    moveToNextUser(leagueId);
  }, TURN_DURATION);

  const startTime = Date.now();
  if (intervalId) {
    clearInterval(intervalId);
  }
  intervalId = setInterval(() => {
    const timeLeft = Math.max(0, Math.ceil((TURN_DURATION - (Date.now() - startTime)) / 1000));
    broadcastToLeague(leagueId, { type: 'timeUpdate', remainingTime: timeLeft });

    if (timeLeft <= 0) {
      clearInterval(intervalId);
    }
  }, TIME_UPDATE_INTERVAL);
}

// REFACTORING CODE
// function fetchPlayerDetails(playerId) {
//   return pool.query('SELECT player_name, team_abrev FROM player WHERE player_id = $1', [playerId])
//     .then(result => {
//       if (result.rows.length === 0) {
//         throw new Error('Player not found');
//       }
//       return result.rows[0];
//     });
// }
// function fetchAndBroadcastAvailablePlayers(leagueId) {
//   return pool.query(
//     `SELECT p.player_id, p.player_name, p.team_abrev, p.role
//      FROM player p
//      LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = $1
//      WHERE dp.player_id IS NULL`,
//     [leagueId]
//   ).then(result => {
//     const availablePlayers = result.rows;

//     // Log the available players
//     logger.debug('Available players fetched:', availablePlayers);

//     // Emit the updated availablePlayers list to the entire league
//     io.to(leagueId).emit('message', {
//       type: 'availablePlayersUpdate',
//       availablePlayers: availablePlayers
//     });

//     return availablePlayers;
//   });
// }
// function updateAndBroadcastCurrentTurnIndex(leagueId) {
//   return pool.query(
//     `UPDATE draft_status
//      SET current_turn_index = (current_turn_index % (SELECT COUNT(*) FROM user_leagues WHERE league_id = $1)) + 1
//      WHERE league_id = $1
//      RETURNING current_turn_index`,
//     [leagueId]
//   ).then(result => {
//     if (result.rows.length === 0) {
//       throw new Error('Failed to update and fetch current_turn_index');
//     }

//     const currentTurnIndex = result.rows[0].current_turn_index;

//     // Emit the updated current_turn_index to the entire league
//     io.to(leagueId).emit('message', {
//       type: 'turnIndexUpdate',
//       currentTurnIndex: currentTurnIndex
//     });

//     logger.debug('Current turn index updated and broadcasted for league:', leagueId);

//     return currentTurnIndex;
//   });
// }
// function handlePlayerDrafted(message) {
//   logger.debug('Handling player drafted:', message);

//   // Validate message fields
//   if (!message.playerId || !message.userId || !message.leagueId) {
//     logger.error('Invalid playerDrafted message:', message);
//     return Promise.resolve(); // Resolve immediately if invalid
//   }

//   return fetchPlayerDetails(message.playerId)
//     .then(playerData => {
//       const { player_name: playerName, team_abrev: teamAbrev } = playerData;
//       const draftMessage = `Player drafted: ${teamAbrev} ${playerName}`;
//       logger.info(draftMessage);

//       // Emit the playerDrafted event to the entire league
//       io.to(message.leagueId).emit('message', {
//         type: 'playerDrafted',
//         draftMessage: draftMessage,
//         playerId: message.playerId,
//         userId: message.userId
//       });

//       logger.debug('Fetching and broadcasting available players');
//       return fetchAndBroadcastAvailablePlayers(message.leagueId);
//     })
//     .then(() => {
//       logger.debug('Updating and broadcasting current turn index');
//       return updateAndBroadcastCurrentTurnIndex(message.leagueId);
//     })
//     .catch(error => {
//       logger.error('Error handling player draft:', error);
//     });
// }

function handlePlayerDrafted(message) {
  logger.debug('Handling player drafted:', message);

  // Validate message fields
  if (!message.playerId || !message.userId || !message.leagueId) {
      logger.error('Invalid playerDrafted message:', message);
      return Promise.resolve(); // Resolve immediately if invalid
  }

  // Fetch player details first and log the draft message
  return pool.query('SELECT player_name, team_abrev FROM player WHERE player_id = $1', [message.playerId])
      .then(result => {
          if (result.rows.length === 0) {
              throw new Error('Player not found');
          }

          const playerData = result.rows[0];
          const playerName = playerData.player_name;
          const teamAbrev = playerData.team_abrev;

          const draftMessage = `Player drafted: ${teamAbrev} ${playerName}`;
          logger.info(draftMessage);

          // Emit the playerDrafted event to the entire league
          io.to(message.leagueId).emit('message', {
              type: 'playerDrafted',
              draftMessage: draftMessage,
              playerId: message.playerId,
              userId: message.userId
          });

          // Fetch the updated list of available players for the specific league
          return pool.query(
              `SELECT p.player_id, p.player_name, p.team_abrev, p.role
               FROM player p
               LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = $1
               WHERE dp.player_id IS NULL`,
              [message.leagueId]
          );
      })
      .then(result => {
          const availablePlayers = result.rows;

          // Emit the updated availablePlayers list to the entire league
          io.to(message.leagueId).emit('message', {
              type: 'availablePlayersUpdate',
              availablePlayers: availablePlayers
          });

      //     // Increment the turn index on the server and fetch the updated current_turn_index
      //     return pool.query(
      //         `UPDATE draft_status
      //          SET current_turn_index = (current_turn_index % (SELECT COUNT(*) FROM user_leagues WHERE league_id = $1)) + 1
      //          WHERE league_id = $1
      //          RETURNING current_turn_index`,
      //         [message.leagueId]
      //     );
      // })
      // .then(result => {
      //     if (result.rows.length === 0) {
      //         throw new Error('Failed to update and fetch current_turn_index');
      //     }

          const currentTurnIndex = result.rows[0].current_turn_index;
          console.log(currentTurnIndex, 'on the server')

          // Emit the updated current_turn_index to the entire league
          io.to(message.leagueId).emit('message', {
              type: 'turnIndexUpdate',
              currentTurnIndex: currentTurnIndex
          });

          logger.debug('Available players and current turn index fetched and broadcasted for league:', message.leagueId);
      })
      .catch(error => {
          logger.error('Error handling player draft:', error);
      });
}

// Moving to the next user
function moveToNextUser(leagueId) {
  pool.query('SELECT current_turn_index, draft_order FROM draft_status WHERE league_id = $1', [leagueId])
    .then(result => {
      if (result.rows.length === 0) {
        throw new Error('Draft status not found');
      }

      const { current_turn_index, draft_order } = result.rows[0];
      console.log(`Current turn index from DB: ${current_turn_index}`);

      const nextTurnIndex = current_turn_index + 1;

      if (nextTurnIndex >= draft_order.length) {
        endDraft();
        return;
      }

      const nextUserId = draft_order[nextTurnIndex];
      console.log(`Next user ID: ${nextUserId}`);

      return pool.query(
        'UPDATE draft_status SET current_turn_index = $1 WHERE league_id = $2',
        [nextTurnIndex, leagueId]
      ).then(() => {
        console.log(`Starting turn for user ${nextUserId} with index ${nextTurnIndex}`);
        startUserTurn(leagueId, nextUserId, nextTurnIndex);
      });
    })
    .catch(error => {
      logger.error('Error moving to next user:', error);
    });
}

// Starting the Socket.IO server
function startSocketIOServer() {
    io.on('connection', (socket) => {
        const { userId, leagueId } = socket.handshake.query;
    
        if (userId && leagueId) {
            console.log(`User ${userId} connected to league ${leagueId}`);
            clients.set(userId, { socket, leagueId });
            socket.join(leagueId);
            console.log(`User ${userId} joined room ${leagueId}`);
    
            // Send the updated user list to the newly connected user
            const userList = Array.from(clients.keys());
            console.log('Sending userListUpdate to new client:', userList);
            socket.emit('userListUpdate', { users: userList });
    
            // Broadcast to all clients
            broadcastUserList();
    
        } else {
            logger.error('User ID or League ID missing');
            socket.emit('error', 'User ID or League ID missing');
            socket.disconnect();
            return;
        }

        // Handle incoming messages
        socket.on('message', (data) => {
            try {
                logger.debug('Received message from client:', data);

                switch (data.type) {
                  // case 'draftUpdate':
                  //     logger.debug('Broadcasting draft update:', data);
                  //     io.to(leagueId).emit('draftUpdate', data);
                  //     break;

                    case 'userConnected':
                      // Handle user connection logic if needed
                      broadcastUserList();
                      break;

                    case 'startDraft':
                      logger.debug('Received startDraft message:', data);
              
                      // Call setDraftOrder and only proceed once it completes
                      setDraftOrder(data.leagueId)
                        .then(draftOrder => {
                          // Emit the startDraft message with the draftOrder and MAX_TURNS
                          io.to(data.leagueId).emit('message', {
                            type: 'startDraft',
                            draftOrder: draftOrder,
                            MAX_TURNS: data.MAX_TURNS
                          });
                          logger.info(`Draft started for league: ${data.leagueId}`);
                        })
                        .catch(error => {
                          logger.error('Error starting draft:', error);
                          socket.emit('error', 'Error starting draft');
                        });
                      break;

                    case 'playerDrafted':
                      logger.debug('Received playerDrafted event:', data);
                      handlePlayerDrafted(data)
                          .then(() => {
                              logger.debug('Player draft handled successfully');
                          })
                          .catch(error => {
                              logger.error('Error handling player draft:', error);
                          });
                      break;
                      
                    default:
                        logger.warn(`Unknown message type: ${data.type}`);
                }
            } catch (error) {
                logger.error('Error processing message:', error);
                socket.emit('error', 'Invalid message format');
            }
        });

      //   socket.on('playerDrafted', async ({ playerId, userId, leagueId }) => {
      //     try {
      //         // Update the draft state on the server
      //         const draftUpdate = await handlePlayerDrafted(playerId, userId, leagueId);
  
      //         // Emit the draft update to all connected clients
      //         io.emit('draftUpdate', draftUpdate);
      //     } catch (error) {
      //         console.error('Error handling draft turn:', error);
      //         socket.emit('draftError', { message: 'An error occurred while processing the draft.' });
      //     }
      // });

        socket.on('requestCurrentState', () => {
            const userList = Array.from(clients.keys());
            socket.emit('userListUpdate', { users: userList });
            // Optionally, include other state information here
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            logger.info('Client disconnected:', socket.id);
            clients.delete(userId);
            broadcastUserList();
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