// File: draft.js

// Variable declarations
let intervalId;
let draftOrder = [];
let MAX_TURNS = null;
let currentTurnIndex; // Initialize here
const draftInterval = 15000; // Interval time in milliseconds
let draftTimer = null;
let remainingTime = 0;
const TURN_DURATION = 15000;
let countdownTimer = null; // Timer reference for countdown
let userIdToUsername = {}; // Initialize the mapping
let connectedUserIds = [];

const token = localStorage.getItem('token');
const leagueId = getLeagueIdFromUrl();
const userId = getUserIdFromToken(token);

// Initialize Socket.IO
const socket = io(`http://localhost:8080`, {
    query: { userId, leagueId },
    transports: ['websocket']
});

// initialize DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed for draft.js');

    // make sure that the correct user is in the draft
    if (!token || !leagueId || !userId) {
        console.error('Missing required parameters.');
        return;
    }

    console.log('Token:', token);
    console.log('League ID:', leagueId);
    console.log('User ID:', userId);

    // determine who the league owner is
    let leagueOwnerId;
    try {
        const leagueResponse = await fetch(`/api/draft/leagues/${leagueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const league = await leagueResponse.json();
        leagueOwnerId = league.owner_id;
        console.log('League Owner ID:', leagueOwnerId);

        // if the user is the league owner, give them the startDraftButton
        if (userId === leagueOwnerId) {
            const startDraftButton = document.getElementById('startDraftButton');
            if (startDraftButton) {
                // only display the button to the league owner
                startDraftButton.style.display = 'block';
                console.log('Start Draft button displayed for league owner');
            } else {
                console.error('Start Draft button element not found');
            }
        } else {
            console.log('User is not the league owner');
        }
    } catch (error) {
        console.error('Error fetching league details:', error);
        return;
    }
});

// grab the leagueId from the url
function getLeagueIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('leagueId');
}

// return the userId from the token in local storage
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