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

-- Calculate total points for each player in each game
SELECT
    ps.player_stat_id,
    ps.player_id,
    ps.game_id,
    p.player_name,
    ps.kills,
    ps.deaths,
    ps.assists,
    ps.adr,
    ps.fk,
    ps.fd,
    ps.clutches,
    ps.aces,
    SUM(ps.kills * 1 +
        ps.assists * 0.5 -
        ps.deaths * 0.5 +
        ps.fk * 2 -
        ps.fd * 1 +
        ps.clutches * 2 +
        ps.aces * 3 +
        ROUND(ps.adr::numeric * 0.1, 2) -- Cast adr to numeric before rounding
    ) AS total_points
FROM
    player_stats ps
JOIN
    players p ON ps.player_id = p.player_id
GROUP BY
    ps.player_stat_id, ps.player_id, ps.game_id, p.player_name, ps.kills, ps.deaths, ps.assists, ps.adr, ps.fk, ps.fd, ps.clutches, ps.aces
ORDER BY
    ps.player_stat_id;


SELECT
    ps.player_id,
    s.series_id,
    SUM(ps.total_points) AS total_points_series
FROM
    player_stats ps
JOIN
    games g ON ps.game_id = g.game_id
JOIN
    series s ON g.series_id = s.series_id
GROUP BY
    ps.player_id, s.series_id;

SELECT
    ps.player_id,
    s.series_id,
    SUM(ps.total_points) AS total_points_series
FROM
    player_stats ps
JOIN
    games g ON ps.game_id = g.game_id
JOIN
    series s ON g.series_id = s.series_id
GROUP BY
    ps.player_id, s.series_id;

-- Calculate round difference for each series
SELECT
    series_id,
    g.home_team,
    g.away_team,
    SUM(g.home_score - g.away_score) AS home_round_difference,
    SUM(g.away_score - g.home_score) AS away_round_difference
FROM
    games AS g
WHERE
    series_id IS NOT NULL
GROUP BY
    series_id,
    g.home_team,
    g.away_team
ORDER BY
    series_id ASC;

-- Count number of maps for each series
SELECT
    series_id,
    COUNT(DISTINCT map_name) AS num_maps
FROM
    games
WHERE
    series_id IS NOT NULL  -- Assuming you've already set up series_id in games table
GROUP BY
    series_id;

-- Calculate total points for each player for each series
SELECT
    s.series_id,
    p.player_name,
    g.home_team,
    g.away_team,
    SUM(ps.kills) AS total_kills,
    SUM(ps.deaths) AS total_deaths,
    SUM(ps.fk) AS total_fk,
    SUM(ps.fd) AS total_fd,
    SUM(ps.clutches) AS total_clutches,
    SUM(ps.aces) AS total_aces,
    (SUM(ps.adr)/ s.num_maps) AS total_adr,
    SUM(
        ps.kills * 1 +
        ps.assists * 0.5 -
        ps.deaths * 0.5 +
        ps.fk * 2 -
        ps.fd * 1 +
        ps.clutches * 2 +
        ps.aces * 3 +
        total_adr * 0.1
    ) AS total_points
FROM
    player_stats ps
JOIN
    games g ON ps.game_id = g.game_id
JOIN
    series s ON g.series_id = s.series_id
JOIN
    players p ON ps.player_id = p.player_id
GROUP BY
    s.series_id, p.player_name, g.home_team, g.away_team
ORDER BY
    s.series_id ASC, p.player_name ASC;

-- Calculate ADR for each player for each series
SELECT
    s.series_id,
    p.player_name,
    g.home_team,
    g.away_team,
    SUM(ps.kills) AS total_kills,
    SUM(ps.deaths) AS total_deaths,
    SUM(ps.fk) AS total_fk,
    SUM(ps.fd) AS total_fd,
    SUM(ps.clutches) AS total_clutches,
    SUM(ps.aces) AS total_aces,
    AVG(ps.adr) AS avg_adr_per_series
FROM
    player_stats ps
JOIN
    games g ON ps.game_id = g.game_id
JOIN
    series s ON g.series_id = s.series_id
JOIN
    players p ON ps.player_id = p.player_id
GROUP BY
    s.series_id, p.player_name, g.home_team, g.away_team
ORDER BY
    s.series_id ASC, p.player_name ASC;

SELECT
    sps.series_id,
    sps.player_id,
    p.player_name,
    g.home_team,
    g.away_team,
    sps.total_kills,
    sps.total_deaths,
    sps.total_assists,
    sps.total_fk,
    sps.total_fd,
    sps.total_clutches,
    sps.total_aces,
	sps.avg_adr_per_series,
    SUM(
        sps.total_kills * 1 +
        sps.total_assists * 0.5 -
        sps.total_deaths * 0.5 +
        sps.total_fk * 2 -
        sps.total_fd * 1 +
        sps.total_clutches * 2 +
        sps.total_aces * 3 +
        sps.avg_adr_per_series * 0.1
    ) AS total_points
FROM
    series_player_stats sps
JOIN
    series s ON sps.series_id = s.series_id
JOIN
    games g ON s.series_id = g.series_id  -- Join games table to get home_team and away_team
JOIN
    players p ON sps.player_id = p.player_id
GROUP BY
    sps.series_id, sps.player_id, p.player_name, g.home_team, g.away_team, sps.avg_adr_per_series
ORDER BY
    sps.series_id ASC, p.player_name ASC;











