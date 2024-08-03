let intervalId;
let draftOrder = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for draft.js');

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
    let currentTurnIndex = 0;
    let draftTimer = null;
    let remainingTime = 0;
    const TURN_DURATION = 5000;
    let countdownTimer = null; // Timer reference for countdown

    // Event listener for the "Start Draft" button
    document.getElementById('startDraftButton').addEventListener('click', () => {
        ws.send(JSON.stringify({
            type: 'startDraft',
            leagueId: leagueId
        }));
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

    // When the WebSocket connection is established
    ws.onopen = () => {
        console.log('WebSocket connection opened');
        // Send a welcome message to the new client
        ws.send(JSON.stringify({
            type: 'welcome',
            message: 'Welcome to the draft'
        }));
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);
    
            // Handle messages without a type property
            if (!message.type) {
                console.warn('Received message without type property:', message);
                if (message.message) {
                    // Handle messages with a `message` property
                    console.log('Message:', message.message);
                }
                return; // Early return to avoid further processing
            }
            
            // message handling
            switch (message.type) {
                case 'userListUpdate':
                    updateUserListUI(message.users);
                    break;
                case 'draftUpdate':
                    const { draftOrder: newDraftOrder, availablePlayers } = message;
                    if (Array.isArray(newDraftOrder)) {
                        draftOrder = newDraftOrder;
                        updateDraftOrderUI(draftOrder);
                    } else {
                        console.warn('Received draft order is not an array:', newDraftOrder);
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
                case 'updateRound':
                    updateCurrentRound(message.round);
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
            const response = await fetch(`/api/draft/leagues/${leagueId}/available-players`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const availablePlayers = await response.json();

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
                draftOrder: draftOrder,
                availablePlayers: availablePlayers
            }));

            updateDraftOrderUI(draftOrder);
            updateAvailablePlayersUI(availablePlayers);
        } catch (error) {
            console.error('Failed to fetch draft details:', error);
        }
    }

    function updateDraftOrderUI(draftOrder) {
        const draftOrderContainer = document.getElementById('draftOrderContainer');
        draftOrderContainer.innerHTML = '';

        draftOrder.forEach(userId => {
            const userElement = document.createElement('div');
            userElement.textContent = `User ID: ${userId}`;
            draftOrderContainer.appendChild(userElement);
        });
    }

    function updateAvailablePlayersUI(availablePlayers) {
        const availablePlayersElement = document.getElementById('available-players');
        if (availablePlayersElement) {
            // Clear previous content
            availablePlayersElement.innerHTML = '';
    
            // Create new cards
            const cardsHTML = availablePlayers.map(player =>
                `<div class="col-md-4 player-card">
                    <div class="card">
                        <div class="card-body" id="draft-card">
                            <h5 class="card-title">${player.player_name} (undefined)</h5>
                            <button class="btn btn-primary" data-player-id="${player.player_id}" onclick="draftPlayer('${player.player_id}')">Draft</button>
                        </div>
                    </div>
                </div>`
            ).join('');
    
            availablePlayersElement.innerHTML = `<div class="row">${cardsHTML}</div>`;
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

        // Update the UI with the new draft order
        updateDraftOrderUI(draftOrder);

        currentTurnIndex = 0;
        remainingTime = draftInterval / 1000; // Reset remaining time
        startDraftTimer();
    }

    function startDraftTimer() {
        console.log('Starting draft timer...');
        if (intervalId) {
            clearInterval(intervalId);
            console.log('Previous draft timer cleared');
        }
        intervalId = setInterval(() => {
            handleDraftTurn();
        }, draftInterval);
    }

    // Function to start the countdown timer
    function startCountdownTimer(durationInSeconds) {
        // Clear any existing countdown timer
        if (countdownTimer) {
            clearInterval(countdownTimer);
            console.log('Previous countdown timer cleared');
        }

        let timeLeft = durationInSeconds;
        countdownTimer = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null; // Reset timer reference
                console.log('Countdown finished');
                handleDraftTurn(); // Move to the next user
            } else {
                timeLeft--;
                updateDraftTimerUI(timeLeft); // Update UI with remaining time
            }
        }, 1000); // Update every second
    }

    function handleDraftTurn() {
        console.log('Handling draft turn...');
        
        if (draftOrder.length === 0) {
            console.error('Draft order is empty');
            return;
        }
    
        // Define maximum turns or picks allowed in the draft
        const MAX_TURNS = 2;
    
        // End draft if the turn index reaches or exceeds the maximum
        if (currentTurnIndex >= MAX_TURNS) {
            endDraft();
            return;
        }
    
        const currentUserId = draftOrder[currentTurnIndex];
        console.log(`Current Turn: User ID ${currentUserId} (Index: ${currentTurnIndex})`);
        updateCurrentTurnUI(currentUserId);
    
        // Move to the next user
        currentTurnIndex = (currentTurnIndex + 1) % draftOrder.length;
        console.log(`Next Turn Index: ${currentTurnIndex}`);
    
        // Update draft status on server
        updateDraftStatus(currentTurnIndex, true, false);

        // Start countdown timer for the new turn
        const durationInSeconds = TURN_DURATION / 1000; // Convert milliseconds to seconds
        console.log(`Starting countdown for ${durationInSeconds} seconds`);
        startCountdownTimer(durationInSeconds);
    }
    
    function handleUserTurn(message) {
        if (!message.userId || message.turnIndex === undefined) {
            console.error('Invalid user turn message:', message);
            return;
        }
    
        console.log(`Handling turn for user ${message.userId}, Turn Index: ${message.turnIndex}`);
        currentTurnIndex = message.turnIndex;
        updateCurrentTurnUI(message.userId);

        // Optionally reset or start the countdown timer
        startCountdownTimer(TURN_DURATION / 1000);
    }

    // Function to handle time update messages
    function handleTimeUpdate(message) {
        console.log('Time update received:', message);
        if (message.remainingTime === undefined) {
            console.error('Invalid time update message:', message);
            return;
        }

        remainingTime = message.remainingTime;
        updateDraftTimerUI(remainingTime);
    }

    function updateCurrentTurnUI(userId) {
        const currentTurnElement = document.getElementById('current-turn-user');
        if (currentTurnElement) {
            currentTurnElement.textContent = userId ? `User ID: ${userId}` : 'Waiting for draft to start...';
        } else {
            console.error('Current turn element not found');
        }
    }

    // Function to update the current round in the HTML
    function updateCurrentRound(round) {
        const roundTextElement = document.getElementById('current-round-text');
        if (roundTextElement) {
            roundTextElement.textContent = round;
        }
    }


    // Function to update the draft timer UI
    function updateDraftTimerUI(time) {
        const timerElement = document.getElementById('draft-timer');
        if (timerElement) {
            timerElement.textContent = `Time remaining: ${time} seconds`;
        } else {
            console.error('Draft timer element not found');
        }
    }

    // Function to update draft status
    async function updateDraftStatus(currentTurnIndex, draftStarted, draftEnded) {
        try {
            const response = await fetch(`/api/draft/leagues/${leagueId}/draft-status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentTurnIndex,
                    draftStarted,
                    draftEnded
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            console.log(result.message);
            updateCurrentRound(result.round);
        } catch (error) {
            console.error('Error updating draft status:', error);
        }
    }

    function endDraft() {
        if (draftTimer) {
            clearInterval(draftTimer);
            draftTimer = null;
            console.log('Draft timer cleared');
        }
    
        // Notify the server that the draft has ended
        updateDraftStatus(currentTurnIndex, true, true)
            .then(() => {
                ws.send(JSON.stringify({
                    type: 'endDraft',
                    message: 'The draft has ended.'
                }));
    
                alert('Draft has ended.');
                window.location.href = `league-dashboard.html?leagueId=${leagueId}`; // Use stored leagueId
            })
            .catch(error => {
                console.error('Error ending draft:', error);
            });
    }

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };

    await fetchDraftDetails();
});
