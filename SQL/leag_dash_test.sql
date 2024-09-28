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




SELECT * FROM player
	ORDER BY team_abrev;
