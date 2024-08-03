document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for league-dashboard.js');
    const token = localStorage.getItem('token')
    console.log('User details fetched:', token)

    // Function to show a modal with a message
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

    // Function to decode JWT and get user ID
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

    // #region Get League Info
    // Function to extract league ID from URL
    function getLeagueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('leagueId');
    }

    const leagueId = getLeagueIdFromUrl(); // Extract league ID from URL

    console.log('Full URL:', window.location.href); // Log the full URL for debugging
    console.log('Extracted League ID:', leagueId); // Log the leagueId for debugging

    // Function to fetch league details
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

    // Function to fetch league users
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

    // Ensure leagueId is not null and fetch details and users
    if (leagueId) {
        await fetchLeagueDetails(leagueId);
        await fetchLeagueUsers(leagueId);
    } else {
        console.error('No league ID found in URL');
        document.querySelector('#league-info').innerHTML = '<p>No league ID provided.</p>';
        document.querySelector('#users-list').innerHTML = '<li class="list-group-item">No league ID provided.</li>';
    }
    // #endregion

    // #region Tabs
    window.openTab = (event, tabName) => {
        // Get all elements with class="tab-content" and hide them
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));

        // Get all elements with class="tab" and remove the class "active"
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));

        // Show the current tab, and add an "active" class to the button that opened the tab
        document.getElementById(tabName).classList.add('active');
        event.currentTarget.classList.add('active');
    }
    // #endregion

    // #region Create Team
    const createTeamBtn = document.getElementById('create-team-btn');
    const teamCreationForm = document.getElementById('team-creation-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const teamForm = document.getElementById('team-form');

    if (createTeamBtn && teamCreationForm && cancelBtn && teamForm) {
        // Show the team creation form when the button is clicked
        createTeamBtn.addEventListener('click', () => {
            teamCreationForm.style.display = 'block';
        });

        // Hide the form when the cancel button is clicked
        cancelBtn.addEventListener('click', () => {
            teamCreationForm.style.display = 'none';
        });

        // Handle form submission
        teamForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            const teamName = document.getElementById('team-name').value;
            const leagueId = getLeagueIdFromUrl(); // Ensure this function works correctly
            const token = localStorage.getItem('token'); // Get JWT token from local storage
            const userId = getUserIdFromToken(token); // Extract user ID from token

            if (!userId) {
                alert('Unable to extract user ID from token.');
                return;
            }

            console.log('Final user ID:', userId);

            try {
                const response = await fetch('/api/draft/create-team', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ team_name: teamName, league_id: leagueId, user_id: userId })
                });

                const result = await response.json();

                if (result.success) {
                    alert('Team created successfully!');
                    teamCreationForm.style.display = 'none'; // Hide the form
                    // Optionally, reload or update the UI
                } else {
                    alert(result.message);
                }
            } catch (error) {
                console.error('Error creating team:', error);
                alert('Failed to create team');
            }
        });
    }
    // #endregion

    // #region Leave League
    // Function to show the confirmation modal
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

    // Event listener for the "Leave League" button
    const leaveLeagueBtn = document.getElementById('leave-league-btn');
    if (leaveLeagueBtn) {
        leaveLeagueBtn.addEventListener('click', showConfirmLeaveModal);
    }
    // #endregion

    // #region Enter Draft
    // Open Draft
    // Function to open the draft
    function openDraft() {
        const leagueId = getLeagueIdFromUrl();

        if (!leagueId) {
            console.error('No league ID found for draft');
            return;
        }

        window.location.href = `draft.html?leagueId=${leagueId}`;
        removeDraftButton();
    }

    // Function to remove the draft button
    function removeDraftButton() {
        const draftButton = document.getElementById('draft-button');
        if (draftButton) {
            draftButton.style.display = 'none';
        }
    }

    // Attach event listener to the draft button
    const draftButton = document.getElementById('draft-button');
    if (draftButton) {
        draftButton.addEventListener('click', openDraft);
    }
    // #endregion
});