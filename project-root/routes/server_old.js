// #region Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { expressjwt: expressJwt } = require('express-jwt');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const { JWT_SECRET } = require('./utils/auth');
const logger = require('./utils/logger'); // Import your logger
const startSocketIOServer = require('./socketio'); // Import the Socket.IO server setup

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the HTTP server
const io = socketIo(server);

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
    /\/images\/.*/,
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
    logger.info(`User ID extracted from token: ${req.userId}`);
  } else {
    req.userId = null;
  }
  next();
});

// Route Imports
const authRoutes = require('./routes/authRoutes');
const valStatsRoutes = require('./routes/valStatsRoutes');
const leagueRoutes = require('./routes/leagueRoutes');
// const draftRoutes = require('./routes/draftRoutes');

// Route Mounting
app.use('/api/users', authRoutes);
app.use('/api/val-stats', valStatsRoutes);
app.use('/api/leagues', leagueRoutes);
// app.use('/api/draft', draftRoutes);

// Serving index.html
app.get('/', (req, res) => {
  logger.info('Serving index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware for JWT
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    logger.error('UnauthorizedError: Invalid or missing token');
    res.status(401).send('Invalid or missing token');
  } else {
    logger.error('Server Error:', err);
    next(err);
  }
});

// Start the Socket.IO server
startSocketIOServer(io);

// Start the HTTP server
server.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});