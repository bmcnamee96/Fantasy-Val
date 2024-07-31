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

    // Fetch league details to get the owner ID
    let leagueOwnerId;
    try {
        const leagueResponse = await fetch(`/api/leagues/${leagueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const league = await leagueResponse.json();
        leagueOwnerId = league.owner_id;
        console.log('League Owner ID:', leagueOwnerId);

        if (userId === leagueOwnerId) {
            const startDraftButton = document.getElementById('startDraftButton');
            if (startDraftButton) {
                startDraftButton.style.display = 'block';
                console.log('Start Draft button displayed for league owner');
            } else {
                console.error('Start Draft button element not found');
            }
        } else {
            console.log('User is not the league owner');
        }
    } catch (error) {
        console.error('Error fetching league details:', error);
        return;
    }

    const ws = new WebSocket(`ws://localhost:8080?userId=${userId}`);
    let draftOrder = [];
    let availablePlayers = [];
    let currentDraftIndex = 0;
    let draftTimer;

    // Event listener for the "Start Draft" button
    document.getElementById('startDraftButton').addEventListener('click', () => {
        ws.send(JSON.stringify({ type: 'startDraft', leagueId }));
    });

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
    
            switch (message.type) {
                case 'userListUpdate':
                    updateUserListUI(message.users);
                    break;
                case 'draftUpdate':
                    const { draftOrder, availablePlayers } = message;
                    if (Array.isArray(draftOrder)) {
                        updateDraftOrderUI(draftOrder);
                    } else {
                        console.warn('Received draft order is not an array:', draftOrder);
                    }
                    updateAvailablePlayersUI(availablePlayers);
                    break;
                case 'startDraft':
                    startDraft();
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
            // Fetch available players
            const response = await fetch(`/api/leagues/${leagueId}/available-players`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const availablePlayers = await response.json();

            // Construct draft order URL
            const draftOrderUrl = `/api/leagues/${leagueId}/draft-order`;
            console.log(`Draft Order URL: ${draftOrderUrl}`)
    
            // Fetch draft order
            const draftOrderResponse = await fetch(draftOrderUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!draftOrderResponse.ok) {
                throw new Error(`HTTP error! Status: ${draftOrderResponse.status}`);
            }

            const draftOrderData = await draftOrderResponse.json();
            const draftOrder = Array.isArray(draftOrderData) ? draftOrderData : [];

            console.log('Draft Order:', draftOrder);
    
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

    function updateDraftOrderUI(draftOrder) {
        const draftOrderContainer = document.getElementById('draftOrderContainer');
        draftOrderContainer.innerHTML = '';  // Clear existing content
    
        draftOrder.forEach(user => {
            const userElement = document.createElement('div');
            userElement.textContent = `${user.username}`;
            draftOrderContainer.appendChild(userElement);
        });
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

    function startDraft(leagueId) {
        console.log('Starting draft for league:', leagueId);
        const response = { type: 'startDraft' };
    
        // Ensure the draft order is fetched and updated in the server
    
        // Broadcast the start draft message to all clients
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(response));
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

    // Initialize WebSocket and fetch initial draft details
    ws.onopen = () => {
        console.log('WebSocket connection opened');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };

    await fetchDraftDetails();
});
