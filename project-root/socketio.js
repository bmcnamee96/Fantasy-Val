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
const TURN_DURATION = 5000; // 5 seconds for testing
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

// Broadcast draft updates
function broadcastDraftUpdate(leagueId, data) {
    const { draftOrder, availablePlayers } = data;
    logger.debug('Broadcasting draft update to league:', { leagueId, draftOrder, availablePlayers });

    const response = { type: 'draftUpdate', draftOrder, availablePlayers };
    io.to(leagueId).emit('draftUpdate', response);
}


// Broadcast user list
function broadcastUserList() {
    const userList = Array.from(clients.keys());
    const message = { users: userList };
    logger.debug('Broadcasting user list:', message);

    io.emit('userListUpdate', message); // Emit to all connected clients
}

// Broadcast to league
function broadcastToLeague(leagueId, message) {
  io.to(leagueId).emit('leagueMessage', message);
}

// Starting the draft
function startDraft(leagueId) {
  logger.info(`Starting draft for league: ${leagueId}`);

  let draftOrder = [];
  let maxTurns;

  pool.query(`
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

      maxTurns = (userIds.length * 7);
      logger.info(`MAX_TURNS set to ${maxTurns}`);

      draftOrder = generateSnakeDraftOrder(userIds, userMap);
      logger.debug('Draft Order:', draftOrder);

      return pool.query(
        'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2) ON CONFLICT (league_id) DO UPDATE SET draft_order = EXCLUDED.draft_order',
        [leagueId, JSON.stringify(draftOrder)]
      );
    })
    .then(() => {
      return pool.query(
        'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, TRUE, FALSE) ON CONFLICT (league_id) DO UPDATE SET draft_started = TRUE, current_turn_index = EXCLUDED.current_turn_index',
        [leagueId, 0]
      );
    })
    .then(() => {
      const response = { type: 'startDraft', draftOrder, MAX_TURNS: maxTurns };
      logger.info(`Sending startDraft message to league: ${leagueId} with MAX_TURNS: ${maxTurns}`);
      broadcastToLeague(leagueId, response);
    })
    .catch(error => {
      logger.error('Error starting draft:', error);
    });
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
            clients.set(userId, { socket, leagueId });
            socket.join(leagueId); // Ensure the user joins the correct room
    
            // Send the updated user list to the newly connected user
            const userList = Array.from(clients.keys());
            logger.debug('Sending userListUpdate to new client:', userList);
            socket.emit('userListUpdate', { users: userList });
    
            // Broadcast to all clients
            broadcastUserList();
    
        } else {
            logger.error('User ID or League ID missing');
            socket.emit('error', 'User ID or League ID missing');
            socket.disconnect();
            return;
        }

        // Send the current user mappings to the new client
        socket.emit('userMappings', users);

        socket.emit('welcome', 'Welcome to the draft');

        // Handle incoming messages
        socket.on('message', (data) => {
            try {
                logger.debug('Received message from client:', data);

                switch (data.type) {
                    case 'draftUpdate':
                        logger.debug('Broadcasting draft update:', data);
                        broadcastDraftUpdate(data);
                        break;
                    case 'userConnected':
                        // Handle user connection logic if needed
                        broadcastUserList();
                        break;
                    case 'startDraft':
                        logger.debug('Starting draft with league ID:', data.leagueId);
        
                        // Log the real data received from the client
                        console.log('Real draft data:', data.data);
        
                        // Validate the structure of the real data
                        if (!data.data || !data.data.draftOrder || typeof data.data.MAX_TURNS === 'undefined') {
                            console.error('Invalid draft data received:', data.data);
                            return; // Exit if data is invalid
                        }
        
                        // Emit the validated data to all clients in the league
                        io.to(data.leagueId).emit('startDraft', data.data);
                        logger.debug('Draft data sent to league:', data.leagueId);
        
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
