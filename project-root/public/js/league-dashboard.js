// league-dashboard.js

const token = localStorage.getItem('token');
let leagueId = getLeagueIdFromUrl(); // Extract league ID from URL
// let currentTargetIndex = 0; // Start with the first target date (first Friday)
let currentWeek; // Start with the first week
// let timerInterval = null;
let benchPlayers = {}; // Stores available players categorized by role
let currentLineup = []; // Stores the current lineup of players
let originalLineup = [];
let originalBenchPlayers = {};

// // Array of targets in UTC (adjust these dates as needed)
// const targetFridaysUTC = [
//     new Date(Date.UTC(2024, 8, 11, 23, 22, 0)), // September 11, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 8, 18, 23, 22, 0)), // September 18, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 8, 25, 23, 22, 0)), // September 25, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 9, 2, 23, 22, 0)),  // October 2, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 9, 9, 23, 22, 0)),  // October 9, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 9, 16, 23, 22, 0)), // October 16, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 9, 23, 23, 22, 0)), // October 23, 2024, 23:22 UTC
//     new Date(Date.UTC(2024, 9, 30, 23, 22, 0)), // October 30, 2024, 23:22 UTC
//     // Add more dates as needed...
// ];

// -------------------------------------------------------------------------- //

/**
 * Display a toast message.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success', 'error'). Defaults to 'success'.
 */
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }

    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Style the toast
    toast.style.minWidth = '200px';
    toast.style.marginTop = '10px';
    toast.style.padding = '15px 20px';
    toast.style.borderRadius = '5px';
    toast.style.color = '#fff';
    toast.style.opacity = '0.9';
    toast.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
    toast.style.fontFamily = 'Arial, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.cursor = 'pointer';
    toast.style.transition = 'opacity 0.5s ease';

    // Set background color based on type
    switch(type) {
        case 'success':
            toast.style.backgroundColor = '#28a745';
            break;
        case 'error':
            toast.style.backgroundColor = '#dc3545';
            break;
        default:
            toast.style.backgroundColor = '#333';
    }

    // Remove toast on click
    toast.addEventListener('click', () => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 500);
    });

    // Append the toast to the container
    toastContainer.appendChild(toast);

    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 500);
    }, 3000);
}

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
        // Split the token into parts and decode the payload
        const payload = token.split('.')[1]; // The payload is the second part
        const decoded = JSON.parse(atob(payload.replace(/_/g, '/').replace(/-/g, '+')));
        console.log('Decoded payload:', decoded);
        const userId = decoded.userId; // Adjust according to your token payload
        console.log('Extracted user ID:', userId);
        return userId;
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

async function openDraft() {
    try {
        // Fetch draft status
        const status = await fetchDraftStatus();

        // Check if the draft has ended
        if (!status.draft_ended) {
            // Redirect to the draft page if the draft has not ended
            window.location.href = `draft.html?leagueId=${leagueId}`;
        } else {
            console.log('Draft has already ended.');
        }
    } catch (error) {
        console.error('Error checking draft status:', error);
    }
}

async function fetchDraftStatus() {
    try {
        const response = await fetch(`/api/leagues/${leagueId}/draft-status`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming the token is stored in localStorage
            }
        });

        if (!response.ok) throw new Error('Failed to fetch draft status.');

        const draftStatus = await response.json();
        console.log('Draft Status:', draftStatus);
        return draftStatus;
    } catch (error) {
        console.error('Error fetching draft status:', error);
        throw error; // Rethrow to handle in openDraft
    }
}

function removeDraftButton() {
    const draftButton = document.getElementById('draft-button');
    if (draftButton) {
        draftButton.style.display = 'none';
    }
}

function showConfirmLeaveModal() {
    const modal = document.getElementById('confirm-leave-modal');
    const confirmBtn = document.getElementById('confirm-leave-btn');
    const closeBtn = document.getElementById('confirm-leave-close');
    const messageElement = document.getElementById('confirm-leave-message');

    // Update message with league name
    const leagueName = document.querySelector('#league-name').textContent;
    messageElement.innerHTML = `Are you sure you want to leave ${leagueName}?<br><br>This action cannot be undone!`;

    modal.style.display = 'block'; // Show modal

    // Handle confirm button
    confirmBtn.onclick = async () => {
        const leagueName = document.querySelector('#league-name').textContent;

        try {
            const response = await fetch('/api/leagues/leave-league', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ league_name: leagueName })
            });

            const result = await response.json();

            if (result.success) {
                alert('Successfully left the league');
                window.location.href = 'my-dashboard.html'; // Example: redirect to the leagues page
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error leaving league:', error);
            alert('Failed to leave the league');
        }

        modal.style.display = 'none'; // Hide modal
    };

    // Handle close button
    closeBtn.onclick = () => {
        modal.style.display = 'none'; // Hide modal
    };

    // Hide modal if clicking outside of modal-content
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function showModal(message) {
    const modal = document.getElementById('error-modal');
    const modalMessage = document.getElementById('modal-message');
    const closeButton = document.querySelector('.close-button');

    if (!modal || !modalMessage || !closeButton) {
        console.error('Modal elements are missing');
        return;
    }

    modalMessage.textContent = message;
    modal.style.display = 'block';

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

/**
 * Optionally fetches the next roster lock time from the server and displays a countdown.
 * Implement this if you want to show a countdown based on server-managed times.
 */
async function updateCountdown() {
    try {
        const response = await fetch(`/api/leagues/next-roster-lock`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch roster lock time.');
        }

        const data = await response.json();
        const rosterLockTime = new Date(data.rosterLockTime); // Assuming the server sends a timestamp

        const now = new Date();
        const timeDifference = rosterLockTime - now;

        if (timeDifference <= 0) {
            document.getElementById('countdown').innerHTML = "Roster Lock Passed!";
            return;
        }

        // Convert time difference to days, hours, minutes, and seconds
        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

        // Display the countdown
        document.getElementById('countdown').innerHTML =
            `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` + 
            `<br>Until Roster Lock`;

    } catch (error) {
        console.error('Error updating countdown:', error);
        document.getElementById('countdown').innerHTML = "Failed to load countdown.";
    }
}

/**
 * Fetches the current week from the server.
 * @returns {Promise<number>} The current week number.
 */
async function fetchCurrentWeek() {
    try {
        const response = await fetch(`/api/leagues/current-week`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch current week.');
        }

        const data = await response.json();
        console.log('Current Week Fetched:', data.currentWeek);
        return data.currentWeek;
    } catch (error) {
        console.error('Error fetching current week:', error);
        showToast(`Error: ${error.message}`, 'error');
        return null;
    }
}

function updateWeekDisplay() {
    const weekDisplay = document.getElementById('currentWeek');
    if (weekDisplay) {
        weekDisplay.innerHTML = `Current Week: ${currentWeek}`;
    }
}

function showDebugInfo() {
    const now = new Date(); // Current local time
    const nowUTC = new Date(now.toISOString()); // Current time in UTC
    const currentTargetDateUTC = targetFridaysUTC[currentTargetIndex]; // Get the current target date in UTC
    const endOfGameUTC = new Date(currentTargetDateUTC.getTime() + 5 * 60 * 1000); // 5 minutes after the target

    // console.log("Current local time:", now);
    // console.log("Current UTC time:", nowUTC);
    // console.log("Current target date (UTC):", currentTargetDateUTC);
    // console.log("End of Game Period (UTC):", endOfGameUTC);
    // console.log("Current Week:", currentWeek);
}

// -------------------------------------------------------------------------- //

async function fetchLeagueDetails(leagueId) {
    try {
        if (!token) {
            throw new Error('No token found');
        }

        if (!leagueId) {
            throw new Error('Invalid league ID');
        }

        const response = await fetch(`/api/draft/leagues/${leagueId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // Ensure the token is valid
            }
        });

        if (!response.ok) {
            const errorText = await response.text(); // Get error response text
            console.error('Server response:', errorText); // Log server response
            throw new Error(errorText);
        }

        const league = await response.json();
        console.log('League details fetched:', league); // Log fetched league details

        document.querySelector('#league-name').textContent = league.league_name;
        document.querySelector('#league-description').textContent = league.description;
    } catch (error) {
        console.error('Error fetching league details:', error);
        document.querySelector('#league-info').innerHTML = '<p>Failed to load league details.</p>';
    }
}

async function fetchLeagueUsers(leagueId) {
    try {
        if (!token) {
            throw new Error('No token found');
        }

        if (!leagueId) {
            throw new Error('Invalid league ID');
        }

        const response = await fetch(`/api/leagues/${leagueId}/users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // Ensure the token is valid
            }
        });

        if (!response.ok) {
            const errorText = await response.text(); // Get error response text
            console.error('Server response:', errorText); // Log server response
            throw new Error(errorText);
        }

        const users = await response.json();
        console.log('Users fetched:', users); // Log fetched users

        const usersList = document.querySelector('#users-list');
        usersList.innerHTML = ''; // Clear existing content

        if (users.length === 0) {
            usersList.innerHTML = '<li class="list-group-item">No users found in this league.</li>';
        } else {
            usersList.innerHTML = users.map(user => `
                <li class="list-group-item">${user.username}</li>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        const usersList = document.querySelector('#users-list');
        usersList.innerHTML = '<li class="list-group-item">Failed to load users.</li>';
    }
}

async function fetchMyTeam() {
    if (!leagueId) {
        console.error('No league ID found, cannot fetch team data.');
        showToast('Error: League ID is missing.', 'error');
        return;
    }

    // Fetch currentWeek from the server
    const serverCurrentWeek = await fetchCurrentWeek();
    if (!serverCurrentWeek) {
        // Handle the error appropriately
        return;
    }

    currentWeek = serverCurrentWeek; // Update the global currentWeek
    updateWeekDisplay(); // Update the UI with the new week

    console.log(`Fetching team data for leagueId: ${leagueId}, currentWeek: ${currentWeek}`);

    try {
        const response = await fetch(`/api/leagues/my-team/${leagueId}?week=${currentWeek}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch team data.');

        const teamData = await response.json();
        console.log('My Team Fetched:', teamData);
        renderTeam(teamData);

        // Populate currentLineup based on fetched team data
        currentLineup = teamData
            .filter(player => player.starter)
            .map(player => ({
                name: player.player_name,
                team_abrev: player.team_abrev,
                role: player.role,
                points: player.points
            }));

        // Populate benchPlayers categorized by role
        const bench = teamData.filter(player => !player.starter);
        benchPlayers = bench.reduce((acc, player) => {
            if (!acc[player.role]) acc[player.role] = [];
            acc[player.role].push({
                name: player.player_name,
                team_abrev: player.team_abrev,
                role: player.role,
                points: player.points
            });
            return acc;
        }, {});

        console.log('Current Lineup:', currentLineup);
        console.log('Bench Players:', benchPlayers);

    } catch (error) {
        console.error('Error fetching team data:', error);
        showToast(`Error: ${error.message}`, 'error');

        // Display error message to the user
        const playersContainer = document.getElementById('players-container');
        playersContainer.innerHTML = '<p class="error">Failed to load team data. Please try again later.</p>';
    }
}

async function fetchPlayerIdsByName(playerNames) {
    try {
        const response = await fetch('/api/leagues/player-names-to-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ playerNames })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return data.playerMap;
        } else {
            throw new Error(data.message || 'Failed to fetch player IDs');
        }
    } catch (error) {
        console.error('Error fetching player IDs by name:', error);
        return {};
    }
}

// THIS NEEDS TO BE FIXED.  FETCH FROM LEAGUETEAMPLAYERS NOT DRAFTED PLAYERS
async function fetchAvailablePlayers() {
    try {
        const response = await fetch(`/api/leagues/${leagueId}/available-players`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming token is stored in localStorage
            }
        });

        if (!response.ok) throw new Error('Failed to fetch available players.');
        
        const availablePlayers = await response.json();
        renderAvailablePlayers(availablePlayers);
    } catch (error) {
        console.error('Error fetching available players:', error);
    }
}

async function updateTeamStatus(starters, bench) {
    try {
        const response = await fetch('/api/leagues/update-lineup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ starters, bench })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update team status.');
        }

        console.log('Team status updated successfully');
    } catch (error) {
        console.error('Error updating team status:', error);
    }
}

// -------------------------------------------------------------------------- //

async function mapPlayerNamesToIds(players) {
    const playerNames = players.map(player => player.player_name);
    const playerMap = await fetchPlayerIdsByName(playerNames);

    console.log('playerMap:', playerMap); // Log the playerMap for debugging

    return players.map(player => ({
        ...player,
        player_id: playerMap[player.player_name] || null // Use player name to find player_id
    }));
}

function renderTeam(teamData) {
    const playersContainer = document.getElementById('players-container');
    playersContainer.innerHTML = ''; // Clear any existing content

    if (teamData.length === 0) {
        playersContainer.innerHTML = '<p>No players drafted yet.</p>';
        return;
    }

    // Sort teamData: starters first, bench players last
    const sortedTeamData = teamData.slice().sort((a, b) => {
        return (b.starter === a.starter) ? 0 : b.starter ? 1 : -1;
    });

    // Create headers for starters and bench
    const starters = sortedTeamData.filter(player => player.starter);
    const bench = sortedTeamData.filter(player => !player.starter);

    if (starters.length > 0) {
        const startersHeader = document.createElement('h3');
        startersHeader.textContent = 'Starters';
        playersContainer.appendChild(startersHeader);

        starters.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.classList.add('player', 'starter');
            playerElement.innerHTML = `
                <span>${player.team_abrev} ${player.player_name}</span>
                <span>${player.role}</span>
                <span>${player.points} pts</span>
            `;
            playersContainer.appendChild(playerElement);
        });
    }

    if (bench.length > 0) {
        const benchHeader = document.createElement('h3');
        benchHeader.textContent = 'Bench';
        playersContainer.appendChild(benchHeader);

        bench.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.classList.add('player', 'bench');
            playerElement.innerHTML = `
                <span>${player.team_abrev} ${player.player_name}</span>
                <span>${player.role}</span>
                <span>${player.points} pts</span>
            `;
            playersContainer.appendChild(playerElement);
        });
    }
}


function renderAvailablePlayers(players) {
    const freeAgentsContainer = document.getElementById('free-agents-container');
    freeAgentsContainer.innerHTML = ''; // Clear existing content

    if (players.length === 0) {
        freeAgentsContainer.innerHTML = '<p>No available players.</p>';
        return;
    }

    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        playerElement.innerHTML = `
            <span>${player.team_abrev} ${player.player_name}</span>
            <span>Role: ${player.role}</span>
        `;
        freeAgentsContainer.appendChild(playerElement);
    });
}

// -------------------------------------------------------------------------- //

// // Lineup Editing Modal Code

// DOM elements
const modal = document.getElementById('editLineupModal');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = modal.querySelector('.close'); // Scoped to modal
const saveLineupBtn = document.getElementById('saveLineup');
const cancelEditBtn = document.getElementById('cancelEdit');
const benchPlayersDiv = document.getElementById('benchPlayers');
const currentLineupDiv = document.getElementById('currentLineup');
const errorDiv = document.getElementById('error');

// Open modal
openModalBtn.onclick = function() {
    initializeModalLineup();
    modal.style.display = 'block';
    renderBenchPlayers();
    renderCurrentLineup();
}

// Close modal
closeModalBtn.onclick = function() {
    modal.style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
});

// Render bench players
function renderBenchPlayers() {
    console.log('Rendering Bench Players...');
    benchPlayersDiv.innerHTML = ''; // Clear existing content

    for (const [role, players] of Object.entries(benchPlayers)) {
        console.log(`Role: ${role}, Players:`, players);

        if (players.length === 0) continue; // Skip roles with no players

        const roleDiv = document.createElement('div');
        roleDiv.className = 'role-section';
        roleDiv.innerHTML = `<div class="role-title">${role}:</div>`;

        players.forEach(player => {
            // Ensure the player is not already in the current lineup
            if (!currentLineup.some(p => p.name === player.name)) {
                console.log(`Adding player to bench: ${player.name} (${player.team_abrev})`);
                const playerBtn = document.createElement('button');
                playerBtn.className = 'player-button';
                playerBtn.textContent = `${player.team_abrev} ${player.name}`; // Include team_abrev
                playerBtn.addEventListener('click', () => addToLineup(player, role));
                roleDiv.appendChild(playerBtn);
            } else {
                console.log(`Player already in lineup: ${player.name}`);
            }
        });

        benchPlayersDiv.appendChild(roleDiv);
    }
}

// Render current lineup
function renderCurrentLineup() {
    currentLineupDiv.innerHTML = '';
    currentLineup.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player';
        
        // Create player info
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';
        playerInfo.innerHTML = `
            <span>${player.team_abrev}</span>
            <span>${player.name}</span>
            <span class="player-role">(${player.role})</span>
        `;
        
        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => removeFromLineup(player.name));
        
        // Append to playerDiv
        playerDiv.appendChild(playerInfo);
        playerDiv.appendChild(removeButton);
        
        // Append to currentLineupDiv
        currentLineupDiv.appendChild(playerDiv);
    });
}

// Add player to lineup
function addToLineup(player, role) {
    if (currentLineup.length < 5) {
        // Prevent adding duplicate players
        if (currentLineup.some(p => p.name === player.name)) {
            errorDiv.textContent = 'Error: Player is already in the lineup.';
            return;
        }

        currentLineup.push({ 
            name: player.name, 
            team_abrev: player.team_abrev, // Ensure team_abrev is included
            role: role 
        });
        // Remove player from benchPlayers
        benchPlayers[role] = benchPlayers[role].filter(p => p.name !== player.name);
        renderBenchPlayers();
        renderCurrentLineup();
        validateLineup();
    } else {
        errorDiv.textContent = 'Lineup is full. Remove a player before adding a new one.';
    }
}

// Remove player from lineup
function removeFromLineup(playerName) {
    console.log(`Removing player from lineup: ${playerName}`);
    
    // Find the player in the currentLineup
    const player = currentLineup.find(p => p.name === playerName);
    if (player) {
        // Remove from currentLineup
        currentLineup = currentLineup.filter(p => p.name !== playerName);
        
        // Initialize the role array if it doesn't exist
        if (!benchPlayers[player.role]) {
            benchPlayers[player.role] = [];
        }
        
        // Prevent adding duplicate players to bench
        if (!benchPlayers[player.role].some(p => p.name === player.name)) {
            benchPlayers[player.role].push({ 
                name: player.name, 
                team_abrev: player.team_abrev // Ensure team_abrev is included
            });
            console.log(`Added ${player.name} back to bench under ${player.role}`);
        } else {
            console.warn(`Player ${player.name} already exists in bench under ${player.role}`);
        }
        
        // Re-render the lineup and bench
        renderBenchPlayers();
        renderCurrentLineup();
        validateLineup();
    } else {
        console.error(`Player not found in lineup: ${playerName}`);
    }
}

// Validate lineup
function validateLineup() {
    const roleCount = currentLineup.reduce((acc, player) => {
        acc[player.role] = (acc[player.role] || 0) + 1;
        return acc;
    }, {});

    let isValid = true;
    let errorMessage = '';

    if (roleCount['Fragger'] > 1) {
        errorMessage = 'Error: More than 1 Fragger in the lineup.';
        isValid = false;
    } else if (!roleCount['Support']) {
        errorMessage = 'Error: No Support player in the lineup.';
        isValid = false;
    } else if (!roleCount['Anchor']) {
        errorMessage = 'Error: No Anchor player in the lineup.';
        isValid = false;
    } else {
        errorMessage = '';
    }

    // Display the error message
    errorDiv.textContent = errorMessage;

    return isValid;
}

// Save lineup
saveLineupBtn.onclick = function() {
    if (currentLineup.length !== 5) {
        errorDiv.textContent = 'Error: Lineup must have exactly 5 players.';
    } else {
        saveLineup();
    }
}

// Cancel edit
cancelEditBtn.onclick = function() {
    modal.style.display = 'none';
}

// Initialize modal lineup based on current team
function initializeModalLineup() {
    // Fetch the current lineup from the user's team
    // Assuming fetchMyTeam populates currentLineup; otherwise, adjust accordingly
    currentLineup = currentLineup.length ? currentLineup : [];
}

// Save lineup to the server
async function saveLineup() {
    try {
        // Validate the lineup first
        const isValid = validateLineup();
        if (!isValid) {
            // Optionally, focus on the errorDiv or provide additional UI feedback
            return; // Exit the function if the lineup is invalid
        }

        // Disable the save button and show a loading indicator
        saveLineupBtn.disabled = true;
        saveLineupBtn.textContent = 'Saving...';

        // Extract starters and bench player names
        const starters = currentLineup.map(player => player.name);
        const bench = [];

        // Collect all bench player names across roles
        for (const role in benchPlayers) {
            benchPlayers[role].forEach(playerName => {
                bench.push(playerName);
            });
        }

        // Combine all player names for bulk ID fetching
        const allPlayerNames = [...starters, ...bench];

        // Fetch all player IDs in a single request
        const allPlayerIdsMap = await fetchPlayerIdsByName(allPlayerNames);

        // Extract starters and bench IDs
        const starterIds = starters.map(name => allPlayerIdsMap[name]).filter(id => id);
        const benchIds = bench.map(name => allPlayerIdsMap[name]).filter(id => id);

        // Validate that all starters have corresponding IDs
        if (starterIds.length !== starters.length) {
            throw new Error('Some starters could not be mapped to player IDs.');
        }

        // Optional: Validate bench players
        if (benchIds.length !== bench.length) {
            console.warn('Some bench players could not be mapped to player IDs.');
            // Decide whether to proceed or throw an error
        }

        // Prepare the payload
        const payload = {
            starters: starterIds,
            bench: benchIds
        };

        // Send the updated lineup to the server
        const response = await fetch('/api/leagues/update-lineup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        // Handle server response
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update lineup.');
        }

        const result = await response.json();
        console.log('Lineup saved:', result);
        modal.style.display = 'none';

        // Show success toast
        showToast('Lineup has been successfully updated!', 'success');

        // Re-enable the save button
        saveLineupBtn.disabled = false;
        saveLineupBtn.textContent = 'Save Changes';

        // Refresh the team display
        await fetchMyTeam();
    } catch (error) {
        // Re-enable the save button in case of error
        saveLineupBtn.disabled = false;
        saveLineupBtn.textContent = 'Save Changes';

        // Show error toast
        showToast(`Error: ${error.message}`, 'error');

        // Display error message in the designated div
        errorDiv.textContent = `Error: ${error.message}`;
        console.error('Error saving lineup:', error);
    }
}

// -------------------------------------------------------------------------- //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for league-dashboard.js');

    console.log('Token:', token);
    console.log('Extracted League ID:', leagueId); // Log the leagueId for debugging

    // Fetch draft status
    const status = await fetchDraftStatus();

    if (status.draft_ended) {
        removeDraftButton();
    }

    // Fetch league details
    await fetchLeagueDetails(leagueId);

    // Fetch users
    await fetchLeagueUsers(leagueId);

    // Automatically activate the first tab content and run fetchMyTeam on page load
    document.getElementById('my-team-content').classList.add('active');
    await fetchMyTeam();

    // Function to handle tab switching
    window.openTab = (event, tabName) => {
        const tabContent = document.getElementById(tabName);

        if (!tabContent) {
            console.error(`Tab content with id "${tabName}" not found.`);
            return;
        }
    
        // Hide all tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));
    
        // Remove "active" class from all tabs
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));
    
        // Show the clicked tab's content and mark the tab as active
        tabContent.classList.add('active');
        event.currentTarget.classList.add('active');
    };

    // Attach event listener for clicking on the "My Team" tab to re-fetch data
    const myTeamTab = document.querySelector('.tab[onclick*="my-team-content"]');
    if (myTeamTab) {
        myTeamTab.addEventListener('click', fetchMyTeam);
    }

    // Add event listener to run fetchAvailablePlayers when the "Free Agents" tab is clicked
    const freeAgentsTab = document.querySelector('.tab[onclick*="free-agents-content"]');
    if (freeAgentsTab) {
        freeAgentsTab.addEventListener('click', fetchAvailablePlayers);
    }

    // Other event listeners
    const leaveLeagueBtn = document.getElementById('leave-league-btn');
    if (leaveLeagueBtn) {
        leaveLeagueBtn.addEventListener('click', showConfirmLeaveModal);
    }

    const draftButton = document.getElementById('draft-button');
    if (draftButton) {
        draftButton.addEventListener('click', openDraft);
    }

    // Optionally, initialize the countdown if implemented
    // updateCountdown();
    // setInterval(updateCountdown, 1000); // If using a countdown

});

