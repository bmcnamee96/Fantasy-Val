-- Database: fan_val

-- DROP DATABASE IF EXISTS fan_val;
	
-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id INTEGER PRIMARY KEY,
    league_name TEXT NOT NULL,
    commissioner_id INTEGER,
    FOREIGN KEY (commissioner_id) REFERENCES users(user_id)
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id INTEGER PRIMARY KEY,
    team_name TEXT NOT NULL,
    owner_id INTEGER,
    league_id INTEGER,
    FOREIGN KEY (owner_id) REFERENCES users(user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id)
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    player_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL
);

-- PlayerStats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_stat_id INTEGER PRIMARY KEY,
    player_id INTEGER,
    game_id INTEGER,
    kills INTEGER,
    deaths INTEGER,
    assists INTEGER,
    adr REAL,
    fk INTEGER,
    fd INTEGER,
    clutches INTEGER,
    date TEXT,
    FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
	game_id SERIAL PRIMARY KEY,
	map_name TEXT,
	home_team TEXT NOT NULL,
	away_team TEXT NOT NULL,
	map_duration TIME,
	home_score INTEGER, 
	away_score INTEGER
);

ALTER TABLE games
ALTER COLUMN map_duration TYPE TEXT;



