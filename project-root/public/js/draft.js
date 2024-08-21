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

    init();

    console.log('End of the DOM')
});

// grab the leagueId from the url
function getLeagueIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('leagueId');
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

async function init() {
    try {
        initializeSocket();
        await fetchDraftDetails(leagueId); 
        await initializeUserMapping(leagueId, connectedUserIds);
        fetchUserDetails(leagueId);
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