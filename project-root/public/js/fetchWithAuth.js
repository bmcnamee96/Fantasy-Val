// js/fetchWithAuth.js

// Function to refresh the access token
async function refreshAccessToken() {
    try {
        const response = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            credentials: 'include', // Send cookies with the request
        });

        if (response.ok) {
            const { accessToken } = await response.json();
            console.log('Access token refreshed successfully.');
            localStorage.setItem('token', accessToken); // Store the new token
            return accessToken;
        } else {
            console.error('Failed to refresh access token.');
            logout(); // Handle logout if token refresh fails
        }
    } catch (error) {
        console.error('Error refreshing access token:', error);
        logout(); // Handle logout on error
    }
}

// Function to check if a token is expired
function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1])); // Decode the JWT
        return payload.exp * 1000 < Date.now(); // Compare expiration with the current time
    } catch (error) {
        console.error('Error decoding token:', error);
        return true; // Treat as expired if decoding fails
    }
}

// Function to get a valid access token (refresh if necessary)
async function getValidAccessToken() {
    let token = localStorage.getItem('token');
    console.log(token);

    if (token && isTokenExpired(token)) {
        console.log('Access token expired, attempting to refresh...');
        token = await refreshAccessToken();
    }

    return token;
}

// Function to fetch API data with authentication
export async function fetchWithAuth(url, options = {}) {
    const token = await getValidAccessToken();

    if (!token) {
        console.error('No valid token available. Redirecting to login...');
        logout(); // Handle logout if no valid token
        return; // Stop further execution
    }

    const headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await fetch(url, { ...options, headers });

        // Handle 401 Unauthorized errors (invalid token scenario)
        if (response.status === 401) {
            console.warn('Access token invalid or expired. Logging out...');
            logout(); // Force logout if token is invalid
        }

        return response;
    } catch (error) {
        console.error('Network or server error during fetch:', error);
        throw error; // Re-throw the error for further handling
    }
}

// Logout function to clear tokens and redirect
function logout() {
    localStorage.removeItem('token'); // Clear stored token
    // window.location.href = '/index.html'; // Redirect to login page
}
