const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

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

// Endpoint to register a new user
app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    await pool.query(
      `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING user_id`,
      [username, hashedPassword, email]
    );
    res.status(201).send('User registered successfully');
  } catch (err) {
    console.error('Error registering user:', err.message, err.stack);
    res.status(500).send('Error registering user');
  }
});

// Endpoint to sign in a user
app.post('/api/signin', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT user_id, username, password FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (isValidPassword) {
        res.status(200).json({username: user.username});
      } else {
        res.status(401).send('Invalid username or password');
      }
    } else {
      res.status(401).send('Invalid username or password');
    }
  } catch (err) {
    console.error('Error signing in user:', err.message, err.stack);
    res.status(500).send('Error signing in user');
  }
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
