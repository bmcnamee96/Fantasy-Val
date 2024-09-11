-- TRUNCATE A TABLE
TRUNCATE TABLE drafted_players;
TRUNCATE TABLE league_team_players;
TRUNCATE TABLE draft_status;
TRUNCATE TABLE draft_orders;
TRUNCATE TABLE turn_timers;

-- SELECT A TABLE
SELECT * FROM drafted_players;
SELECT * FROM league_team_players;
SELECT * FROM draft_orders;
SELECT * FROM draft_status;
SELECT * FROM turn_timers;
SELECT * FROM league_teams;
SELECT * FROM users;

INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended)
VALUES (6, -1, FALSE, FALSE);  -- Example for league with ID 1

INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (6, 'Test Team', 1); 
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 1 Team', 3); 
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 2 Team', 10); 
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 3 Team', 5);
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 4 Team', 6);
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 5 Team', 7);
INSERT INTO league_teams (league_id, team_name, user_id)
	VALUES (3, 'Test 6 Team', 8);

UPDATE draft_status
SET current_turn_index = -1  -- Example: move to the next user's turn
WHERE league_id = 3;

UPDATE draft_status
SET draft_started = FALSE  -- Example: move to the next user's turn
WHERE league_id = 3;

SELECT * FROM draft_orders;
INSERT INTO draft_orders (league_id, draft_order)
VALUES (6, '[]');

-- Fetch the element at index 2 from the draft_order array
SELECT draft_order[0] AS first_element
FROM draft_orders
WHERE league_id = 3;

-- Initialize timer
INSERT INTO turn_timers (league_id, current_turn_start, turn_duration)
VALUES (2, NOW(), 45)
ON CONFLICT (league_id) DO UPDATE
SET current_turn_start = EXCLUDED.current_turn_start;

-- get remaining time
SELECT league_id,
       EXTRACT(EPOCH FROM (NOW() - current_turn_start)) AS elapsed_time,
       turn_duration - EXTRACT(EPOCH FROM (NOW() - current_turn_start)) AS remaining_time
FROM turn_timers
WHERE league_id = 3;

-- checktTeamComposition
SELECT p.role 
FROM league_team_players ltp
JOIN player p ON ltp.player_id = p.player_id
WHERE ltp.league_team_id = 1;

SELECT * FROM player
ORDER BY preseason_ranking;



