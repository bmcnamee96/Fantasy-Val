// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    // Fetch top players data on page load
    fetch('/api/top-players')
        .then(response => response.json())
        .then(data => {
            // Insert data into the players table
            const playersTable = document.getElementById('players-table').getElementsByTagName('tbody')[0];
            data.forEach(player => {
                const row = playersTable.insertRow();
                row.innerHTML = `
                    <td>${player.player_name}</td>
                    <td>${player.kills}</td>
                    <td>${player.deaths}</td>
                    <td>${player.assists}</td>
                    <td>${player.adr}</td>
                    <td>${player.fk}</td>
                    <td>${player.fd}</td>
                    <td>${player.clutches}</td>
                    <td>${player.aces}</td>
                    <td>${player.points}</td>
                `;
            });
        })
        .catch(error => console.error('Error fetching top players:', error));

    // Get modals, buttons, and form elements
    var signupModal = document.getElementById("signupModal");
    var signinModal = document.getElementById("signinModal");
    var signupBtn = document.getElementById("signupBtn");
    var signinBtn = document.getElementById("signinBtn");
    var signupClose = document.getElementById("signupClose");
    var signinClose = document.getElementById("signinClose");

    // Show signup modal on click
    signupBtn.onclick = () => signupModal.style.display = "block";

    // Show signin modal on click
    signinBtn.onclick = () => signinModal.style.display = "block";

    // Close modals on span (x) click
    signupClose.onclick = () => signupModal.style.display = "none";
    signinClose.onclick = () => signinModal.style.display = "none";

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
    
        if (username) {
            authLinks.style.display = 'none';
            welcomeMessage.style.display = 'flex';
            signoutBtn.style.display = 'block';
            usernameSpan.textContent = username; // Set username text
        } else {
            authLinks.style.display = 'flex';
            welcomeMessage.style.display = 'none';
            signoutBtn.style.display = 'none';
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

    // Call updateUI on page load to handle existing login state
    updateUI();
});
