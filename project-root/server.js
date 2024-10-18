// #region Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { expressjwt: expressJwt } = require('express-jwt');
const cookieParser = require('cookie-parser'); // NEW: Parse cookies for refresh tokens
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const { JWT_SECRET } = require('./utils/auth'); // Access token secret
const logger = require('./utils/logger'); // Import logger
const startSocketIOServer = require('./socketio'); // Socket.IO server setup

require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the HTTP server
const io = socketIo(server);

// Middleware to parse JSON bodies and cookies
app.use(bodyParser.json());
app.use(cookieParser()); // NEW: Parse cookies (for refresh tokens)

// Serve static files from the 'public' directory
app.use(express.static('public'));

// JWT Middleware for access token validation
app.use(
  expressJwt({
    secret: JWT_SECRET,
    algorithms: ['HS256'],
    getToken: (req) => req.headers.authorization?.split(' ')[1], // Extract token from header
  }).unless({
    path: [
      '/', // Allow public access to root path
      '/index.html',
      /\/images\/.*/, // Allow images without authentication
      '/api/auth/signup',
      '/api/auth/signin',
      '/api/auth/recover-password',
      '/api/auth/refresh-token', // Allow refresh token endpoint without JWT
      '/api/val-stats/player-stats',
      '/api/val-stats/match-stats',
    ],
  })
);

// Middleware to extract userId from JWT, if present
app.use((req, res, next) => {
  if (req.auth) {
    req.userId = req.auth.userId;
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

// Route Mounting
app.use('/api/auth', authRoutes); // Updated path for auth routes
app.use('/api/val-stats', valStatsRoutes);
app.use('/api/leagues', leagueRoutes);

// Serve the main HTML file
app.get('/', (req, res) => {
  logger.info('Serving index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// JWT Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    logger.error('UnauthorizedError: Invalid or missing token');
    res.status(401).json({ error: 'Invalid or missing token' });
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
