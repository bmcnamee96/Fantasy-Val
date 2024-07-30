document.addEventListener('DOMContentLoaded', async () => {
    // Define functions
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

    function getLeagueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('leagueId');
    }

    const token = localStorage.getItem('token');
    console.log('Token:', token);

    const leagueId = getLeagueIdFromUrl();
    console.log('League ID:', leagueId);

    const userId = getUserIdFromToken(token);
    console.log('User ID:', userId);

    if (!token || !leagueId || !userId) {
        console.error('Missing required parameters.');
        return;
    }

    const ws = new WebSocket(`ws://localhost:8080?userId=${userId}`);
    let draftOrder = [];
    let availablePlayers = [];
    let draftTimer;

    ws.onmessage = (event) => {
        console.log('Received message:', event.data);
        try {
            const message = JSON.parse(event.data);
            console.log('Parsed message:', message);
    
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
            console.error('Failed to process WebSocket message:', error);
        }
    };

    async function fetchDraftDetails() {
        try {
            const response = await fetch(`/api/leagues/${leagueId}/available-players`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
    
            const availablePlayers = await response.json();
            console.log('Fetched available players:', availablePlayers);
    
            ws.send(JSON.stringify({
                type: 'draftUpdate',
                draftOrder, // Ensure draftOrder is also populated if needed
                availablePlayers
            }));
    
            updateDraftOrderUI(draftOrder); // Ensure draftOrder is updated if needed
            updateAvailablePlayersUI(availablePlayers);
        } catch (error) {
            console.error('Failed to fetch draft details:', error);
        }
    }    

    function updateDraftOrderUI(draftOrder) {
        const draftOrderElement = document.getElementById('draft-order');
        if (draftOrderElement) {
            draftOrderElement.innerHTML = draftOrder.map(order => `<li>${order.userId}</li>`).join('');
            console.log('Updated draft order UI:', draftOrder);
        } else {
            console.error('Draft order element not found');
        }
    }

    function updateAvailablePlayersUI(availablePlayers) {
        const availablePlayersElement = document.getElementById('available-players');
        if (availablePlayersElement) {
            availablePlayersElement.innerHTML = availablePlayers.map(player =>
                `<div class="col-md-4">${player.player_name} <button data-player-id="${player.player_id}" onclick="draftPlayer('${player.player_id}')">Draft</button></div>`
            ).join('');
            console.log('Updated available players UI:', availablePlayers);
        } else {
            console.error('Available players element not found');
        }
    }

    function updateUserListUI(users) {
        const userListElement = document.getElementById('user-list');
        if (userListElement) {
            userListElement.innerHTML = users.map(user => `<li>${user}</li>`).join('');
        } else {
            console.error('User list element not found');
            console.log('Users:', users);
        }
    }

    function draftPlayer(playerId) {
        const button = document.querySelector(`button[data-player-id="${playerId}"]`);
        if (button) {
            button.disabled = true;
        }

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
                fetchDraftDetails();
            } else {
                console.error('Failed to draft player');
                if (button) {
                    button.disabled = false;
                }
            }
        })
        .catch(error => {
            console.error('Error drafting player:', error);
            if (button) {
                button.disabled = false;
            }
        });
    }    

    function updateDraftTimer() {
        let timerElement = document.getElementById('draft-timer');
        if (timerElement) {
            let currentTime = parseInt(timerElement.textContent);

            if (currentTime <= 0) {
                // Handle timer expiration logic
                endDraft(); // Example
            } else {
                timerElement.textContent = currentTime - 1;
            }
        } else {
            console.error('Draft timer element not found');
        }
    }

    function endDraft() {
        clearInterval(draftTimer);
        alert('Draft has ended.');
        window.close();
    }

    document.getElementById('end-draft-btn').addEventListener('click', endDraft);

    await fetchDraftDetails();

    draftTimer = setInterval(updateDraftTimer, 1000);
});
