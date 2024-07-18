-- IMPORT DATA

-- Ensure the required tables are created
\i schema.sql

-- Manually import teams data
INSERT INTO teams (team_name, team_abrev) VALUES 
	('100 Thieves', '100T'),
	('Sentinels', 'SEN'),
	('NRG Esports', 'NRG'),
	('Evil Geniuses', 'EG')
	('KRU VISA Esports', 'KRU'),
	('Cloud9', 'C9'),
	('MIBR', 'MIBR'),
	('LOUD', 'LOUD'),
	('FURIA', 'FURIA'),
	('Leviatan', 'LEV'),
	('G2 Esports', 'G2');

-- Import players data
COPY player(player_name, team_abrev)
FROM 'C:\Users\bmac9\Desktop\Coding Stuff\Valorant_Project\Fantasy-Val\Data\player_data.csv'
WITH (FORMAT csv, HEADER true);

-- Import series data
COPY series(home_team, away_team, home_round_difference, away_round_difference, num_maps)
FROM 'C:\Users\bmac9\Desktop\Coding Stuff\Valorant_Project\Fantasy-Val\Data\series_df.csv'
WITH (FORMAT csv, HEADER true);

-- Import games data
COPY games(series_id, map_name, home_team, away_team, map_duration, home_score, away_score)
FROM 'C:\Users\bmac9\Desktop\Coding Stuff\Valorant_Project\Fantasy-Val\Data\games_data_updated.csv'
WITH (FORMAT csv, HEADER true);

-- Import player_stats data
COPY player_stats(player_id, series_id, game_id, kills, deaths, assists, fk, fd, clutches, aces, adr, points)
FROM '/path/to/player_stats.csv'
WITH (FORMAT csv, HEADER true);

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
    COUNT(game_id) as total_maps_played,
    SUM(kills) as total_kills,
    SUM(deaths) as total_deaths,
    SUM(assists) as total_assists,
    SUM(fk) as total_fk,
    SUM(fd) as total_fd,
    SUM(clutches) as total_clutches,
    SUM(aces) as total_aces,
    AVG(adr) as total_adr,
    SUM(points) as total_points
FROM player_stats
GROUP BY player_id;
