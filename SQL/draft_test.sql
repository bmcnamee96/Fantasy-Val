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

INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended)
VALUES (3, -1, FALSE, FALSE);  -- Example for league with ID 1

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

