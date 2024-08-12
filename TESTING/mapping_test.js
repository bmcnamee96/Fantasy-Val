// Global variable to store the user mapping
let userIdToUsernameMapping = {}; 

// mock data
const allUsers = [
    { user_id: 1, username: 'Alice', league: 1 },
    { user_id: 2, username: 'Bob', league: 1 },
    { user_id: 3, username: 'Charlie', league: 1 },
    { user_id: 4, username: 'David', league: 2 },
    { user_id: 5, username: 'Eva', league: 2 },
    { user_id: 6, username: 'Frank', league: 2 },
    { user_id: 7, username: 'Grace', league: 3 },
    { user_id: 8, username: 'Heidi', league: 3 },
    { user_id: 9, username: 'Ivan', league: 3 },
    { user_id: 10, username: 'Judy', league: 1 },
    { user_id: 11, username: 'Mallory', league: 2 },
    { user_id: 12, username: 'Niaj', league: 3 },
    { user_id: 13, username: 'Oscar', league: 1 },
    { user_id: 14, username: 'Peggy', league: 2 },
    { user_id: 15, username: 'Quincy', league: 3 }
];

async function fetchUserDetails(leagueId) {
    // Simulated function to fetch user details filtered by leagueId
    // Replace this with actual API logic
    console.log('fetchUserDetails')
    console.log(allUsers);
    console.log('Fetching user details for leagueId:', leagueId);
    return allUsers.filter(user => user.league === leagueId);
}

// Initialize User Mapping: 
// initializeUserMapping calls fetchUserDetails and then maps user IDs to usernames. 
// After setting the global userIdToUsernameMapping, it calls updateUserListUI to update the DOM.
async function initializeUserMapping(leagueId) {
    try {
        const users = await fetchUserDetails(leagueId);

        console.log('initializeUserMapping')

        // Map user IDs to usernames
        userIdToUsernameMapping = users.reduce((acc, user) => {
            acc[user.user_id] = user.username;
            return acc;
        }, {});

        console.log('Filtered User ID to Username Mapping:', userIdToUsernameMapping);

        // Update the DOM after the mapping is ready
        updateUserListUI(userIdToUsernameMapping);
    } catch (error) {
        console.error('Error initializing user mapping:', error);
    }
}

function updateUserListUI(mapping) {
    console.log('updateUserListUI')
    console.log('Received userIdToUsername mapping:', mapping);

    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
        console.error('Invalid userIdToUsername mapping:', mapping);
        return;
    }

    const userListElement = document.getElementById('user-list');
    if (userListElement) {
        const userListHTML = Object.values(mapping).map(username => {
            return `<li>${username || 'Unknown User'}</li>`;
        }).join('');
        userListElement.innerHTML = userListHTML;
    } else {
        console.error('User list element not found');
    }
}

// Example usage: Initialize the user mapping for league ID 4 and update the UI
const leagueId = 2;
initializeUserMapping(leagueId);
