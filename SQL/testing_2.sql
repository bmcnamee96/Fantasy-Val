SELECT * FROM leagues;

SELECT * FROM users;

SELECT * FROM information_schema.tables WHERE table_name = 'user_teams';

SELECT * FROM user_leagues;

SELECT * FROM user_teams;
INSERT INTO user_leagues (user_id, league_id) VALUES
(1, 1),  -- User 1 is associated with League 1
(1, 2);  -- User 1 is associated with League 2

SELECT * FROM leagues;

SELECT * FROM user_leagues;