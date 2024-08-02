document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed for scripts.js');

    // #region sign-in / sign-up / fogot password / recover password
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

    // #region open/close
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
    // #endregion

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

    // #region update UI
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

    updateUI(); // Call updateUI() to set initial UI state based on localStorage
    // #endregion

    // Event listener for sign out button
    document.getElementById('signoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token'); // Remove token from localStorage
        localStorage.removeItem('username'); // Remove username from localStorage
        updateUI(); // Update UI to reflect logged out state
        window.location.href = '/index.html'; // Redirect to login page or home page
    });

    // #region Sign-in form submission
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
    // #endregion

    // #region Forgot Password functionality
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
    // #endregion

    // #region Recover Password
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
    // #endregion
    // #endregion

    // #region Dashboard
    // #region Create League
    function showModal(message) {
        const modal = document.getElementById('error-modal');
        const modalMessage = document.getElementById('modal-message');
        const closeButton = document.querySelector('.close-button');

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

    // Handle the create league form submission
    const createLeagueForm = document.getElementById('create-league-form');
    if (createLeagueForm) {
        createLeagueForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const leagueName = document.querySelector('input[name="league_name"]').value;
            const leaguePass = document.querySelector('input[name="league-pass"]').value;
            const description = document.querySelector('textarea[name="description"]').value;
            const token = localStorage.getItem('token'); // Get JWT token from local storage

            try {
                const response = await fetch('/api/leagues/create-league', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Include token in the Authorization header
                    },
                    body: JSON.stringify({ league_name: leagueName, league_pass: leaguePass, description: description })
                });

                const data = await response.json();

                if (response.status === 401) { // Unauthorized
                    showModal('You are not logged in!');
                } else if (data.success) {
                    showModal('League created successfully!');
                    createLeagueForm.reset();
                    fetchUserLeagues(); // Refresh the leagues list
                } else {
                    showModal('Failed to create league: ' + data.message);
                }
            } catch (error) {
                console.error('Error:', error);
                showModal('You are not logged in! Please log in and try again');
            }
        });
    }
    // #endregion

    // #region Join League
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

    // Handle the form submission
    const joinForm = document.getElementById('join-league-form');
    if (joinForm) {
        joinForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const leagueName = document.querySelector('input[name="join_league_name"]').value;
            const passcode = document.querySelector('input[name="passcode"]').value;
            const token = localStorage.getItem('token'); // Get JWT token from local storage

            try {
                const response = await fetch('/api/leagues/join-league', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Include token in the Authorization header
                    },
                    body: JSON.stringify({ league_name: leagueName, passcode: passcode })
                });

                const data = await response.json();

                if (response.status === 401) { // Unauthorized
                    showModal('You are not logged in!');
                } else if (response.status === 404) { // League not found
                    showModal('League not found');
                } else if (response.status === 400) { // Incorrect passcode or already a member
                    showModal(data.message);
                } else if (data.success) {
                    showModal('Successfully joined the league!', true);
                    joinForm.reset();
                    fetchUserLeagues(); // Refresh the leagues list if needed
                } else {
                    showModal('Failed to join league: ' + data.message);
                }
            } catch (error) {
                console.error('Error:', error);
                showModal('An error occurred while joining the league. Please try again.');
            }
        });
    }
    // #endregion

    // #region View Leagues
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
                leaguesList.innerHTML = '<li class="list-group-item">No leagues found.</li>';
            } else {
                leaguesList.innerHTML = leagues.map(league => `
                    <li class="list-group-item">
                        <a href="league-dashboard.html?leagueId=${league.league_id}" class="league-link">${league.league_name}</a>
                    </li>
                `).join('');
            }
        } catch (error) {
            console.error('Error fetching leagues:', error);
            const leaguesList = document.querySelector('#leagues-list');
            leaguesList.innerHTML = '<li class="list-group-item">You are not in a league! Join or create one now!</li>';
        }
    }

    // Call fetchUserLeagues when on the dashboard page
    if (window.location.pathname === '/my-dashboard.html') {
        fetchUserLeagues();
    }
    // #endregion
    // #endregion

    // Call updateUI on page load to handle existing login state
    updateUI();
});