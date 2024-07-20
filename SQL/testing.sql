-- editor

SELECT * FROM games;

SELECT * FROM users;

SELECT * FROM players;

SELECT * FROM player_mapping;

SELECT * FROM player_stats;

SELECT * FROM password_reset_tokens;

SELECT * 
FROM series_player_stats
ORDER BY series_id ASC;

SELECT * 
FROM series;



SELECT game_id FROM games;

SELECT game_id FROM player_stats;

SELECT DISTINCT game_id FROM player_stats;




SELECT * FROM player_stats;

SELECT * FROM series_player_stats;

SELECT * 
FROM total_stats
ORDER BY total_points DESC;

-- total points for each player, descending, not adjusted
SELECT 
    p.player_name,
	t.team_abrev,
    ts.total_maps_played,
    ts.total_kills,
    ts.total_deaths,
    ts.total_assists,
    ts.total_fk,
    ts.total_fd,
    ts.total_clutches,
    ts.total_aces,
    ts.total_adr,
    ROUND(CAST(ts.total_points AS NUMERIC), 2) AS total_points
FROM total_stats ts
JOIN player p ON ts.player_id = p.player_id
JOIN teams t ON p.team_abrev = t.team_abrev
ORDER BY total_points DESC;

SELECT * FROM series_player_stats;

-- NOT ADJUSTED
SELECT 
	s.week,
	s.home_team,
    s.away_team,
	p.player_name,
	p.team_abrev,
    sps.series_maps,
    sps.series_kills,
    sps.series_deaths,
    sps.series_assists,
    sps.series_fk,
    sps.series_fd,
    sps.series_clutches,
    sps.series_aces,
    sps.avg_adr_per_series,
    sps.series_points, 
	s.home_round_difference,
	s.away_round_difference
FROM series_player_stats AS sps
JOIN series s ON sps.series_id = s.series_id
JOIN player p ON sps.player_id = p.player_id
ORDER BY week ASC, s.series_id ASC;

-- ADD adjusted_series_points
ALTER TABLE series_player_stats
ADD COLUMN adjusted_points FLOAT DEFAULT 0.0;
-- ADJUSTED
SELECT 
    s.week,
    s.home_team,
    s.away_team,
	s.home_round_difference,
    s.away_round_difference,
    p.player_name,
    p.team_abrev,
    sps.series_maps,
    sps.series_kills,
    sps.series_deaths,
    sps.series_assists,
    sps.series_fk,
    sps.series_fd,
    sps.series_clutches,
    sps.series_aces,
    sps.avg_adr_per_series,
    sps.series_points, 
    CASE 
        WHEN sps.series_maps = 2 THEN 
            CASE 
                WHEN p.team_abrev = s.home_team THEN sps.series_points + s.home_round_difference
                WHEN p.team_abrev = s.away_team THEN sps.series_points + s.away_round_difference
                ELSE sps.series_points
            END
        WHEN sps.series_maps = 3 THEN sps.series_points
        ELSE sps.series_points
    END AS adjusted_series_points
FROM series_player_stats AS sps
JOIN series s ON sps.series_id = s.series_id
JOIN player p ON sps.player_id = p.player_id
ORDER BY week ASC, s.series_id ASC;


SELECT column_name
FROM information_schema.columns
WHERE table_name = 'series_player_stats';

SELECT adjusted_points FROM series_player_stats;