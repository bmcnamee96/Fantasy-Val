// socketio.js

const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { Pool } = require('pg'); // Database connection
const { JWT_SECRET } = require('./utils/auth');
const logger = require('./utils/logger');
const users = {};
const clients = new Map();
let draftTimers = {};
let intervalId;

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

// show the users within the league
function broadcastUserList() {
  const userList = Array.from(clients.keys());
  const message = { users: userList };
  logger.debug('Broadcasting user list:', message);

  io.emit('userListUpdate', message); // Emit to all connected clients
}

// work on the draft order
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