document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed');

    // Function to extract league ID from URL
    function getLeagueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('leagueId');
    }

    const token = localStorage.getItem('token'); // Get JWT token from local storage
    const leagueId = getLeagueIdFromUrl(); // Extract league ID from URL

    console.log('Extracted League ID:', leagueId); // Log the leagueId for debugging

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

    // Ensure leagueId is not null and fetch users
    if (leagueId) {
        fetchLeagueUsers(leagueId);
    } else {
        console.error('No league ID found in URL');
        document.querySelector('#users-list').innerHTML = '<li class="list-group-item">No league ID provided.</li>';
    }
});
