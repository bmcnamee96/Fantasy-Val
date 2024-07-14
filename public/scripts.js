document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    // Fetch top players data on page load
    fetch('/api/top-players')
        .then(response => response.json())
        .then(data => {
            // Insert data into the players table
            const playersTable = document.getElementById('top-players-table').getElementsByTagName('tbody')[0];
            data.forEach(player => {
                const row = playersTable.insertRow();
                row.innerHTML = `
                    <td>${player.player_name}</td>
                    <td>${player.points}</td>
                `;
            });
        })
        .catch(error => console.error('Error fetching top players:', error));

    // Fetch worst players data on page load
    fetch('/api/worst-players')
        .then(response => response.json())
        .then(data => {
            // Insert data into the players table
            const playersTable = document.getElementById('worst-players-table').getElementsByTagName('tbody')[0];
            data.forEach(player => {
                const row = playersTable.insertRow();
                row.innerHTML = `
                    <td>${player.player_name}</td>
                    <td>${player.points}</td>
                `;
            });
        })
        .catch(error => console.error('Error fetching top players:', error));

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
            const response = await fetch('/api/signup', {
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

        // Hide navigation links
        navLinks.style.display = 'none';
    }
}

    // Event listener for sign out button
    document.getElementById('signoutBtn').addEventListener('click', () => {
        localStorage.removeItem('username'); // Remove username from localStorage
        updateUI(); // Update UI to reflect logged out state
    });

    // Sign-in form submission
    document.getElementById('signinForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('signinUsername').value;
        const password = document.getElementById('signinPassword').value;

        try {
            const response = await fetch('/api/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Sign in successful. Data:', data); // Log data received from server
                alert('Sign in successful');
                localStorage.setItem('username', data.username);
                updateUI();
                signinModal.style.display = 'none';
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

    const recoverPasswordBtn = document.getElementById('recoverPasswordBtn');
    console.log('recoverPasswordBtn:', recoverPasswordBtn);

    if (recoverPasswordBtn) {
        recoverPasswordBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('Recover Password button clicked');
            
            const recoveryEmail = document.getElementById('recoveryEmail').value;
            
            try {
                const response = await fetch('/api/recover-password', {
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

    // Call updateUI on page load to handle existing login state
    updateUI();
});
