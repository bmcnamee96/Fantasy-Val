// tScript.js
const myApp = {
    concatStrings: function (str1, str2) {
        return str1 + ' ' + str2;
    },
    addNumbers: function (num1, num2) {
        return num1 + num2;
    },
    multiplyNumbers: function (num1, num2) {
        return num1 * num2;
    }
};

// Attach the object to the window to make it globally accessible
window.myApp = myApp;

document.getElementById('button1').addEventListener('click', function() {
    alert('Button 1 clicked! This is from tScript.js');
});

// Array of target Fridays in UTC (adjust these dates as needed)
const targetFridaysUTC = [
    new Date(Date.UTC(2024, 8, 11, 19, 0, 0)), // Next Friday at 5 PM UTC
    new Date(Date.UTC(2024, 8, 11, 19, 10, 0)), // Following Friday at 5 PM UTC
    new Date(Date.UTC(2024, 8, 11, 19, 20, 0))  // And so on...
];
let currentTargetIndex = 0; // Start with the first target date (first Friday)
let currentWeek = 1; // Start with the first week

function updateCountdown() {
    const now = new Date(); // Get current local time
    const nowUTC = new Date(now.toISOString()); // Convert local time to UTC

    // Get the current target Friday and the following Sunday (end of game period)
    const targetFridayUTC = targetFridaysUTC[currentTargetIndex];
    const endOfGameUTC = new Date(targetFridayUTC.getTime() + 5 * 60 * 1000); // 5 minutes after the target

    if (nowUTC >= targetFridayUTC && nowUTC <= endOfGameUTC) {
        // If within the game period (Friday to Sunday), stop the timer
        document.getElementById('countdown').innerHTML = "Games in Progress!";
        return;
    } else if (nowUTC > endOfGameUTC) {
        // If after Sunday, move to the next Friday target
        currentTargetIndex++;
        if (currentTargetIndex >= targetFridaysUTC.length) {
            document.getElementById('countdown').innerHTML = "All games have ended!";
            clearInterval(timerInterval); // Stop the timer if no more dates
            return;
        } else {
            // Increment the week number when moving to the next target date
            currentWeek++;
            updateWeekDisplay(); // Update the displayed week number
            updateCountdown(); // Call recursively to start next countdown
            showDebugInfo();
            return;
        }
    } else {
        // Calculate the countdown time remaining until the next Friday
        const timeDifference = targetFridayUTC - nowUTC; // Difference in milliseconds

        // Convert the time difference to days, hours, minutes, and seconds
        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

        // Display the countdown
        document.getElementById('countdown').innerHTML =
            `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Function to update the displayed week number
function updateWeekDisplay() {
    document.getElementById('currentWeek').innerHTML = `Current Week: ${currentWeek}`;
}

// Update the countdown every second
const timerInterval = setInterval(updateCountdown, 1000);

// Initial call to display the timer and current week immediately
updateCountdown();
updateWeekDisplay();

function showDebugInfo() {
    const now = new Date(); // Current local time
    const nowUTC = new Date(now.toISOString()); // Current time in UTC
    const currentTargetDateUTC = targetFridaysUTC[currentTargetIndex]; // Get the current target date in UTC
    const endOfGameUTC = new Date(currentTargetDateUTC.getTime() + 5 * 60 * 1000); // 5 minutes after the target

    console.log("Current local time:", now);
    console.log("Current UTC time:", nowUTC);
    console.log("Current target date (UTC):", currentTargetDateUTC);
    console.log("End of Game Period (UTC):", endOfGameUTC);
    console.log("Current Week:", currentWeek);
}

