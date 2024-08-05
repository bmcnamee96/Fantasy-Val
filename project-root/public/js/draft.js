// Variable declarations
let intervalId;
let draftOrder = [];
let MAX_TURNS;
let currentTurnIndex = 0; // Initialize here
const draftInterval = 5000; // Interval time in milliseconds
let draftTimer = null;
let remainingTime = 0;
const TURN_DURATION = 5000;
let countdownTimer = null; // Timer reference for countdown


// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for draft.js');

    const token = localStorage.getItem('token');
    const leagueId = getLeagueIdFromUrl();
    const userId = getUserIdFromToken(token);
    console.log('Token:', token);
    console.log('League ID:', leagueId);
    console.log('User ID:', userId);

    // #region Functions

    // Define function to get User ID from token
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

    // Define function to get League ID from URL
    function getLeagueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('leagueId');
    }

    if (!token || !leagueId || !userId) {
        console.error('Missing required parameters.');
        return;
    }

    // Function to fetch draft details
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

            // Update WebSocket and UI with draft details
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

    // Fetch league details
    let leagueOwnerId;
    try {
        const leagueResponse = await fetch(`/api/draft/leagues/${leagueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const league = await leagueResponse.json();
        leagueOwnerId = league.owner_id;
        console.log('League Owner ID:', leagueOwnerId);

        // Display "Start Draft" button if the user is the league owner
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

    // #region UPDATE UI
    // Function to update the draft order UI
    function updateDraftOrderUI(draftOrder) {
        const draftOrderContainer = document.getElementById('draftOrderContainer');
        draftOrderContainer.innerHTML = '';

        draftOrder.forEach(userId => {
            const userElement = document.createElement('div');
            userElement.textContent = `User ID: ${userId}`;
            draftOrderContainer.appendChild(userElement);
        });
    }

    // Function to update the available players UI
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

    // Function to update the user list UI
    function updateUserListUI(users) {
        const userListElement = document.getElementById('user-list');
        if (userListElement) {
            userListElement.innerHTML = users.map(user => `<li>${user}</li>`).join('');
        } else {
            console.error('User list element not found');
            console.log('Users:', users);
        }
    }

    // Function to update the current turn UI
    function updateCurrentTurnUI(userId) {
        const currentTurnElement = document.getElementById('current-turn-user');
        if (currentTurnElement) {
            currentTurnElement.textContent = userId ? `${userId}` : 'Waiting for draft to start...';
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

    // #endregion

    // Function to handle the draft turn
    function handleDraftTurn() {
        if (draftOrder.length === 0) {
            console.error('Draft order is empty');
            return;
        }

        // End draft if the turn index reaches or exceeds the maximum
        if (currentTurnIndex >= MAX_TURNS) {
            endDraft();
            return;
        }

        // update the current turn UI
        const currentUserId = draftOrder[currentTurnIndex];
        console.log(`Current Turn: ${currentUserId} (Index: ${currentTurnIndex})`);
        updateCurrentTurnUI(currentUserId);

        // Move to the next turn
        currentTurnIndex = (currentTurnIndex + 1) % draftOrder.length;

        // Update draft status on server
        updateDraftStatus(currentTurnIndex, true, false);

        // Start countdown timer for the new turn
        const durationInSeconds = TURN_DURATION / 1000; // Convert milliseconds to seconds
        startCountdownTimer(durationInSeconds);
    }

    // Function to handle user turn updates
    function handleUserTurn(message) {
        if (!message.userId || message.turnIndex === undefined) {
            console.error('Invalid user turn message:', message);
            return;
        }

        console.log(`Handling turn for user ${message.userId}, Turn Index: ${message.turnIndex}`);
        
        // Check for and resolve any turn index mismatches
        if (message.turnIndex !== currentTurnIndex) {
            console.warn(`Turn index mismatch! Expected ${currentTurnIndex}, received ${message.turnIndex}`);
            currentTurnIndex = message.turnIndex;
            updateCurrentTurnUI(message.userId);
            startCountdownTimer(TURN_DURATION / 1000);
        } else {
            console.log('Turn index matches current index');
        }
    }    

    // Function to update draft status on server
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

            // Update the current round (if applicable)
            if (result.round) {
                updateCurrentRound(result.round);
            }

        } catch (error) {
            console.error('Error updating draft status:', error);
        }
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

    // Function to start the draft timer
    function startDraftTimer() {
        if (intervalId) {
            clearInterval(intervalId);
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

    // Function to start the draft
    function startDraft(data) {
        if (!data || !data.draftOrder || typeof data.MAX_TURNS === 'undefined') {
          console.error('Invalid draft data:', data);
          return;
        }
      
        console.log('Draft has started.');
        MAX_TURNS = data.MAX_TURNS; // Store MAX_TURNS
        console.log(`Draft started with MAX_TURNS: ${MAX_TURNS}`);
      
        draftOrder = data.draftOrder || [];
        if (draftOrder.length === 0) {
          console.error('No draft order provided.');
          return;
        }
      
        // Set currentTurnIndex to the value from the server if provided
        if (data.currentTurnIndex !== undefined) {
          currentTurnIndex = data.currentTurnIndex;
          console.log('Draft started with currentTurnIndex:', currentTurnIndex);
        }
      
        // Update the UI with the new draft order
        updateDraftOrderUI(draftOrder);
      
        remainingTime = draftInterval / 1000; // Reset remaining time
        startDraftTimer();
    }

    // Function to end the draft
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

    // #endregion

    // #region Event Listeners

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

    // #endregion

    // #region Websocket

    // WebSocket connection setup
    const ws = new WebSocket(`ws://localhost:8080/?userId=${userId}&leagueId=${leagueId}`);

    // When the WebSocket connection is established
    ws.onopen = () => {
        console.log('WebSocket connection opened');
        // Send a welcome message to the new client
        ws.send(JSON.stringify({
            type: 'welcome',
            message: 'Welcome to the draft'
        }));
    };

    // WebSocket message event handler
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);

            if (!message.type) {
                console.warn('Received message without type property:', message);
                return;
            }

            // Handle different types of messages
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

    // WebSocket error event handler
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    // WebSocket close event handler
    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };

    // #endregion

    // Fetch initial draft details
    await fetchDraftDetails();
});
