// Mock data (replace with actual data fetching in a real application)
const leagueData = {
    name: "Super Esports League",
    description: "The ultimate fantasy esports experience!",
    currentWeek: 3,
    nextEvent: new Date("2024-10-01T00:00:00"),
    members: ["User1", "User2", "User3", "User4"],
    standings: [
        { name: "User1", points: 120 },
        { name: "User2", points: 115 },
        { name: "User3", points: 100 },
        { name: "User4", points: 95 },
    ],
    rules: "1. Each team must have 1 fragger, 1 support, and 1 anchor. 2. Points are awarded based on player performance.",
};

const myTeam = [
    { name: "Player1", role: "Fragger", stats: { kills: 20, assists: 5 } },
    { name: "Player2", role: "Support", stats: { kills: 10, assists: 15 } },
    { name: "Player3", role: "Anchor", stats: { kills: 5, assists: 10 } },
];

// DOM Elements
const leagueName = document.getElementById('leagueName');
const leagueDescription = document.getElementById('leagueDescription');
const currentWeek = document.getElementById('currentWeek');
const timer = document.getElementById('timer');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const teamRoster = document.getElementById('teamRoster');
const leagueStandings = document.getElementById('leagueStandings');
const leagueMembers = document.getElementById('leagueMembers');
const leagueRules = document.getElementById('leagueRules');
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.querySelector('.close');

// Initialize the dashboard
function init() {
    updateLeagueInfo();
    updateTimer();
    updateTeamRoster();
    updateLeagueStandings();
    updateLeagueMembers();
    updateLeagueRules();
    setInterval(updateTimer, 1000);
}

// Update league information
function updateLeagueInfo() {
    leagueName.textContent = leagueData.name;
    leagueDescription.textContent = leagueData.description;
    currentWeek.textContent = `Current Week: ${leagueData.currentWeek}`;
}

// Update timer
function updateTimer() {
    const now = new Date();
    const timeDiff = leagueData.nextEvent - now;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    timer.textContent = `Next event in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Update team roster
function updateTeamRoster() {
    teamRoster.innerHTML = myTeam.map(player => `
        <div>
            <h3>${player.name}</h3>
            <p>Role: ${player.role}</p>
            <p>Kills: ${player.stats.kills}, Assists: ${player.stats.assists}</p>
        </div>
    `).join('');
}

// Update league standings
function updateLeagueStandings() {
    leagueStandings.innerHTML = `
        <h2>League Standings</h2>
        ${leagueData.standings.map((user, index) => `
            <div>${index + 1}. ${user.name} - ${user.points} points</div>
        `).join('')}
    `;
}

// Update league members
function updateLeagueMembers() {
    leagueMembers.innerHTML = `
        <h2>League Members</h2>
        ${leagueData.members.map(member => `<div>${member}</div>`).join('')}
    `;
}

// Update league rules
function updateLeagueRules() {
    leagueRules.innerHTML = `
        <h2>League Rules</h2>
        <p>${leagueData.rules}</p>
    `;
}

// Tab functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName) {
                content.classList.add('active');
            }
        });
    });
});

// Modal functionality
function showModal(message, buttons = []) {
    modalMessage.textContent = message;
    const modalButtons = document.getElementById('modalButtons');
    modalButtons.innerHTML = buttons.map(button => `
        <button id="${button.id}">${button.text}</button>
    `).join('');
    buttons.forEach(button => {
        document.getElementById(button.id).addEventListener('click', button.action);
    });
    modal.style.display = "block";
}

modalClose.addEventListener('click', () => {
    modal.style.display = "none";
});

window.addEventListener('click', (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
});

// Leave league functionality
document.getElementById('leaveLeague').addEventListener('click', () => {
    showModal("Are you sure you want to leave the league?", [
        {
            id: "confirmLeave",
            text: "Yes, leave",
            action: () => {
                // Add logic to leave the league here
                console.log("Leaving the league...");
                modal.style.display = "none";
            }
        },
        {
            id: "cancelLeave",
            text: "Cancel",
            action: () => {
                modal.style.display = "none";
            }
        }
    ]);
});

// Initialize the dashboard
init();