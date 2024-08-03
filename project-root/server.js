// server.js

// #region Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { expressjwt: expressJwt } = require('express-jwt');
// const WebSocket = require('ws');
const { Pool } = require('pg');
const { JWT_SECRET } = require('./utils/auth');
const startWebSocketServer = require('./wsServer');
const logger = require('./utils/logger'); // Import your logger

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
const draftRoutes = require('./routes/draftRoutes');

// Route Mounting
app.use('/api/users', authRoutes);
app.use('/api/val-stats', valStatsRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/draft', draftRoutes);

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

// Database Pool Initialization
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
  startWebSocketServer(); // Start the WebSocket server
});