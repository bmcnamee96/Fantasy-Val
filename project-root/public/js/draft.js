// File: draft.js

// Variable declarations
let intervalId;
let draftOrder = [];
let MAX_TURNS = null;
let currentTurnIndex = 0; // Initialize here
const draftInterval = 5000; // Interval time in milliseconds
let draftTimer = null;
let remainingTime = 0;
const TURN_DURATION = 5000;
let countdownTimer = null; // Timer reference for countdown
let userIdToUsername = {}; // Initialize the mapping
let connectedUserIds = [];

const token = localStorage.getItem('token');
const leagueId = getLeagueIdFromUrl();
const userId = getUserIdFromToken(token);

// Initialize Socket.IO
const socket = io(`http://localhost:8080`, {
    query: { userId, leagueId },
    transports: ['websocket']
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for draft.js');

    if (!token || !leagueId || !userId) {
        console.error('Missing required parameters.');
        return;
    }

    console.log('Token:', token);
    console.log('League ID:', leagueId);
    console.log('User ID:', userId);

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

    disableDraftButtons();

    init(); // Call init function

    document.getElementById('startDraftButton').addEventListener('click', initializeDraft);
    
});

async function init() {
    try {
        initializeSocket();
        await fetchDraftDetails(leagueId); 
        await initializeUserMapping(leagueId, connectedUserIds);
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

async function fetchUserDetails(leagueId) {
    try {
        const response = await fetch(`/api/leagues/${leagueId}/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const users = await response.json();
        console.log('Fetched users:', users);

        // No need to filter here, as the API should already return users for the specific league
        return users;

    } catch (error) {
        console.error('Error fetching user details:', error);
        return [];
    }
}

async function initializeUserMapping(leagueId, connectedUserIds) {
    console.log('initializeUserMapping');
    // Convert strings to numbers
    connectedUserIds = connectedUserIds.map(id => Number(id));
    console.log('UserIds connected', connectedUserIds);

    if (!leagueId) {
        console.error('League ID is not defined');
        return;
    }

    try {
        // Fetch users directly filtered by leagueId
        const leagueUsers = await fetchUserDetails(leagueId);

        // Ensure connectedUserIds are numbers
        const connectedLeagueUsers = leagueUsers.filter(user => connectedUserIds.includes(user.user_id));

        // Create the mapping of user IDs to usernames
        const userIdToUsername = connectedLeagueUsers.reduce((acc, user) => {
            acc[user.user_id] = user.username;
            return acc;
        }, {});

        console.log('Filtered User ID to Username Mapping (Connected Users Only):', userIdToUsername);
        updateUserListUI(userIdToUsername); // Update UI after mapping is initialized
    } catch (error) {
        console.error('Error initializing user mapping:', error);
    }
}

async function fetchAndUpdateUserList() {
    try {
        const userDetails = await fetchUserDetails(leagueId);
        
        // Update the userIdToUsername mapping
        userIdToUsername = userDetails.reduce((acc, user) => {
            acc[user.user_id] = user.username;
            return acc;
        }, {});

        console.log('Updated User ID to Username Mapping:', userIdToUsername);

        // Update the UI
        updateUserListUI(userIdToUsername);
    } catch (error) {
        console.error('Error fetching user details:', error);
    }
}

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

async function getTeamIdForPlayer(playerId, leagueId) {
    try {
        // Fetch the list of teams in the league
        const teamsResponse = await fetch(`/api/leagues/${leagueId}/teams`);
        if (!teamsResponse.ok) {
            throw new Error('Failed to fetch league teams');
        }
        const teams = await teamsResponse.json();
        console.log(teams);

        // Fetch the player details
        const playerResponse = await fetch(`/api/draft/users`);
        if (!playerResponse.ok) {
            throw new Error('Failed to fetch player details');
        }
        const player = await playerResponse.json();

        // Find the team that has this player
        const team = teams.find(team => team.players.includes(playerId));
        if (!team) {
            throw new Error('Player does not belong to any team');
        }

        return team.teamId;
    } catch (error) {
        console.error('Error getting team ID for player:', error);
        return null;
    }
}

async function fetchTeamPlayers(teamId) {
    try {
        const response = await fetch(`/api/draft/teams/${teamId}/players`);
        if (!response.ok) {
            throw new Error('Failed to fetch team players');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching team players:', error);
        return { players: [] }; // Return an empty array or handle the error as needed
    }
}

//#endregion

// #region UI Update Functions

// #region UI Updates

function updateDraftOrderUI(draftOrder) {
    const draftOrderContainer = document.getElementById('draftOrderContainer');
    draftOrderContainer.innerHTML = '';

    draftOrder.forEach(userId => {
        const userElement = document.createElement('div');
        userElement.textContent = `User ID: ${userId}`;
        draftOrderContainer.appendChild(userElement);
    });
}

function disableDraftButtons() {
    document.querySelectorAll('.btn-secondary').forEach(button => {
        button.classList.add('disabled');
        button.disabled = true; // Ensure the button is disabled
    });
}

function updateAvailablePlayersUI(availablePlayers) {
    const availablePlayersElement = document.getElementById('available-players');
    if (availablePlayersElement) {
        if (Array.isArray(availablePlayers)) {
            // Clear previous content
            availablePlayersElement.innerHTML = '';

            // Create new cards
            const cardsHTML = availablePlayers.map(player => {
                return `
                    <div class="col-md-4 player-card">
                        <div class="card">
                            <div class="card-body" id="draft-card">
                                <h5 class="card-title">${player.team_abrev} ${player.player_name} (${player.role})</h5>
                                <button class="btn btn-secondary"
                                        data-player-id="${player.player_id}"
                                        onclick="showDraftConfirmation('${player.player_id}', '${player.team_abrev}', '${player.player_name}', '${player.role}')">
                                    Draft
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            availablePlayersElement.innerHTML = `<div class="row">${cardsHTML}</div>`;

            // Update button states after rendering
            enableOrDisableDraftButtons(draftOrder[currentTurnIndex]);

            // Add event listeners to the draft buttons
            document.querySelectorAll('.draft-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const playerId = event.target.getAttribute('data-player-id');
                    const teamAbrev = event.target.getAttribute('data-team-abrev');
                    const playerName = event.target.getAttribute('data-player-name');
                    const playerRole = event.target.getAttribute('data-player-role');
                    showDraftConfirmation(playerId, teamAbrev, playerName, playerRole);
                });
            });
        } else {
            console.error('Available players element not found or data is not an array');
        }
    } else {
        console.error('Available players element not found');
    }
}

function enableOrDisableDraftButtons(currentUserId) {
    document.querySelectorAll('.btn-secondary').forEach(button => {
        const username = userIdToUsername[userId];
        const isCurrentTurn = currentUserId === username;
        button.classList.toggle('disabled', !isCurrentTurn);
        button.disabled = !isCurrentTurn; // Ensure the button is disabled
    });
}

function updateCurrentTurnUI(userId) {
    const currentTurnElement = document.getElementById('current-turn-user');
    if (currentTurnElement) {
        currentTurnElement.textContent = userId ? `${userId}` : 'Waiting for draft to start...';
    } else {
        console.error('Current turn element not found');
    }
} 

function updateUserListUI(userIdToUsername) {
    const userListElement = document.getElementById('user-list');
    if (userListElement) {
        // Generate user list HTML
        const userListHTML = connectedUserIds
            .map(userId => {
                const username = userIdToUsername[userId] || 'Unknown User';
                return `<li>${username}</li>`;
            })
            .join('');

        userListElement.innerHTML = userListHTML;
    } else {
        console.error('User list element not found');
    }
}

function updateCurrentRound(round) {
    const roundTextElement = document.getElementById('current-round-text');
    if (roundTextElement) {
        roundTextElement.textContent = round;
    }
}

function updateDraftTimerUI(time) {
    const timerElement = document.getElementById('draft-timer');
    if (timerElement) {
        timerElement.textContent = `Time remaining: ${time} seconds`;
    } else {
        console.error('Draft timer element not found');
    }
}

function updateTeamUI(players) {
    const teamContainer = document.getElementById('team-container');
    teamContainer.innerHTML = ''; // Clear the existing content

    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        playerElement.textContent = `${player.player_name} (${player.team_abrev})`;
        teamContainer.appendChild(playerElement);
    });
}

function updateCurrentTurnMessage(message) {
    document.getElementById('current-turn-user').innerText = message;
}

function updateCurrentRoundMessage(message) {
    document.getElementById('current-round-text').innerText = message;
}

function updateDraftMessage(message) {
    const draftMessageElement = document.getElementById('draft-message');
    if (draftMessageElement) {
        draftMessageElement.innerText = message;
    } else {
        console.error('Draft message element not found');
    }
}

//#endregion

// #region Modal Management

window.showDraftConfirmation = showDraftConfirmation;

function showDraftConfirmation(playerId, teamAbrev, playerName, playerRole) {
    const confirmationMessage = `Are you sure you want to draft ${teamAbrev} ${playerName} (${playerRole})?`;
    document.getElementById('confirmationMessage').innerText = confirmationMessage;

    // Show the modal
    document.getElementById('confirmationModal').style.display = 'block';

    // Handle the submit button click
    document.getElementById('confirmDraftButton').addEventListener('click', function handleConfirm() {
        draftPlayer(userId, playerId, leagueId);
        hideModal();
    }, { once: true });
}

function hideModal() {
    document.getElementById('confirmationModal').style.display = 'none';
}

// #endregion

//#endregion

// #region Draft Management

// #region Draft Handling

function initializeDraft() {
    if (!draftOrder || typeof MAX_TURNS === 'undefined') {
        console.error('Draft data is not available.');
        return;
    }

    // Emit the draft start event with necessary data
    socket.emit('message', {
        type: 'startDraft',
        draftOrder: draftOrder,
        MAX_TURNS: MAX_TURNS
    });
}

function startDraft(data) {
    if (!data || !data.draftOrder || typeof data.MAX_TURNS === 'undefined') {
        console.error('Invalid draft data:', data);
        return;
    }
    
    console.log('Draft has started.');
    // MAX_TURNS should be set by fetchDraftDetails
    console.log(`Draft started with MAX_TURNS: ${data.MAX_TURNS}`);
    
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
    
    // Update messages to indicate that the draft is beginning
    updateCurrentTurnMessage('Draft Beginning Now...');
    updateCurrentRoundMessage('Draft Beginning Now...');

    // Update the UI with the new draft order
    updateDraftOrderUI(draftOrder);

    // Hide the "Start Draft" button
    const startDraftButton = document.getElementById('startDraftButton');
    if (startDraftButton) {
        startDraftButton.style.display = 'none';
    }
    
    remainingTime = draftInterval / 1000; // Reset remaining time
    startDraftTimer();
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
            socket.emit('endDraft', {
                message: 'The draft has ended.'
            });

            window.location.href = `league-dashboard.html?leagueId=${leagueId}`; // Use stored leagueId
        })
        .catch(error => {
            console.error('Error ending draft:', error);
        });
}

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

    // Enable or disable draft buttons based on current turn
    enableOrDisableDraftButtons(currentUserId);

    // Move to the next turn
    currentTurnIndex = (currentTurnIndex + 1) % draftOrder.length;

    // Update draft status on server
    updateDraftStatus(currentTurnIndex, true, false);

    // Start countdown timer for the new turn
    const durationInSeconds = TURN_DURATION / 1000; // Convert milliseconds to seconds
    startCountdownTimer(durationInSeconds);
}

function handleUserTurn(message) {
    if (!message.userId || message.turnIndex === undefined) {
        console.error('Invalid user turn message:', message);
        return;
    }
    
    // Check for and resolve any turn index mismatches
    if (message.turnIndex !== currentTurnIndex) {
        console.warn(`Turn index mismatch! Expected ${currentTurnIndex}, received ${message.turnIndex}`);
        currentTurnIndex = message.turnIndex;
        updateCurrentTurnUI(message.userId);
        startCountdownTimer(TURN_DURATION / 1000);
    } else {
        console.log('Turn index matches current index');
    }

    // Update button states after turn change
    enableOrDisableDraftButtons(message.userId);
}  

async function handlePlayerDrafted(message) {
    if (!message.playerId || !message.userId) {
        console.error('Invalid playerDrafted message:', message);
        return;
    }

    try {
        // Fetch player details from the API
        const response = await fetch(`/api/draft/players/${message.playerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch player details');
        }

        const playerData = await response.json();
        const playerName = playerData.player_name;
        const teamAbrev = playerData.team_abrev;

        console.log(`Player drafted: ${message.playerId} by user: ${message.userId}`);
        
        // Display the drafted player information in the message box
        updateDraftMessage(`Player drafted: ${teamAbrev} ${playerName}`);

    } catch (error) {
        console.error('Error fetching player details:', error);
        updateDraftMessage('Error retrieving player details.');
    }
}

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

// #endregion

// #region Draft Timer

function startDraftTimer() {
    if (intervalId) {
        clearInterval(intervalId);
    }
    intervalId = setInterval(() => {
        handleDraftTurn();
    }, draftInterval);
}

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

// #endregion

// #region Drafting a Player

async function draftPlayer(userId, playerId, leagueId) {
    try {
        const response = await fetch('api/draft/draft-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, playerId, leagueId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        if (result.status === 'success') {
            // alert('Player successfully drafted!');
            // Fetch the updated list of available players
            const availablePlayersResponse = await fetch(`/api/draft/leagues/${leagueId}/available-players`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const availablePlayers = await availablePlayersResponse.json();
            updateAvailablePlayersUI(availablePlayers);

            // Handle the drafted player locally
            handlePlayerDrafted({
                playerId: playerId,
                userId: userId,
                teamAbrev: result.teamAbrev,
                playerName: result.playerName
            });

            // Move to the next turn
            handleDraftTurn();
        } else {
            // alert('Failed to draft player: ' + result.message);
        }
    } catch (error) {
        console.error('Error drafting player:', error);
        // alert('An error occurred while drafting the player.');
    }
}

// #endregion

// #endregion

// #region WebSocket Functions

// #region WebSocket Management

async function fetchDraftDetails() {
    try {
        // Ensure leagueId and token are correctly set
        if (!leagueId || !token) {
            throw new Error('Missing leagueId or token');
        }

        // Fetch available players
        const response = await fetch(`/api/draft/leagues/${leagueId}/available-players`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch available players: ${response.status}`);
        }
        const availablePlayers = await response.json();

        // Fetch draft order
        const draftOrderResponse = await fetch(`/api/draft/leagues/${leagueId}/draft-order`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!draftOrderResponse.ok) {
            throw new Error(`Failed to fetch draft order: ${draftOrderResponse.status}`);
        }
        const draftOrderData = await draftOrderResponse.json();
        draftOrder = Array.isArray(draftOrderData) ? draftOrderData : [];

        // Log draft order to check its content
        console.log('Draft Order:', draftOrder);

        // Find the MAX_TURNS
        MAX_TURNS = ((draftOrder.length / 8)*7); 
        console.log('MAX_TURNS set to:', MAX_TURNS);

        // Find current turn index based on the userId
        currentTurnIndex = draftOrder.findIndex(player => player.userId === userId);

        // Handle case where userId is not found in the draft order
        if (currentTurnIndex === -1) {
            console.warn('User not found in draft order');
        }

        // Log current turn index to debug
        console.log('Current Turn Index:', currentTurnIndex);

        // Update UI with fetched data
        updateDraftOrderUI(draftOrder);
        updateAvailablePlayersUI(availablePlayers);
    } catch (error) {
        console.error('Failed to fetch draft details:', error);
    }
}  

function handleTimeUpdate(message) {
    console.log('Time update received:', message);
    if (message.remainingTime === undefined) {
        console.error('Invalid time update message:', message);
        return;
    }

    remainingTime = message.remainingTime;
    updateDraftTimerUI(remainingTime);
}

// #endregion

function initializeSocket() {
    console.log('Initializing socket...');

    // Initialize socket connection
    const socket = io('http://localhost:8080', {
        query: { userId, leagueId },
        transports: ['websocket']
    });

    socket.on('connect', () => {
    });

    socket.on('userListUpdate', async (data) => {
        if (data.users && Array.isArray(data.users)) {
            // Update connected user IDs
            connectedUserIds = data.users;
    
            console.log('Updated connectedUserIds:', connectedUserIds);
    
            // Fetch user details and update UI
            await fetchAndUpdateUserList();
        } else {
            console.error('Expected users to be an array but got:', data.users);
        }
    });    

    // Handle user connection event
    socket.on('userConnected', (userId) => {
        console.log('User connected:', userId);
        // Optionally update the UI
        initializeUserMapping(leagueId, connectedUserIds);
    });

    // Handle user disconnection event
    socket.on('userDisconnected', (userId) => {
        connectedUserIds = connectedUserIds.filter(id => id !== userId); // Update connected user IDs
        console.log('User disconnected:', userId);
        // Optionally update the UI
        initializeUserMapping(leagueId, connectedUserIds);
    });

    // Other event handlers
    socket.on('draftUpdate', ({ draftOrder: newDraftOrder, availablePlayers }) => {
        if (Array.isArray(newDraftOrder)) {
            draftOrder = newDraftOrder;
            updateDraftOrderUI(draftOrder);
        } else {
            console.warn('Received draft order is not an array:', newDraftOrder);
        }
        updateAvailablePlayersUI(availablePlayers);
    });

    socket.on('message', (data) => {
        if (data.type === 'startDraft') {
            startDraft(data); // Ensure the startDraft function handles the data appropriately
        }
    });    

    socket.on('endDraft', () => {
        endDraft();
    });

    socket.on('userTurn', (message) => {
        handleUserTurn(message);
    });

    socket.on('updateRound', (round) => {
        updateCurrentRound(round);
    });

    socket.on('timeUpdate', (message) => {
        handleTimeUpdate(message);
    });

    socket.on('playerDrafted', (message) => {
        handlePlayerDrafted(message);
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO connection closed');
    });

    socket.on('reconnect', () => {
        console.log('Reconnected to the server');
        // Fetch current draft state
        fetchDraftDetails();
    });

    socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });

    return socket;
}

// Ensure Socket.IO is reinitialized on page load
// window.addEventListener('load', () => {
//     initializeSocket();
// });

// #endregion