document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed for tables.js');

    const tableFilter = document.getElementById('table-filter');
    const playerStatsTable = document.getElementById('player-stats-table');
    const matchStatsTable = document.getElementById('match-stats-table');
    const tableHeading = document.getElementById('table-heading');
    const teamFilter = document.getElementById('team-filter');
    const splitFilter = document.getElementById('split-filter');
    const weekFilter = document.getElementById('week-filter');

    if (tableFilter && playerStatsTable && matchStatsTable && tableHeading) {
        playerStatsTable.style.display = '';
        matchStatsTable.style.display = 'none';

        // Clear filters when switching between tables
        tableFilter.addEventListener('change', function () {
            resetFilters();
            if (tableFilter.value === 'player-stats') {
                playerStatsTable.style.display = '';
                matchStatsTable.style.display = 'none';
                tableHeading.textContent = 'Player Stats';
                fetchPlayerStats();
            } else if (tableFilter.value === 'match-stats') {
                playerStatsTable.style.display = 'none';
                matchStatsTable.style.display = '';
                tableHeading.textContent = 'Match Stats';
                fetchMatchStats();
            }
        });

        // Fetch player stats data on page load
        fetchPlayerStats();

        document.getElementById('apply-filters').addEventListener('click', (event) => {
            event.preventDefault();
            const teamAbrev = teamFilter.value;
            const split = splitFilter.value;
            const week = weekFilter.value;

            console.log('Filters:', { teamAbrev, split, week });

            if (tableFilter.value === 'player-stats') {
                fetchPlayerStats(teamAbrev);
            } else if (tableFilter.value === 'match-stats') {
                fetchMatchStats(teamAbrev, split, week);
            }
        });

        // Fetch data for Player Stats
        async function fetchPlayerStats(team_abrev = '') {
            try {
                const response = await fetch(`/api/val-stats/player-stats?team_abrev=${encodeURIComponent(team_abrev)}`);
                const data = await response.json();
                console.log('Fetched data:', data);

                if (Array.isArray(data)) {
                    populatePlayerStatsTable(data);
                } else {
                    console.error('Unexpected data format:', data);
                }
            } catch (error) {
                console.error('Error fetching player stats:', error);
            }
        }

        function populatePlayerStatsTable(data) {
            const tableBody = document.querySelector('#player-stats-table tbody');
            if (!tableBody) return console.error('Table body not found');
            tableBody.innerHTML = '';

            data.forEach(row => {
                const totalAdr = parseFloat(row.total_adr) || 0;
                const totalPoints = parseFloat(row.total_points) || 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.player_name}</td>
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

        async function fetchMatchStats(team_abrev = '', split = '', week = '') {
            try {
                const url = new URL('/api/val-stats/match-stats', window.location.origin);
                url.searchParams.append('team_abrev', team_abrev);
                url.searchParams.append('split', split);
                url.searchParams.append('week', week);

                const response = await fetch(url);
                const data = await response.json();
                console.log('Fetched data:', data);
                populateMatchStatsTable(data);
            } catch (error) {
                console.error('Error fetching match stats:', error);
            }
        }

        function populateMatchStatsTable(data) {
            const tableBody = document.querySelector('#match-stats-table tbody');
            if (!tableBody) return console.error('Table body not found');
            tableBody.innerHTML = '';

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

        document.querySelectorAll('#player-stats-table th, #match-stats-table th').forEach((header, index) => {
            header.addEventListener('click', () => {
                const currentSort = header.getAttribute('data-sort');
                const newSort = currentSort === 'asc' ? 'desc' : 'asc';
                header.setAttribute('data-sort', newSort);
                updateSortIcons(header, newSort);
                sortTable(header.closest('table').id, index, newSort);
            });
        });

        function sortTable(tableId, columnIndex, order) {
            const tableBody = document.querySelector(`#${tableId} tbody`);
            const rows = Array.from(tableBody.getElementsByTagName('tr'));

            rows.sort((a, b) => {
                const aText = a.getElementsByTagName('td')[columnIndex].textContent.trim();
                const bText = b.getElementsByTagName('td')[columnIndex].textContent.trim();
                const aValue = isNaN(aText) ? aText.toLowerCase() : parseFloat(aText);
                const bValue = isNaN(bText) ? bText.toLowerCase() : parseFloat(bText);

                return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });

            rows.forEach(row => tableBody.appendChild(row));
        }

        function updateSortIcons(header, order) {
            document.querySelectorAll('#player-stats-table th, #match-stats-table th').forEach(h => {
                h.textContent = h.textContent.replace(/ ▲| ▼/g, '');
            });
            header.textContent += order === 'asc' ? ' ▲' : ' ▼';
        }

        function resetFilters() {
            teamFilter.value = '';
            splitFilter.value = '';
            weekFilter.value = '';
        }

        $('#search-input').on('keyup', function () {
            const value = $(this).val().toLowerCase();
            $('.stats-table tbody tr').filter(function () {
                $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
            });
        });
    } else {
        console.error('One or more elements not found');
    }
});
