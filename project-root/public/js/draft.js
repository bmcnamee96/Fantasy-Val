// File: draft.js

// Variable declarations
let intervalId;
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

// Initialize the socket globally
// const socket = initializeSocket();

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

    init(); // initialize the draft
});

// -------------------------------------------------------------------------- //

function getLeagueIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('leagueId');
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
        await initialDraftDetails(leagueId); 
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

// -------------------------------------------------------------------------- //

async function initialDraftDetails() {
    fetchDraftOrder();
    fetchMaxTurns();
    fetchCurrentTurn();
}  

async function fetchDraftOrder() {
    try {
        // Ensure leagueId and token are correctly set
        if (!leagueId || !token) {
            throw new Error('Missing leagueId or token');
        }

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
    } catch (error) {
        console.error('Failed to fetch draft details:', error);
    }
}

async function fetchMaxTurns() {
    maxTurns = (cachedUsers.length * 7);
    console.log('Max turns:', maxTurns);
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
        // updateCurrentTurnUI(draftOrder[currentTurnIndex]);

    } catch (error) {
        console.error('Error fetching current turn:', error);
    }
}

function startCountdown(remainingTime) {
    const timerElement = document.getElementById('turn-timer');

    if (!timerElement) {
        console.error('Timer element not found');
        return;
    }

    let timeLeft = Math.round(remainingTime);

    const intervalId = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(intervalId);
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

            // // Attach event listeners to the parent element (event delegation)
            // availablePlayersElement.addEventListener('click', (event) => {
            //     if (event.target && event.target.classList.contains('btn-secondary')) {
            //         const playerId = event.target.getAttribute('data-player-id');
            //         const teamAbrev = event.target.getAttribute('data-team-abrev');
            //         const playerName = event.target.getAttribute('data-player-name');
            //         const playerRole = event.target.getAttribute('data-player-role');
            //         showDraftConfirmation(playerId, teamAbrev, playerName, playerRole);
            //     }
            // });
            
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

// -------------------------------------------------------------------------- //

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
        console.log('userListUpdate received:', data)
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

    socket.on('draftStatusUpdate', (data) => {
        console.log('draftStatusUpdate', data);
    
        // Ensure the data structure is as expected
        if (data && typeof data.currentIndex === 'number') {
            updateCurrentTurnUI(data.currentIndex);
        } else {
            console.error('Invalid data format for draft status:', data);
        }
    });    
    
    // Socket listener for available players update
    socket.on('availablePlayersUpdate', (data) => {
        console.log('availablePlayersUpdate', data);

        // Ensure the data structure is as expected
        if (data && Array.isArray(data.players)) {
            updateAvailablePlayersUI(data.players);
        } else {
            console.error('Invalid data format for available players:', data);
        }
    });

    socket.on('draftStarted', (data) => {
        console.log('draftStarted', data);
    
        if (data) {
            // Start the countdown with the provided remaining time
            if (typeof Math.round(data.remainingTime) === 'number') {
                startCountdown(data.remainingTime);
            }
    
            // Update the current turn and round UI
            if (typeof data.currentTurnIndex === 'number') {
                updateCurrentTurnUI(data.currentTurnIndex);
            }
        } else {
            console.error('Invalid data format for draft start:', data);
        }
    });

    socket.on('turnUpdate', (data) => {
        console.log('turnUpdate', data);

        // if (data && typeof data.currentTurnIndex === 'number') {
        //     updateCurrentTurnUI(data.currentTurnIndex);
        //     startCountdown(data.turnDuration);
        // } else {
        //     console.error('Invalid data format for turn update:', data);
        // }
    });

    socket.on('turnTimeUpdate', (data) => {
        console.log('turnTimeUpdate', data);

        // // Ensure the data structure is as expected
        // if (data && typeof Math.round(data.remainingTime) === 'number') {
        //     updateDraftTimerUI(Math.round(data.remainingTime));
        // } else {
        //     console.error('Invalid data format for draft timer:', data);
        // }
    })

    socket.on('disconnect', () => {
        console.log('Socket.IO connection closed');
    });

    socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });

    return socket;
}