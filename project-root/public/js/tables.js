document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed for tables.js');   
   
    // Access the filter dropdown by its ID
    const tableFilter = document.getElementById('table-filter');
    // Access the tables by their IDs
    const playerStatsTable = document.getElementById('player-stats-table');
    const matchStatsTable = document.getElementById('match-stats-table');
    // Access the table heading
    const tableHeading = document.getElementById('table-heading');

    // Check if all necessary elements are present
    if (tableFilter && playerStatsTable && matchStatsTable && tableHeading) {
        // Show Player Stats table by default
        playerStatsTable.style.display = '';
        matchStatsTable.style.display = 'none';

        // Event listener for the filter dropdown
        tableFilter.addEventListener('change', function() {
            if (tableFilter.value === 'player-stats') {
                playerStatsTable.style.display = '';
                matchStatsTable.style.display = 'none';
                tableHeading.textContent = 'Player Stats';
                fetchPlayerStats(); // Fetch player stats data
            } else if (tableFilter.value === 'match-stats') {
                playerStatsTable.style.display = 'none';
                matchStatsTable.style.display = '';
                tableHeading.textContent = 'Match Stats';
                fetchMatchStats(); // Fetch match stats data
            }
        });

        // Fetch player stats data on page load
        fetchPlayerStats();

        // Event listener for filter button click
        document.getElementById('apply-filters').addEventListener('click', (event) => {
            event.preventDefault();
            const teamAbrev = document.getElementById('team-filter').value;
            console.log('Selected team_abrev:', teamAbrev); // Debug log
            fetchPlayerStats(teamAbrev);
            if (tableFilter.value === 'player-stats') {
                fetchPlayerStats(teamAbrev);
            } else if (tableFilter.value === 'match-stats') {
                fetchMatchStats(teamAbrev);
            }
        });

        async function fetchPlayerStats(team_abrev = '') {
            try {
              const response = await fetch(`/api/val-stats/player-stats?team_abrev=${encodeURIComponent(team_abrev)}`);
              const data = await response.json();
          
              if (data.error) {
                console.error('Error fetching player stats:', data.details); // Log error message
                return; // Stop processing if there was an error
              }
          
              console.log('Fetched data:', data); // Debug log
              populatePlayerStatsTable(data);
            } catch (error) {
              console.error('Error fetching player stats:', error);
            }
        }          

        function populatePlayerStatsTable(data) {
            const tableBody = document.querySelector('#player-stats-table tbody');
            if (!tableBody) {
                console.error('Table body not found');
                return;
            }
            tableBody.innerHTML = ''; // Clear existing rows

            data.forEach(row => {
                const totalAdr = parseFloat(row.total_adr) || 0;
                const totalPoints = parseFloat(row.total_points) || 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.player.player_name}</td>
                    <td>${row.team_abrev}</td>
                    <td>${row.total_maps_played}</td>
                    <td>${row.total_kills}</td>
                    <td>${row.total_deaths}</td>
                    <td>${row.total_assists}</td>
                    <td>${row.total_fk}</td>
                    <td>${row.total_fd}</td>
                    <td>${row.total_clutches}</td>
                    <td>${row.total_aces}</td>
                    <td>${totalAdr.toFixed(2)}</td>
                    <td>${totalPoints.toFixed(2)}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Fetch data from the API for MatchStats
        async function fetchMatchStats(team_abrev = '') {
            try {
                const response = await fetch(`/api/val-stats/match-stats?team_abrev=${encodeURIComponent(team_abrev)}`);
                const text = await response.text(); // Get response as text first
                console.log('Response text:', text); // Log response text
                const data = JSON.parse(text); // Parse text as JSON
                console.log('Fetched data:', data); // Debug log
                populateMatchStatsTable(data);
            } catch (error) {
                console.error('Error fetching match stats:', error);
            }
        }

        function populateMatchStatsTable(data) {
            const tableBody = document.querySelector('#match-stats-table tbody');
            if (!tableBody) {
                console.error('Table body not found');
                return;
            }
            tableBody.innerHTML = ''; // Clear existing rows

            data.forEach(row => {
                const seriesAdr = parseFloat(row.avg_adr_per_series) || 0;
                const seriesPoints = parseFloat(row.adjusted_points) || 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.week}</td>
                    <td>${row.split}</td>
                    <td>${row.player_name}</td>
                    <td>${row.team_abrev}</td>
                    <td>${row.series_maps}</td>
                    <td>${row.series_kills}</td>
                    <td>${row.series_deaths}</td>
                    <td>${row.series_assists}</td>
                    <td>${row.series_fk}</td>
                    <td>${row.series_fd}</td>
                    <td>${row.series_clutches}</td>
                    <td>${row.series_aces}</td>
                    <td>${seriesAdr.toFixed(2)}</td>
                    <td>${seriesPoints.toFixed(2)}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Add event listeners to table headers for sorting
        document.querySelectorAll('#player-stats-table th').forEach((header, index) => {
            header.addEventListener('click', () => {
                const currentSort = header.getAttribute('data-sort');
                const newSort = currentSort === 'asc' ? 'desc' : 'asc';
                header.setAttribute('data-sort', newSort);
                updateSortIcons(header, newSort);
                sortTable('#player-stats-table', index, newSort);
            });
        });

        document.querySelectorAll('#match-stats-table th').forEach((header, index) => {
            header.addEventListener('click', () => {
                const currentSort = header.getAttribute('data-sort');
                const newSort = currentSort === 'asc' ? 'desc' : 'asc';
                header.setAttribute('data-sort', newSort);
                updateSortIcons(header, newSort);
                sortTable('#match-stats-table', index, newSort);
            });
        });

        // Sort table columns
        function sortTable(tableSelector, columnIndex, order) {
            const tableBody = document.querySelector(`${tableSelector} tbody`);
            const rows = Array.from(tableBody.getElementsByTagName('tr'));

            rows.sort((a, b) => {
                const aText = a.getElementsByTagName('td')[columnIndex].textContent.trim();
                const bText = b.getElementsByTagName('td')[columnIndex].textContent.trim();
                const aValue = isNaN(aText) ? aText : parseFloat(aText);
                const bValue = isNaN(bText) ? bText : parseFloat(bText);

                if (aValue < bValue) return order === 'asc' ? -1 : 1;
                if (aValue > bValue) return order === 'asc' ? 1 : -1;
                return 0;
            });

            rows.forEach(row => tableBody.appendChild(row));
        }

        // Update sort icons
        function updateSortIcons(header, order) {
            const allHeaders = document.querySelectorAll('#player-stats-table th, #match-stats-table th');
            allHeaders.forEach(h => {
                h.textContent = h.textContent.replace(/ ▲| ▼/g, ''); // Remove existing arrows
            });
            header.textContent += order === 'asc' ? ' ▲' : ' ▼'; // Add new arrow
        }
        
        // Search
        $(document).ready(function() {
            $('#search-input').on('keyup', function() {
                var value = $(this).val().toLowerCase();
                console.log("Value", value);
        
                $(".stats-table tbody tr").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
                });
            });
        });
    } else {
        console.error('One or more elements not found');
    }
});