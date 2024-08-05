// wsServer.js

const WebSocket = require('ws');
const { Pool } = require('pg'); // Database connection
const { JWT_SECRET } = require('./utils/auth');
const logger = require('./utils/logger');

// Create a new pool instance for database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

let intervalId;

// #region WebSocket
// #region helper functions

const TURN_DURATION = 5000; // 5 seconds for testing
const TIME_UPDATE_INTERVAL = 1000; // Update every second

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} - The shuffled array.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generates a snake draft order based on the users array.
 * @param {Array} userIds - Array of user IDs.
 * @param {Object} userMap - Mapping of user IDs to usernames.
 * @returns {Array} - The snake draft order with usernames.
 */
function generateSnakeDraftOrder(userIds, userMap) {
  // Shuffle the user IDs to randomize the order
  const shuffledUserIds = shuffleArray(userIds.slice()); // Use slice() to create a copy of the array

  const draftOrder = [];
  const numRounds = 8; // Number of rounds

  for (let round = 0; round < numRounds; round++) {
    if (round % 2 === 0) {
      // Normal order for even rounds (0, 2, 4, 6)
      draftOrder.push(...shuffledUserIds.map(id => userMap[id]));
    } else {
      // Reverse order for odd rounds (1, 3, 5, 7)
      draftOrder.push(...shuffledUserIds.slice().reverse().map(id => userMap[id]));
    }
  }

  return draftOrder;
}

// Store connected clients and user IDs
const clients = new Map();
let draftTimers = {}; // Store timers for each user

// broadcast any draft updates (draftOrder, availablePlayers)
function broadcastDraftUpdate(data) {
  const { draftOrder, availablePlayers } = data;
  logger.debug('Broadcasting draft update:', { draftOrder, availablePlayers });

  const response = { type: 'draftUpdate', draftOrder, availablePlayers };

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(response));
    }
  });
}

// broadcast the usesr list
function broadcastUserList() {
  const userList = Array.from(clients.keys());
  const message = JSON.stringify({ type: 'userListUpdate', users: userList });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

// broadcast to league
function broadcastToLeague(leagueId, message) {
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.leagueId === leagueId) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// starting the draft
function startDraft(leagueId) {
  logger.info(`Starting draft for league: ${leagueId}`);

  let draftOrder = [];
  let maxTurns;

  // Fetch user IDs and usernames
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

      // Calculate MAX_TURNS based on the number of users
      maxTurns = (userIds.length * 7);
      logger.info(`MAX_TURNS set to ${maxTurns}`); // Debugging line

      // Generate draft order with usernames
      draftOrder = generateSnakeDraftOrder(userIds, userMap);
      logger.debug('Draft Order:', draftOrder);

      // Insert or update draft order
      return pool.query(
        'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2) ON CONFLICT (league_id) DO UPDATE SET draft_order = EXCLUDED.draft_order',
        [leagueId, JSON.stringify(draftOrder)]  // Convert draftOrder to JSON string
      );
    })
    .then(() => {
      // Insert or update draft status
      return pool.query(
        'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, TRUE, FALSE) ON CONFLICT (league_id) DO UPDATE SET draft_started = TRUE, current_turn_index = EXCLUDED.current_turn_index',
        [leagueId, -1]
      );
    })
    .then(() => {
      // Broadcast start draft message to league, including MAX_TURNS
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

  // Clear any existing timer for this user
  if (draftTimers[userId]) {
    clearTimeout(draftTimers[userId]);
  }

  // Notify clients about the current turn and the remaining time
  const response = { type: 'userTurn', userId, turnIndex, remainingTime: TURN_DURATION / 1000 };
  broadcastToLeague(leagueId, response);

  // Start a countdown timer for the turn
  draftTimers[userId] = setTimeout(() => {
    logger.info(`Time's up for user ${userId} in league ${leagueId}`);
    moveToNextUser(leagueId);
  }, TURN_DURATION);

  // Periodically broadcast the remaining time
  const startTime = Date.now();
  if (intervalId) {
    clearInterval(intervalId); // Clear the previous interval if any
  }
  intervalId = setInterval(() => {
    const timeLeft = Math.max(0, Math.ceil((TURN_DURATION - (Date.now() - startTime)) / 1000));
    broadcastToLeague(leagueId, { type: 'timeUpdate', remainingTime: timeLeft });

    if (timeLeft <= 0) {
      clearInterval(intervalId);
    }
  }, TIME_UPDATE_INTERVAL);
}

// moving to the next user
function moveToNextUser(leagueId) {
  pool.query('SELECT current_turn_index, draft_order FROM draft_status WHERE league_id = $1', [leagueId])
    .then(result => {
      if (result.rows.length === 0) {
        throw new Error('Draft status not found');
      }

      const { current_turn_index, draft_order } = result.rows[0];
      console.log(`Current turn index from DB: ${current_turn_index}`);
      
      const nextTurnIndex = current_turn_index + 1;
      
      // Check if we have reached the end of the draftOrder array
      if (nextTurnIndex >= draft_order.length) {
        // End the draft after a full cycle
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

// starting the websocketserver
function startWebSocketServer() {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws, req) => {
    logger.info('New client connected');

    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');
    const leagueId = urlParams.get('leagueId');

    logger.debug('Extracted userId:', userId);
    logger.debug('Extracted leagueId:', leagueId);

    if (userId && leagueId) {
      clients.set(userId, { ws, leagueId });
      logger.info(`Added client: ${userId} to league: ${leagueId}`);
      broadcastUserList();
    } else {
      logger.error('User ID or League ID missing');
      ws.send(JSON.stringify({ type: 'error', message: 'User ID or League ID missing' }));
      ws.close();
      return;
    }

    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Welcome to the draft'
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug('Received message from client:', data);

        switch (data.type) {
          case 'draftUpdate':
            broadcastDraftUpdate(data);
            break;
          case 'userConnected':
            // Handle user connection logic if needed
            break;
          case 'startDraft':
            const client = Array.from(clients.values()).find(client => client.leagueId === data.leagueId);
            if (client) {
              startDraft(data.leagueId);
            } else {
              logger.error('Client not found for league:', data.leagueId);
              logger.debug('Current clients:', Array.from(clients.entries()));
            }
            break;
          default:
            logger.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      logger.info('Client disconnected');
      clients.delete(userId);
      broadcastUserList();
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  wss.on('listening', () => {
    logger.info('WebSocket server is listening on port 8080');
  });
}

module.exports = startWebSocketServer;

// Ensure this file is only executed if run directly, preventing double-start issues
if (require.main === module) {
  startWebSocketServer();
}
