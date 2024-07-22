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