SELECT * FROM league_teams;

SELECT * FROM league_team_players;

SELECT p.player_id, p.player_name, p.team_abrev
FROM player p
LEFT JOIN drafted_players dp ON p.player_id = dp.player_id AND dp.league_id = 1
WHERE dp.player_id IS NULL;