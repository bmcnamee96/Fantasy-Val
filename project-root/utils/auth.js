// utils/auth.js
const jwt_decode = require('jwt-decode'); // Ensure jwt-decode is installed and required correctly

const JWT_SECRET = 'valorant';

function getUserIdFromToken(token) {
  if (!token) {
      console.error('No token provided');
      return null;
  }

  try {
      const decoded = jwt_decode(token);
      return decoded.user_id; // Ensure this matches the payload of your JWT
  } catch (error) {
      console.error('Error decoding token:', error);
      return null;
  }
}

module.exports = {
  JWT_SECRET,
  getUserIdFromToken
};
