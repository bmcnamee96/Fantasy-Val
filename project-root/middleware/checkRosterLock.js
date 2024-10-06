// middleware/checkRosterLock.js

const { isWithinRosterLockPeriod } = require('../utils/timeUtils');

/**
 * Middleware to check if roster changes are allowed.
 */
function checkRosterLock(req, res, next) {
  if (isWithinRosterLockPeriod()) {
    return res.status(403).json({ message: 'Roster changes are locked during game periods (Friday to Sunday).' });
  }
  next();
}

module.exports = checkRosterLock;
