document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const leagueId = getLeagueIdFromUrl();
    const userId = getUserIdFromToken(token);
    const ws = new WebSocket(`ws://localhost:8080?userId=${userId}`);
    let draftOrder = [];
    let availablePlayers = [];
    let draftTimer;

    // Get UserId
    function getUserIdFromToken(token) {
        if (!token) {
            console.error('No token provided');
            return null;
        }

        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/_/g, '/').replace(/-/g, '+')));
            return decoded.userId;
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }

    // Get LeagueId
    function getLeagueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('leagueId');
    }

    // Get Draft Details
    async function fetchDraftDetails() {
        try {
            const response = await fetch(`/api/leagues/${leagueId}/draft-details`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            draftOrder = data.draftStatus;
            availablePlayers = data.draftedPlayers;

            // Notify all clients about the draft update
            ws.send(JSON.stringify({
                type: 'draftUpdate',
                draftOrder,
                availablePlayers
            }));

            updateDraftOrderUI(draftOrder);
            updateAvailablePlayersUI(availablePlayers);
        } catch (error) {
            console.error('Failed to fetch draft details:', error);
        }
    }

    // Show Draft Order
    function updateDraftOrderUI(draftOrder) {
        const draftOrderElement = document.getElementById('draft-order');
        if (draftOrderElement) {
            draftOrderElement.innerHTML = draftOrder.map(order => `<li>${order.userId}</li>`).join('');
        } else {
            console.error('Draft order element not found');
        }
    }

    // Show Available Players
    function updateAvailablePlayersUI(availablePlayers) {
        const availablePlayersElement = document.getElementById('available-players');
        if (availablePlayersElement) {
            availablePlayersElement.innerHTML = availablePlayers.map(player =>
                `<div class="col-md-4">${player.playerName} <button onclick="draftPlayer('${player.playerId}')">Draft</button></div>`
            ).join('');
        } else {
            console.error('Available players element not found');
        }
    }

    // Show users within the draft
    function updateUserListUI(users) {
        const userListElement = document.getElementById('user-list');
        if (userListElement) {
            userListElement.innerHTML = users.map(user => `<li>${user}</li>`).join('');
        } else {
            console.error('User list element not found');
            console.log('Users:', users); // Debugging
        }
    }

    // Draft Player
    function draftPlayer(playerId) {
        // Disable the draft button to prevent multiple clicks
        document.querySelector(`button[data-player-id="${playerId}"]`).disabled = true;
    
        fetch('/api/draft-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, playerId, leagueId }),
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                fetchDraftDetails(); // Refresh draft details
            } else {
                console.error('Failed to draft player');
                // Re-enable button in case of failure
                document.querySelector(`button[data-player-id="${playerId}"]`).disabled = false;
            }
        })
        .catch(error => {
            console.error('Error drafting player:', error);
            // Re-enable button in case of failure
            document.querySelector(`button[data-player-id="${playerId}"]`).disabled = false;
        });
    }    

    // Draft Timer
    function updateDraftTimer() {
        let timerElement = document.getElementById('draft-timer');
        let currentTime = parseInt(timerElement.textContent);

        if (currentTime <= 0) {
            // Handle timer expiration logic
            draftPlayer(); // Example
        } else {
            timerElement.textContent = currentTime - 1;
        }
    }

    // End Draft
    function endDraft() {
        clearInterval(draftTimer);
        alert('Draft has ended.');
        window.close();
    }

    document.getElementById('end-draft-btn').addEventListener('click', endDraft);

    ws.onmessage = (event) => {
        console.log('Received message:', event.data);
    
        try {
            const message = JSON.parse(event.data);
    
            switch (message.type) {
                case 'userListUpdate':
                    updateUserListUI(message.users);
                    break;
                case 'draftUpdate':
                    updateDraftOrderUI(message.draftOrder);
                    updateAvailablePlayersUI(message.availablePlayers);
                    break;
                case 'welcome':
                    console.log(message.message);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to process message:', error);
        }
    };    

    await fetchDraftDetails();

    draftTimer = setInterval(updateDraftTimer, 1000);
});
