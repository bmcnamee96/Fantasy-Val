const express = require('express');
const router = express.Router();
const League = require('../models/leagues.js'); // Adjust the path as necessary

// route to create a league
router.post('/api/create-leagues', async (req, res) => {
  const { league_name, description, owner_id } = req.body;
  
  try {
    const newLeague = await League.create({
      league_name,
      description,
      owner_id // Ensure this references a valid user ID
    });

    res.json({ success: true, league: newLeague });
  } catch (error) {
    console.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league.' });
  }
});

module.exports = router;

