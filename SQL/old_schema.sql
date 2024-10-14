-- Database: fan_val

-- DROP DATABASE IF EXISTS fan_val;

-------------- USER TABLES --------------

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT unique_user UNIQUE(username, email),
	CONSTRAINT user_email UNIQUE(email),
	CONSTRAINT unique_username UNIQUE(username)
);

-- leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id SERIAL PRIMARY KEY,
    league_name VARCHAR(50) NOT NULL,
	league_pass VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT unique_league UNIQUE(league_name)
);

-- user_leagues table
CREATE TABLE IF NOT EXISTS user_leagues (
    user_league_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    league_id INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id),
	UNIQUE(user_id, league_id)
);

-- team within a league table
CREATE TABLE IF NOT EXISTS league_teams (
    league_team_id SERIAL PRIMARY KEY,
    league_id INTEGER,
    team_name TEXT NOT NULL,
    user_id INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(league_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT unique_team_per_league UNIQUE(league_id, user_id)
);

-- draft order for each league
CREATE TABLE IF NOT EXISTS draft_orders (
    league_id INTEGER NOT NULL,
    draft_order JSONB NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (league_id)
);

CREATE TABLE IF NOT EXISTS draft_status (
    league_id INT PRIMARY KEY,      -- References the league for which the draft is happening
    current_turn_index INT NOT NULL,  -- Index of the current user’s turn in the draft order
    draft_started BOOLEAN NOT NULL DEFAULT FALSE,  -- Indicates if the draft has started
    draft_ended BOOLEAN NOT NULL DEFAULT FALSE,    -- Indicates if the draft has ended
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) -- Assuming there's a 'leagues' table with 'id' as its primary key
);

-- players on each team table
CREATE TABLE IF NOT EXISTS league_team_players (
    league_team_player_id SERIAL PRIMARY KEY,
    league_team_id INTEGER,
    player_id INTEGER,
    starter BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_team_id) REFERENCES league_teams(league_team_id),
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    CONSTRAINT unique_player_per_team UNIQUE(league_team_id, player_id)
);

-- trade requests table
CREATE TABLE trade_requests (
    trade_request_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL,
    sender_team_id INTEGER NOT NULL,
    receiver_team_id INTEGER NOT NULL,
    sender_player_id INTEGER NOT NULL,
    receiver_player_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Accepted', 'Rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(league_id),
    FOREIGN KEY (sender_team_id) REFERENCES league_teams(league_team_id),
    FOREIGN KEY (receiver_team_id) REFERENCES league_teams(league_team_id),
    FOREIGN KEY (sender_player_id) REFERENCES player(player_id),
    FOREIGN KEY (receiver_player_id) REFERENCES player(player_id)
);


-- drafted players table
CREATE TABLE IF NOT EXISTS drafted_players (
    drafted_player_id SERIAL PRIMARY KEY,
    league_id INTEGER,
    player_id INTEGER,
    league_team_id INTEGER,
	turn_index INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(league_id),
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    FOREIGN KEY (league_team_id) REFERENCES league_teams(league_team_id),
    CONSTRAINT unique_drafted_player UNIQUE(league_id, player_id)
);

-- turn timers table
CREATE TABLE IF NOT EXISTS turn_timers (
    league_id INT PRIMARY KEY,         -- References the league for which the turn timer is set
    current_turn_start TIMESTAMP, -- Timestamp when the current turn started
    current_turn_end TIMESTAMP,   -- Timestamp for when the current turn will end
    turn_duration INT NOT NULL DEFAULT 45  -- Duration of each turn in seconds
);

-- user_schedule table
CREATE TABLE user_schedule (
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

-- system settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR PRIMARY KEY,
    value VARCHAR,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_standings (
    league_team_id INT PRIMARY KEY,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    FOREIGN KEY (league_team_id) REFERENCES league_teams(league_team_id)
);

-- Password reset token
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_token UNIQUE(token),
	CONSTRAINT unique_email UNIQUE (email)
);

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
    team_abrev TEXT NOT NULL,
	role TEXT,
	preseason_ranking INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_abrev) REFERENCES teams(team_abrev),
    CONSTRAINT unique_player UNIQUE(player_name, team_abrev),
	CONSTRAINT unique_rank UNIQUE(preseason_ranking)
);

-- Weeks table
CREATE TABLE weeks (
    week_number INT PRIMARY KEY,
    start_date TIMESTAMP NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Series table
CREATE TABLE IF NOT EXISTS series (
    series_id SERIAL PRIMARY KEY,
    split INT,
    week INT,
    home_team TEXT,
    away_team TEXT,
    home_round_difference INTEGER,
    away_round_difference INTEGER,
    num_maps INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_game UNIQUE (series_id, map_name, home_team, away_team),
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    FOREIGN KEY (home_team) REFERENCES teams(team_abrev),
    FOREIGN KEY (away_team) REFERENCES teams(team_abrev)
);

-- PlayerStats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_stat_id SERIAL PRIMARY KEY,
    player_id INTEGER,
    series_id INTEGER,
    game_id INTEGER,
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
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    CONSTRAINT unique_stat UNIQUE(player_id, game_id)
);

-- Series Player Stats table
CREATE TABLE IF NOT EXISTS series_player_stats (
    player_series_stats_id SERIAL PRIMARY KEY,
    series_id INTEGER,
    week INTEGER,
    player_id INTEGER,
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
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    FOREIGN KEY (series_id) REFERENCES series(series_id),
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    CONSTRAINT unique_player_series UNIQUE (series_id, player_id)
);

-- Total Player Stats table
CREATE TABLE IF NOT EXISTS total_stats (
    total_stats_id SERIAL PRIMARY KEY,
    player_id INT,
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
    FOREIGN KEY (player_id) REFERENCES player(player_id),
    CONSTRAINT unique_total_stats UNIQUE (player_id)
);

-- Indexes for performance
CREATE INDEX idx_player_name ON player (player_name);
CREATE INDEX idx_team_name ON teams (team_name);
CREATE INDEX idx_series_id ON games (series_id);
CREATE INDEX idx_player_id ON player_stats (player_id);
CREATE INDEX idx_game_id ON player_stats (game_id);

