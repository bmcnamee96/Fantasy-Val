// scripts.js

import { fetchWithAuth } from './fetchWithAuth.js'; // Ensure correct path

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

// Function to update the UI based on the login state
function updateUI() {
    const username = localStorage.getItem('username');
    console.log('Stored username:', localStorage.getItem('username'));
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

function toggleMenu() {
    const navLinksContainer = document.querySelector(".nav-links-container");
    navLinksContainer.classList.toggle("show");
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

// Function to fetch and display user's leagues on the dashboard page
async function fetchUserLeagues() {
    try {
        const response = await fetchWithAuth('/api/leagues/user-leagues', {
            method: 'GET',
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

                // Add Bootstrap card class and inline width styling
                leagueCard.className = 'card mb-3';
                leagueCard.style.width = '75%'; // Set the width to 75% of parent container
                leagueCard.style.margin = '0 auto'; // Center the card horizontally

                // Truncate description to the first 50 characters and add "..."
                const truncatedDescription = league.description && league.description.length > 50
                    ? league.description.substring(0, 50) + '...'
                    : league.description || 'No description available.';

                leagueCard.innerHTML = `
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="card-title mb-1">${league.league_name}</h5>
                            <p class="card-text mb-0">${truncatedDescription}</p>
                        </div>
                        <button class="btn btn-primary" 
                            onclick="location.href='league-dashboard.html?leagueId=${league.league_id}'">
                            View League
                        </button>
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

// Function to create a league
async function createLeague() {
    const leagueName = document.querySelector('input[name="league_name"]').value;
    const leaguePass = document.querySelector('input[name="league-pass"]').value;
    const description = document.querySelector('textarea[name="description"]').value;
    const teamName = document.querySelector('input[name="team_name"]').value;

    try {
        const response = await fetchWithAuth('/api/leagues/create-league', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        const response = await fetchWithAuth('/api/leagues/join-league', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            const response = await fetchWithAuth('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email }),
            });

            if (response.ok) {
                showToast('User registered successfully', 'success');
                signupModal.style.display = 'none';
            } else {
                showToast('Error registering user', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    updateUI(); // Call updateUI() to set initial UI state based on localStorage

    // Event listener for sign out button
    document.getElementById('signoutBtn').addEventListener('click', async () => {
        try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' }); // Clear refresh token cookie
        } catch (error) {
            console.error('Logout failed:', error);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        updateUI();
        window.location.href = '/index.html';
    });
   
    // Sign-in form submission
    document.getElementById('signinForm').addEventListener('submit', async (e) => {
        e.preventDefault();
    
        const username = document.getElementById('signinUsername').value;
        const password = document.getElementById('signinPassword').value;
    
        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
    
            if (!response.ok) {
                console.error('Failed to log in:', await response.text());
                showToast('Invalid username or password', 'error');
                return;
            }
    
            const { accessToken, username: storedUsername } = await response.json();
    
            // Store the access token and username in localStorage
            localStorage.setItem('token', accessToken);
            localStorage.setItem('username', storedUsername);

            console.log('Access token and username stored:', accessToken, storedUsername);
    
            showToast('Login successful!', 'success');
            updateUI();
    
            // Redirect to the dashboard or another page
            window.location.href = '/my-dashboard.html';
        } catch (error) {
            console.error('Login error:', error);
            showToast('Login failed. Please try again.', 'error');
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
                const response = await fetchWithAuth('/api/auth/recover-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: recoveryEmail })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Password recovery initiated:', result.message);
                    showToast('Password recovery initiated. Please check your email.', 'success');
                    // Optionally show a success message or redirect the user
                } else {
                    console.error('Failed to recover password:', response.status, response.statusText);
                    const errorData = await response.json();
                    showToast('Failed to recover password: ' + (errorData.message || 'Unknown error'), 'error');
                    // Handle error response, e.g., show an error message to the user
                }
            } catch (error) {
                console.error('Error recovering password:', error);
                showToast('Internal server error', 'error');
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

    // feedback 

    document.getElementById('suggestionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const suggestion = document.getElementById('suggestion').value;
        const category = document.getElementById('category').value;
        const rating = document.querySelector('input[name="rating"]:checked')?.value;
        const email = document.getElementById('email').value;
        
        // In a real application, you would send this data to a server
        console.log('Suggestion:', suggestion);
        console.log('Category:', category);
        console.log('Rating:', rating);
        console.log('Email:', email);
        
        // Add to past suggestions (for demo purposes)
        const pastSuggestions = document.getElementById('pastSuggestions');
        const li = document.createElement('li');
        li.textContent = `${suggestion} (${category}) - Status: In Review`;
        pastSuggestions.appendChild(li);
        
        // Show acknowledgment
        document.getElementById('acknowledgment').style.display = 'block';
        
        // Clear form
        this.reset();
    });

    // Handle rating feedback
    const feedbackElement = document.getElementById('feedback');
    const ratingLabels = document.querySelectorAll('.rating label');

    function updateFeedback(rating) {
        const feedbackMessages = [
            "Very Poor",
            "Poor",
            "Good",
            "Very Good",
            "Excellent"
        ];
        feedbackElement.textContent = `${feedbackMessages[rating - 1]} (${rating} star${rating !== 1 ? 's' : ''})`;
    }

    document.querySelectorAll('input[name="rating"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFeedback(parseInt(e.target.value));
        });
    });

    ratingLabels.forEach(label => {
        label.addEventListener('mouseover', () => {
            const ratingValue = label.getAttribute('for').replace('star', '');
            updateFeedback(parseInt(ratingValue));
        });

        label.addEventListener('mouseout', () => {
            const checkedRating = document.querySelector('input[name="rating"]:checked');
            if (checkedRating) {
                updateFeedback(parseInt(checkedRating.value));
            } else {
                feedbackElement.textContent = '';
            }
        });
    });

    // Call updateUI on page load to handle existing login state
    updateUI();
});
