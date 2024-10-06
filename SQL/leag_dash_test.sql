SELECT * FROM league_teams;
SELECT * FROM leagues;
SELECT * FROM league_team_players;
SELECT * FROM user_leagues;
SELECT * FROM draft_orders;
SELECT * FROM draft_status;

DELETE FROM draft_status
	WHERE league_id <> 3;
DELETE FROM draft_orders
	WHERE league_id <> 3;
DELETE FROM drafted_players
	WHERE league_team_id <> 3;
DELETE FROM league_team_players
	WHERE league_team_id <> 3;
DELETE FROM league_teams
	WHERE league_id <> 3;
DELETE FROM user_leagues
	WHERE league_id <> 3;
DELETE FROM leagues
	WHERE league_id <> 3;

ALTER TABLE league_team_players ADD COLUMN starter BOOLEAN DEFAULT FALSE;

INSERT INTO player (player_id, player_name, team_abrev, role) VALUES
    (59, 'Blaze',     '100T', 'Fragger'),
    (60, 'Phantom',   'EG',   'Fragger'),
    (61, 'Vortex',    'NRG',  'Fragger'),
    (62, 'Shadow',    'SEN',  'Fragger'),
    (63, 'Ghost',     'KRU',  'Fragger'),
    (64, 'Stone',     'MIBR', 'Anchor'),
    (65, 'Ironclad',  'C9',   'Anchor'),
    (66, 'Fortress',  'LEV',  'Anchor'),
    (67, 'Bulwark',   'FUR',  'Anchor'),
    (68, 'Sentinel',  'LOUD', 'Anchor');


ALTER TABLE series_player_stats
ADD COLUMN week INTEGER DEFAULT 0;

UPDATE series_player_stats
SET week = 4
WHERE series_id = 24;
SELECT * 
FROM series_player_stats
ORDER BY series_id ASC;

SELECT * FROM series WHERE week = 2;

SELECT lt.league_team_id, lt.team_name
FROM league_teams lt
WHERE lt.league_id = 3;

SELECT *
FROM series_player_stats
WHERE week = 3 AND player_id = 23; -- Replace with actual player_id and week

SELECT lt.league_team_player_id, lt.league_team_id, lt.player_id, p.player_name
FROM league_team_players lt
JOIN player p ON lt.player_id = p.player_id
WHERE lt.league_team_id = 13; -- Replace with actual league_team_id

SELECT 
    p.player_name, 
    p.role, 
    p.team_abrev, 
    COALESCE(SUM(sps.adjusted_points), 0) AS points, 
    ltp.starter
FROM 
    league_team_players ltp
JOIN 
    player p ON ltp.player_id = p.player_id
LEFT JOIN 
    series_player_stats sps 
    ON p.player_id = sps.player_id 
    AND sps.week = 2
WHERE 
    ltp.league_team_id = 13
GROUP BY 
    p.player_name, p.role, p.team_abrev, ltp.starter;


CREATE TABLE weeks (
    week_number SERIAL PRIMARY KEY,
    start_date TIMESTAMP NOT NULL
);

INSERT INTO weeks (week_number, start_date) VALUES
(1, '2024-10-04 22:00:00'), 
(2, '2024-10-11 22:00:00'),
(3, '2024-10-18 22:00:00'),
(4, '2024-10-25 22:00:00'),
(5, '2024-10-01 22:00:00'),
(6, '2024-10-08 22:00:00'),
(7, '2024-10-15 22:00:00'),
(8, '2024-10-22 22:00:00')
;

UPDATE weeks
SET start_date = '2024-10-31 22:00:00+00'
WHERE week_number = 5;

SELECT * FROM weeks;

TRUNCATE TABLE weeks, user_schedule;

SELECT * FROM user_schedule;
