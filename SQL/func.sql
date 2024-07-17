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
  player_name ASC
LIMIT 5;

-- Calculate total points for each player in each game
WITH calculated_points AS (
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
	    ps.player_stat_id
)
UPDATE player_stats ps
SET ps.total_points = cp.total_points
FROM calculated_points cp
WHERE ps.player_stat_id = cp.player_stat_id;

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

-- Calculate total points
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

-- Calculate total points for each player for each map
ALTER TABLE player_stats
ADD COLUMN total_points numeric;
WITH calculated_points AS (
    SELECT
        ps.player_stat_id,
        SUM(ps.kills * 1 +
            ps.assists * 0.5 -
            ps.deaths * 0.5 +
            ps.fk * 2 -
            ps.fd * 1 +
            ps.clutches * 2 +
            ps.aces * 3 +
            ROUND(ps.adr::numeric * 0.1, 2)
        ) AS total_points
    FROM
        player_stats ps
    JOIN
        players p ON ps.player_id = p.player_id
    GROUP BY
        ps.player_stat_id, ps.player_id, ps.game_id, p.player_name, ps.kills, ps.deaths, ps.assists, ps.adr, ps.fk, ps.fd, ps.clutches, ps.aces
)
UPDATE player_stats
SET total_points = cp.total_points
FROM calculated_points cp
WHERE player_stats.player_stat_id = cp.player_stat_id;


-- Calculate total points for each player for each series (not adjusted)
ALTER TABLE series_player_stats
ADD COLUMN total_series_points numeric;
WITH total_points_per_series AS (
    SELECT
        g.series_id,
        ps.player_id,
        SUM(ps.total_points) AS total_series_points
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
    GROUP BY
        g.series_id, ps.player_id
)
UPDATE series_player_stats sps
SET total_series_points = tps.total_series_points
FROM total_points_per_series tps
WHERE sps.series_id = tps.series_id AND sps.player_id = tps.player_id;
SELECT * FROM series_player_stats;


-- Calculate the total points for each player (not adjusted)
SELECT
    ps.player_id,
    p.player_name,
    SUM(ps.total_points) AS total_overall_points
FROM
    player_stats ps
JOIN
    players p ON ps.player_id = p.player_id
GROUP BY
    ps.player_id, p.player_name
ORDER BY
    total_overall_points DESC;

-- Calculate the number of maps played by each player in each series
WITH maps_played AS (
    SELECT
        g.series_id,
        ps.player_id,
        COUNT(DISTINCT ps.game_id) AS maps_played
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
    GROUP BY
        g.series_id, ps.player_id
),

-- Determine if the player was part of the home team or away team in each series
player_team AS (
    SELECT
        ps.player_id,
        g.series_id,
        CASE
            WHEN ps.player_id = g.home_team_player_id THEN 'home_team'
            WHEN ps.player_id = g.away_team_player_id THEN 'away_team'
            ELSE 'unknown_team'
        END AS team_role
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
)

-- Calculate the adjusted total points for each player in each series
SELECT
    mp.series_id,
    mp.player_id,
    pt.team_role,
    sps.total_series_points AS original_total_points,
    CASE
        WHEN mp.maps_played = 2 THEN sps.total_series_points * 1.5
        WHEN mp.maps_played = 3 THEN sps.total_series_points * 1.0
        ELSE sps.total_series_points
    END AS adjusted_total_points
FROM
    maps_played mp
JOIN
    series_player_stats sps ON mp.series_id = sps.series_id AND mp.player_id = sps.player_id
JOIN
    player_team pt ON mp.series_id = pt.series_id AND mp.player_id = pt.player_id;


-- Calculate the number of maps played by each player in each series
WITH maps_played AS (
    SELECT
        g.series_id,
        ps.player_id,
        COUNT(DISTINCT ps.game_id) AS maps_played
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
    GROUP BY
        g.series_id, ps.player_id
),

-- Calculate the adjusted total points for each player in each series
adjusted_series_points AS (
    SELECT
        mp.series_id,
        mp.player_id,
        sps.total_series_points AS original_total_points,
        CASE
            WHEN mp.maps_played = 2 THEN sps.total_series_points * 1.5
            WHEN mp.maps_played = 3 THEN sps.total_series_points * 1.0
            ELSE sps.total_series_points
        END AS adjusted_total_points
    FROM
        maps_played mp
    JOIN
        series_player_stats sps ON mp.series_id = sps.series_id AND mp.player_id = sps.player_id
)

-- Select the original and adjusted total points
SELECT
    asp.series_id,
    asp.player_id,
    p.player_name,
    p.team,
    asp.original_total_points,
    asp.adjusted_total_points
FROM
    adjusted_series_points asp
JOIN
    players p ON asp.player_id = p.player_id;

-- Calculate the number of maps played by each player in each series
WITH maps_played AS (
    SELECT
        g.series_id,
        ps.player_id,
        COUNT(DISTINCT ps.game_id) AS maps_played
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
    GROUP BY
        g.series_id, ps.player_id
),

-- Calculate if the player was part of the home team or away team in each series
player_team AS (
    SELECT
        ps.player_id,
        g.series_id,
        CASE
            WHEN ps.game_id = g.game_id AND ps.player_id = g.home_team_player_id THEN 'home_team'
            WHEN ps.game_id = g.game_id AND ps.player_id = g.away_team_player_id THEN 'away_team'
            ELSE 'unknown_team'
        END AS team_role
    FROM
        player_stats ps
    JOIN
        games g ON ps.game_id = g.game_id
),

-- Calculate the adjusted total points for each player in each series
adjusted_series_points AS (
    SELECT
        mp.series_id,
        mp.player_id,
        pt.team_role,
        sps.total_series_points AS original_total_points,
        CASE
            WHEN mp.maps_played = 2 THEN sps.total_series_points * 1.5
            WHEN mp.maps_played = 3 THEN sps.total_series_points * 1.0
            ELSE sps.total_series_points
        END AS adjusted_total_points
    FROM
        maps_played mp
    JOIN
        series_player_stats sps ON mp.series_id = sps.series_id AND mp.player_id = sps.player_id
    JOIN
        player_team pt ON mp.series_id = pt.series_id AND mp.player_id = pt.player_id
)

-- Select the original and adjusted total points with team role information
SELECT
    asp.series_id,
    asp.player_id,
    p.player_name,
    p.team,
    asp.team_role,
    asp.original_total_points,
    asp.adjusted_total_points
FROM
    adjusted_series_points asp
JOIN
    players p ON asp.player_id = p.player_id;


-- Alter Series table to add home_team and away_team columns
ALTER TABLE series
ADD COLUMN home_team TEXT,
ADD COLUMN away_team TEXT;

-- Update using games table to determine home_team and away_team
UPDATE series s
SET 
    home_team = g.home_team,
    away_team = g.away_team
FROM (
    SELECT 
        series_id,
        MIN(home_team) AS home_team,
        MIN(away_team) AS away_team
    FROM games
    GROUP BY series_id
) g
WHERE s.series_id = g.series_id;

SELECT * FROM series;
