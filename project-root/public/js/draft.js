// File: draft.js

// Variable declarations
let intervalId;
let draftOrder = [];
let MAX_TURNS = null;
let currentTurnIndex; // Initialize here
const draftInterval = 15000; // Interval time in milliseconds
let draftTimer = null;
let remainingTime = 0;
const TURN_DURATION = 15000;
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

// initialize DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for draft.js');

    // make sure that the correct user is in the draft
    if (!token || !leagueId || !userId) {
        console.error('Missing required parameters.');
        return;
    }

    console.log('Token:', token);
    console.log('League ID:', leagueId);
    console.log('User ID:', userId);

    // determine who the league owner is
    let leagueOwnerId;
    try {
        const leagueResponse = await fetch(`/api/draft/leagues/${leagueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const league = await leagueResponse.json();
        leagueOwnerId = league.owner_id;
        console.log('League Owner ID:', leagueOwnerId);

        // if the user is the league owner, give them the startDraftButton
        if (userId === leagueOwnerId) {
            const startDraftButton = document.getElementById('startDraftButton');
            if (startDraftButton) {
                // only display the button to the league owner
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

    // disable all draft buttons on entry into the draft page
    disableDraftButtons();

    init(); // Call init function

    // listen for the draft starting
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

// fetch all user details from the server
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

// map the userId to the username for each member in the league
async function initializeUserMapping(leagueId, connectedUserIds) {
    // Convert strings to numbers
    connectedUserIds = connectedUserIds.map(id => Number(id));
    console.log('UserIds connected', connectedUserIds);

    // make sure we are in the correct league
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

        updateUserListUI(userIdToUsername); // Update UI after mapping is initialized
    } catch (error) {
        console.error('Error initializing user mapping:', error);
    }
}

// update the userListUI
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

// return the userId from the token in local storage
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

// grab the leagueId from the url
function getLeagueIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('leagueId');
}

// 🚩 fetch the teamId for the player within the correct league
// async function getTeamIdForPlayer(playerId, leagueId) {
//     try {
//         // Fetch the list of teams in the league
//         const teamsResponse = await fetch(`/api/leagues/${leagueId}/teams`);
//         if (!teamsResponse.ok) {
//             throw new Error('Failed to fetch league teams');
//         }
//         const teams = await teamsResponse.json();
//         console.log(teams);

//         // Fetch the player details
//         const playerResponse = await fetch(`/api/draft/users`);
//         if (!playerResponse.ok) {
//             throw new Error('Failed to fetch player details');
//         }
//         const player = await playerResponse.json();

//         // Find the team that has this player
//         const team = teams.find(team => team.players.includes(playerId));
//         if (!team) {
//             throw new Error('Player does not belong to any team');
//         }

//         return team.teamId;
//     } catch (error) {
//         console.error('Error getting team ID for player:', error);
//         return null;
//     }
// }


// 🚩 fetch the entire team for a certain teamId
// async function fetchTeamPlayers(teamId) {
//     try {
//         const response = await fetch(`/api/draft/teams/${teamId}/players`);
//         if (!response.ok) {
//             throw new Error('Failed to fetch team players');
//         }
//         console.log('This is the team for team 8', response)
//         return await response.json();
//     } catch (error) {
//         console.error('Error fetching team players:', error);
//         return { players: [] }; // Return an empty array or handle the error as needed
//     }
// }

// 🚩 update the draftOrderUI
// function updateDraftOrderUI(draftOrder) {
//     const draftOrderContainer = document.getElementById('draftOrderContainer');
//     draftOrderContainer.innerHTML = '';

//     draftOrder.forEach(userId => {
//         const userElement = document.createElement('div');
//         userElement.textContent = `User ID: ${userId}`;
//         draftOrderContainer.appendChild(userElement);
//     });
// }

function disableDraftButtons() {
    // select all draft buttons on player cards and disable them
    // called on opening of draft page
    document.querySelectorAll('.btn-secondary').forEach(button => {
        button.classList.add('disabled');
        button.disabled = true; // Ensure the button is disabled
    });
}

// show all available players
// updated every time a player is drafted
function updateAvailablePlayersUI(availablePlayers) {
    const availablePlayersElement = document.getElementById('available-players');
    if (availablePlayersElement) {
        if (Array.isArray(availablePlayers)) {
            // Clear previous content
            availablePlayersElement.innerHTML = '';

            // Create new cards
            // 🚩 still need to add picture into here
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

// enable or disable the buttons based on the current index
function enableOrDisableDraftButtons(currentUserId) {
    document.querySelectorAll('.btn-secondary').forEach(button => {
        const username = userIdToUsername[userId];
        const isCurrentTurn = currentUserId === username;
        button.classList.toggle('disabled', !isCurrentTurn);
        button.disabled = !isCurrentTurn; // Ensure the button is disabled
    });
}

// update the current turn
function updateCurrentTurnUI(userId) {
    const currentTurnElement = document.getElementById('current-turn-user');
    if (currentTurnElement) {
        // if the current index is not a userId put the starting message
        currentTurnElement.textContent = userId ? `${userId}` : 'Waiting for draft to start...';
    } else {
        console.error('Current turn element not found');
    }
} 

// show the users that are connected to the draft
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

// update the current round UI
function updateCurrentRound(round) {
    const roundTextElement = document.getElementById('current-round-text');
    if (roundTextElement) {
        roundTextElement.textContent = round;
    }
}

// update the draft timer UI
function updateDraftTimerUI(time) {
    const timerElement = document.getElementById('draft-timer');
    if (timerElement) {
        timerElement.textContent = `Time remaining: ${time} seconds`;
    } else {
        console.error('Draft timer element not found');
    }
}

// 🚩 not done yet
// function updateTeamUI(players) {
//     const teamContainer = document.getElementById('team-container');
//     teamContainer.innerHTML = ''; // Clear the existing content

//     players.forEach(player => {
//         const playerElement = document.createElement('div');
//         playerElement.classList.add('player');
//         playerElement.textContent = `${player.player_name} (${player.team_abrev})`;
//         teamContainer.appendChild(playerElement);
//     });
// }

// update all of the messages
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

// show the confirmation message when you try and draft a player
// 🚩 WE HAVE A PROBLEM 🚩
// THE PLAYER IS DRAFTED WHEN THE USER CLICKS ON THE DRAFT BUTTON, NOT WHEN THEY CONFIRM THE DRAFT
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

// 🚩 I think I only want to emit that the draft has started, not all of the other data
// all other data should come from the server
function initializeDraft() {
    if (!draftOrder || typeof MAX_TURNS === 'undefined' || !leagueId) {
        console.error('Draft data is not available.');
        return;
    }

    // Emit the draft start event with necessary data
    socket.emit('message', {
        type: 'startDraft',
        draftOrder: draftOrder,
        MAX_TURNS: MAX_TURNS,
        leagueId: leagueId 
    });
}

// 
function startDraft(data) {
    if (!data || !data.draftOrder || typeof data.MAX_TURNS === 'undefined') {
        console.error('Invalid draft data:', data);
        return;
    }
    
    // MAX_TURNS should be set by fetchDraftDetails
    console.log(`Draft started with MAX_TURNS: ${data.MAX_TURNS}`);
    
    // make sure there is a draft order
    draftOrder = data.draftOrder || [];
    if (draftOrder.length === 0) {
        console.error('No draft order provided.');
        return;
    }
    
    // fetch the current turn index from the server
    fetchCurrentTurn();
    console.log('Draft started with currentTurnIndex:', currentTurnIndex)
    // // Set currentTurnIndex to the value from the server if provided
    // if (data.currentTurnIndex !== undefined) {
    //     currentTurnIndex = data.currentTurnIndex;
    //     console.log('Draft started with currentTurnIndex:', currentTurnIndex);
    // }
    
    // Update messages to indicate that the draft is beginning
    updateCurrentTurnMessage('Draft Beginning Now...');
    updateCurrentRoundMessage('Draft Beginning Now...');

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

    fetchCurrentTurn();

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
        
        // Display the drafted player information in the message box
        updateDraftMessage(`Player drafted: ${teamAbrev} ${playerName}`);

        // Emit the playerDrafted event to the server
        socket.emit('message', {
            type: 'playerDrafted',
            playerId: message.playerId,
            userId: message.userId,
            leagueId: leagueId  
        });

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

// async function draftPlayer(userId, playerId, leagueId) {
//     try {
//         const response = await fetch('/api/draft/draft-player', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             },
//             body: JSON.stringify({ userId, playerId, leagueId })
//         });

//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }

//         const result = await response.json();
//         console.log('Draft response:', result);

//         if (result.status === 'success') {
//             // Emit the playerDrafted event to the server
//             console.log('Emitting playerDrafted event')
//             socket.emit('playerDrafted', { playerId, userId, leagueId });
//         } else {
//             // Handle failure (optional)
//             console.error('Failed to draft player:', result.message);
//         }
//     } catch (error) {
//         console.error('Error drafting player:', error);
//     }
// }

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

        // Fetch total number of users in the league
        const usersResponse = await fetch(`/api/leagues/${leagueId}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        }
        const usersData = await usersResponse.json();
        const users = Array.isArray(usersData) ? usersData : [];

        // Calculate MAX_TURNS
        MAX_TURNS = (users.length * 7);
        console.log('NEW MAX_TURNS set to:', MAX_TURNS);

        // Find current turn index based on the userId
        currentTurnIndex = draftOrder.findIndex(player => player.userId === userId);

        // Handle case where userId is not found in the draft order
        // if (currentTurnIndex === -1) {
        //     console.warn('User not found in draft order');
        // }

        // Log current turn index to debug
        currentTurnIndex = fetchCurrentTurn();
        console.log('Current Turn Index:', currentTurnIndex);

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

async function fetchCurrentTurn() {
    try {
        const response = await fetch(`/api/draft/leagues/${leagueId}/current-turn`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        currentTurnIndex = (data.currentTurnIndex);
        console.log('Current turn on server:', currentTurnIndex)
        updateCurrentTurnUI(draftOrder[currentTurnIndex]);
        // startCountdownTimer(TURN_DURATION / 1000);

    } catch (error) {
        console.error('Error fetching current turn:', error);
    }
}

function initializeSocket() {
    console.log('Initializing socket...');

    // Initialize socket connection
    const socket = io('http://localhost:8080', {
        query: { userId, leagueId },
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log('Connected to socket server');
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
        } else {
            console.warn('Received draft order is not an array:', newDraftOrder);
        }
        updateAvailablePlayersUI(availablePlayers);
    });

    socket.on('message', (data) => {
        switch (data.type){
            case 'startDraft':
                console.log('Draft starting with data:', data);
                startDraft(data);
                break;

            case 'playerDrafted':
                updateDraftMessage(data.draftMessage); // Update the UI with the drafted player
                break;

            case 'availablePlayersUpdate':
                console.log('Available players update received')
                updateAvailablePlayersUI(data.availablePlayers); // Update the UI with the new list of available players
                break;

            case 'turnIndexUpdate':
                fetchCurrentTurn();
                // updateCurrentTurnUI(data.currentTurnIndex); // Directly use the provided turn index
                break;
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

    socket.on('playerDrafted', (data) => {
        updateDraftMessage(data.message); // Display the draft message in the UI
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