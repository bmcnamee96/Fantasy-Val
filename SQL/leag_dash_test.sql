SELECT * FROM league_teams;

SELECT * FROM league_team_players;

SELECT * FROM draft_orders;

INSERT INTO draft_orders (league_id, draft_order) VALUES (3, '[1, 2, 5, 6, 7, 3, 4]');

INSERT INTO draft_status (league_id, current_turn_index, draft_started, draft_ended)
VALUES (3, 0, FALSE, FALSE);  -- Example for league with ID 1

UPDATE draft_status
SET current_turn_index = 0  -- Example: move to the next user's turn
WHERE league_id = 3;

SELECT * FROM draft_status;