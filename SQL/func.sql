-- func.sql

-- Create function to import user_id into user_league
CREATE OR REPLACE FUNCTION add_league_to_user_leagues()
RETURNS TRIGGER AS $func$
BEGIN
    INSERT INTO user_leagues (user_id, league_id) VALUES (NEW.owner_id, NEW.league_id);
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER after_league_insert
AFTER INSERT ON leagues
FOR EACH ROW
EXECUTE FUNCTION add_league_to_user_leagues();

-- Create the trigger function to update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_leagues
CREATE TRIGGER trg_user_leagues_updated_at
BEFORE UPDATE ON user_leagues
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for draft_orders
CREATE TRIGGER trg_draft_orders_updated_at
BEFORE UPDATE ON draft_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for draft_status
CREATE TRIGGER trg_draft_status_updated_at
BEFORE UPDATE ON draft_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for league_team_players
CREATE TRIGGER trg_league_team_players_updated_at
BEFORE UPDATE ON league_team_players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for trade_requests
CREATE TRIGGER trg_trade_requests_updated_at
BEFORE UPDATE ON trade_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for drafted_players
CREATE TRIGGER trg_drafted_players_updated_at
BEFORE UPDATE ON drafted_players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_schedule
CREATE TRIGGER trg_user_schedule_updated_at
BEFORE UPDATE ON user_schedule
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for system_settings
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for team_standings
CREATE TRIGGER trg_team_standings_updated_at
BEFORE UPDATE ON team_standings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for player
CREATE TRIGGER trg_player_updated_at
BEFORE UPDATE ON player
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for total_stats
CREATE TRIGGER trg_total_stats_updated_at
BEFORE UPDATE ON total_stats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
