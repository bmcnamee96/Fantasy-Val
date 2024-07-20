// controllers/leagueController.js
const League = require('../models/leagues.js');

exports.createLeague = async (req, res) => {
  const { league_name, description, owner_id } = req.body;

  try {
    const newLeague = await League.create({ league_name, description, owner_id });
    res.json({ success: true, league: newLeague });
  } catch (error) {
    console.error('Error creating league:', error);
    res.status(500).json({ success: false, message: 'Failed to create league.' });
  }
};
