// Game state
let gameActive = false;
let currentInterval = null;
let currentAnswer = null;
let questionCount = 0;
let totalError = 0;
let intervalPool = [];
let remainingIntervals = [];
let missedIntervals = [];
let totalQuestions = 0;
let startTime = null;
let timerInterval = null;
let waitingForNext = false;

// Settings
let jiLimit = 20;
let edoList = [];

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
const jiSettings = document.getElementById('ji-settings');
const jiModeRadios = document.querySelectorAll('input[name="ji-mode"]');
const jiCustomSettings = document.getElementById('ji-custom-settings');
const customIntervalsInput = document.getElementById('custom-intervals');
const primeLimitInput = document.getElementById('prime-limit');
const primeExponentInput = document.getElementById('prime-exponent');
const jiLimitInput = document.getElementById('ji-limit');
const complexityLimitInput = document.getElementById('complexity-limit');
const generateIntervalsBtn = document.getElementById('generate-intervals-btn');
const filterComplexBtn = document.getElementById('filter-complex-btn');
const filterRangeBtn = document.getElementById('filter-range-btn');
const centMinInput = document.getElementById('cent-min');
const centMaxInput = document.getElementById('cent-max');
const edoListInput = document.getElementById('edo-list');
const edoSettings = document.getElementById('edo-settings');
const edoAllIntervals = document.getElementById('edo-all-intervals');
const edoApproximations = document.getElementById('edo-approximations');
const edoUseApproximations = document.getElementById('edo-use-approximations');
const generateEdoIntervalsBtn = document.getElementById('generate-edo-intervals-btn');
const soundEnabledInput = document.getElementById('sound-enabled');
const playIntervalsInput = document.getElementById('play-intervals');
const roundsInput = document.getElementById('rounds');
const hideIntervalInput = document.getElementById('hide-interval');

// Audio context and sound settings
let audioContext = null;
let soundEnabled = true;
let playIntervals = true;
let hideInterval = false;
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

// Play interval audio
function playIntervalAudio(cents) {
    if (!playIntervals || !audioContext) return;

    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;
    const baseFreq = 220; // A3
    const release = 0.6; // Medium-high release

    // Calculate interval frequency
    const intervalFreq = baseFreq * Math.pow(2, cents / 1200);

    // Play root note
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    osc1.type = 'sawtooth';
    osc1.frequency.value = baseFreq;
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + release);

    osc1.start(now);
    osc1.stop(now + release);

    // Play interval note after 300ms
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    osc2.type = 'sawtooth';
    osc2.frequency.value = intervalFreq;
    gain2.gain.setValueAtTime(0.15, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + release);

    osc2.start(now + 0.3);
    osc2.stop(now + 0.3 + release);
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

// Event listeners for settings (removed enable checkboxes, so these listeners are no longer needed)

// Generate intervals
console.log('generateIntervalsBtn:', generateIntervalsBtn);
if (generateIntervalsBtn) {
    generateIntervalsBtn.addEventListener('click', generateIntervals);
} else {
    console.error('Generate intervals button not found!');
}

// Generate EDO intervals
if (generateEdoIntervalsBtn) {
    generateEdoIntervalsBtn.addEventListener('click', generateEdoIntervals);
} else {
    console.error('Generate EDO intervals button not found!');
}

// Clear intervals button
const clearIntervalsBtn = document.getElementById('clear-intervals-btn');
if (clearIntervalsBtn) {
    clearIntervalsBtn.addEventListener('click', () => {
        customIntervalsInput.value = '';
    });
}

// Filter complex intervals button
if (filterComplexBtn) {
    filterComplexBtn.addEventListener('click', filterComplexIntervals);
}

// Filter by cent range button
if (filterRangeBtn) {
    filterRangeBtn.addEventListener('click', filterByCentRange);
}

// Share intervals button
const shareIntervalsBtn = document.getElementById('share-intervals-btn');
if (shareIntervalsBtn) {
    shareIntervalsBtn.addEventListener('click', shareIntervals);
}

function filterComplexIntervals() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) return;

    const complexityLimit = parseInt(complexityLimitInput.value) || 100;
    const lines = customText.split('\n');
    const filtered = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Parse JI intervals (e.g., "3/2")
        const jiMatch = line.match(/^(\d+)\/(\d+)$/);
        if (jiMatch) {
            const num = parseInt(jiMatch[1]);
            const den = parseInt(jiMatch[2]);

            if ((num * den) <= complexityLimit) {
                filtered.push(line);
            }
            continue;
        }

        // Keep EDO intervals unchanged
        const edoMatch = line.match(/^(-?\d+)\\(\d+)$/);
        if (edoMatch) {
            filtered.push(line);
            continue;
        }

        // Keep unrecognized lines
        filtered.push(line);
    }

    customIntervalsInput.value = filtered.join('\n');
}

function filterByCentRange() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) return;

    const centMin = parseFloat(centMinInput.value) || 0;
    const centMax = parseFloat(centMaxInput.value) || 1200;
    const lines = customText.split('\n');
    const filtered = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        let cents = null;

        // Parse JI intervals (e.g., "3/2")
        const jiMatch = line.match(/^(\d+)\/(\d+)$/);
        if (jiMatch) {
            const num = parseInt(jiMatch[1]);
            const den = parseInt(jiMatch[2]);
            cents = 1200 * Math.log2(num / den);
        }

        // Parse EDO intervals (e.g., "7\12")
        const edoMatch = line.match(/^(-?\d+)\\(\d+)$/);
        if (edoMatch) {
            const step = parseInt(edoMatch[1]);
            const edo = parseInt(edoMatch[2]);
            cents = (step / edo) * 1200;
        }

        // Keep intervals within range
        if (cents !== null && cents >= centMin && cents <= centMax) {
            filtered.push(line);
        } else if (cents === null) {
            // Keep unrecognized lines
            filtered.push(line);
        }
    }

    customIntervalsInput.value = filtered.join('\n');
}

function shareIntervals() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) {
        alert('No intervals to share. Add some intervals first.');
        return;
    }

    // Gather all settings
    const settings = {
        intervals: customText,
        // JI Generator settings
        generatorMode: document.querySelector('input[name="generator-mode"]:checked')?.value,
        primeLimit: primeLimitInput.value,
        primeExponent: primeExponentInput.value,
        jiLimit: jiLimitInput.value,
        // EDO Generator settings
        edoList: edoListInput.value,
        edoAllIntervals: edoAllIntervals.checked,
        edoUseApproximations: edoUseApproximations.checked,
        edoApproximations: edoApproximations.value,
        // Filter settings
        complexityLimit: complexityLimitInput.value,
        centMin: centMinInput.value,
        centMax: centMaxInput.value,
        // Audio settings
        soundEnabled: soundEnabledInput.checked,
        playIntervals: playIntervalsInput.checked,
        // Game settings
        rounds: roundsInput.value,
        hideInterval: hideIntervalInput.checked
    };

    // Encode settings as base64 JSON
    const encoded = btoa(JSON.stringify(settings));

    // Create URL with settings parameter
    const url = new URL(window.location.href.split('?')[0]); // Remove existing params
    url.searchParams.set('s', encoded);

    // Copy to clipboard
    navigator.clipboard.writeText(url.toString()).then(() => {
        alert('URL copied to clipboard! Share this link to load all settings and intervals.');
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url.toString();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('URL copied to clipboard! Share this link to load all settings and intervals.');
    });
}

// Load intervals from URL on page load
function loadIntervalsFromURL() {
    const urlParams = new URLSearchParams(window.location.search);

    // Try new format first (all settings)
    const settingsEncoded = urlParams.get('s');
    if (settingsEncoded) {
        try {
            const settings = JSON.parse(atob(settingsEncoded));

            // Load intervals
            if (settings.intervals) {
                customIntervalsInput.value = settings.intervals;
            }

            // Load JI Generator settings
            if (settings.generatorMode) {
                const radio = document.querySelector(`input[name="generator-mode"][value="${settings.generatorMode}"]`);
                if (radio) radio.checked = true;
            }
            if (settings.primeLimit) primeLimitInput.value = settings.primeLimit;
            if (settings.primeExponent) primeExponentInput.value = settings.primeExponent;
            if (settings.jiLimit) jiLimitInput.value = settings.jiLimit;

            // Load EDO Generator settings
            if (settings.edoList !== undefined && settings.edoList !== null) {
                console.log('Setting edoList to:', settings.edoList);
                edoListInput.value = settings.edoList;
                console.log('edoListInput.value is now:', edoListInput.value);
            }
            if (settings.edoAllIntervals !== undefined) edoAllIntervals.checked = settings.edoAllIntervals;
            if (settings.edoUseApproximations !== undefined) edoUseApproximations.checked = settings.edoUseApproximations;
            if (settings.edoApproximations !== undefined && settings.edoApproximations !== null) {
                console.log('Setting edoApproximations to:', settings.edoApproximations);
                edoApproximations.value = settings.edoApproximations;
                console.log('edoApproximations.value is now:', edoApproximations.value);
            }

            // Load filter settings
            if (settings.complexityLimit) complexityLimitInput.value = settings.complexityLimit;
            if (settings.centMin) centMinInput.value = settings.centMin;
            if (settings.centMax) centMaxInput.value = settings.centMax;

            // Load audio settings
            if (settings.soundEnabled !== undefined) soundEnabledInput.checked = settings.soundEnabled;
            if (settings.playIntervals !== undefined) playIntervalsInput.checked = settings.playIntervals;

            // Load game settings
            if (settings.rounds) roundsInput.value = settings.rounds;
            if (settings.hideInterval !== undefined) hideIntervalInput.checked = settings.hideInterval;

            console.log('Loaded all settings from URL');
            return;
        } catch (e) {
            console.error('Failed to decode settings from URL:', e);
        }
    }

    // Fallback to old format (intervals only)
    const intervalsEncoded = urlParams.get('intervals');
    if (intervalsEncoded) {
        try {
            const decoded = atob(intervalsEncoded);
            customIntervalsInput.value = decoded;
            console.log('Loaded intervals from URL (legacy format)');
        } catch (e) {
            console.error('Failed to decode intervals from URL:', e);
        }
    }
}

// Load intervals when page loads - wrap in DOMContentLoaded to ensure elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIntervalsFromURL);
} else {
    // DOM already loaded
    loadIntervalsFromURL();
}

// Make EDO checkboxes mutually exclusive
edoAllIntervals.addEventListener('change', () => {
    if (edoAllIntervals.checked) {
        edoUseApproximations.checked = false;
    }
});

edoUseApproximations.addEventListener('change', () => {
    if (edoUseApproximations.checked) {
        edoAllIntervals.checked = false;
    }
});

function generateIntervals() {
    console.log('Generate intervals button clicked');
    const generatorModeElement = document.querySelector('input[name="generator-mode"]:checked');
    console.log('Generator mode element:', generatorModeElement);
    if (!generatorModeElement) {
        alert('Please select a generator mode');
        return;
    }
    const generatorMode = generatorModeElement.value;
    console.log('Generator mode:', generatorMode);
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

    // Convert set to array and sort by ratio
    let intervalArray = Array.from(intervals);

    // Sort by ratio
    intervalArray.sort((a, b) => {
        const [an, ad] = a.split('/').map(Number);
        const [bn, bd] = b.split('/').map(Number);
        return (an / ad) - (bn / bd);
    });

    console.log(`Generated ${intervalArray.length} intervals`);

    if (intervalArray.length === 0) {
        alert('No intervals generated. Try adjusting your settings.');
        return;
    }

    // Get existing intervals from the textarea
    const existingText = customIntervalsInput.value.trim();
    const existingIntervals = existingText ? existingText.split('\n').map(s => s.trim()).filter(s => s) : [];

    // Create a set to avoid duplicates
    const intervalSet = new Set(existingIntervals);

    // Add new intervals (only if not already present)
    intervalArray.forEach(interval => intervalSet.add(interval));

    // Convert back to array and join
    const allIntervals = Array.from(intervalSet);
    customIntervalsInput.value = allIntervals.join('\n');
}

function generateEdoIntervals() {
    console.log('Generate EDO intervals button clicked');

    const edoInput = edoListInput.value.trim();
    if (!edoInput) {
        alert('Please enter EDO values (e.g., 17,19,22,26,31)');
        return;
    }

    const edos = edoInput.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
    if (edos.length === 0) {
        alert('Please enter valid EDO values');
        return;
    }

    const intervals = [];
    const useApproximations = edoUseApproximations.checked;
    const useAllIntervals = edoAllIntervals.checked;

    // If neither checkbox is selected, prompt user
    if (!useApproximations && !useAllIntervals) {
        alert('Please select either "All EDO intervals" or "Use approximations"');
        return;
    }

    if (useApproximations) {
        // Generate approximations of specific intervals
        const approxInput = edoApproximations.value.trim();
        if (!approxInput) {
            alert('Please enter intervals to approximate (e.g., 3/2,5/4)');
            return;
        }

        const ratios = approxInput.split(',').map(s => s.trim());

        for (const ratio of ratios) {
            const match = ratio.match(/^(\d+)\/(\d+)$/);
            if (!match) {
                console.warn(`Skipping invalid ratio: ${ratio}`);
                continue;
            }

            const num = parseInt(match[1]);
            const den = parseInt(match[2]);
            const targetCents = 1200 * Math.log2(num / den);

            // Find best approximation in each EDO
            for (const edo of edos) {
                let bestStep = 0;
                let bestError = Infinity;

                for (let step = 0; step <= edo; step++) {
                    const stepCents = (step / edo) * 1200;
                    const error = Math.abs(stepCents - targetCents);

                    if (error < bestError) {
                        bestError = error;
                        bestStep = step;
                    }
                }

                // Skip 0\n and n\n unless it's genuinely the best approximation
                if (bestStep !== 0 && bestStep !== edo) {
                    intervals.push(`${bestStep}\\${edo}`);
                }
            }
        }
    } else {
        // Generate all EDO intervals (exclude 0\n and n\n)
        for (const edo of edos) {
            for (let step = 1; step < edo; step++) {
                intervals.push(`${step}\\${edo}`);
            }
        }
    }

    if (intervals.length === 0) {
        alert('No intervals generated. Try adjusting your settings.');
        return;
    }

    // Get existing intervals from the textarea
    const existingText = customIntervalsInput.value.trim();
    const existingIntervals = existingText ? existingText.split('\n').map(s => s.trim()).filter(s => s) : [];

    // Create a set to avoid duplicates
    const intervalSet = new Set(existingIntervals);

    // Add new intervals (only if not already present)
    intervals.forEach(interval => intervalSet.add(interval));

    // Convert back to array and join
    const allIntervals = Array.from(intervalSet);
    customIntervalsInput.value = allIntervals.join('\n');

    console.log(`Generated ${intervals.length} EDO intervals`);
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

    // Reveal interval if it was hidden
    if (hideInterval) {
        if (currentInterval.type === 'JI') {
            intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
        } else {
            intervalValue.textContent = currentInterval.display;
        }
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
    console.log('Start game clicked');
    // Initialize audio on first interaction
    initAudio();

    // Read settings
    jiLimit = parseInt(jiLimitInput.value) || 20;
    soundEnabled = soundEnabledInput.checked;
    playIntervals = playIntervalsInput.checked;
    hideInterval = hideIntervalInput.checked;
    numRounds = parseInt(roundsInput.value) || 1;

    const edoInput = edoListInput.value.trim();
    edoList = edoInput.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);

    // Initialize game state
    gameActive = true;
    questionCount = 0;
    totalError = 0;
    intervalPool = [];
    missedIntervals = [];

    // Build interval pool from custom intervals textarea
    // This now handles both JI (x/y) and EDO (x\n) notation
    buildCustomJIIntervals();

    console.log('Interval pool length:', intervalPool.length);
    console.log('First few intervals:', intervalPool.slice(0, 5));

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

                // Only include if within 0-1200¢ range
                if (cents >= 0 && cents <= 1200) {
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
    console.log('buildCustomJIIntervals called, customText:', customText);
    if (!customText) {
        // Don't alert here - let the main validation handle it
        console.log('No custom intervals text found');
        return;
    }

    const lines = customText.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Parse EDO notation (e.g., "7\12" or "5\17")
        const edoMatch = line.match(/^(-?\d+)\\(\d+)$/);
        if (edoMatch) {
            const step = parseInt(edoMatch[1]);
            const edo = parseInt(edoMatch[2]);

            if (edo === 0) {
                console.warn(`Skipping invalid EDO interval (division by zero): ${line}`);
                continue;
            }

            intervalPool.push({
                type: 'EDO',
                edo: edo,
                step: step,
                display: `${step}\\${edo}`
            });
            continue;
        }

        // Parse fraction (e.g., "3/2" or "5/4")
        const jiMatch = line.match(/^(\d+)\/(\d+)$/);
        if (jiMatch) {
            const num = parseInt(jiMatch[1]);
            const den = parseInt(jiMatch[2]);

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
            continue;
        }

        console.warn(`Skipping invalid interval: ${line}`);
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

    // Display interval (or hide it if audio-only mode)
    if (hideInterval) {
        intervalValue.innerHTML = '<span class="hidden-interval">?</span>';
    } else {
        if (currentInterval.type === 'JI') {
            // Display JI intervals as vertical fractions
            intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
        } else {
            // Display EDO intervals as normal text
            intervalValue.textContent = currentInterval.display;
        }
    }
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

    // Play the interval audio
    playIntervalAudio(currentAnswer);
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

    // Reveal interval if it was hidden
    if (hideInterval) {
        if (currentInterval.type === 'JI') {
            intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
        } else {
            intervalValue.textContent = currentInterval.display;
        }
    }

    // Show feedback and play sound
    feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;

    if (error < 1) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Excellent! Off by only ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
        // Don't add to missed intervals (excellent)
    } else if (error < 5) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Great! Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
        // Don't add to missed intervals (still excellent)
    } else if (error < 10) {
        // Light green/yellow (lime-ish)
        feedback.className = 'feedback good';
        feedback.textContent = `Good! Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#e7f4d3';
        feedback.style.color = '#5a7a2c';
        feedback.style.border = '2px solid #c4db9b';
        playSound('excellent');
        // Add to missed intervals (not excellent)
        missedIntervals.push(currentInterval);
    } else if (error < 25) {
        // Yellow
        feedback.className = 'feedback medium';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#fff3cd';
        feedback.style.color = '#856404';
        feedback.style.border = '2px solid #ffeaa7';
        playSound('good');
        // Add to missed intervals
        missedIntervals.push(currentInterval);
    } else if (error < 40) {
        // Orange
        feedback.className = 'feedback poor';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '#ffe5cc';
        feedback.style.color = '#cc5500';
        feedback.style.border = '2px solid #ffb366';
        playSound('good');
        // Add to missed intervals
        missedIntervals.push(currentInterval);
    } else {
        // Red
        feedback.className = 'feedback incorrect';
        feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${currentAnswer.toFixed(2)}¢)`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('wrong');
        // Add to missed intervals
        missedIntervals.push(currentInterval);
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
        message += `Average error: ${(totalError / questionCount).toFixed(2)}¢\n`;
    }
    if (missedIntervals.length > 0) {
        message += `\nMissed intervals: ${missedIntervals.length}`;
    }

    // Show summary in game panel instead of alert
    feedback.innerHTML = `
        <div style="text-align: left;">
            <strong>Game Over!</strong><br><br>
            Time: ${seconds}s<br>
            Questions answered: ${questionCount}<br>
            Total error: ${totalError.toFixed(2)}¢<br>
            ${questionCount > 0 ? `Average error: ${(totalError / questionCount).toFixed(2)}¢<br>` : ''}
            ${missedIntervals.length > 0 ? `<br>Missed intervals (>5¢ error): ${missedIntervals.length} <button id="load-missed-btn" class="btn-secondary" style="margin-left: 10px;">Load to Bank</button>` : ''}
        </div>
    `;
    feedback.className = 'feedback';
    feedback.style.background = '#f8f9fa';
    feedback.style.color = '#333';
    feedback.style.border = '2px solid #ddd';
    feedback.style.padding = '20px';

    // Add event listener for "Load to Bank" button if it exists
    if (missedIntervals.length > 0) {
        setTimeout(() => {
            const loadMissedBtn = document.getElementById('load-missed-btn');
            if (loadMissedBtn) {
                loadMissedBtn.addEventListener('click', loadMissedToBank);
            }
        }, 0);
    }

    // Hide interval display and input
    document.querySelector('.interval-display').style.display = 'none';
    document.querySelector('.input-section').style.display = 'none';
    document.querySelector('.continuum-container').style.display = 'none';
    skipBtn.style.display = 'none';

    // Change end button to "Return to Settings"
    endBtn.textContent = 'Return to Settings';
    endBtn.onclick = () => {
        // Reset display
        document.querySelector('.interval-display').style.display = '';
        document.querySelector('.input-section').style.display = '';
        document.querySelector('.continuum-container').style.display = '';
        skipBtn.style.display = '';
        endBtn.textContent = 'End Game';
        endBtn.onclick = endGame;

        // Return to settings
        gamePanel.style.display = 'none';
        settingsPanel.style.display = 'block';
    };

    // Add "Retry Missed Intervals" button if there are any
    if (missedIntervals.length > 0) {
        submitBtn.style.display = '';
        submitBtn.textContent = 'Retry Missed Intervals';
        submitBtn.onclick = () => {
            retryMissedIntervals();
        };
    } else {
        submitBtn.style.display = 'none';
    }
}

function loadMissedToBank() {
    // Convert missed intervals to their display format
    const missedDisplays = missedIntervals.map(interval => interval.display);

    // Clear the custom intervals textarea and fill with missed intervals only
    customIntervalsInput.value = missedDisplays.join('\n');

    // Return to settings panel
    document.querySelector('.interval-display').style.display = '';
    document.querySelector('.input-section').style.display = '';
    document.querySelector('.continuum-container').style.display = '';
    skipBtn.style.display = '';
    submitBtn.style.display = '';
    endBtn.textContent = 'End Game';
    endBtn.onclick = endGame;

    gamePanel.style.display = 'none';
    settingsPanel.style.display = 'block';

    alert(`Loaded ${missedIntervals.length} missed intervals to the interval bank. You can now start a new game with only these intervals.`);
}

function retryMissedIntervals() {
    // Reset display elements
    document.querySelector('.interval-display').style.display = '';
    document.querySelector('.input-section').style.display = '';
    document.querySelector('.continuum-container').style.display = '';
    skipBtn.style.display = '';
    submitBtn.style.display = '';
    endBtn.textContent = 'End Game';
    endBtn.onclick = endGame;
    submitBtn.onclick = null; // Will be handled by handleSubmitOrNext

    // Reset game state
    gameActive = true;
    questionCount = 0;
    totalError = 0;

    // Use only the missed intervals
    remainingIntervals = [...missedIntervals];
    shuffleArray(remainingIntervals);
    missedIntervals = []; // Clear missed intervals for new attempt
    totalQuestions = remainingIntervals.length;

    // Start timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    // Start first question
    nextQuestion();
}
