// Game state
let gameActive = false;
let currentInterval = null;
let currentAnswer = null;
let questionCount = 0;
let totalError = 0;
let intervalPool = [];
let remainingIntervals = [];
let totalQuestions = 0;
let startTime = null;
let timerInterval = null;
let waitingForNext = false;

// Settings
let jiEnabled = true;
let jiLimit = 20;
let jiAllowNegative = false;
let edoEnabled = false;
let edoList = [];
let edoAllowNegative = false;

// DOM elements
const settingsPanel = document.getElementById('settings-panel');
const gamePanel = document.getElementById('game-panel');
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const skipBtn = document.getElementById('skip-btn');
const endBtn = document.getElementById('end-btn');
const answerInput = document.getElementById('answer-input');
const intervalValue = document.getElementById('interval-value');
const feedback = document.getElementById('feedback');
const questionCountEl = document.getElementById('question-count');
const totalScoreEl = document.getElementById('total-score');
const avgScoreEl = document.getElementById('avg-score');
const timerEl = document.getElementById('timer');
const correctMarker = document.getElementById('correct-marker');
const userMarker = document.getElementById('user-marker');
const continuumTrack = document.querySelector('.continuum-track');
const continuum = document.querySelector('.continuum');

// Settings controls
const enableJi = document.getElementById('enable-ji');
const jiLimitInput = document.getElementById('ji-limit');
const jiSettings = document.getElementById('ji-settings');
const allowNegative = document.getElementById('allow-negative');
const jiModeRadios = document.querySelectorAll('input[name="ji-mode"]');
const jiGeneratedSettings = document.getElementById('ji-generated-settings');
const jiCustomSettings = document.getElementById('ji-custom-settings');
const customIntervalsInput = document.getElementById('custom-intervals');
const primeLimitInput = document.getElementById('prime-limit');
const primeExponentInput = document.getElementById('prime-exponent');
const jiLimitInput = document.getElementById('ji-limit');
const generateIntervalsBtn = document.getElementById('generate-intervals-btn');
const enableEdo = document.getElementById('enable-edo');
const edoListInput = document.getElementById('edo-list');
const edoSettings = document.getElementById('edo-settings');
const edoAllowNegativeInput = document.getElementById('edo-allow-negative');
const soundEnabledInput = document.getElementById('sound-enabled');
const roundsInput = document.getElementById('rounds');

// Audio context and sound settings
let audioContext = null;
let soundEnabled = true;
let numRounds = 1;

// Initialize audio context on first user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context initialized:', audioContext.state);
    }
    // Resume if suspended (required by some browsers)
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('Audio context resumed');
        });
    }
}

// Play sound based on accuracy
function playSound(accuracy) {
    console.log('playSound called:', accuracy, 'soundEnabled:', soundEnabled, 'audioContext:', audioContext);
    if (!soundEnabled || !audioContext) return;

    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    if (accuracy === 'excellent') {
        // Perfect - major chord arpeggio (C-E-G)
        const notes = [
            { freq: 523.25, start: 0, duration: 0.15 },    // C5
            { freq: 659.25, start: 0.08, duration: 0.15 },  // E5
            { freq: 783.99, start: 0.16, duration: 0.2 }    // G5
        ];

        notes.forEach(note => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.2, now + note.start);
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.duration);
        });
    } else if (accuracy === 'good') {
        // Good - single pleasant tone
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = 440; // A4
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.start(now);
        osc.stop(now + 0.25);
    } else {
        // Wrong - dissonant descending sound
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Event listeners for settings
enableJi.addEventListener('change', () => {
    jiSettings.style.display = enableJi.checked ? 'block' : 'none';
});

enableEdo.addEventListener('change', () => {
    edoSettings.style.display = enableEdo.checked ? 'block' : 'none';
});

// Generate intervals
generateIntervalsBtn.addEventListener('click', generateIntervals);

function generateIntervals() {
    const generatorMode = document.querySelector('input[name="generator-mode"]:checked').value;
    const primeLimit = parseInt(primeLimitInput.value) || 7;
    const maxExponent = parseInt(primeExponentInput.value) || 1;
    const limit = parseInt(jiLimitInput.value) || 20;

    const intervals = new Set();

    if (generatorMode === 'simple-limit') {
        // Generate all fractions with numerator and denominator less than limit
        for (let num = 1; num < limit; num++) {
            for (let den = 1; den < limit; den++) {
                if (gcd(num, den) === 1) { // Only reduced fractions
                    const cents = 1200 * Math.log2(num / den);
                    if (cents >= 0 && cents <= 1200) {
                        intervals.add(`${num}/${den}`);
                    }
                }
            }
        }
    } else {
        // Get all primes up to limit
        const primes = getPrimesUpTo(primeLimit).filter(p => p > 2); // Exclude 2

        if (generatorMode === 'primes-2x') {
            // Generate primes/2^x (primes only in numerator)
            for (const prime of primes) {
                for (let exp = 1; exp <= maxExponent; exp++) {
                    const numerator = Math.pow(prime, exp);
                    // Find appropriate power of 2 to keep within octave
                    for (let pow2 = 0; pow2 <= 10; pow2++) {
                        const denominator = Math.pow(2, pow2);
                        const ratio = numerator / denominator;
                        if (ratio >= 1 && ratio < 2) {
                            intervals.add(`${numerator}/${denominator}`);
                        }
                    }
                }
            }
        } else if (generatorMode === 'prime-ratios') {
            // Generate simple prime ratios (one prime over another different prime)
            for (let i = 0; i < primes.length; i++) {
                for (let j = 0; j < primes.length; j++) {
                    if (i === j) continue; // Skip same prime

                    for (let expNum = 1; expNum <= maxExponent; expNum++) {
                        for (let expDen = 1; expDen <= maxExponent; expDen++) {
                            const numerator = Math.pow(primes[i], expNum);
                            const denominator = Math.pow(primes[j], expDen);

                            // Normalize to within octave
                            let num = numerator;
                            let den = denominator;

                            while (num / den >= 2) {
                                den *= 2;
                            }
                            while (num / den < 1) {
                                num *= 2;
                            }

                            // Reduce fraction
                            const g = gcd(num, den);
                            num /= g;
                            den /= g;

                            intervals.add(`${num}/${den}`);
                        }
                    }
                }
            }
        } else if (generatorMode === 'products') {
            // Generate all combinations (n-limit JI with composite numbers)
            generatePrimeCombinations(primes, maxExponent, intervals);
        }
    }

    // Convert set to sorted array and update textarea
    const intervalArray = Array.from(intervals).sort((a, b) => {
        const [an, ad] = a.split('/').map(Number);
        const [bn, bd] = b.split('/').map(Number);
        return (an / ad) - (bn / bd);
    });

    console.log(`Generated ${intervalArray.length} intervals`);

    if (intervalArray.length === 0) {
        alert('No intervals generated. Try adjusting your settings.');
        return;
    }

    customIntervalsInput.value = intervalArray.join('\n');
}

function getPrimesUpTo(limit) {
    const primes = [];
    for (let n = 2; n <= limit; n++) {
        let isPrime = true;
        for (let i = 2; i <= Math.sqrt(n); i++) {
            if (n % i === 0) {
                isPrime = false;
                break;
            }
        }
        if (isPrime) primes.push(n);
    }
    return primes;
}

function generatePrimeCombinations(primes, maxExponent, intervals) {
    // Generate all combinations of prime exponents
    const numPrimes = primes.length;

    // Generate exponent combinations (including negative exponents for denominator)
    function generateExponents(primeIndex, currentExponents) {
        if (primeIndex === numPrimes) {
            // Calculate the fraction from exponents
            const fraction = exponentsToFraction(primes, currentExponents);
            if (fraction) {
                intervals.add(fraction);
            }
            return;
        }

        // Try each exponent value (including negative for denominator)
        for (let exp = -maxExponent; exp <= maxExponent; exp++) {
            currentExponents[primeIndex] = exp;
            generateExponents(primeIndex + 1, currentExponents);
        }
    }

    generateExponents(0, new Array(numPrimes).fill(0));
}

function exponentsToFraction(primes, exponents) {
    let numerator = 1;
    let denominator = 1;

    for (let i = 0; i < primes.length; i++) {
        const prime = primes[i];
        const exp = exponents[i];

        if (exp > 0) {
            numerator *= Math.pow(prime, exp);
        } else if (exp < 0) {
            denominator *= Math.pow(prime, -exp);
        }
    }

    // Normalize to within one octave (1 to 2)
    const ratio = numerator / denominator;
    if (ratio === 1) return null; // Skip unison

    // Adjust by powers of 2 to get within octave
    let adjustedNum = numerator;
    let adjustedDen = denominator;

    while (adjustedNum / adjustedDen >= 2) {
        adjustedDen *= 2;
    }
    while (adjustedNum / adjustedDen < 1) {
        adjustedNum *= 2;
    }

    // Reduce fraction
    const g = gcd(adjustedNum, adjustedDen);
    adjustedNum /= g;
    adjustedDen /= g;

    return `${adjustedNum}/${adjustedDen}`;
}

// Start game
startBtn.addEventListener('click', startGame);

// Click on continuum to enter value
continuum.addEventListener('click', (e) => {
    if (!gameActive || waitingForNext) return;

    const rect = continuum.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const cents = Math.round(percent * 1200 * 100) / 100; // Round to 2 decimals

    answerInput.value = cents.toFixed(2);
    answerInput.focus();
});

// Submit answer / Next question
submitBtn.addEventListener('click', handleSubmitOrNext);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSubmitOrNext();
    }
});

function handleSubmitOrNext() {
    if (waitingForNext) {
        nextQuestion();
    } else {
        submitAnswer();
    }
}

// Skip question
skipBtn.addEventListener('click', () => {
    if (waitingForNext) {
        nextQuestion();
        return;
    }

    feedback.textContent = `Skipped. The answer was ${currentAnswer.toFixed(2)}¢`;
    feedback.className = 'feedback';
    feedback.style.background = '#fff3cd';
    feedback.style.color = '#856404';
    feedback.style.border = '2px solid #ffeaa7';

    // Show correct marker only
    const correctClamped = Math.max(0, Math.min(1200, currentAnswer));
    const correctPercent = (correctClamped / 1200) * 100;
    correctMarker.style.left = `${correctPercent}%`;
    correctMarker.classList.add('visible');

    // Wait for user to press Enter/Submit for next question
    waitingForNext = true;
    submitBtn.textContent = 'Next (Enter)';
    answerInput.value = '';
    answerInput.focus();

    // Pause timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
});

// End game
endBtn.addEventListener('click', endGame);

function startGame() {
    // Initialize audio on first interaction
    initAudio();

    // Read settings
    jiEnabled = enableJi.checked;
    jiLimit = parseInt(jiLimitInput.value) || 20;
    jiAllowNegative = allowNegative.checked;
    edoEnabled = enableEdo.checked;
    edoAllowNegative = edoAllowNegativeInput.checked;
    soundEnabled = soundEnabledInput.checked;
    numRounds = parseInt(roundsInput.value) || 1;

    if (edoEnabled) {
        const edoInput = edoListInput.value.trim();
        edoList = edoInput.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
    }

    // Validate settings
    if (!jiEnabled && !edoEnabled) {
        alert('Please enable at least one game mode (JI or EDO)');
        return;
    }

    if (edoEnabled && edoList.length === 0) {
        alert('Please enter valid EDO values (e.g., 12,17,24)');
        return;
    }

    // Initialize game state
    gameActive = true;
    questionCount = 0;
    totalError = 0;
    intervalPool = [];

    // Build interval pool
    if (jiEnabled) {
        buildCustomJIIntervals();
    }

    if (edoEnabled) {
        buildEDOIntervals();
    }

    // Check if we have any intervals
    if (intervalPool.length === 0) {
        alert('No intervals to practice! Please configure at least one interval source.');
        gamePanel.style.display = 'none';
        settingsPanel.style.display = 'block';
        return;
    }

    // Shuffle and multiply intervals by number of rounds
    shuffleArray(intervalPool);

    // Create the full pool with numRounds copies of each interval
    remainingIntervals = [];
    for (let round = 0; round < numRounds; round++) {
        const roundCopy = [...intervalPool];
        shuffleArray(roundCopy);
        remainingIntervals.push(...roundCopy);
    }

    totalQuestions = remainingIntervals.length;

    // Start timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    // Switch panels
    settingsPanel.style.display = 'none';
    gamePanel.style.display = 'block';

    // Start first question
    nextQuestion();
}

function buildJIIntervals() {
    // Generate all JI intervals within limit (within one octave: 0-1200¢)
    for (let num = 1; num < jiLimit; num++) {
        for (let den = 1; den < jiLimit; den++) {
            if (gcd(num, den) === 1) { // Only reduced fractions
                const cents = 1200 * Math.log2(num / den);

                // Only include if within 0-1200¢ range (or allow negative if enabled)
                if (jiAllowNegative || (cents >= 0 && cents <= 1200)) {
                    intervalPool.push({
                        type: 'JI',
                        numerator: num,
                        denominator: den,
                        display: `${num}/${den}`
                    });
                }
            }
        }
    }
}

function buildCustomJIIntervals() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) {
        // Don't alert here - let the main validation handle it
        return;
    }

    const lines = customText.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Parse fraction (e.g., "3/2" or "5/4")
        const match = line.match(/^(\d+)\/(\d+)$/);
        if (!match) {
            console.warn(`Skipping invalid interval: ${line}`);
            continue;
        }

        const num = parseInt(match[1]);
        const den = parseInt(match[2]);

        if (den === 0) {
            console.warn(`Skipping invalid interval (division by zero): ${line}`);
            continue;
        }

        intervalPool.push({
            type: 'JI',
            numerator: num,
            denominator: den,
            display: `${num}/${den}`
        });
    }
}

function buildEDOIntervals() {
    // Generate EDO intervals for each selected EDO
    edoList.forEach(edo => {
        const startStep = edoAllowNegative ? -edo + 1 : 1;
        const endStep = edoAllowNegative ? edo - 1 : edo - 1;

        for (let step = startStep; step <= endStep; step++) {
            if (step === 0 || step === edo || step === -edo) continue; // Skip trivial intervals

            intervalPool.push({
                type: 'EDO',
                edo: edo,
                step: step,
                display: `${step}\\${edo}`
            });
        }
    });
}

function gcd(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function updateTimer() {
    if (!gameActive) return;
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((elapsed % 1000) / 10);
    timerEl.textContent = `${minutes}:${String(remainingSeconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

function nextQuestion() {
    // Check if game is complete
    if (remainingIntervals.length === 0) {
        endGame();
        return;
    }

    // Pick and remove interval from pool (each appears once)
    const randomIndex = Math.floor(Math.random() * remainingIntervals.length);
    currentInterval = remainingIntervals.splice(randomIndex, 1)[0];

    // Calculate answer
    if (currentInterval.type === 'JI') {
        currentAnswer = 1200 * Math.log2(currentInterval.numerator / currentInterval.denominator);
    } else { // EDO
        currentAnswer = (currentInterval.step / currentInterval.edo) * 1200;
    }

    // Display interval
    intervalValue.textContent = currentInterval.display;
    answerInput.value = '';
    answerInput.focus();
    feedback.textContent = '';
    feedback.className = 'feedback';

    // Hide markers for new question
    correctMarker.classList.remove('visible');
    userMarker.classList.remove('visible');

    // Reset waiting state and button
    waitingForNext = false;
    submitBtn.textContent = 'Submit';

    // Resume timer
    if (!timerInterval) {
        timerInterval = setInterval(updateTimer, 100);
    }
}

function submitAnswer() {
    if (!gameActive) return;

    const userAnswer = parseFloat(answerInput.value);

    if (isNaN(userAnswer)) {
        alert('Please enter a valid number');
        return;
    }

    // Calculate error
    const error = Math.abs(userAnswer - currentAnswer);
    totalError += error;
    questionCount++;

    // Update score display
    questionCountEl.textContent = questionCount;
    totalScoreEl.textContent = totalError.toFixed(2);
    avgScoreEl.textContent = (totalError / questionCount).toFixed(2);

    // Update continuum markers
    updateContinuumMarkers(currentAnswer, userAnswer);

    // Show feedback and play sound
    feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;

    if (error < 1) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Excellent! Off by only ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
    } else if (error < 5) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Great! Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
    } else if (error < 10) {
        // Light green/yellow (lime-ish)
        feedback.className = 'feedback good';
        feedback.textContent = `Good! Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#e7f4d3';
        feedback.style.color = '#5a7a2c';
        feedback.style.border = '2px solid #c4db9b';
        playSound('excellent');
    } else if (error < 25) {
        // Yellow
        feedback.className = 'feedback medium';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#fff3cd';
        feedback.style.color = '#856404';
        feedback.style.border = '2px solid #ffeaa7';
        playSound('good');
    } else if (error < 40) {
        // Orange
        feedback.className = 'feedback poor';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#ffe5cc';
        feedback.style.color = '#cc5500';
        feedback.style.border = '2px solid #ffb366';
        playSound('good');
    } else {
        // Red
        feedback.className = 'feedback incorrect';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('wrong');
    }

    // Wait for user to press Enter/Submit for next question
    waitingForNext = true;
    submitBtn.textContent = 'Next (Enter)';
    answerInput.value = '';
    answerInput.focus();

    // Pause timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateContinuumMarkers(correctCents, userCents) {
    // Clamp values to 0-1200 range for display
    const correctClamped = Math.max(0, Math.min(1200, correctCents));
    const userClamped = Math.max(0, Math.min(1200, userCents));

    // Calculate percentages
    const correctPercent = (correctClamped / 1200) * 100;
    const userPercent = (userClamped / 1200) * 100;

    // Position markers
    correctMarker.style.left = `${correctPercent}%`;
    userMarker.style.left = `${userPercent}%`;

    // Show markers
    correctMarker.classList.add('visible');
    userMarker.classList.add('visible');
}

function endGame() {
    gameActive = false;

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const elapsed = Date.now() - startTime;
    const seconds = (elapsed / 1000).toFixed(2);

    let message = 'Game Over!\n\n';
    message += `Time: ${seconds}s\n`;
    message += `Questions answered: ${questionCount}\n`;
    message += `Total error: ${totalError.toFixed(2)}¢\n`;
    if (questionCount > 0) {
        message += `Average error: ${(totalError / questionCount).toFixed(2)}¢`;
    }

    alert(message);

    // Return to settings
    gamePanel.style.display = 'none';
    settingsPanel.style.display = 'block';
}
