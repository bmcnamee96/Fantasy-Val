import psycopg2
import csv

# Connect to the database
conn = psycopg2.connect(
    dbname='fan_val',
    user='postgres',
    password='pgadmin',
    host='localhost'
)
cursor = conn.cursor()

# Function to import CSV data
def import_csv(table_name, csv_file_path, columns):
    with open(csv_file_path, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip the header row
        for row in reader:
            cursor.execute(f'INSERT INTO {table_name} ({columns}) VALUES ({", ".join(["%s"] * len(row))})', row)
    conn.commit()

# Import data into games table
import_csv('games', 'Data\scores_data.csv', 'game_id, map_name, home_team, away_team, map_duration, home_score, away_score')
