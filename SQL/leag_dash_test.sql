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

SELECT * FROM draft_orders;
INSERT INTO draft_orders (league_id, draft_order)
VALUES (6, '[]');

UPDATE draft_status
SET current_turn_index = 5, draft_started = TRUE, draft_ended = FALSE
WHERE league_id = 3;

TRUNCATE TABLE draft_status;
TRUNCATE TABLE draft_orders;

SELECT
    l.*,
    COUNT(ul.user_id) AS user_count
FROM
    leagues l
LEFT JOIN
    user_leagues ul ON l.league_id = ul.league_id
WHERE
    l.league_id = 3
GROUP BY
    l.league_id;

SELECT user_id FROM user_leagues WHERE league_id = 1;
SELECT user_id, username FROM users WHERE user_id = ANY(ARRAY[1, 3, 5, 6, 7, 8, 9, 10]::integer[]);

-- Fetch the element at index 2 from the draft_order array
SELECT draft_order[2] AS second_element
FROM draft_orders
WHERE league_id = 6;

