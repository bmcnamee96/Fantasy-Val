const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fan_val',
  password: 'pgadmin',
  port: 5432,
});

// API endpoint to get top players
app.get('/api/top-players', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
          p.player_name, 
          SUM(ps.kills) AS kills, 
          SUM(ps.deaths) AS deaths, 
          SUM(ps.assists) AS assists, 
          ROUND(CAST(AVG(ps.adr) AS numeric), 2) AS adr, 
          SUM(ps.fk) AS fk, 
          SUM(ps.fd) AS fd, 
          SUM(ps.clutches) AS clutches, 
          SUM(ps.aces) AS aces,
          ROUND(CAST(SUM(ps.kills * 1 + ps.assists * 0.5 - ps.deaths * 0.5 + ps.adr * 0.1 + ps.fk * 2 - ps.fd * 1 + ps.clutches * 2 + ps.aces * 3) AS numeric), 2) AS points
      FROM 
          players p
      JOIN 
          player_stats ps 
      ON 
          p.player_id = ps.player_id
      GROUP BY 
          p.player_name
      ORDER BY 
          points DESC
      LIMIT 5;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err.message, err.stack);
    res.status(500).send('Error executing query');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
