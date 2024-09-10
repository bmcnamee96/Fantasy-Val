// File: draft.js

// Variable declarations
let intervalId;
let socket;
let draftOrder = [];
let maxTurns = null;
let currentTurnIndex; // Initialize here
const draftInterval = 15000; // Interval time in milliseconds
let draftTimer = null;
let remainingTime = 0;
const TURN_DURATION = 15000;
let countdownTimer = null; // Timer reference for countdown
let userIdToUsername = {}; // Initialize the mapping
let connectedUserIds = {};
let cachedUsers = null;  // Variable to store the fetched user details
const users = {};

const token = localStorage.getItem('token');
const leagueId = getLeagueIdFromUrl();
const userId = getUserIdFromToken(token);

// -------------------------------------------------------------------------- //

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

    // Determine who the league owner is
    let leagueOwnerId;
    try {
        const leagueResponse = await fetch(`/api/draft/leagues/${leagueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const league = await leagueResponse.json();
        leagueOwnerId = league.owner_id;
        console.log('League Owner ID:', leagueOwnerId);

        // If the user is the league owner, give them the startDraftButton
        if (userId === leagueOwnerId) {
            const startDraftButton = document.getElementById('startDraftButton');
            if (startDraftButton) {
                // Only display the button to the league owner
                startDraftButton.style.display = 'block';
                console.log('Start Draft button displayed for league owner');

                // Add event listener for the start button
                startDraftButton.addEventListener('click', startDraft);
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

      // Emit an event to request team data when the "My Team" tab is clicked
    document.getElementById('my-team-tab').addEventListener('click', () => {
        socket.emit('requestMyTeam');
    });

    try {
        await init(); // initialize the draft
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// -------------------------------------------------------------------------- //

function getLeagueIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const leagueId = urlParams.get('leagueId');
    return parseInt(leagueId, 10); // Convert to integer
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

async function init() {
    try {
        await fetchUserDetails(leagueId);
        await initDraftDetails(leagueId); 
        await initializeSocket();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// -------------------------------------------------------------------------- //

async function fetchUserDetails(leagueId) {
    // Check if users have already been fetched
    if (cachedUsers) {
        console.log('Returning cached users:', cachedUsers);
        return cachedUsers;
    }

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

        cachedUsers = await response.json();  // Store the fetched users in cachedUsers
        console.log('League users:', cachedUsers);

        return cachedUsers;

    } catch (error) {
        console.error('Error fetching user details:', error);
        return [];
    }
}

async function userMapping() {
    // if cachedUsers is null then call fetchUserDetails
    try {
        let userDetails = cachedUsers;
        if (!userDetails) {
            userDetails = await fetchUserDetails(leagueId);
        }
        
        // map the userId to the username
        userIdToUsername = userDetails.reduce((acc, user) => {
            acc[user.user_id] = user.username;
            return acc;
        }, {});

    } catch (error) {
        console.error('Error fetching user details:', error);
    }
}

async function initDraftDetails() {
    // fetchDraftOrder();
    fetchMaxTurns();
    fetchCurrentTurn();
}  

// can use this function if I come up with a way to set the draftOrder before draft starts
// async function fetchDraftOrder() {
//     try {
//         // Ensure leagueId and token are correctly set
//         if (!leagueId || !token) {
//             throw new Error('Missing leagueId or token');
//         }

//         // Fetch draft order
//         const draftOrderResponse = await fetch(`/api/draft/leagues/${leagueId}/draft-order`, {
//             headers: { 'Authorization': `Bearer ${token}` }
//         });
//         if (!draftOrderResponse.ok) {
//             throw new Error(`Failed to fetch draft order: ${draftOrderResponse.status}`);
//         }
//         const draftOrderData = await draftOrderResponse.json();
//         draftOrder = Array.isArray(draftOrderData) ? draftOrderData : [];

//         // Log draft order to check its content
//         console.log('Draft Order:', draftOrder);
//     } catch (error) {
//         console.error('Failed to fetch draft details:', error);
//     }
// }

async function fetchMaxTurns() {
    maxTurns = (cachedUsers.length * 7);
    console.log('Max turns:', maxTurns);
}

// 🚩 can probably delete
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
        // updateCurrentTurnUI(draftOrder[currentTurnIndex]);

    } catch (error) {
        console.error('Error fetching current turn:', error);
    }
}

// -------------------------------------------------------------------------- //

function startDraft() {
    if (!socket) {
        console.error('Socket is not initialized.');
        return;
    }

    socket.emit('message', { type: 'startDraft' });
    
    const startDraftButton = document.getElementById('startDraftButton');
    if (startDraftButton) {
        startDraftButton.style.display = 'none';
    } else {
        console.error('Start Draft button element not found when trying to hide it.');
    }
}

let countdownIntervalId = null; // Store the interval ID globally

function startCountdown(remainingTime) {
    const timerElement = document.getElementById('turn-timer');

    if (!timerElement) {
        console.error('Timer element not found');
        return;
    }

    // Clear any existing timer
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
    }

    // Validate remainingTime
    if (isNaN(remainingTime) || remainingTime === null || remainingTime === undefined) {
        console.error('Invalid remaining time:', remainingTime);
        timerElement.textContent = 'Invalid time';
        return;
    }

    let timeLeft = Math.round(remainingTime);

    countdownIntervalId = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null; // Reset the interval ID
            timerElement.textContent = 'Time’s up!';
        } else {
            timerElement.textContent = formatTime(timeLeft);
            timeLeft -= 1;
        }
    }, 1000);
}

function formatTime(seconds) {
    return `${seconds} seconds`;
}

// -------------------------------------------------------------------------- //

function updateUserListUI() {
    // call the userMapping function to get the username
    userMapping();
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

function updateAvailablePlayersUI(availablePlayers) {
    const availablePlayersElement = document.getElementById('available-players');
    if (availablePlayersElement) {
        if (Array.isArray(availablePlayers)) {
            // Clear previous content
            availablePlayersElement.innerHTML = '';

            // Create new cards with default picture handling
            const cardsHTML = availablePlayers.map(player => {
                const pictureUrl = player.pictureUrl || 'images/Blank.png'; 

                return `
                    <div class="col-md-4 player-card">
                        <div class="card">
                            <img src="${pictureUrl}" class="card-img-top" alt="${player.name}" style="min-height: 50px; max-height: 100px;">
                            <div class="card-body">
                                <h5 class="card-title">${player.team_abrev} ${player.name} (${player.role || 'Unknown Role'})</h5>
                                <button class="btn btn-secondary"
                                        data-player-id="${player.id}"
                                        onclick="showDraftConfirmation('${player.id}', '${player.team_abrev}', '${player.name}', '${player.role || 'Unknown Role'}')">
                                    Draft
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            availablePlayersElement.innerHTML = `<div class="row">${cardsHTML}</div>`;
        } else {
            console.error('Data is not an array:', availablePlayers);
        }
    } else {
        console.error('Available players element not found');
    }
}

function updateCurrentTurnUI(currentIndex) {
    const currentTurnElement = document.getElementById('current-turn-user');
    if (currentTurnElement) {
        // Find the userId based on currentIndex
        const userId = draftOrder[currentIndex] || null;
        console.log('Current turn:', userId)
        currentTurnElement.textContent = userId ? `${userId}` : 'Waiting for draft to start...';
    } else {
        console.error('Current turn element not found');
    }
}

function updateDraftTimerUI(time) {
    const timerElement = document.getElementById('turn-timer');
    if (timerElement) {
        timerElement.textContent = `${time} seconds`;
    } else {
        console.error('Draft timer element not found');
    }
}

function updateCurrentRoundUI(currentIndex) {
    const currentRoundElement = document.getElementById('current-round-text');
    if (!currentRoundElement) {
        return console.error('Current round element not found');
    }

    // Calculate the current round
    const currentRound = Math.floor(currentIndex / 7) + 1;
    console.log('Updating current round to:', currentRound, 'for turn index:', currentIndex);
    currentRoundElement.textContent = currentRound ? `${currentRound}` : 'Waiting for draft to start...';
}

function updateDraftMessageUI(message) {
    // Get the message area element
    const messageArea = document.getElementById('draft-message');
    
    if (messageArea) {
        // Update the message area with the received message
        messageArea.innerText = message;
    } else {
        console.error('Message area element not found');
    }
}

function renderTeam(teamData) {
    const teamContainer = document.getElementById('team-container');
    teamContainer.innerHTML = ''; // Clear any existing content
  
    if (teamData.length === 0) {
      teamContainer.innerHTML = '<p>No players drafted yet.</p>';
      return;
    }
  
    teamData.forEach(player => {
      const playerElement = document.createElement('div');
      playerElement.classList.add('player-card');
      playerElement.innerHTML = `
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">${player.team_abrev} ${player.player_name}</h5>
            <p class="card-text">Role: ${player.role}</p>
          </div>
        </div>
      `;
      teamContainer.appendChild(playerElement);
    });
}

// -------------------------------------------------------------------------- //

function draftPlayer(playerId) {
    const userId = getUserIdFromToken(token); 
    const leagueId = getLeagueIdFromUrl();

    // Emit the draftPlayer event with necessary data
    socket.emit('draftPlayer', {
        userId: userId,
        leagueId: leagueId,
        playerId: playerId,
    });
}

// Get modal elements
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const successCloseBtn = document.getElementById('successCloseBtn');
const errorCloseBtn = document.getElementById('errorCloseBtn');

// Function to show modal with a message
function showModal(modal, message) {
    modal.style.display = 'block';
    const messageElement = modal === successModal ? successMessage : errorMessage;
    messageElement.textContent = message;
}

// Function to close modal
function closeModal(modal) {
    modal.style.display = 'none';
}

// Event listeners for close buttons
successCloseBtn.onclick = () => closeModal(successModal);
errorCloseBtn.onclick = () => closeModal(errorModal);

// Click outside of modal closes it
window.onclick = (event) => {
    if (event.target === successModal) closeModal(successModal);
    if (event.target === errorModal) closeModal(errorModal);
};

function showDraftConfirmation(playerId, teamAbrev, playerName, playerRole) {
    // Set the confirmation message with the player's details
    document.getElementById('confirmationMessage').textContent = `Are you sure you want to draft ${teamAbrev} ${playerName} (${playerRole})?`;

    // Display the modal
    document.getElementById('confirmationModal').style.display = 'block';

    // Assign the confirmDraft function to the confirm button
    document.getElementById('confirmDraftButton').onclick = function() {
        confirmDraft(playerId);
    };
}

function confirmDraft(playerId) {
    // Emit to the server with the player's draft information
    draftPlayer(playerId);

    // Hide the modal after confirmation
    hideModal();
}

function hideModal() {
    // Hide the modal
    document.getElementById('confirmationModal').style.display = 'none';
}

// -------------------------------------------------------------------------- //

async function initializeSocket() {
    console.log('Initializing socket...');

    return new Promise((resolve, reject) => {
        const socketInstance = io('http://localhost:8080', {
            query: { userId, leagueId },
            transports: ['websocket']
        });

        // socketInstance.onAny((event, data) => {
        //     console.log(`Received event: ${event}`, data);
        // });

        // Log when the socket connects
        socketInstance.on('connect', () => {
            console.log('Connected to socket server', socketInstance.id);
            socket = socketInstance;  // Assign to global variable
            resolve(socketInstance);
        });

        // Handle connection errors
        socketInstance.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            reject(error);
        });

        // Handle disconnections
        socketInstance.on('disconnect', () => {
            console.log('Socket.IO connection closed', socketInstance);
        });

        // Handle generic errors
        socketInstance.on('error', (error) => {
            console.error('Socket.IO error:', error);
        });

        // Event handler for user list updates
        socketInstance.on('userListUpdate', (data) => {
            if (data.users && Array.isArray(data.users)) {
                // Update connected user IDs
                connectedUserIds = data.users;
                console.log('ConnectedUserIds:', connectedUserIds);

                // Fetch user details and update UI
                updateUserListUI();
            } else {
                console.error('Expected users to be an array but got:', data.users);
            }
        });

        socketInstance.on('myTeamData', (data) => {
            renderTeam(data);
        });

        // Event handler for draft status updates
        socketInstance.on('draftStatusUpdate', (data) => {
            console.log('draftStatusUpdate', data);

            if (data && typeof data.currentIndex === 'number') {
                updateCurrentTurnUI(data.currentIndex);
                updateCurrentRoundUI(data.currentIndex);
            } else {
                console.error('Invalid data format for draft status:', data);
            }
        });

        // Event handler for available players updates
        socketInstance.on('availablePlayersUpdate', (data) => {
            console.log('Received availablePlayersUpdate:', data);
            if (data && Array.isArray(data.players)) {
                updateAvailablePlayersUI(data.players);
            } else {
                console.error('Invalid data format:', data);
            }
        });

        socketInstance.on('updateMessageArea', (data) => {
            console.log('updateMessageArea:', data);

            updateDraftMessageUI(data);
        });
                
        // Event handler for draft started event
        socketInstance.on('draftStarted', async (data) => {
            console.log('draftStarted event data:', data);
        
            if (data) {
                // Handle draftOrder first
                if (Array.isArray(data.draftOrder)) {
                    draftOrder = data.draftOrder;
        
                    // Handle remainingTime if defined
                    if (typeof data.remainingTime === 'number' && !isNaN(data.remainingTime)) {
                        startCountdown(data.remainingTime);
                    } else {
                        console.error('Invalid remainingTime:', data.remainingTime);
                    }
        
                    // Handle currentTurnIndex if defined
                    if (typeof data.currentTurnIndex === 'number' && !isNaN(data.currentTurnIndex)) {
                        updateCurrentTurnUI(data.currentTurnIndex);
                        updateCurrentRoundUI(data.currentTurnIndex);
                    } else {
                        console.error('Invalid currentTurnIndex:', data.currentTurnIndex);
                    }
                } else {
                    console.error('Invalid draftOrder:', data.draftOrder);
                }
            } else {
                console.error('Invalid data format for draft start:', data);
            }
        });
        
        socketInstance.on('turnUpdate', (data) => {
            console.log('turnUpdate', data.message);
            startCountdown(data.remainingTime);
            updateCurrentTurnUI(data.currentTurnIndex);
            updateCurrentRoundUI(data.currentTurnIndex);
        });

        socketInstance.on('draftSuccess', (data) => {
            console.log('draftSuccess', data)
            showModal(successModal, data);
        });

        socketInstance.on('draftError', (data) => {
            console.log('draftError', data)
            showModal(errorModal, data);
        })
        
        // Event handler for draft ended event
        socketInstance.on('draftEnded', (data) => {
            console.log(data.message);
          
            if (data.redirectUrl) {
              // Redirect to the league dashboard
              window.location.href = data.redirectUrl;
            } else {
              console.error('Redirect URL not provided in draftEnded event.');
            }
          });
    });
}