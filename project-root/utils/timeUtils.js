// utils/timeUtils.js

const { DateTime } = require('luxon');

/**
 * Checks if the current time is within the roster lock period.
 * @returns {boolean} True if rosters should be locked, false otherwise.
 */
function isWithinRosterLockPeriod() {
  // Current time in 'America/New_York' time zone
  const now = DateTime.now().setZone('America/New_York');

  // Start of lock period: Friday at 5:00 PM
  let lockStart = now
    .set({ weekday: 5, hour: 17, minute: 0, second: 0, millisecond: 0 })
    .startOf('minute');

  // End of lock period: Sunday at 11:59 PM
  let lockEnd = now
    .set({ weekday: 7, hour: 23, minute: 59, second: 59, millisecond: 999 })
    .endOf('second');

  // Adjust lockStart and lockEnd if necessary
  if (now > lockEnd) {
    // Move to next week's lock period
    lockStart = lockStart.plus({ weeks: 1 });
    lockEnd = lockEnd.plus({ weeks: 1 });
  } else if (now < lockStart) {
    // Move to previous week's lock period
    lockStart = lockStart.minus({ weeks: 1 });
    lockEnd = lockEnd.minus({ weeks: 1 });
  }

  // Return true if now is between lockStart and lockEnd
  return now >= lockStart && now <= lockEnd;
}

module.exports = {
  isWithinRosterLockPeriod,
};

