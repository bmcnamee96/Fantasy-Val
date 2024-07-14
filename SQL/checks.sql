-- editor

SELECT * FROM games;

SELECT * FROM users;

SELECT * FROM players;

SELECT * FROM player_mapping;

SELECT * FROM player_stats;

SELECT * FROM password_reset_tokens;

-- Top 5 players by points
WITH PlayerStats AS (
  SELECT 
    p.player_name, 
    ROUND(CAST(
      (SUM(ps.kills) * 1) +
      (SUM(ps.assists) * 0.5) - 
      (SUM(ps.deaths) * 0.5) + 
      (SUM(ps.fk) * 2) - 
      (SUM(ps.fd) * 1) + 
      (SUM(ps.clutches) * 2) + 
      (SUM(ps.aces) * 3) + 
      (ROUND(CAST(AVG(ps.adr) AS numeric), 2) * 0.1)
    AS numeric), 2) AS points
  FROM 
    players p
  JOIN 
    player_stats ps 
  ON 
    p.player_id = ps.player_id
  GROUP BY 
    p.player_name
)
SELECT 
  player_name,
  points
FROM 
  PlayerStats
ORDER BY 
  points DESC
LIMIT 5;
