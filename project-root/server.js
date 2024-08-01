// server.js

// #region Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { expressjwt: expressJwt } = require('express-jwt');
const WebSocket = require('ws');
const { Pool } = require('pg');
const { JWT_SECRET } = require('./utils/auth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// JWT Middleware
app.use(expressJwt({
  secret: JWT_SECRET,
  algorithms: ['HS256']
}).unless({
  path: [
    '/',
    '/index.html',
    '/api/users/signup',
    '/api/users/signin',
    '/api/users/recover-password',
    '/api/val-stats/player-stats',
    '/api/val-stats/match-stats'
  ]
}));

// Middleware to extract userId from JWT
app.use((req, res, next) => {
  if (req.user) {
    req.userId = req.user.userId;
  } else {
    req.userId = null;
  }
  next();
});

// Route Imports
const authRoutes = require('./routes/authRoutes');
const valStatsRoutes = require('./routes/valStatsRoutes');
const leagueRoutes = require('./routes/leagueRoutes');
const draftRoutes = require('./routes/draftRoutes');

// Route Mounting
app.use('/api/users', authRoutes);
app.use('/api/val-stats', valStatsRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/draft', draftRoutes);

// Serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware for JWT
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('Invalid or missing token');
  } else {
    next(err);
  }
});
// #endregion

// #region WebSocket
// #region helper functions

const TURN_DURATION = 5000; // 15 seconds
const TIME_UPDATE_INTERVAL = 1000; // Update every second

/**
 * Generates a snake draft order based on the users array.
 * @param {Array} users - Array of user IDs.
 * @returns {Array} - The snake draft order.
 */
function generateSnakeDraftOrder(users) {
  const draftOrder = [];
  const numUsers = users.length;

  // Determine the number of rounds
  const numRounds = 7; // Assuming each team drafts 7 players

  for (let round = 0; round < numRounds; round++) {
      if (round % 2 === 0) {
          // Normal order for odd rounds
          for (let i = 0; i < numUsers; i++) {
              draftOrder.push(users[i]);
          }
      } else {
          // Reverse order for even rounds
          for (let i = numUsers - 1; i >= 0; i--) {
              draftOrder.push(users[i]);
          }
      }
  }

  return draftOrder;
}
// #endregion

// Set up WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients and user IDs
const clients = new Map();
let draftTimers = {}; // Store timers for each user

wss.on('connection', (ws, req) => {
    console.log('New client connected');

    // Log the full URL and query parameters
    console.log('Request URL:', req.url);

    // Extract user ID and league ID from query parameters
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');
    const leagueId = urlParams.get('leagueId');

    console.log('Extracted userId:', userId);
    console.log('Extracted leagueId:', leagueId);

    if (userId && leagueId) {
        // Store the WebSocket connection and league ID
        clients.set(userId, { ws, leagueId });
        broadcastUserList();
    } else {
        console.error('User ID or League ID missing');
    }

    // Send a welcome message to the new client
    ws.send(JSON.stringify({ message: 'Welcome to the draft' }));

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message from client:', data);
    
            switch (data.type) {
                case 'draftUpdate':
                    broadcastDraftUpdate(data);
                    break;
                case 'userConnected':
                    // Handle user connection logic if needed
                    break;
                case 'startDraft':
                    const leagueId = data.leagueId;
                    const client = Array.from(clients.values()).find(client => client.leagueId === leagueId);
                    if (client) {
                        startDraft(client.leagueId);
                    } else {
                        console.error('Client not found for league:', leagueId);
                    }
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });    

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(userId);
        broadcastUserList();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcastDraftUpdate(data) {
    const { draftOrder, availablePlayers } = data;
    console.log('Broadcasting draft update:', { draftOrder, availablePlayers });

    const response = { type: 'draftUpdate', draftOrder, availablePlayers };

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(response));
        }
    });
}

function broadcastUserList() {
    const userList = Array.from(clients.keys());
    const message = JSON.stringify({ type: 'userListUpdate', users: userList });

    // Broadcast the user list to all connected clients
    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
        }
    });
}

function broadcastToLeague(leagueId, message) {
    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN && client.leagueId === leagueId) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

// Initialize a timer for each user's turn
function startUserTurn(leagueId, userId, turnIndex) {
    console.log(`Starting turn for user ${userId} in league ${leagueId}`);

    // Clear any existing timer for this user
    if (draftTimers[userId]) {
        clearTimeout(draftTimers[userId]);
    }

    // Notify clients about the current turn and the remaining time
    const response = { type: 'userTurn', userId, turnIndex, remainingTime: TURN_DURATION / 1000 };
    broadcastToLeague(leagueId, response);

    // Start a countdown timer for the turn
    draftTimers[userId] = setTimeout(() => {
        console.log(`Time's up for user ${userId} in league ${leagueId}`);
        // Move to the next user
        moveToNextUser(leagueId);
    }, TURN_DURATION);

    // Periodically broadcast the remaining time
    const startTime = Date.now();
    const intervalId = setInterval(() => {
        const timeLeft = Math.max(0, Math.ceil((TURN_DURATION - (Date.now() - startTime)) / 1000));
        broadcastToLeague(leagueId, { type: 'timeUpdate', remainingTime: timeLeft });

        if (timeLeft <= 0) {
            clearInterval(intervalId);
        }
    }, TIME_UPDATE_INTERVAL);
}

function moveToNextUser(leagueId) {
    // Fetch the current draft status and draft order
    pool.query('SELECT current_turn_index, draft_order, draft_started FROM draft_status WHERE league_id = $1', [leagueId])
        .then(result => {
            const { current_turn_index, draft_order, draft_started } = result.rows[0];
            const draftOrder = JSON.parse(draft_order);
            
            if (!draft_started) {
                // Draft has not started
                return;
            }

            // Calculate the next turn index
            const nextTurnIndex = (current_turn_index + 1) % draftOrder.length;
            
            // Check if we have completed all rounds
            const numRounds = 7; // Total number of rounds
            const numUsers = draftOrder.length / numRounds;
            
            if (nextTurnIndex % numUsers === 0 && nextTurnIndex / numUsers >= numRounds) {
                // End the draft if all rounds are complete
                return pool.query('UPDATE draft_status SET draft_ended = TRUE WHERE league_id = $1', [leagueId])
                    .then(() => {
                        // Notify all clients that the draft has ended
                        broadcastToLeague(leagueId, { type: 'draftEnded' });
                    });
            } else {
                // Update the draft status with the new turn index
                return pool.query('UPDATE draft_status SET current_turn_index = $1 WHERE league_id = $2', [nextTurnIndex, leagueId])
                    .then(() => {
                        const nextUserId = draftOrder[nextTurnIndex];
                        startUserTurn(leagueId, nextUserId, nextTurnIndex);
                    });
            }
        })
        .catch(error => {
            console.error('Error moving to next user:', error);
        });
}

// Server-side function to start the draft
function startDraft(leagueId) {
    console.log('Starting draft for league:', leagueId);

    let draftOrder = [];

    // Fetch the users in the league
    pool.query('SELECT user_id FROM user_leagues WHERE league_id = $1', [leagueId])
        .then(result => {
            const users = result.rows.map(row => row.user_id);
            console.log('League users:', users);

            // Generate the snake draft order
            draftOrder = generateSnakeDraftOrder(users);

            console.log('Draft Order:', draftOrder);

            // Insert or update the draft order in the draft_orders table
            return pool.query(
                'INSERT INTO draft_orders (league_id, draft_order) VALUES ($1, $2) ON CONFLICT (league_id) DO UPDATE SET draft_order = EXCLUDED.draft_order',
                [leagueId, JSON.stringify(draftOrder)]
            );
        })
        .then(() => {
            // Update the draft status to indicate that the draft has started
            return pool.query(
                'INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended) VALUES ($1, $2, TRUE, FALSE) ON CONFLICT (league_id) DO UPDATE SET draft_started = TRUE, current_turn_index = EXCLUDED.current_turn_index',
                [leagueId, 0] // Assuming the draft starts with turn index 0
            );
        })
        .then(() => {
            // Notify all clients to start the draft
            const response = { type: 'startDraft', draftOrder };
            console.log('Sending startDraft message to league:', leagueId);
            broadcastToLeague(leagueId, response);
        })
        .catch(error => {
            console.error('Error starting draft:', error);
        });
}

console.log('WebSocket server is running on ws://localhost:8080');
// #endregion

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});