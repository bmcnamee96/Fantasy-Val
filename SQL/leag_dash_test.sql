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
DELETE FROM league_teams
WHERE league_id <> 3;
DELETE FROM user_leagues
WHERE league_id <> 3;
DELETE FROM leagues
WHERE league_id <> 3;






