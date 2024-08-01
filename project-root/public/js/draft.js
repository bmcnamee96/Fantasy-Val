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
        const leagueResponse = await fetch(`/api/draft/leagues/${leagueId}`, {
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

    const ws = new WebSocket(`ws://localhost:8080/?userId=${userId}&leagueId=${leagueId}`);
    const draftInterval = 5000; // Interval time in milliseconds (e.g., 60000ms = 1 minute)
    let currentTurnIndex = 0; // Initialize currentTurnIndex
    let draftOrder = [];
    let draftTimer; // Global variable to hold the timer
    let remainingTime = 0; // Global variable to hold the remaining time for the current turn

    // Event listener for the "Start Draft" button
    document.getElementById('startDraftButton').addEventListener('click', () => {
        ws.send(JSON.stringify({ type: 'startDraft', leagueId }));
    });

    // Event listener for the "End Draft" button
    document.getElementById('end-draft-btn').addEventListener('click', async () => {
        try {
            // Notify server to end the draft
            await fetch(`/api/draft/leagues/${leagueId}/end-draft`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Handle end draft UI
            endDraft();
        } catch (error) {
            console.error('Error ending draft:', error);
        }
    });

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
    
            switch (message.type) {
                case 'userListUpdate':
                    updateUserListUI(message.users);
                    break;
                case 'draftUpdate':
                    const { draftOrder: newDraftOrder, availablePlayers } = message;
                    if (Array.isArray(newDraftOrder)) {
                        draftOrder = newDraftOrder; // Update draftOrder with the new data
                        updateDraftOrderUI(draftOrder);
                    } else {
                        console.warn('Received draft order is not an array:', draftOrder);
                    }
                    updateAvailablePlayersUI(availablePlayers);
                    break;
                case 'startDraft':
                    startDraft(message);
                    break;
                case 'endDraft':
                    endDraft();
                    break;
                case 'userTurn':
                    handleUserTurn(message);
                    break;
                case 'timeUpdate':
                    handleTimeUpdate(message);
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
            const response = await fetch(`/api/draft/leagues/${leagueId}/available-players`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const availablePlayers = await response.json();

            // Fetch draft order
            const draftOrderResponse = await fetch(`/api/draft/leagues/${leagueId}/draft-order`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!draftOrderResponse.ok) {
                throw new Error(`HTTP error! Status: ${draftOrderResponse.status}`);
            }

            const draftOrderData = await draftOrderResponse.json();
            draftOrder = Array.isArray(draftOrderData) ? draftOrderData : [];

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
    
        draftOrder.forEach(userId => {
            const userElement = document.createElement('div');
            userElement.textContent = `User ID: ${userId}`;  // Display userId
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

    function startDraft(data) {
        if (!data || !data.draftOrder) {
            console.error('Invalid draft data:', data);
            return;
        }
    
        console.log('Draft has started.');
    
        draftOrder = data.draftOrder || [];
        if (draftOrder.length === 0) {
            console.error('No draft order provided.');
            return;
        }
    
        currentTurnIndex = 0;
        remainingTime = draftInterval / 1000; // Reset remaining time
        startDraftTimer();
    }    

    function startDraftTimer() {
        console.log('Starting draft timer...');
        if (draftTimer) {
            clearInterval(draftTimer);
            console.log('Previous draft timer cleared');
        }
        draftTimer = setInterval(() => {
            handleDraftTurn();
            remainingTime = draftInterval / 1000; // Reset remaining time
        }, draftInterval);
    }

    function handleDraftTurn() {
        console.log('Handling draft turn...');
        if (draftOrder.length === 0) {
            console.error('Draft order is empty');
            return;
        }
      
        const currentUserId = draftOrder[currentTurnIndex];
        console.log(`Current Turn: User ID ${currentUserId}`);
        updateCurrentTurnUI(currentUserId);
    
        // Move to the next user
        currentTurnIndex = (currentTurnIndex + 1) % draftOrder.length;
    }

    function handleUserTurn(message) {
        if (!message.userId || !message.turnIndex) {
            console.error('Invalid user turn message:', message);
            return;
        }
    
        console.log(`Handling turn for user ${message.userId}`);
        updateCurrentTurnUI(message.userId);
    }

    function handleTimeUpdate(message) {
        if (!message.remainingTime) {
            console.error('Invalid time update message:', message);
            return;
        }
    
        remainingTime = message.remainingTime;
        updateCurrentTurnUI();
    }

    function updateCurrentTurnUI(userId) {
        const currentTurnElement = document.getElementById('current-turn-user');
        if (currentTurnElement) {
            currentTurnElement.textContent = userId ? `User ID: ${userId}` : 'Waiting for draft to start...';
        } else {
            console.error('Current turn element not found');
        }
    }

    function endDraft() {
        clearInterval(draftTimer);
        alert('Draft has ended.');
        window.close(); // Or any other logic to end the draft
    }

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
