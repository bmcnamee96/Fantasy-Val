function createBalancedSchedule(users, weeks, maxRetries = 1000) {
    let matchupRepeat;
    if (users.length === 4) {
        matchupRepeat = 4; // 4 times for 4 users
    } else if (users.length === 5) {
        matchupRepeat = 3; // 3 times for 5 users
    } else {
        matchupRepeat = 2; // 2 times for 6, 7, and 8 users
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const schedule = Array.from({ length: weeks }, () => []);
            const matchups = [];

            for (let i = 0; i < users.length; i++) {
                for (let j = i + 1; j < users.length; j++) {
                    matchups.push([users[i], users[j]]);
                }
            }

            const allGames = Array.from({ length: matchupRepeat }, () => matchups).flat();
            shuffleArray(allGames);

            function canPlaceGame(weekGames, game) {
                const [player1, player2] = game;
                const playerGames = weekGames.filter(
                    match => match.includes(player1) || match.includes(player2)
                );
                return playerGames.length < 2 && !weekGames.some(match => match[0] === player1 && match[1] === player2);
            }

            for (const game of allGames) {
                let placed = false;
                const weekOrder = shuffleArray([...Array(weeks).keys()]);

                for (const week of weekOrder) {
                    if (schedule[week].length === 0 && canPlaceGame(schedule[week], game)) {
                        schedule[week].push(game);
                        placed = true;
                        break;
                    }
                }

                if (!placed) {
                    for (const week of weekOrder) {
                        if (canPlaceGame(schedule[week], game)) {
                            schedule[week].push(game);
                            placed = true;
                            break;
                        }
                    }
                }

                if (!placed) {
                    throw new Error("Unable to place game.");
                }
            }

            if (schedule.some(week => week.length < 3)) {
                throw new Error("A week with fewer than 2 games was found.");
            }

            if (schedule.some(week => week.length > 6)) {
                throw new Error("A week with fewer than 2 games was found.");
            }

            return schedule;
        } catch (error) {
            console.log(`Retrying... Attempt ${attempt + 1} of ${maxRetries}`);
        }
    }

    throw new Error("Unable to create a valid schedule.");
}

function analyzeSchedule(schedule, users) {
    const gamesCount = Object.fromEntries(users.map(user => [user, 0]));
    const matchupCount = Object.fromEntries(
        users.map(user => [user, Object.fromEntries(users.map(opponent => [opponent, 0]))])
    );

    schedule.forEach(week => {
        week.forEach(game => {
            const [user1, user2] = game;
            gamesCount[user1] += 1;
            gamesCount[user2] += 1;
            matchupCount[user1][user2] += 1;
            matchupCount[user2][user1] += 1;
        });
    });

    // Convert analysis to array format
    const gamesCountArray = Object.entries(gamesCount).map(([user, count]) => ({
        user,
        gamesPlayed: count
    }));

    const matchupCountArray = [];
    for (const [user1, opponents] of Object.entries(matchupCount)) {
        for (const [user2, count] of Object.entries(opponents)) {
            matchupCountArray.push({ user1, user2, games: count });
        }
    }

    return { gamesCountArray, matchupCountArray };
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Example Usage
const users = ["User1", "User2", "User3", "User4", "User5", "User6", "User7", "Users8"];
const weeks = 10;
const schedule = createBalancedSchedule(users, weeks);
const { gamesCountArray, matchupCountArray } = analyzeSchedule(schedule, users);

// Print schedule
console.log("Schedule:");
schedule.forEach((week, index) => {
    console.log(`Week ${index + 1}: ${week.map(game => `${game[0]} vs ${game[1]}`).join(", ")}`);
});

// Analysis Results in Array Format
console.log("\nTotal Games Played by Each User (Array Format):");
console.log(gamesCountArray);

console.log("\nGames Played Against Each Other (Array Format):");
console.log(matchupCountArray);
