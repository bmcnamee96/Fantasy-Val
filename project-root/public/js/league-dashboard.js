// league-dashboard.js

const token = localStorage.getItem('token');
let leagueId = getLeagueIdFromUrl(); // Extract league ID from URL
let currentTargetIndex = 0; // Start with the first target date (first Friday)
let currentWeek = 1; // Start with the first week

// Array of targets in UTC (adjust these dates as needed)
const targetFridaysUTC = [
    new Date(Date.UTC(2024, 8, 11, 23, 22, 0)), // Next Friday at 5 PM UTC
    new Date(Date.UTC(2024, 8, 20, 22, 0, 0)), // Following Friday at 5 PM UTC
    new Date(Date.UTC(2024, 8, 27, 22, 0, 0))  // And so on...
];

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

function updateCountdown() {
    const now = new Date(); // Get current local time
    const nowUTC = new Date(now.toISOString()); // Convert local time to UTC

    // Get the current target Friday and the following Sunday (end of game period)
    const targetFridayUTC = targetFridaysUTC[currentTargetIndex];
    const endOfGameUTC = new Date(targetFridayUTC.getTime() + 5 * 60 * 1000); // 5 minutes after the target

    if (nowUTC >= targetFridayUTC && nowUTC <= endOfGameUTC) {
        // If within the game period (Friday to Sunday), stop the timer
        document.getElementById('countdown').innerHTML = "Games in Progress!";
        return;
    } else if (nowUTC > endOfGameUTC) {
        // If after Sunday, move to the next Friday target
        currentTargetIndex++;
        if (currentTargetIndex >= targetFridaysUTC.length) {
            document.getElementById('countdown').innerHTML = "All games have ended!";
            clearInterval(timerInterval); // Stop the timer if no more dates
            return;
        } else {
            // Increment the week number when moving to the next target date
            currentWeek++;
            updateWeekDisplay(); // Update the displayed week number
            updateCountdown(); // Call recursively to start next countdown
            showDebugInfo();
            return;
        }
    } else {
        // Calculate the countdown time remaining until the next Friday
        const timeDifference = targetFridayUTC - nowUTC; // Difference in milliseconds

        // Convert the time difference to days, hours, minutes, and seconds
        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

        // Display the countdown
        document.getElementById('countdown').innerHTML =
            `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` + 
            `<br>Until Roster Lock`;  // Add line break
    }
}

function updateWeekDisplay() {
    document.getElementById('currentWeek').innerHTML = `Current Week: ${currentWeek}`;
}

function showDebugInfo() {
    const now = new Date(); // Current local time
    const nowUTC = new Date(now.toISOString()); // Current time in UTC
    const currentTargetDateUTC = targetFridaysUTC[currentTargetIndex]; // Get the current target date in UTC
    const endOfGameUTC = new Date(currentTargetDateUTC.getTime() + 5 * 60 * 1000); // 5 minutes after the target

    console.log("Current local time:", now);
    console.log("Current UTC time:", nowUTC);
    console.log("Current target date (UTC):", currentTargetDateUTC);
    console.log("End of Game Period (UTC):", endOfGameUTC);
    console.log("Current Week:", currentWeek);
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
        return;
    }

    try {
        const response = await fetch(`/api/leagues/my-team/${leagueId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming the token is stored in localStorage
            }
        });
        if (!response.ok) throw new Error('Failed to fetch team data.');
        
        const teamData = await response.json();
        renderTeam(teamData);
    } catch (error) {
        console.error('Error fetching team data:', error);
    }
}

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

// -------------------------------------------------------------------------- //

function renderTeam(teamData) {
    const playersContainer = document.getElementById('players-container');
    playersContainer.innerHTML = ''; // Clear any existing content

    if (teamData.length === 0) {
        playersContainer.innerHTML = '<p>No players drafted yet.</p>';
        return;
    }

    teamData.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        playerElement.classList.add(player.role === 'Bench' ? 'bench' : 'starter');
        playerElement.innerHTML = `
        <span>${player.team_abrev} ${player.player_name}</span>
        <span>${player.points} pts</span>
        `;
        playersContainer.appendChild(playerElement);
    });
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for league-dashboard.js');

    console.log('Token:', token);
    console.log('Extracted League ID:', leagueId); // Log the leagueId for debugging

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
    document.querySelector('.tab[onclick*="my-team-content"]').addEventListener('click', fetchMyTeam);

    // Add event listener to run fetchAvailablePlayers when the "Free Agents" tab is clicked
    document.querySelector('.tab[onclick*="free-agents-content"]').addEventListener('click', fetchAvailablePlayers);

    // Other event listeners
    const leaveLeagueBtn = document.getElementById('leave-league-btn');
    if (leaveLeagueBtn) {
        leaveLeagueBtn.addEventListener('click', showConfirmLeaveModal);
    }

    const draftButton = document.getElementById('draft-button');
    if (draftButton) {
        draftButton.addEventListener('click', openDraft);
    }

    // Update the countdown every second
    const timerInterval = setInterval(updateCountdown, 1000);

    // Initial call to display the timer and current week immediately
    updateCountdown();
    updateWeekDisplay();

    const status = await fetchDraftStatus();
    if (status.draft_ended) {
        removeDraftButton();
    }
});
