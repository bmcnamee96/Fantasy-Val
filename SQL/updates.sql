
-- Drop all games that have not yet been played.
DELETE FROM games
WHERE home_score = 0 AND away_score = 0;

-- Update games with series_id based on some criteria
UPDATE games g
SET series_id = sub.series_id
FROM (
    SELECT
        game_id,
        DENSE_RANK() OVER (ORDER BY home_team, away_team) AS series_id
    FROM
        games
    WHERE
        series_id IS NULL -- Only update rows that don't have a series_id yet
) AS sub
WHERE
    g.game_id = sub.game_id;

-- Populate series table with round differences and num_maps
INSERT INTO series (series_id, home_round_difference, away_round_difference, num_maps)
SELECT
    g.series_id,
    SUM(g.home_score - g.away_score) AS home_round_difference,
    SUM(g.away_score - g.home_score) AS away_round_difference,
    COUNT(*) AS num_maps
FROM
    games g
WHERE
    g.series_id IS NOT NULL
GROUP BY
    g.series_id;

INSERT INTO series_player_stats (series_id, player_id, avg_adr_per_series, total_kills, total_deaths, total_assists, total_fk, total_fd, total_clutches, total_aces)
SELECT
    s.series_id,
    p.player_id,
    AVG(ps.adr) AS avg_adr_per_series,
    SUM(ps.kills) AS total_kills,
    SUM(ps.deaths) AS total_deaths,
	SUM(ps.assists) AS total_assists,
    SUM(ps.fk) AS total_fk,
    SUM(ps.fd) AS total_fd,
    SUM(ps.clutches) AS total_clutches,
    SUM(ps.aces) AS total_aces
FROM
    player_stats ps
JOIN
    games g ON ps.game_id = g.game_id
JOIN
    series s ON g.series_id = s.series_id
JOIN
    players p ON ps.player_id = p.player_id
GROUP BY
    s.series_id, p.player_id
ORDER BY
    s.series_id ASC, p.player_id ASC;


