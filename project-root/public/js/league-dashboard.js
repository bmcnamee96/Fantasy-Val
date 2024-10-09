// league-dashboard.js

const token = localStorage.getItem('token');
let leagueId = getLeagueIdFromUrl(); // Extract league ID from URL
let currentWeek = null; // Start with the first week
let timerInterval = null;
let weeksData = []; // Array to store weeks data
let targetTime = null; // The next target time (start_date of the next week)
let benchPlayers = {}; // Stores available players categorized by role
let currentLineup = []; // Stores the current lineup of players
let originalLineup = [];
let originalBenchPlayers = {};

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

// -------------------------------------------------------------------------- //

/**
 * Fetches the weeks data from the server.
 * @returns {Promise<void>}
 */
async function fetchWeeksData() {
    try {
        const response = await fetch(`/api/leagues/weeks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch weeks data.');
        }

        const data = await response.json();
        weeksData = data.weeks; // Assuming the server returns { weeks: [...] }

        console.log('Weeks Data Fetched:', weeksData);
    } catch (error) {
        console.error('Error fetching weeks data:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Determines the current week based on the current time and weeks data.
 */
function determineCurrentWeek() {
    const now = new Date(); // Current UTC time
    let weekFound = false;

    for (let i = 0; i < weeksData.length; i++) {
        const weekStart = new Date(weeksData[i].start_date);
        const nextWeekStart = weeksData[i + 1] ? new Date(weeksData[i + 1].start_date) : null;

        if (now >= weekStart && (nextWeekStart === null || now < nextWeekStart)) {
            currentWeek = weeksData[i].week_number;
            targetTime = nextWeekStart; // The start of the next week
            weekFound = true;
            break;
        }
    }

    if (!weekFound) {
        if (now < new Date(weeksData[0].start_date)) {
            // Before the first week
            currentWeek = 0;
            targetTime = new Date(weeksData[0].start_date);
        } else {
            // After the last week
            currentWeek = weeksData[weeksData.length - 1].week_number;
            targetTime = null; // No next week
        }
    }

    updateWeekDisplay();
}

function isWithinRosterLockPeriod() {
    const timeZone = 'America/New_York';

    const now = new Date();

    // Get the date and time components in 'America/New_York' time zone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour12: false,
        hour: 'numeric',
        minute: 'numeric',
    });

    const parts = formatter.formatToParts(now);
    const dateTime = {};
    parts.forEach(({ type, value }) => {
        dateTime[type] = value;
    });

    const dayOfWeek = dateTime.weekday; // e.g., 'Friday'
    const hour = parseInt(dateTime.hour, 10);
    const minute = parseInt(dateTime.minute, 10);

    const timeInMinutes = hour * 60 + minute;

    // Lock period is from Friday 17:00 to Sunday 23:59
    const lockStartDay = 'Friday';
    const lockStartTime = 17 * 60; // 17:00 in minutes

    const lockEndDay = 'Sunday';
    const lockEndTime = 23 * 60 + 59; // 23:59

    const daysOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let currentDayIndex = daysOrder.indexOf(dayOfWeek);
    const lockStartDayIndex = daysOrder.indexOf(lockStartDay);
    let lockEndDayIndex = daysOrder.indexOf(lockEndDay);

    if (currentDayIndex === -1) {
        // Should not happen
        return false;
    }

    // Adjust indices for week wrap-around
    if (lockEndDayIndex < lockStartDayIndex) {
        lockEndDayIndex += 7;
    }
    if (currentDayIndex < lockStartDayIndex) {
        currentDayIndex += 7;
    }

    if (currentDayIndex === lockStartDayIndex) {
        // Friday
        if (timeInMinutes >= lockStartTime) {
            return true;
        }
    } else if (currentDayIndex === lockEndDayIndex) {
        // Sunday
        if (timeInMinutes <= lockEndTime) {
            return true;
        }
    } else if (currentDayIndex > lockStartDayIndex && currentDayIndex < lockEndDayIndex) {
        // Saturday
        return true;
    }

    return false;
}

// Update countdown function
function updateCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) {
        console.error('Countdown element not found!');
        return;
    }

    // Check if rosters are locked
    if (isWithinRosterLockPeriod()) {
        countdownElement.innerHTML = 'Games started! Rosters Locked!';
        return;
    } 
    
    if (targetTime === null) {
        // No more weeks to count down to
        countdownElement.innerHTML = 'Season has ended.';
        return;
    }

    const now = new Date();
    const timeDifference = targetTime - now;

    if (timeDifference <= 0) {
        // Timer has reached zero; increment currentWeek
        incrementCurrentWeek();
        return;
    }

    // Calculate days, hours, minutes, seconds
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeDifference / (1000 * 60)) % 60);
    const seconds = Math.floor((timeDifference / 1000) % 60);

    // Update countdown display
    countdownElement.innerHTML =
        `${days}d ${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}<br>` +
        `Until Week ${currentWeek + 1} Starts`;
}

/**
 * Increments the current week and updates the target time.
 */
function incrementCurrentWeek() {
    currentWeek += 1;

    // Find the index of the new current week
    const currentWeekIndex = weeksData.findIndex(week => week.week_number === currentWeek);

    if (currentWeekIndex === -1 || currentWeekIndex + 1 >= weeksData.length) {
        // No more weeks left
        targetTime = null;
        updateCountdown(); // Update the countdown to show 'Season has ended.'
    } else {
        // Set targetTime to the start_date of the next week
        targetTime = new Date(weeksData[currentWeekIndex + 1].start_date);
    }

    updateWeekDisplay();
}

/**
 * Updates the current week display in the DOM.
 */
function updateWeekDisplay() {
    const weekDisplay = document.getElementById('currentWeek');
    if (weekDisplay) {
        if (currentWeek === 0) {
            weekDisplay.innerHTML = `Season has not started yet.`;
        } else {
            weekDisplay.innerHTML = `Current Week: ${currentWeek}`;
        }
    }
}

/**
 * Starts the countdown timer, updating every second.
 */
async function startCountdown() {
    // Fetch weeks data from the server
    await fetchWeeksData();

    if (weeksData.length === 0) {
        console.error('No weeks data available.');
        return;
    }

    // Determine the current week and target time
    determineCurrentWeek();

    updateCountdown(); // Initial call
    setInterval(updateCountdown, 1000); // Update every second
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

// -------------------------------------------------------------------------- //

// Function to fetch the league schedule
async function fetchLeagueSchedule() {
    console.log('Fetching league schedule...');
    try {
        const response = await fetch(`api/leagues/${leagueId}/schedule`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(response);

        if (!response.ok) {
            throw new Error('Failed to fetch league schedule');
        }

        const data = await response.json();
        if (data.success) {
            if (data.schedule && data.schedule.length > 0) {
                displayLeagueSchedule(data.schedule);
            } else {
                // Schedule is empty
                displayNoScheduleMessage(data.message);
            }
        } else {
            // Handle the case when success is false
            displayNoScheduleMessage(data.message);
        }
    } catch (error) {
        console.error('Error fetching league schedule:', error);
        displayNoScheduleMessage('Schedule will be created after the draft!');
    }
}

function displayLeagueSchedule(schedule) {
    const scheduleContainer = document.getElementById('league-schedule');
    if (!scheduleContainer) {
        console.error('League Schedule container not found!');
        return;
    }

    // Clear any existing content
    scheduleContainer.innerHTML = '';

    // Group schedule entries by week number
    const scheduleByWeek = {};
    schedule.forEach(entry => {
        if (!scheduleByWeek[entry.week_number]) {
            scheduleByWeek[entry.week_number] = [];
        }
        scheduleByWeek[entry.week_number].push(entry);
    });

    // Sort the weeks in order
    const sortedWeeks = Object.keys(scheduleByWeek).sort((a, b) => a - b);

    sortedWeeks.forEach(weekNumber => {
        const weekEntries = scheduleByWeek[weekNumber];

        // Create a section for the week
        const weekSection = document.createElement('div');
        weekSection.classList.add('week-section');

        const weekHeader = document.createElement('h3');
        weekHeader.textContent = `Week ${weekNumber}`;
        weekSection.appendChild(weekHeader);

        // Create a table for the matchups
        const matchupTable = document.createElement('table');
        matchupTable.classList.add('matchup-table');

        // Table header
        const tableHeader = document.createElement('thead');
        tableHeader.innerHTML = `
            <tr>
                <th>Home Team</th>
                <th>Home Points</th>
                <th></th>
                <th>Away Team</th>
                <th>Away Points</th>
                <th>Result</th>
            </tr>
        `;
        matchupTable.appendChild(tableHeader);

        const tableBody = document.createElement('tbody');

        weekEntries.forEach(matchup => {
            const row = document.createElement('tr');

            // Home Team
            const homeTeamCell = document.createElement('td');
            homeTeamCell.textContent = matchup.home_team_name;
            row.appendChild(homeTeamCell);

            // Home Team Points
            const homePointsCell = document.createElement('td');
            homePointsCell.textContent = matchup.home_team_score !== null ? matchup.home_team_score : '-';
            row.appendChild(homePointsCell);

            // VS Separator
            const vsCell = document.createElement('td');
            vsCell.textContent = 'vs';
            vsCell.style.textAlign = 'center';
            row.appendChild(vsCell);

            // Away Team
            const awayTeamCell = document.createElement('td');
            awayTeamCell.textContent = matchup.away_team_name;
            row.appendChild(awayTeamCell);

            // Away Team Points
            const awayPointsCell = document.createElement('td');
            awayPointsCell.textContent = matchup.away_team_score !== null ? matchup.away_team_score : '-';
            row.appendChild(awayPointsCell);

            // Result
            const resultCell = document.createElement('td');
            if (matchup.home_team_score !== null && matchup.away_team_score !== null) {
                if (matchup.is_tie) {
                    resultCell.textContent = 'Tie';
                } else if (matchup.winner_team_id === matchup.home_team_id) {
                    resultCell.textContent = `Winner: ${matchup.home_team_name}`;
                } else if (matchup.winner_team_id === matchup.away_team_id) {
                    resultCell.textContent = `Winner: ${matchup.away_team_name}`;
                } else {
                    resultCell.textContent = 'Result Pending';
                }
            } else {
                resultCell.textContent = 'Scheduled';
            }
            row.appendChild(resultCell);

            tableBody.appendChild(row);
        });

        matchupTable.appendChild(tableBody);
        weekSection.appendChild(matchupTable);
        scheduleContainer.appendChild(weekSection);
    });
}

function displayNoScheduleMessage(message) {
    const scheduleContainer = document.getElementById('league-schedule');
    if (!scheduleContainer) {
        console.error('League Schedule container not found!');
        return;
    }

    // Clear any existing content
    scheduleContainer.innerHTML = '';

    const messageElement = document.createElement('p');
    messageElement.textContent = message || 'Schedule will be created after the draft!';
    scheduleContainer.appendChild(messageElement);
}

async function fetchNextOpponent(leagueId, token) {
    try {
      const response = await fetch(`/api/leagues/next-opponent/${leagueId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  
      if (response.status === 401) {
        // Handle unauthorized access
        window.location.href = '/login.html';
        return;
      }
  
      const data = await response.json();
  
      if (data.error) {
        throw new Error(data.error);
      }
  
      if (data.message) {
        document.getElementById('opponent-name').textContent = data.message;
      } else {
        updateOpponentDisplay(data.opponent_name, data.week_number);
      }
    } catch (error) {
      console.error('Error fetching next opponent:', error);
      document.getElementById('opponent-name').textContent = 'Error fetching opponent.';
    }
}
  
function updateOpponentDisplay(opponentName, weekNumber) {
    const opponentNameElement = document.getElementById('opponent-name');
    opponentNameElement.textContent = `${opponentName} (Week ${weekNumber})`;
}

async function fetchLeagueStandings(leagueId, token) {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/standings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  
      if (response.status === 401) {
        // Handle unauthorized access
        window.location.href = '/login.html';
        return;
      }
  
      if (!response.ok) {
        throw new Error('Failed to fetch league standings.');
      }
  
      const data = await response.json();
      if (data.success) {
        updateStandingsDisplay(data.standings);
      } else {
        console.error(data.message);
        document.getElementById('standings-list').innerHTML = `<li>${data.message}</li>`;
      }
    } catch (error) {
      console.error('Error fetching league standings:', error);
      document.getElementById('standings-list').innerHTML = '<li>Error loading standings.</li>';
    }
}
  
function updateStandingsDisplay(standings) {
    const standingsList = document.getElementById('standings-list');
    standingsList.innerHTML = ''; // Clear existing list items
  
    standings.forEach((team, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${team.team_name} - ${team.points} pts`;
      standingsList.appendChild(listItem);
    });
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
                <li class="list-group-item">
                    <a href="#" class="user-name" data-user-id="${user.user_id}" data-username="${user.username}">${user.username}</a>
                    <div class="team-info mt-2" id="team-${user.id}" style="display: none;">
                        <!-- Team details will be inserted here -->
                    </div>
                </li>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        const usersList = document.querySelector('#users-list');
        usersList.innerHTML = '<li class="list-group-item">Failed to load users.</li>';
    }
}

// Function to toggle team info visibility
function toggleTeamInfo(event) {
    event.preventDefault(); // Prevent default link behavior

    const clickedElement = event.target;

    // Ensure the clicked element has the 'user-name' class
    if (clickedElement.classList.contains('user-name')) {
        const userId = clickedElement.getAttribute('data-user-id');
        const teamDiv = document.getElementById(`team-${userId}`);

        if (teamDiv) {
            // Toggle display
            if (teamDiv.style.display === 'none') {
                teamDiv.style.display = 'block';
            } else {
                teamDiv.style.display = 'none';
            }
        }
    }
}

// Function to fetch and display team info in modal
async function fetchAndShowTeamModal(event) {
    event.preventDefault();

    // Use closest to ensure you get the <a> element even if a child element was clicked
    const userLink = event.target.closest('.user-name');

    if (userLink) {
        const userId = userLink.getAttribute('data-user-id');
        const username = userLink.getAttribute('data-username');

        if (!userId || !username) {
            console.error('User ID or Username not found in data attributes.');
            return;
        }

        try {
            // Show a loading indicator in the modal body
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = '<p>Loading...</p>';

            // Set modal title
            document.getElementById('teamModalLabel').textContent = `${username}'s Team`;

            // Fetch team data
            const response = await fetch(`/api/leagues/${userId}/${leagueId}/team`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Handle unauthorized access (e.g., token expired)
                    alert('Session expired. Please log in again.');
                    window.location.href = '/login'; // Redirect to login page
                    return;
                }
                const errorText = await response.text();
                console.error('Error fetching team:', errorText);
                modalBody.innerHTML = '<p>Failed to load team information.</p>';
                return;
            }

            let teamData = await response.json();

            // Debugging: Log teamData to verify structure
            console.log('Fetched team data:', teamData);

            // Clear the loading indicator
            modalBody.innerHTML = '';

            // Map player IDs to player names using the provided function
            teamData.teams = await mapPlayerIdsToNames(teamData.teams);

            // Debugging: Log mapped team data
            console.log('Mapped team data:', teamData);

            // Check if teamData has players
            if (teamData.teams && teamData.teams.length > 0) {
                // Build the HTML content for the team
                let teamHtml = '<ul>';

                teamData.teams.forEach(player => {
                    // Ensure player_name and team_abrev exist
                    const playerName = player.player_name.player_name || 'Unknown';
                    const teamAbrev = player.player_name.team_abrev || 'Unknown';
                    const lineupStatus = player.lineup ? 'Starter' : 'Bench';
                    const badgeClass = player.lineup ? 'starting' : 'bench';

                    // Access playerId correctly (fix typo)
                    const playerId = player.playeId || player.player_id || 'Unknown';

                    // Display team_abrev followed by player_name
                    teamHtml += `
                        <li>
                            <span>${teamAbrev} ${playerName}</span>
                            <span class="badge ${badgeClass}">${lineupStatus}</span>
                            <button>Trade</button>
                        </li>
                    `;
                });

                teamHtml += '</ul>';

                // Insert the generated team HTML into the modal body
                modalBody.innerHTML = teamHtml;
            } else {
                // If no team data found, display a message
                modalBody.innerHTML = '<p>No players found for this team.</p>';
            }

            // Show the modal
            openModal();

        } catch (error) {
            console.error('Error fetching team:', error);
            modalBody.innerHTML = '<p>Error loading team information.</p>';
        }
    }
}

// Function to open the modal
function openModal() {
    const modal = document.getElementById('teamModal');
    modal.style.display = 'block';
}

// Function to close the modal
function closeModal() {
    const modal = document.getElementById('teamModal');
    modal.style.display = 'none';
}

// Event listeners for close buttons
document.querySelector('.close-button').addEventListener('click', closeModal);
document.getElementById('close').addEventListener('click', closeModal);

// Optionally, close the modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('teamModal');
    if (event.target == modal) {
        closeModal();
    }
});

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

    console.log(`Fetching team data for leagueId: ${leagueId}, currentWeek: ${currentWeek}`);

    let teamData = [];
    let weekToFetch = currentWeek;

    try {
        // Loop to fetch team data from currentWeek down to week 1
        while (weekToFetch >= 1) {
            const response = await fetch(`/api/leagues/my-team/${leagueId}?week=${weekToFetch}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch team data.');

            teamData = await response.json();
            console.log(`Team Data Fetched for week ${weekToFetch}:`, teamData);

            if (teamData && teamData.length > 0) {
                // Check if the lineup is not empty
                if (teamData.some(player => player.starter)) {
                    break; // Found team data with a lineup
                }
            }

            // If teamData is empty or no starters, decrement week and try again
            weekToFetch--;
        }

        if (!teamData || teamData.length === 0) {
            console.log('No team data found for any week.');
            // Handle the case where no team data is found
            renderTeam([]);
            return;
        }

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

async function fetchPlayerNamesByIds(playerIds) {
    const response = await fetch(`/api/leagues/ids-to-names`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ playerIds })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch player names');
    }

    return await response.json(); // Should return an object like { "player_id_1": "player_name_1", "player_id_2": "player_name_2", ... }
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

async function mapPlayerIdsToNames(players) {
    const playerIds = players.map(player => player.playeId); // Collect player IDs
    const playerMap = await fetchPlayerNamesByIds(playerIds); // Fetch player names

    console.log('playerMap:', playerMap); // Log the playerMap for debugging

    return players.map(player => ({
        ...player,
        player_name: playerMap[player.playeId] || 'Unknown' // Use player ID to find player_name
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
            <button class="sign-button" data-player-id="${player.player_id}" data-role="${player.role}">Sign</button>
        `;
        freeAgentsContainer.appendChild(playerElement);
    });

    // Attach event listeners to all "Sign" buttons
    const signButtons = document.querySelectorAll('.sign-button');
    signButtons.forEach(button => {
        button.addEventListener('click', handleSignPlayer);
    });
}

// Function to handle "Sign" button click
async function handleSignPlayer(event) {
    const button = event.target;
    const playerIdToSign = button.getAttribute('data-player-id');
    const roleToSign = button.getAttribute('data-role');

    console.log('Signing player:', playerIdToSign, 'Role:', roleToSign);

    if (!leagueId || leagueId === "null" || !token) {
        console.error('League ID or token is missing.');
        showToast('Unable to sign player. Please ensure you are logged in and have selected a league.', 'error');
        return;
    }

    try {
        // Fetch bench players via the separate endpoint
        const benchResponse = await fetch(`/api/leagues/${leagueId}/bench-players`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!benchResponse.ok) {
            throw new Error('Failed to fetch bench players.');
        }

        const benchData = await benchResponse.json();
        console.log('Bench Players:', benchData);

        if (!benchData.success || !Array.isArray(benchData.availableBenchPlayers)) {
            throw new Error('Invalid bench players data.');
        }

        // Filter bench players by the same role
        const eligibleBenchPlayers = benchData.availableBenchPlayers.filter(player => player.role === roleToSign);

        if (eligibleBenchPlayers.length === 0) {
            showToast('No eligible bench players to drop for this role.', 'info');
            return;
        }

        // Prompt user to select a player to drop (using modal)
        openDropPlayerModal(eligibleBenchPlayers, playerIdToSign);
    } catch (error) {
        console.error('Error signing player:', error);
        showToast(error.message || 'An error occurred while signing the player.', 'error');
    }
}

// Function to open the modal and populate bench players
function openDropPlayerModal(eligiblePlayers, playerIdToSign) {
    const modal = document.getElementById('dropPlayerModal');
    const benchPlayersContainer = document.getElementById('benchPlayersSelect');
    const confirmButton = document.getElementById('confirmDrop');
    const cancelButton = document.getElementById('cancelDrop');
    const closeButton = document.querySelector('.close-button');
    let selectedPlayerId = null; // Track the selected player to drop

    // Clear previous content
    benchPlayersContainer.innerHTML = '';

    // Populate the container with eligible players as clickable items
    eligiblePlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.textContent = `${player.team_abrev} ${player.player_name}`;
        playerItem.dataset.playerId = player.player_id;

        // Handle click to select the player
        playerItem.onclick = () => {
            // Deselect all other player items
            document.querySelectorAll('.player-item').forEach(item => item.classList.remove('selected'));
            
            // Mark the clicked player as selected
            playerItem.classList.add('selected');
            selectedPlayerId = player.player_id;
        };

        // Add the player item to the container
        benchPlayersContainer.appendChild(playerItem);
    });

    // Show the modal
    modal.style.display = 'block';

    // Handle the confirm button click
    confirmButton.onclick = async () => {
        if (!selectedPlayerId) {
            showToast('Please select a player to drop.', 'info');
            return;
        }

        // Close the modal
        modal.style.display = 'none';

        // Send the sign and drop request to the backend
        await signPlayer(leagueId, token, playerIdToSign, selectedPlayerId);
    };

    // Handle the cancel button click to close the modal
    cancelButton.onclick = () => {
        modal.style.display = 'none';
    };

    // Handle the close button click
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    // Handle clicks outside the modal to close it
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// Function to send the sign and drop request
async function signPlayer(leagueId, token, playerIdToSign, playerIdToDrop) {
    try {
        const signResponse = await fetch(`/api/leagues/${leagueId}/sign-player`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerIdToSign: playerIdToSign,
                playerIdToDrop: playerIdToDrop,
            }),
        });

        const signData = await signResponse.json();
        console.log('Sign Response:', signData);

        if (signResponse.ok && signData.success) {
            showToast('Player signed successfully!', 'success');
            // Refresh available players and team roster
            fetchAvailablePlayers(leagueId, token);
            fetchMyTeam(); // Refresh team data to update benchPlayers
        } else {
            let errorMessage = 'Failed to sign player.';
            
            // Check if the error is due to roster lock (403 Forbidden)
            if (signResponse.status === 403 && signData.message) {
                errorMessage = signData.message;
            }

            // Optionally, handle other specific error messages here

            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error signing player:', error);
        showToast(error.message || 'An error occurred while signing the player.', 'error');
    }
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
    // Add event listener to the users list (event delegation)
    document.getElementById('users-list').addEventListener('click', toggleTeamInfo);
    // Add event listener to the users list (event delegation)
    document.getElementById('users-list').addEventListener('click', fetchAndShowTeamModal);
    // Add an event listener for closing the modal
    document.getElementById('teamModal').addEventListener('hidden.bs.modal', closeModal);


    // fetch schedule
    await fetchLeagueSchedule(leagueId);

    // fetch the next opponent
    if (leagueId && token) {
        fetchNextOpponent(leagueId, token);
    } else {
        document.getElementById('opponent-name').textContent = 'League or authentication information missing.';
    }

    if (leagueId && token) {
        fetchLeagueStandings(leagueId, token);
    } else {
        console.error('League ID or token is missing.');
        document.getElementById('standings-list').innerHTML = '<li>Error loading standings.</li>';
    }

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

    startCountdown();
    fetchCurrentWeek().then(week => {
        currentWeek = week;
    });
});

