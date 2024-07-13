// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/top-players')
        .then(response => response.json())
        .then(data => {
            const playersTable = document.getElementById('players-table').getElementsByTagName('tbody')[0];
            data.forEach(player => {
                const row = playersTable.insertRow();
                row.innerHTML = `
                    <td>${player.player_name}</td>
                    <td>${player.kills}</td>
                    <td>${player.deaths}</td>
                    <td>${player.assists}</td>
                    <td>${player.adr}</td>
                    <td>${player.fk}</td>
                    <td>${player.fd}</td>
                    <td>${player.clutches}</td>
                    <td>${player.aces}</td>
                    <td>${player.points}</td>
                `;
            });
        })
        .catch(error => console.error('Error fetching top players:', error));
});
