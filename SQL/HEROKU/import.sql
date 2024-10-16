-- IMPORT DATA

-- Manually import teams data
INSERT INTO teams (team_name, team_abrev) VALUES 
	('100 Thieves', '100T'),
	('Sentinels', 'SEN'),
	('NRG Esports', 'NRG'),
	('Evil Geniuses', 'EG'),
	('KRU VISA Esports', 'KRU'),
	('Cloud9', 'C9'),
	('MIBR', 'MIBR'),
	('LOUD', 'LOUD'),
	('FURIA', 'FUR'),
	('Leviatan', 'LEV'),
	('G2 Esports', 'G2');

-- \copy commands for the psql terminal
-- \copy player(player_name, team_id) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/player.csv' DELIMITER ',' CSV HEADER;
-- \copy series(split, week, home_team_id, away_team_id, home_round_difference, away_round_difference, num_maps) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/series.csv' DELIMITER ',' CSV HEADER;
-- \copy games(series_id, map_name, home_team_id, away_team_id, map_duration, home_score, away_score) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/games.csv' DELIMITER ',' CSV HEADER;
-- \copy player_stats(player_id, series_id, game_id, agent, agent_role, kills, deaths, assists, fk, fd, clutches, aces, adr, points) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/player_stats.csv' DELIMITER ',' CSV HEADER;

INSERT INTO weeks (week_number, start_date) VALUES
(1, '2024-09-20 17:00:00+00'), 
(2, '2024-09-29 23:59:59+00'),
(3, '2024-10-06 23:59:59+00'),
(4, '2024-10-06 23:59:59+00'),
(5, '2024-10-20 23:59:59+00'),
(6, '2024-10-27 23:59:59+00'),
(7, '2024-11-03 23:59:59+00'),
(8, '2024-11-17 23:59:59+00'),
(9, '2024-11-24 23:59:59+00'),
(10, '2024-12-01 23:59:59+00')
;

-- add more players into the db so we have enough of each role
INSERT INTO player (player_id, player_name, team_id, role) VALUES
    (59, 'Blaze',     1, 'Fragger'),
    (60, 'Phantom',   4,   'Fragger'),
    (61, 'Vortex',    3,  'Fragger'),
    (62, 'Shadow',    2,  'Fragger'),
    (63, 'Ghost',     5,  'Fragger'),
    (64, 'Stone',     7, 'Anchor'),
    (65, 'Ironclad',  6,   'Anchor'),
    (66, 'Fortress',  10,  'Anchor'),
    (67, 'Bulwark',   9,  'Anchor'),
    (68, 'Sentinel',  8, 'Anchor');

-- input player rankings
UPDATE player
SET preseason_ranking = data.preseason_ranking
FROM (
    VALUES
    ('aspas', 'LEV', 1),
    ('jawgemo', 'EG', 2),
    ('Victor', 'NRG', 3),
    ('keznit', 'KRU', 4),
    ('zekken', 'SEN', 5),
    ('eeiu', '100T', 6),
    ('s0m', 'NRG', 7),
    ('OXY', 'C9', 8),
    ('leaf', 'G2', 9),
    ('Khalil', 'FUR', 10),
    ('kiNgg', 'LEV', 11),
    ('cauanzin', 'LOUD', 12),
    ('Cryocells', '100T', 13),
    ('TenZ', 'SEN', 14),
    ('mwzera', 'FUR', 15),
    ('Asuna', '100T', 16),
    ('Ethan', 'NRG', 17),
    ('Palla', 'MIBR', 18),
    ('Derrek', 'EG', 19),
    ('tuyz', 'LOUD', 20),
    ('Mazino', 'LEV', 21),
    ('heat', 'KRU', 22),
    ('Less', 'LOUD', 23),
    ('bang', '100T', 24),
    ('valyn', 'G2', 25),
    ('Xeppaa', 'C9', 26),
    ('JonahP', 'G2', 27),
    ('pANcada', 'LOUD', 28),
    ('supamen', 'EG', 29),
    ('Melser', 'KRU', 30),
    ('artzin', 'MIBR', 31),
    ('havoc', 'FUR', 32),
    ('trent', 'G2', 33),
    ('crashies', 'NRG', 34),
    ('saadhak', 'LOUD', 35),
    ('tex', 'LEV', 36),
    ('nzr', 'FUR', 37),
    ('Shyy', 'KRU', 38),
    ('icy', 'G2', 39),
    ('Sacy', 'SEN', 40),
    ('Boostio', '100T', 41),
    ('NaturE', 'EG', 42),
    ('Zellsis', 'SEN', 43),
    ('C0M', 'LEV', 44),
    ('moose', 'C9', 45),
    ('johnqt', 'SEN', 46),
    ('mazin', 'MIBR', 47),
    ('runi', 'C9', 48),
    ('Apoth', 'EG', 49),
    ('rich', 'MIBR', 50),
    ('vanity', 'C9', 51),
    ('FiNESSE', 'NRG', 52),
    ('xand', 'FUR', 53),
    ('liazzi', 'MIBR', 54),
    ('mta', 'KRU', 55),
    ('ShahZaM', 'MIBR', 56),
    ('Pa1nt', 'MIBR', 57),
    ('Klaus', 'KRU', 58),
    ('Blaze', '100T', 59),
    ('Phantom', 'EG', 60),
    ('Vortex', 'NRG', 61),
    ('Shadow', 'SEN', 62),
    ('Ghost', 'KRU', 63),
    ('Stone', 'MIBR', 64),
    ('Ironclad', 'C9', 65),
    ('Fortress', 'LEV', 66),
    ('Bulwark', 'FUR', 67),
    ('Sentinel', 'LOUD', 68)
) AS data(player_name, team_abrev, preseason_ranking)
JOIN teams ON teams.team_abrev = data.team_abrev
WHERE player.player_name = data.player_name
  AND player.team_id = teams.team_id;

-- Populate series_player_stats using data from player_stats
INSERT INTO series_player_stats (series_id, player_id, series_maps, series_kills, series_deaths, series_assists, series_fk, series_fd, series_clutches, series_aces, avg_adr_per_series, series_points)
SELECT 
    series_id, 
    player_id, 
    COUNT(game_id) as series_maps,
    SUM(kills) as series_kills,
    SUM(deaths) as series_deaths,
    SUM(assists) as series_assists,
    SUM(fk) as series_fk,
    SUM(fd) as series_fd,
    SUM(clutches) as series_clutches,
    SUM(aces) as series_aces,
    AVG(adr) as avg_adr_per_series,
    SUM(points) as series_points
FROM player_stats
GROUP BY series_id, player_id;
-- Do some math to get the adjusted_points
WITH SeriesStats AS (
    SELECT 
        sps.player_id,
        sps.series_id,
        CASE 
            WHEN sps.series_maps = 2 THEN 
                CASE 
                    WHEN p.team_id = s.home_team_id THEN sps.series_points + s.home_round_difference
                    WHEN p.team_id = s.away_team_id THEN sps.series_points + s.away_round_difference
                    ELSE sps.series_points
                END
            WHEN sps.series_maps = 3 THEN sps.series_points
            ELSE sps.series_points
        END AS adjusted_series_points
    FROM series_player_stats AS sps
    JOIN series s ON sps.series_id = s.series_id
    JOIN player p ON sps.player_id = p.player_id
)
UPDATE series_player_stats sps
SET adjusted_points = ss.adjusted_series_points
FROM SeriesStats ss
WHERE sps.player_id = ss.player_id AND sps.series_id = ss.series_id;

-- Populate total_stats using data from player_stats
INSERT INTO total_stats (player_id, total_maps_played, total_kills, total_deaths, total_assists, total_fk, total_fd, total_clutches, total_aces, total_adr, total_points)
SELECT 
    player_id,
    SUM(sps.series_maps) as total_maps_played,
    SUM(sps.series_kills) as total_kills,
    SUM(sps.series_deaths) as total_deaths,
    SUM(sps.series_assists) as total_assists,
    SUM(sps.series_fk) as total_fk,
    SUM(sps.series_fd) as total_fd,
    SUM(sps.series_clutches) as total_clutches,
    SUM(sps.series_aces) as total_aces,
    AVG(sps.avg_adr_per_series) as total_adr,
    SUM(sps.adjusted_points) as total_points
FROM series_player_stats as sps
GROUP BY player_id;
