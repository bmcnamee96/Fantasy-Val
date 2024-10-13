-- Step 1: Remove data from dependent tables (with foreign key references to users)
DELETE FROM user_schedule WHERE league_id IN (SELECT league_id FROM user_leagues);
DELETE FROM league_team_players WHERE league_team_id IN (SELECT league_team_id FROM league_teams WHERE user_id IS NOT NULL);
DELETE FROM drafted_players WHERE league_team_id IN (SELECT league_team_id FROM league_teams WHERE user_id IS NOT NULL);
DELETE FROM trade_requests WHERE sender_team_id IN (SELECT league_team_id FROM league_teams WHERE user_id IS NOT NULL) 
OR receiver_team_id IN (SELECT league_team_id FROM league_teams WHERE user_id IS NOT NULL);

-- Step 1.1: Delete related entries in team_standings that reference league_teams
DELETE FROM team_standings WHERE league_team_id IN (SELECT league_team_id FROM league_teams WHERE user_id IS NOT NULL);

-- Continue with the deletions
DELETE FROM user_leagues WHERE user_id IS NOT NULL;
DELETE FROM league_teams WHERE user_id IS NOT NULL;
DELETE FROM draft_orders WHERE league_id IN (SELECT league_id FROM leagues WHERE owner_id IS NOT NULL);
DELETE FROM draft_status WHERE league_id IN (SELECT league_id FROM leagues WHERE owner_id IS NOT NULL);
DELETE FROM turn_timers WHERE league_id IN (SELECT league_id FROM leagues WHERE owner_id IS NOT NULL);

-- Step 2: Remove the main user data
DELETE FROM users WHERE user_id IS NOT NULL;

-- Step 3: Remove leagues if needed (optional, depending on whether you want to keep them)
DELETE FROM leagues WHERE owner_id IS NOT NULL;

-- Step 4: Optionally, clean up any orphaned records or reset sequences if necessary
