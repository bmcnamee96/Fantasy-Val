-- Database: fan_val

-- DROP DATABASE IF EXISTS fan_val;

-------------- USER TABLES --------------

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
	CONSTRAINT unique_user UNIQUE(username, email),
	CONSTRAINT user_email UNIQUE(email),
	CONSTRAINT unique_username UNIQUE(username)
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id SERIAL PRIMARY KEY,
    league_name TEXT NOT NULL,
    commissioner_id INTEGER,
    FOREIGN KEY (commissioner_id) REFERENCES users(user_id)
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL,
    owner_id INTEGER,
    league_id INTEGER,
    FOREIGN KEY (owner_id) REFERENCES users(user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id)
);

-- Password reset token
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_token UNIQUE(token)
);

ALTER TABLE password_reset_tokens
ADD CONSTRAINT unique_email
UNIQUE (email);

-------------- VALORANT TABLES --------------

-- Players table
CREATE TABLE IF NOT EXISTS players (
    player_id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    team TEXT NOT NULL,
	CONSTRAINT unique_player UNIQUE(player_name, team)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
	game_id SERIAL PRIMARY KEY,
	map_name TEXT,
	home_team TEXT NOT NULL,
	away_team TEXT NOT NULL,
	map_duration TEXT,
	home_score INTEGER, 
	away_score INTEGER,
	CONSTRAINT unique_game UNIQUE (map_name, home_team, away_team)
);

-- PlayerStats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_stat_id SERIAL PRIMARY KEY,
    player_id INTEGER,
    game_id INTEGER,
    kills INTEGER,
    deaths INTEGER,
    assists INTEGER,
    adr REAL,
    fk INTEGER,
    fd INTEGER,
    clutches INTEGER,
	aces INTEGER,
    FOREIGN KEY (player_id) REFERENCES players(player_id),
	FOREIGN KEY (game_id) REFERENCES games(game_id),
	CONSTRAINT unique_stat UNIQUE(player_id, game_id)
);

CREATE TABLE IF NOT EXISTS player_mapping (
    player_name TEXT PRIMARY KEY,
    player_id INTEGER
);

