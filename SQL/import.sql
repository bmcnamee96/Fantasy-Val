-- IMPORT DATA

-- Ensure schema is set up correctly
\i 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/SQL/schema.sql';

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

-- Example of \copy commands with corrected syntax
\copy player(player_name, team_abrev) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/player.csv' DELIMITER ',' CSV HEADER;
\copy series(split, week, home_team, away_team, home_round_difference, away_round_difference, num_maps) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/series.csv' DELIMITER ',' CSV HEADER;
\copy games(series_id, map_name, home_team, away_team, map_duration, home_score, away_score) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/games.csv' DELIMITER ',' CSV HEADER;
\copy player_stats(player_id, series_id, game_id, agent, agent_role, kills, deaths, assists, fk, fd, clutches, aces, adr, points) FROM 'C:/Users/bmac9/Desktop/Coding Stuff/Valorant_Project/Fantasy-Val/Data/import_tables/player_stats.csv' DELIMITER ',' CSV HEADER;


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
    SUM(sps.series_points) as total_points
FROM series_player_stats as sps
GROUP BY player_id;
