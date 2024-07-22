SELECT * FROM leagues;

SELECT * FROM users;

SELECT * FROM information_schema.tables WHERE table_name = 'user_teams';

SELECT * FROM user_leagues;

SELECT * FROM user_teams;
INSERT INTO user_leagues (user_id, league_id) VALUES
(1, 1),  -- User 1 is associated with League 1
(1, 2);  -- User 1 is associated with League 2

SELECT proname
FROM pg_proc
WHERE proname = 'add_league_to_user_leagues';

SELECT tgname
FROM pg_trigger
WHERE tgname = 'after_league_insert';

SELECT * FROM leagues;

INSERT INTO leagues (league_name, description, owner_id)
VALUES ('league2', 'Description of the league', 1);