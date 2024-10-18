# import dependencies
from bs4 import BeautifulSoup as bs
import requests
import re
import timeit
import pandas as pd
import csv

# url to the matches tab
url = 'https://www.vlr.gg/event/matches/2004/champions-tour-2024-americas-stage-1/?series_id=3836'

# ------------------------- RETRIEVE ALL LINKS FOR SPLIT ------------------------- #

# scrape all the urls from the matches tab
print('Beginning URL Retrieval')
print('------------------------')

# get the html file using request
html_txt = requests.get(url)
soup = bs(html_txt.text, 'lxml')

try:
    # map to the correct location in the html file
    body = soup.find('body')
    div_container = body.find('div', class_='col-container')
    div_card = div_container.find_all('div', class_='wf-card')
    url_list = []
    perf_list = []
    over_list = []

    for idx, x in enumerate(div_card):
        if idx != 0:
            # create a base_url
            base_link = []
            base_url = f'https://www.vlr.gg'
            for link in div_card[idx].find_all('a'):
                base_link.append(link.get('href'))

            # fill the df with base urls
            for url in base_link:
                url_list.append(f'{base_url}{url}')
                
            # fill the df with the urls + /?game=all&tab=performance 
            # brings you to the performance tab 
            for url in base_link:
                perf_list.append(f'{base_url}{url}{"/?game=all&tab=performance"}')
                
            # fill the df with the urls + /?game=all&tab=overview 
            # brings you to the overview tab
            for url in base_link:
                over_list.append(f'{base_url}{url}{"/?game=all&tab=overview"}')

except AttributeError:
        print('There was a missing URL')

print('------------------------')
print(f'Found {len(url_list)} games!\n')

# ------------------------- SCRAPE THE OVERVIEW TAB ------------------------- #

def clean_dataframe(df, team_names):
    if df.empty:
        return None
    
    df_copy = df.copy()

    # Rename the columns
    df_copy.columns = ['name', 'blank', 'rating', 'acs', 'kills', 'deaths', 'assists', 'k/d', 'KAST', 'adr', 'hs', 'fk', 'fd', 'fk/fd']

    # Clean the 'name' column
    df_copy['name'] = df_copy['name'].str.strip().str.replace('\t', '').str.replace('\n', '')

    # Drop all unneeded columns
    df_copy = df_copy.drop(columns=['blank', 'rating', 'acs', 'k/d', 'KAST', 'hs', 'fk/fd'])
    
    # Apply a lambda function to extract the first number from each cell
    df_copy['kills'] = df_copy['kills'].apply(lambda x: x.split('\n')[0] if x else None)

    # Use a try-except block to handle potential errors in 'deaths' column processing
    try:
        df_copy['deaths'] = df_copy['deaths'].apply(lambda x: int(re.findall(r'\d+', x)[0]) if x else None)
    except IndexError:
        df_copy['deaths'] = None  # Handle the error by assigning a default value

    df_copy['assists'] = df_copy['assists'].apply(lambda x: x.split('\n')[0] if x else None)
    df_copy['adr'] = df_copy['adr'].apply(lambda x: x.split('\n')[0] if x else None)
    df_copy['fk'] = df_copy['fk'].apply(lambda x: x.split('\n')[0] if x else None)
    df_copy['fd'] = df_copy['fd'].apply(lambda x: x.split('\n')[0] if x else None)

    return df_copy

def scrape_data(url_list):
    all_dfs = {}  # Dictionary to store processed DataFrames for each URL

    team_names = ['MIBR', 'LEV', 'SEN', 'NRG', 'FUR', '100T', 'LOUD', 'EG', 'G2', 'C9', 'KRÜ']

    for url in url_list:
        response = requests.get(url)
        if response.status_code == 200:
            soup = bs(response.content, 'html.parser')

            # Initialize lists to store DataFrames for each pass
            first_pass_dfs = []
            second_pass_dfs = []

            # Find all game divs
            game_divs = soup.find_all('div', class_='vm-stats-game')

            # First pass: Find initial tables
            for game_div in game_divs:
                table = game_div.find('table', class_='wf-table-inset mod-overview')

                if table:
                    # Extract table data into a DataFrame
                    table_data = []
                    rows = table.find_all('tr')
                    for row in rows:
                        row_data = [cell.text.strip() for cell in row.find_all(['td', 'th'])]
                        table_data.append(row_data)

                    # Convert table_data into a DataFrame and append to first_pass_dfs list
                    df = pd.DataFrame(table_data[1:], columns=table_data[0])  # Assuming first row is header
                    first_pass_dfs.append(df)

            # Second pass: Find the next tables
            for game_div in game_divs:
                table = game_div.find('table', class_='wf-table-inset mod-overview')
                if table:
                    next_table = table.find_next('table', class_='wf-table-inset mod-overview')
                    if next_table:
                        # Extract table data into a DataFrame
                        table_data = []
                        rows = next_table.find_all('tr')
                        for row in rows:
                            row_data = [cell.text.strip() for cell in row.find_all(['td', 'th'])]
                            table_data.append(row_data)

                        # Convert table_data into a DataFrame and append to second_pass_dfs list
                        df = pd.DataFrame(table_data[1:], columns=table_data[0])  # Assuming first row is header
                        second_pass_dfs.append(df)

            # Process and clean DataFrames from both passes
            first_pass_cleaned = [clean_dataframe(df, team_names) for df in first_pass_dfs if not df.empty]
            second_pass_cleaned = [clean_dataframe(df, team_names) for df in second_pass_dfs if not df.empty]

            # Combine corresponding DataFrames from both passes
            combined_dfs = []
            min_length = min(len(first_pass_cleaned), len(second_pass_cleaned))
            for i in range(min_length):
                if first_pass_cleaned[i] is not None and second_pass_cleaned[i] is not None:
                    combined_df = pd.concat([first_pass_cleaned[i], second_pass_cleaned[i]], axis=0)
                    combined_dfs.append(combined_df)
                    combined_df.reset_index(inplace=True, drop=True)

            all_dfs[url] = combined_dfs

        else:
            print('Failed to retrieve the webpage. Status code:', response.status_code)

    return all_dfs

data_frames = scrape_data(over_list)

# remove the second df from each series

# Create a list of new keys
new_keys = [f'Series {i+1}' for i in range(len(data_frames))]

# Create a new dictionary with updated keys
re_dfs = dict(zip(new_keys, data_frames.values()))

# Iterate through the dictionary and remove the second item from each list value
for key in re_dfs:
    if len(re_dfs[key]) > 1:
        del re_dfs[key][1]  # Delete the second item (index 1)

# Convert dictionary keys to list
values_list = list(re_dfs.values())

# Flatten the list of lists into a single list of lists
flattened_list = [item for sublist in values_list for item in sublist]

# Initialize a game_id counter
game_id = 0

# Add game_id column to each DataFrame in the list
for df in flattened_list:
    df['game_id'] = game_id
    game_id += 1

# Concatenate all DataFrames in the list
concatenated_df = pd.concat(flattened_list, ignore_index=True)

# Extract team_abrev from name column
concatenated_df['team_abrev'] = concatenated_df['name'].apply(lambda x: x.split()[-1])

replace_data = {'name': ['Apoth EG', 'artzin MIBR', 'aspas LEV', 'Asuna 100T', 'bang 100T', 'Boostio 100T', 'C0M LEV', 
                         'cauanzin LOUD', 'crashies NRG', 'Cryocells 100T', 'Derrek EG', 'eeiu 100T', 'Ethan NRG', 
                         'FiNESSE NRG', 'havoc FUR', 'heat KRÜ', 'icy G2', 'jawgemo EG', 'johnqt SEN', 'JonahP G2', 
                         'keznit KRÜ', 'Khalil FUR', 'kiNgg LEV', 'Klaus KRÜ', 'leaf G2', 'Less LOUD', 'liazzi MIBR', 
                         'mazin MIBR', 'Mazino LEV', 'Melser KRÜ', 'moose C9', 'mta KRÜ', 'mwzera FUR', 'NaturE EG', 
                         'nzr FUR', 'OXY C9', 'Pa1nt MIBR', 'Palla MIBR', 'pANcada LOUD', 'rich MIBR', 'runi C9', 's0m NRG', 
                         'saadhak LOUD', 'Sacy SEN', 'ShahZaM MIBR', 'Shyy KRÜ', 'supamen EG', 'TenZ SEN', 'tex LEV', 
                         'trent G2', 'tuyz LOUD', 'valyn G2', 'vanity C9', 'Victor NRG', 'xand FUR', 'Xeppaa C9', 
                         'zekken SEN', 'Zellsis SEN', 'Quick LOUD'],
                'player_name': ['Apoth', 'artzin', 'aspas', 'Asuna', 'bang', 'Boostio', 'C0M', 'cauanzin', 'crashies', 
                               'Cryocells', 'Derrek', 'eeiu', 'Ethan', 'FiNESSE', 'havoc', 'heat', 'icy', 'jawgemo', 'johnqt', 
                               'JonahP', 'keznit', 'Khalil', 'kiNgg', 'Klaus', 'leaf', 'Less', 'liazzi', 'mazin', 'Mazino', 
                               'Melser', 'moose', 'mta', 'mwzera', 'NaturE', 'nzr', 'OXY', 'Pa1nt', 'Palla', 'pANcada', 'rich', 
                               'runi', 's0m', 'saadhak', 'Sacy', 'ShahZaM', 'Shyy', 'supamen', 'TenZ', 'tex', 'trent', 'tuyz', 
                               'valyn', 'vanity', 'Victor', 'xand', 'Xeppaa', 'zekken', 'Zellsis', 'Quick']}

replace_df = pd.DataFrame(replace_data)

# Replace names in df using replace_df
for index, row in replace_df.iterrows():
    concatenated_df['name'] = concatenated_df['name'].replace(row['name'], row['player_name'])

# change the names of the columns
new_names = ['player_name', 'kills', 'deaths', 'assists', 'adr', 'fk', 'fd', 'game_id', 'team_abrev']
concatenated_df.columns = new_names

# change the order of the columns
new_order = ['game_id', 'player_name', 'team_abrev', 'kills', 'deaths', 'assists', 'adr', 'fk', 'fd']
concatenated_df = concatenated_df[new_order]

print(concatenated_df.tail(10))