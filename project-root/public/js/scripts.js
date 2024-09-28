// scripts.js

// Function to update the UI based on the login state
function updateUI() {
    const username = localStorage.getItem('username');
    const authLinks = document.getElementById('authLinks');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const signoutBtn = document.getElementById('signoutBtn');
    const usernameSpan = document.getElementById('usernameSpan'); // Ensure this is defined
    const navLinks = document.querySelector('.nav-links'); // Get the nav-links container

    if (username) {
        authLinks.style.display = 'none';
        welcomeMessage.style.display = 'flex';
        signoutBtn.style.display = 'block';
        usernameSpan.textContent = username; // Set username text

        // Show navigation links
        navLinks.style.display = 'flex';
    } else {
        authLinks.style.display = 'flex';
        welcomeMessage.style.display = 'none';
        signoutBtn.style.display = 'none';
    }
}

// Theme Toggle Functionality

// Function to update the theme icon
function updateThemeIcon() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return; // Exit if the button doesn't exist

    if (document.body.classList.contains('dark-theme')) {
        themeToggleBtn.textContent = '☀️'; // Sun icon for light mode
        themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
    } else {
        themeToggleBtn.textContent = '🌙'; // Moon icon for dark mode
        themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
    }
}

// On page load, set the theme based on saved preference
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    updateThemeIcon();
}

// Function to set up theme toggle event listener
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return; // Exit if the button doesn't exist

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        updateThemeIcon();
        // Save the user's preference in localStorage
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
}

// Join League
function showModal(message, isSuccess = false) {
    const modal = document.getElementById('error-modal');
    const modalMessage = document.getElementById('modal-message');
    const closeButton = document.querySelector('.close-button');
    
    // Set message and style based on success or error
    modalMessage.textContent = message;
    modal.style.display = 'block';
    
    if (isSuccess) {
        modal.classList.remove('error');
        modal.classList.add('success');
    } else {
        modal.classList.remove('success');
        modal.classList.add('error');
    }

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

// Function to fetch and display user's leagues on dashboard page
async function fetchUserLeagues() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }
        console.log('Token:', token);

        const response = await fetch('/api/leagues/user-leagues', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // Ensure the token is valid
            }
        });

        console.log('Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text(); // Get error response text
            console.error('Server response:', errorText); // Log server response
            throw new Error(errorText);
        }

        const leagues = await response.json();
        console.log('Leagues fetched:', leagues); // Log fetched leagues

        const leaguesList = document.querySelector('#leagues-list');
        leaguesList.innerHTML = ''; // Clear existing content

        if (leagues.length === 0) {
            leaguesList.innerHTML = '<p>You are not in any leagues. Join or create one now!</p>';
        } else {
            leagues.forEach(league => {
                const leagueCard = document.createElement('div');
                leagueCard.className = 'card mb-3';

                leagueCard.innerHTML = `
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="card-title mb-1">${league.league_name}</h5>
                            <p class="card-text mb-0">${league.description || 'No description available.'}</p>
                        </div>
                        <button class="btn btn-primary" onclick="location.href='league-dashboard.html?leagueId=${league.league_id}'">View League</button>
                    </div>
                `;

                leaguesList.appendChild(leagueCard);
            });
        }
    } catch (error) {
        console.error('Error fetching leagues:', error);
        const leaguesList = document.querySelector('#leagues-list');
        leaguesList.innerHTML = '<p>Error loading leagues. Please try again later.</p>';
    }
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

async function fetchLeagueIdFromName(leagueName) {
    try {
        // Check if leagueName is provided
        if (!leagueName) {
            throw new Error('League name is required');
        }
        const token = localStorage.getItem('token');

        // Make a request to the API endpoint to get the league ID
        const response = await fetch(`/api/leagues/get-league-id?leagueName=${encodeURIComponent(leagueName)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // Ensure the token is valid,
            },
        });

        // Check if the response is OK
        if (!response.ok) {
            throw new Error('Failed to fetch league ID');
        }

        // Parse the JSON response
        const data = await response.json();

        // Check if the league ID is provided in the response
        if (!data.league_id) {
            throw new Error('League not found');
        }

        const leagueId = data.league_id;

        // Return the league ID
        console.log(leagueId);
        return leagueId;
    } catch (error) {
        console.error('Error fetching league ID:', error);
        throw error; // Rethrow the error to be handled by the caller
    }
}

// Function to create a team
async function createTeam(leagueId, teamName) {
    const token = localStorage.getItem('token');
    console.log('Token', token);
    console.log('teamName', teamName);
    const userId = getUserIdFromToken(token);
    console.log('userId', userId);
    console.log('leagueId', leagueId);

    if (!token || !userId || !teamName || !leagueId) {
        throw new Error('Team name, league ID, and user ID are required');
    }

    try {
        const response = await fetch('/api/leagues/create-team', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ team_name: teamName, league_id: leagueId, user_id: userId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to create team');
        }

        showModal('League created successfully!', true);
        return data;
    } catch (error) {
        console.error('Error creating team:', error);
        showModal('Failed to create team: ' + error.message);
        throw error;
    }
}

// Function to create a league
async function createLeague() {
    const leagueName = document.querySelector('input[name="league_name"]').value;
    const leaguePass = document.querySelector('input[name="league-pass"]').value;
    const description = document.querySelector('textarea[name="description"]').value;
    const teamName = document.querySelector('input[name="team_name"]').value;

    try {
        const token = localStorage.getItem('token'); // Get JWT token from local storage

        const response = await fetch('/api/leagues/create-league', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Include token in the Authorization header
            },
            body: JSON.stringify({ 
                league_name: leagueName, 
                league_pass: leaguePass, 
                description: description,
                team_name: teamName 
            })
        });

        const data = await response.json();

        if (response.status === 401) { // Unauthorized
            showModal('You are not logged in!');
        } else if (data.success) {
            document.getElementById('create-league-form').reset(); // Reset the form
            showModal('League and team created successfully!'); // Show success modal
        } else {
            showModal('Failed to create league: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        showModal('You are not logged in! Please log in and try again');
    }
}

// Function to join a league
async function joinLeague() {
    const leagueName = document.querySelector('input[name="join_league_name"]').value;
    const passcode = document.querySelector('input[name="passcode"]').value;
    const teamName = document.querySelector('input[name="team_name"]').value;

    if (!teamName) {
        showModal('Please provide a team name.');
        return;
    }

    try {
        const token = localStorage.getItem('token'); // Get JWT token from local storage

        const response = await fetch('/api/leagues/join-league', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Include token in the Authorization header
            },
            body: JSON.stringify({ league_name: leagueName, passcode: passcode, team_name: teamName })
        });

        const data = await response.json();

        if (response.status === 401) { // Unauthorized
            showModal('You are not logged in!');
        } else if (response.status === 404) { // League not found
            showModal('League not found');
        } else if (response.status === 400) { // Incorrect passcode or other issues
            showModal(data.message);
        } else if (data.success) {
            showModal('Successfully joined the league and created your team!', true);
            document.getElementById('join-league-form').reset();
        } else {
            showModal('Failed to join league: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        showModal('An error occurred while joining the league. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed for scripts.js');

    // Initialize theme
    initializeTheme();

    // Set up theme toggle event listener
    setupThemeToggle();

    // Get modals, buttons, and form elements
    const signupModal = document.getElementById("signupModal");
    const signinModal = document.getElementById("signinModal");
    const signupBtn = document.getElementById("signupBtn");
    const signinBtn = document.getElementById("signinBtn");
    const signupClose = document.getElementById("signupClose");
    const signinClose = document.getElementById("signinClose");

    console.log('signupModal:', signupModal);
    console.log('signinModal:', signinModal);
    console.log('signupBtn:', signupBtn);
    console.log('signinBtn:', signinBtn);
    console.log('signupClose:', signupClose);
    console.log('signinClose:', signinClose);

    // Show signup modal on click
    if (signupBtn) {
        signupBtn.onclick = () => signupModal.style.display = "block";
    }

    // Show signin modal on click
    if (signinBtn) {
        signinBtn.onclick = () => signinModal.style.display = "block";
    }

    // Close modals on span (x) click
    if (signupClose) {
        signupClose.onclick = () => signupModal.style.display = "none";
    }

    if (signinClose) {
        signinClose.onclick = () => signinModal.style.display = "none";
    }

    // Close modals on window click outside modal
    window.onclick = (event) => {
        if (event.target == signupModal) signupModal.style.display = "none";
        if (event.target == signinModal) signinModal.style.display = "none";
    };

    // Sign-up form submission
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const email = document.getElementById('signupEmail').value;

        try {
            const response = await fetch('/api/users/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email }),
            });

            if (response.ok) {
                alert('User registered successfully');
                signupModal.style.display = 'none';
            } else {
                alert('Error registering user');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    updateUI(); // Call updateUI() to set initial UI state based on localStorage

    // Event listener for sign out button
    document.getElementById('signoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token'); // Remove token from localStorage
        localStorage.removeItem('username'); // Remove username from localStorage
        updateUI(); // Update UI to reflect logged out state
        window.location.href = '/index.html'; // Redirect to login page or home page
    });

    // Sign-in form submission
    document.getElementById('signinForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('signinUsername').value;
        const password = document.getElementById('signinPassword').value;

        try {
            const response = await fetch('/api/users/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Sign in successful. Data:', data); // Log data received from server
                localStorage.setItem('token', data.token); // Store the token in local storage
                localStorage.setItem('username', data.username);
                alert('Sign in successful');
                updateUI();
                signinModal.style.display = 'none';
                window.location.href = '/my-dashboard.html'; // Redirect to dashboard page
            } else {
                console.error('Sign in failed:', response.status, response.statusText);
                alert('Invalid username or password');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Forgot Password functionality
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const passwordRecoveryForm = document.getElementById('passwordRecoveryForm');

    console.log('forgotPasswordLink:', forgotPasswordLink);
    console.log('passwordRecoveryForm:', passwordRecoveryForm);

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Forgot Password link clicked');
            passwordRecoveryForm.style.display = 'block';
        });
    }

    // Recover Password
    const recoverPasswordBtn = document.getElementById('recoverPasswordBtn');
    console.log('recoverPasswordBtn:', recoverPasswordBtn);

    if (recoverPasswordBtn) {
        recoverPasswordBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('Recover Password button clicked');
            
            const recoveryEmail = document.getElementById('recoveryEmail').value;
            console.log('Recovery Email:', recoveryEmail); // Debugging statement

            try {
                const response = await fetch('/api/users/recover-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: recoveryEmail })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Password recovery initiated:', result.message);
                    // Optionally show a success message or redirect the user
                } else {
                    console.error('Failed to recover password:', response.status, response.statusText);
                    // Handle error response, e.g., show an error message to the user
                }
            } catch (error) {
                console.error('Error recovering password:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
    }

    // Event listener for clicking the close button in the password recovery form
    const passwordRecoveryClose = document.getElementById('passwordRecoveryClose');
    console.log('passwordRecoveryClose:', passwordRecoveryClose);

    if (passwordRecoveryClose) {
        passwordRecoveryClose.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Close button clicked');
            passwordRecoveryForm.style.display = 'none'; // Hide the password recovery form
        });
    }

    // Handle the create league form submission
    const createLeagueForm = document.getElementById('create-league-form');
    if (createLeagueForm) {
        createLeagueForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            await createLeague(); // Call createLeague function
        });
    }

    // Handle the join league form submission
    const joinForm = document.getElementById('join-league-form');
    if (joinForm) {
        joinForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            await joinLeague(); // Call joinLeague function
        });
    }

    // Call fetchUserLeagues when on the dashboard page
    if (window.location.pathname === '/my-dashboard.html') {
        fetchUserLeagues();
    }

    // Call updateUI on page load to handle existing login state
    updateUI();
});