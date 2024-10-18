-- Database: fan_val

-- DROP DATABASE IF EXISTS fan_val;

-------------- FUNCTIONS AND TRIGGERS --------------

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to insert the owner into user_leagues after a league is created
CREATE OR REPLACE FUNCTION add_league_to_user_leagues()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_leagues (user_id, league_id)
    VALUES (NEW.owner_id, NEW.league_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-------------- USER TABLES --------------

-- Refresh token table
CREATE TABLE refresh_tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE
);


-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id SERIAL PRIMARY KEY,
    league_name VARCHAR(50) NOT NULL UNIQUE,
    league_pass VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for inserting owner into user_leagues
CREATE TRIGGER after_league_insert
AFTER INSERT ON leagues
FOR EACH ROW
EXECUTE FUNCTION add_league_to_user_leagues();

-- User leagues table
CREATE TABLE IF NOT EXISTS user_leagues (
    user_league_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    league_id INTEGER NOT NULL REFERENCES leagues(league_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, league_id)
);

-- Trigger for user_leagues
CREATE TRIGGER trg_user_leagues_updated_at
BEFORE UPDATE ON user_leagues
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- League teams table
CREATE TABLE IF NOT EXISTS league_teams (
    league_team_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id),
    team_name TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (league_id, user_id)
);

-- Team standings table
CREATE TABLE IF NOT EXISTS team_standings (
    league_team_id INTEGER PRIMARY KEY REFERENCES league_teams(league_team_id),
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for team_standings
CREATE TRIGGER trg_team_standings_updated_at
BEFORE UPDATE ON team_standings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-------------- VALORANT TABLES --------------

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL UNIQUE,
    team_abrev TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE IF NOT EXISTS player (
    player_id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    team_id INTEGER NOT NULL REFERENCES teams(team_id),
    role TEXT,
    preseason_ranking INTEGER UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_name, team_id)
);

-- Weeks table
CREATE TABLE IF NOT EXISTS weeks (
    week_number INTEGER PRIMARY KEY,
    start_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Series table
CREATE TABLE IF NOT EXISTS series (
    series_id SERIAL PRIMARY KEY,
    split INTEGER,
    week INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
    away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
    home_round_difference INTEGER,
    away_round_difference INTEGER,
    num_maps INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    game_id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES series(series_id),
    map_name TEXT,
    home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
    away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
    map_duration TEXT,
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (series_id, map_name, home_team_id, away_team_id)
);

-------------- OTHER TABLES --------------

-- League team players table
CREATE TABLE IF NOT EXISTS league_team_players (
    league_team_player_id SERIAL PRIMARY KEY,
    league_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id),
    player_id INTEGER NOT NULL REFERENCES player(player_id),
    starter BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (league_team_id, player_id)
);

-- Trigger for league_team_players
CREATE TRIGGER trg_league_team_players_updated_at
BEFORE UPDATE ON league_team_players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Draft orders table
CREATE TABLE IF NOT EXISTS draft_orders (
    league_id INTEGER PRIMARY KEY REFERENCES leagues(league_id),
    draft_order JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for draft_orders
CREATE TRIGGER trg_draft_orders_updated_at
BEFORE UPDATE ON draft_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Draft status table
CREATE TABLE IF NOT EXISTS draft_status (
    league_id INTEGER PRIMARY KEY REFERENCES leagues(league_id),
    current_turn_index INTEGER NOT NULL,
    draft_started BOOLEAN NOT NULL DEFAULT FALSE,
    draft_ended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for draft_status
CREATE TRIGGER trg_draft_status_updated_at
BEFORE UPDATE ON draft_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trade requests table
CREATE TABLE IF NOT EXISTS trade_requests (
    trade_request_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id),
    sender_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id),
    receiver_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id),
    sender_player_id INTEGER NOT NULL REFERENCES player(player_id),
    receiver_player_id INTEGER NOT NULL REFERENCES player(player_id),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Accepted', 'Rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for trade_requests
CREATE TRIGGER trg_trade_requests_updated_at
BEFORE UPDATE ON trade_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Drafted players table
CREATE TABLE IF NOT EXISTS drafted_players (
    drafted_player_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id),
    player_id INTEGER NOT NULL REFERENCES player(player_id),
    league_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id),
    turn_index INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (league_id, player_id)
);

-- Trigger for drafted_players
CREATE TRIGGER trg_drafted_players_updated_at
BEFORE UPDATE ON drafted_players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Turn timers table
CREATE TABLE IF NOT EXISTS turn_timers (
    league_id INTEGER PRIMARY KEY REFERENCES leagues(league_id),
    current_turn_start TIMESTAMP,
    current_turn_end TIMESTAMP,
    turn_duration INTEGER NOT NULL DEFAULT 45,  -- Duration of each turn in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for turn_timers
CREATE TRIGGER trg_turn_timers_updated_at
BEFORE UPDATE ON turn_timers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- User schedule table
CREATE TABLE IF NOT EXISTS user_schedule (
    schedule_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL REFERENCES weeks(week_number),
    home_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id) ON DELETE CASCADE,
    away_team_id INTEGER NOT NULL REFERENCES league_teams(league_team_id) ON DELETE CASCADE,
    home_team_score INTEGER,
    away_team_score INTEGER,
    winner_team_id INTEGER REFERENCES league_teams(league_team_id),
    is_tie BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for user_schedule
CREATE TRIGGER trg_user_schedule_updated_at
BEFORE UPDATE ON user_schedule
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR PRIMARY KEY,
    value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for system_settings
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_stat_id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES player(player_id),
    series_id INTEGER NOT NULL REFERENCES series(series_id),
    game_id INTEGER NOT NULL REFERENCES games(game_id),
    agent TEXT,
    agent_role TEXT,
    kills NUMERIC,
    deaths NUMERIC,
    assists NUMERIC,
    fk NUMERIC,
    fd NUMERIC,
    clutches NUMERIC,
    aces NUMERIC,
    adr FLOAT,
    points FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_id, game_id)
);

-- Trigger for player_stats
CREATE TRIGGER trg_player_stats_updated_at
BEFORE UPDATE ON player_stats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Series player stats table
CREATE TABLE IF NOT EXISTS series_player_stats (
    player_series_stats_id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES series(series_id),
    week INTEGER,
    player_id INTEGER NOT NULL REFERENCES player(player_id),
    series_maps INTEGER DEFAULT 0,
    series_kills NUMERIC DEFAULT 0,
    series_deaths NUMERIC DEFAULT 0,
    series_assists NUMERIC DEFAULT 0,
    series_fk NUMERIC DEFAULT 0,
    series_fd NUMERIC DEFAULT 0,
    series_clutches NUMERIC DEFAULT 0,
    series_aces NUMERIC DEFAULT 0,
    avg_adr_per_series FLOAT DEFAULT 0.0,
    series_points FLOAT DEFAULT 0.0,
    adjusted_points FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (series_id, player_id)
);

-- Trigger for series_player_stats
CREATE TRIGGER trg_series_player_stats_updated_at
BEFORE UPDATE ON series_player_stats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Total player stats table
CREATE TABLE IF NOT EXISTS total_stats (
    total_stats_id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL UNIQUE REFERENCES player(player_id),
    total_maps_played NUMERIC DEFAULT 0,
    total_kills NUMERIC DEFAULT 0,
    total_deaths NUMERIC DEFAULT 0,
    total_assists NUMERIC DEFAULT 0,
    total_fk NUMERIC DEFAULT 0,
    total_fd NUMERIC DEFAULT 0,
    total_clutches NUMERIC DEFAULT 0,
    total_aces NUMERIC DEFAULT 0,
    total_adr DECIMAL(5, 2) DEFAULT 0.00,
    total_points FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for total_stats
CREATE TRIGGER trg_total_stats_updated_at
BEFORE UPDATE ON total_stats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-------------- INDEXES FOR PERFORMANCE --------------

-- Indexes for performance
CREATE INDEX idx_player_name ON player (player_name);
CREATE INDEX idx_team_name ON teams (team_name);
CREATE INDEX idx_series_id ON games (series_id);
CREATE INDEX idx_player_id ON player_stats (player_id);
CREATE INDEX idx_game_id ON player_stats (game_id);
