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

-- user_teams table
CREATE TABLE IF NOT EXISTS user_teams (
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
    CONSTRAINT unique_token UNIQUE(token),
	CONSTRAINT unique_email UNIQUE (email)
);

-------------- VALORANT TABLES --------------

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL UNIQUE,
    team_abrev TEXT NOT NULL UNIQUE
);

-- Players table
CREATE TABLE IF NOT EXISTS player (
    player_id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    FOREIGN KEY (team_name) REFERENCES teams(team_name),
    CONSTRAINT unique_player UNIQUE(player_name, team_name)
);

-- Series table
CREATE TABLE IF NOT EXISTS series (
    series_id SERIAL PRIMARY KEY,
    home_team TEXT,
    away_team TEXT,
    home_round_difference INTEGER,
    away_round_difference INTEGER,
    num_maps INTEGER
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    series_id INTEGER,
    game_id SERIAL PRIMARY KEY,
    map_name TEXT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    map_duration TEXT,
    home_score INTEGER, 
    away_score INTEGER,
    CONSTRAINT unique_game UNIQUE (series_id, map_name, home_team, away_team),
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    FOREIGN KEY (home_team) REFERENCES teams(team_name),
    FOREIGN KEY (away_team) REFERENCES teams(team_name)
);

-- PlayerStats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_stat_id SERIAL PRIMARY KEY,
    player_id INTEGER,
    series_id INTEGER,
    game_id INTEGER,
    kills INTEGER,
    deaths INTEGER,
    assists INTEGER,
    fk INTEGER,
    fd INTEGER,
    clutches INTEGER,
    aces INTEGER,
    adr FLOAT,
    points FLOAT,
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    CONSTRAINT unique_stat UNIQUE(player_id, game_id)
);

-- Series Player Stats table
CREATE TABLE IF NOT EXISTS series_player_stats (
    player_series_stats_id SERIAL PRIMARY KEY,
    series_id INTEGER,
    player_id INTEGER,
    series_maps INTEGER DEFAULT 0,
    series_kills INTEGER DEFAULT 0,
    series_deaths INTEGER DEFAULT 0,
    series_assists INTEGER DEFAULT 0,
    series_fk INTEGER DEFAULT 0,
    series_fd INTEGER DEFAULT 0,
    series_clutches INTEGER DEFAULT 0, 
    series_aces INTEGER DEFAULT 0,
    avg_adr_per_series FLOAT DEFAULT 0.0,
    series_points FLOAT DEFAULT 0.0,
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    CONSTRAINT unique_player_series UNIQUE (series_id, player_id)
);

-- Total Player Stats table
CREATE TABLE IF NOT EXISTS total_stats (
    total_stats_id SERIAL PRIMARY KEY,
    player_id INT,
    total_maps_played INT DEFAULT 0,
    total_kills INT DEFAULT 0,
    total_deaths INT DEFAULT 0,
    total_assists INT DEFAULT 0,
    total_fk INT DEFAULT 0,
    total_fd INT DEFAULT 0,
    total_clutches INT DEFAULT 0,
    total_aces INT DEFAULT 0,
    total_adr DECIMAL(5, 2) DEFAULT 0.00,
    total_points FLOAT DEFAULT 0.0,
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    CONSTRAINT unique_total_stats UNIQUE (player_id)
);

-- Indexes for performance
CREATE INDEX idx_player_name ON player (player_name);
CREATE INDEX idx_team_name ON teams (team_name);
CREATE INDEX idx_series_id ON games (series_id);
CREATE INDEX idx_player_id ON player_stats (player_id);
CREATE INDEX idx_game_id ON player_stats (game_id);

