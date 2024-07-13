import psycopg2
import csv

# Connect to the database
conn = psycopg2.connect(
    dbname='fan_val',
    user='postgres',
    password='pgadmin',
    host='localhost'
)

########################################################################################

cursor = conn.cursor()

# TABLE games

# Open and read CSV file
with open('Data/scores_data.csv', 'r', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Create a tuple of values to insert, excluding game_id
        values = (row['map_name'], row['home_team'], row['away_team'], row['map_duration'], row['home_score'], row['away_score'])
        
        # Insert data into games table, excluding game_id
        cursor.execute("INSERT INTO games (map_name, home_team, away_team, map_duration, home_score, away_score) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;", values)

# Commit the transaction
conn.commit()

########################################################################################

# TABLE players

# Open and read CSV file
with open('Data/player_data.csv', 'r', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Create a tuple of values to insert, excluding game_id
        values = (row['player_name'], row['team_abrev'])
        
        # Insert data into games table, excluding game_id
        cursor.execute("INSERT INTO players (player_name, team) VALUES (%s, %s) ON CONFLICT DO NOTHING;", values)

# Commit the transaction
conn.commit()

########################################################################################

# TABLE player_stats

# Populate player_mapping from players table
cursor.execute("""
    INSERT INTO player_mapping (player_name, player_id)
    SELECT player_name, player_id FROM players;
""")

csv_file = 'Data/all_stats.csv'

# Open CSV file
with open(csv_file, 'r', newline='') as file:
    reader = csv.DictReader(file)
    
    # Iterate over each row in CSV
    for row in reader:
        player_name = row['player_name']
        game_id = float(row['game_id'])
        kills = float(row['kills'])
        deaths = float(row['deaths'])
        assists = float(row['assists'])
        adr = float(row['adr'])
        fk = float(row['fk'])
        fd = float(row['fd'])
        clutches = int(row['clutches'])
        aces = int(row['aces'])
        
        # Use player_name to fetch player_id from player_mapping or players table
        cursor.execute("SELECT player_id FROM player_mapping WHERE player_name = %s", (player_name,))
        result = cursor.fetchone()
        if result:
            player_id = result[0]
        else:
            # Handle case where player_name does not exist in player_mapping
            player_id = None

        # Insert into player_stats table
        if player_id:
            cursor.execute("""
                INSERT INTO player_stats (player_id, game_id, kills, deaths, assists, adr, fk, fd, clutches, aces)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (player_id, game_id, kills, deaths, assists, adr, fk, fd, clutches, aces))
        else:
            print(f"Player '{player_name}' not found in player_mapping")

# Commit the transaction
conn.commit()


########################################################################################


# Close cursor and connection
cursor.close()
conn.close()