// Game state
let gameActive = false;
let currentInterval = null;
let currentAnswer = null;
let questionCount = 0;
let totalError = 0;
let intervalPool = [];
let remainingIntervals = [];
let missedIntervals = [];
let intervalsByAccuracy = {
    perfect: [],      // < 1¢
    excellent: [],    // 1-5¢
    good: [],         // 5-10¢
    decent: [],       // 10-25¢
    poor: [],         // 25-40¢
    bad: []           // > 40¢
};
let totalQuestions = 0;
let startTime = null;
let timerInterval = null;
let waitingForNext = false;
let questionStartTime = null;

// Settings
let jiLimit = 20;
let edoList = [];

// DOM elements
const levelSelectPanel = document.getElementById('level-select-panel');
const settingsPanel = document.getElementById('settings-panel');
const gamePanel = document.getElementById('game-panel');
const customModeBtn = document.getElementById('custom-mode-btn-top');
const backToLevelsBtn = document.getElementById('back-to-levels-btn');
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
const complexityMinInput = document.getElementById('complexity-min');
const complexityMaxInput = document.getElementById('complexity-max');
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
const waveformTypeInput = document.getElementById('waveform-type');
const roundsInput = document.getElementById('rounds');
const hideIntervalInput = document.getElementById('hide-interval');
const repeatMissedInput = document.getElementById('repeat-missed');
const repeatThresholdInput = document.getElementById('repeat-threshold');
const randomRootInput = document.getElementById('random-root');
const centModeInput = document.getElementById('cent-mode');
const answerLabel = document.getElementById('answer-label');

// Game panel audio controls
const soundEnabledGameInput = document.getElementById('sound-enabled-game');
const playIntervalsGameInput = document.getElementById('play-intervals-game');
const waveformTypeGameInput = document.getElementById('waveform-type-game');
const releaseTimeInput = document.getElementById('release-time');
const releaseTimeValueSpan = document.getElementById('release-time-value');
const releaseTimeGameInput = document.getElementById('release-time-game');
const releaseTimeValueGameSpan = document.getElementById('release-time-value-game');
const replayIntervalBtn = document.getElementById('replay-interval-btn');

// Audio context and sound settings
let audioContext = null;
let soundEnabled = true;
let playIntervals = true;
let waveformType = 'sawtooth';
let releaseTime = 4.0;
let randomRoot = true;
let hideInterval = false;
let numRounds = 1;
let repeatMissed = false;
let repeatThreshold = 5;
let repeatSlow = false;
let repeatSlowThreshold = 5;
let centMode = false;

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

// Navigation functions
function showLevelSelect() {
    levelSelectPanel.style.display = 'block';
    settingsPanel.style.display = 'none';
    gamePanel.style.display = 'none';
}

function showCustomMode() {
    levelSelectPanel.style.display = 'none';
    settingsPanel.style.display = 'block';
    gamePanel.style.display = 'none';
}

// Helper function to check if a number is prime
function isPrime(num) {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;
    for (let i = 5; i * i <= num; i += 6) {
        if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
}

// Helper function to check if a number is a power of 2
function isPowerOf2(num) {
    return num > 0 && (num & (num - 1)) === 0;
}

// Helper function to get octave-reduced ratio for a number
// Returns [numerator, denominator] for n reduced to one octave [1, 2)
function getOctaveReducedRatio(n) {
    let num = n;
    let denom = 1;

    // Reduce to [1, 2) by dividing by powers of 2
    while (num >= 2 * denom) {
        denom *= 2;
    }

    return [num, denom];
}

// Helper function to convert ratio to cents
function ratioCents(num, denom) {
    return 1200 * Math.log2(num / denom);
}

// Helper to apply mod 1200 to keep cents in [0, 1200) range
function mod1200(cents) {
    return ((cents % 1200) + 1200) % 1200;
}

// Generate explanation for how to calculate a JI interval
function getIntervalExplanation(numerator, denominator, correctCents) {
    // Check if it's a prime/2^n (must be memorized) - don't show explanation
    if (isPrime(numerator) && isPowerOf2(denominator)) {
        return '';
    }

    // Check if it's 2^n/prime (reciprocal formula)
    if (isPowerOf2(numerator) && isPrime(denominator)) {
        const [denNum, denDenom] = getOctaveReducedRatio(denominator);
        const denCents = mod1200(ratioCents(denNum, denDenom));
        const result = mod1200(1200 - denCents);
        return `<br><em>1200¢ - ${denCents.toFixed(2)}¢ = <strong>${result.toFixed(2)}¢</strong></em>`;
    }

    // It's composite - determine whether to use subtraction or addition
    const [numNum, numDenom] = getOctaveReducedRatio(numerator);
    const [denNum, denDenom] = getOctaveReducedRatio(denominator);
    const numCents = mod1200(ratioCents(numNum, numDenom));
    const denCents = mod1200(ratioCents(denNum, denDenom));

    const difference = numCents - denCents;

    // Simplify: if both have same denominator, just show numerators
    if (numDenom === denDenom) {
        if (difference < 0) {
            // Use multiplication with reciprocal - calculate reciprocal properly
            const reciprocalCents = mod1200(ratioCents(denDenom, denNum));
            const result = mod1200(numCents + reciprocalCents);
            return `<br><em>${numCents.toFixed(2)}¢ + ${reciprocalCents.toFixed(2)}¢ = <strong>${result.toFixed(2)}¢</strong></em>`;
        } else {
            // Use division
            let result = mod1200(difference);
            return `<br><em>${numCents.toFixed(2)}¢ - ${denCents.toFixed(2)}¢ = <strong>${result.toFixed(2)}¢</strong></em>`;
        }
    }

    if (difference < 0) {
        // Use multiplication method with reciprocal
        const reciprocalNum = denDenom;
        const reciprocalDenom = denNum;
        const reciprocalCents = mod1200(ratioCents(reciprocalNum, reciprocalDenom));
        const result = mod1200(numCents + reciprocalCents);
        return `<br><em>${numCents.toFixed(2)}¢ + ${reciprocalCents.toFixed(2)}¢ = <strong>${result.toFixed(2)}¢</strong></em>`;
    } else {
        // Use division method
        let result = mod1200(difference);
        return `<br><em>${numCents.toFixed(2)}¢ - ${denCents.toFixed(2)}¢ = <strong>${result.toFixed(2)}¢</strong></em>`;
    }
}

// Level configuration
function getLevelConfig(level) {
    const configs = {
        1: { mode: 'primes-2x', limit: 40, primeLimit: 19, complexityMin: 0, complexityMax: 1000000, filterType: 'primes-only' },
        2: { mode: 'primes-2x', limit: 40, primeLimit: 19, complexityMin: 0, complexityMax: 1000000, filterType: 'reciprocals-only' },
        3: { mode: 'primes-2x', limit: 40, primeLimit: 19, complexityMin: 0, complexityMax: 1000000 },
        4: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 50 },
        5: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 100 },
        6: { mode: 'simple-limit', limit: 40, complexityMin: 100, complexityMax: 150 },
        7: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 150 },
        8: { mode: 'simple-limit', limit: 40, complexityMin: 150, complexityMax: 200 },
        9: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 200 },
        10: { mode: 'simple-limit', limit: 40, complexityMin: 200, complexityMax: 250 },
        11: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 250 },
        12: { mode: 'simple-limit', limit: 40, complexityMin: 250, complexityMax: 300 },
        13: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 300 },
        14: { mode: 'simple-limit', limit: 40, complexityMin: 300, complexityMax: 350 },
        15: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 350 },
        16: { mode: 'simple-limit', limit: 40, complexityMin: 350, complexityMax: 400 },
        17: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 400 },
        18: { mode: 'simple-limit', limit: 40, complexityMin: 400, complexityMax: 450 },
        19: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 450 },
        20: { mode: 'simple-limit', limit: 40, complexityMin: 450, complexityMax: 500 },
        21: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 500 },
        22: { mode: 'simple-limit', limit: 40, complexityMin: 500, complexityMax: 550 },
        23: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 550 },
        24: { mode: 'simple-limit', limit: 40, complexityMin: 550, complexityMax: 600 },
        25: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 600 },
        26: { mode: 'simple-limit', limit: 40, complexityMin: 600, complexityMax: 650 },
        27: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 650 },
        28: { mode: 'simple-limit', limit: 40, complexityMin: 650, complexityMax: 700 },
        29: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 700 },
        30: { mode: 'simple-limit', limit: 40, complexityMin: 700, complexityMax: 750 },
        31: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 750 },
        32: { mode: 'simple-limit', limit: 40, complexityMin: 750, complexityMax: 800 },
        33: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 800 },
        34: { mode: 'simple-limit', limit: 40, complexityMin: 800, complexityMax: 850 },
        35: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 850 },
        36: { mode: 'simple-limit', limit: 40, complexityMin: 850, complexityMax: 900 },
        37: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 900 },
        38: { mode: 'simple-limit', limit: 40, complexityMin: 900, complexityMax: 950 },
        39: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 950 },
        40: { mode: 'simple-limit', limit: 40, complexityMin: 950, complexityMax: 1000 },
        41: { mode: 'simple-limit', limit: 40, complexityMin: 0, complexityMax: 1000 }
    };
    return configs[level];
}

function configureLevel(level, reverseMode) {
    const config = getLevelConfig(level);
    if (!config) return;

    // Set cent mode based on mode selection
    centModeInput.checked = reverseMode;

    // Set generator mode
    const modeRadio = document.querySelector(`input[name="generator-mode"][value="${config.mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    // Set limits
    jiLimitInput.value = config.limit;
    if (config.primeLimit) {
        primeLimitInput.value = config.primeLimit;
    }

    // Set complexity filter
    complexityMinInput.value = config.complexityMin;
    complexityMaxInput.value = config.complexityMax;

    // Generate intervals based on configuration
    generateIntervals();

    // Apply complexity filter
    filterComplexIntervals();

    // Apply special filters for levels 1 and 2
    if (config.filterType === 'primes-only') {
        filterPrimesOnly();
    } else if (config.filterType === 'reciprocals-only') {
        filterReciprocalsOnly();
    }
}

function filterPrimesOnly() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) return;

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

            // Keep only if numerator is prime (or prime power) and denominator is power of 2
            // Check if numerator is a power of a single prime
            if (isPowerOfSinglePrime(num) && isPowerOf2(den) && !isPowerOf2(num)) {
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

        filtered.push(line);
    }

    customIntervalsInput.value = filtered.join('\n');
}

// Helper function to check if a number is a power of a single prime
function isPowerOfSinglePrime(num) {
    if (num <= 1) return false;

    // Find the smallest prime factor
    for (let i = 2; i * i <= num; i++) {
        if (num % i === 0) {
            // i is a factor, check if num is a power of i
            let temp = num;
            while (temp % i === 0) {
                temp /= i;
            }
            return temp === 1;
        }
    }
    // If no factor found, num is prime
    return true;
}

function filterReciprocalsOnly() {
    const customText = customIntervalsInput.value.trim();
    if (!customText) return;

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

            // Keep only if numerator is power of 2 and denominator is prime (or prime power)
            if (isPowerOf2(num) && isPowerOfSinglePrime(den) && !isPowerOf2(den)) {
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

        filtered.push(line);
    }

    customIntervalsInput.value = filtered.join('\n');
}

// Event listeners for navigation
customModeBtn.addEventListener('click', showCustomMode);
backToLevelsBtn.addEventListener('click', showLevelSelect);

// Function to count intervals for a level
function countIntervalsForLevel(level) {
    const config = getLevelConfig(level);
    if (!config) return 0;

    // Save current state
    const currentIntervals = customIntervalsInput.value;

    // Generate intervals for this level
    const modeRadio = document.querySelector(`input[name="generator-mode"][value="${config.mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    jiLimitInput.value = config.limit;
    if (config.primeLimit) {
        primeLimitInput.value = config.primeLimit;
    }

    complexityMinInput.value = config.complexityMin;
    complexityMaxInput.value = config.complexityMax;

    generateIntervals();
    filterComplexIntervals();

    if (config.filterType === 'primes-only') {
        filterPrimesOnly();
    } else if (config.filterType === 'reciprocals-only') {
        filterReciprocalsOnly();
    }

    // Count the intervals
    const text = customIntervalsInput.value.trim();
    const count = text ? text.split('\n').filter(line => line.trim()).length : 0;

    // Restore original state
    customIntervalsInput.value = currentIntervals;

    return count;
}

// Add hover tooltips to show interval count
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('mouseenter', function() {
        // Get the level ID from the button's data-level attribute
        const level = parseInt(this.dataset.level);
        const count = countIntervalsForLevel(level);

        // Create or update tooltip
        let tooltip = this.querySelector('.interval-count-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'interval-count-tooltip';
            this.appendChild(tooltip);
        }
        tooltip.textContent = `${count} questions`;
        tooltip.style.display = 'block';
    });

    btn.addEventListener('mouseleave', function() {
        const tooltip = this.querySelector('.interval-count-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    });
});

// Event listeners for mode selector buttons
const modeSelectorBtns = document.querySelectorAll('.mode-selector-btn');
const readonlyBtns = document.querySelectorAll('.mode-selector-btn-readonly');

modeSelectorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state for clickable buttons
        modeSelectorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update readonly buttons to show opposite mode
        const selectedMode = btn.dataset.mode;
        const oppositeMode = selectedMode === 'fractions' ? 'cents' : 'fractions';

        readonlyBtns.forEach(rb => {
            if (rb.dataset.mode === oppositeMode) {
                rb.classList.add('active');
            } else {
                rb.classList.remove('active');
            }
        });
    });
});

// Event listeners for level buttons
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset.level);

        // Get selected display mode
        const activeMode = document.querySelector('.mode-selector-btn.active');
        const reverseMode = activeMode && activeMode.dataset.mode === 'cents';

        initAudio();

        // Apply quick settings before configuring level
        const repeatMissedQuick = document.getElementById('repeat-missed-quick');
        const repeatThresholdQuick = document.getElementById('repeat-threshold-quick');
        const repeatSlowQuick = document.getElementById('repeat-slow-quick');
        const repeatSlowThresholdQuick = document.getElementById('repeat-slow-threshold-quick');
        const audioOnlyQuick = document.getElementById('audio-only-quick');

        if (repeatMissedQuick && repeatMissedQuick.checked) {
            repeatMissedInput.checked = true;
            repeatThresholdInput.value = repeatThresholdQuick.value;
        } else if (repeatMissedQuick) {
            repeatMissedInput.checked = false;
        }

        if (repeatSlowQuick && repeatSlowQuick.checked) {
            repeatSlow = true;
            repeatSlowThreshold = parseFloat(repeatSlowThresholdQuick.value) || 5;
        } else if (repeatSlowQuick) {
            repeatSlow = false;
        }

        if (audioOnlyQuick && audioOnlyQuick.checked) {
            hideIntervalInput.checked = true;
        } else if (audioOnlyQuick) {
            hideIntervalInput.checked = false;
        }

        configureLevel(level, reverseMode);
        startGame();
    });
});

// Play interval audio
function playIntervalAudio(cents) {
    if (!playIntervals || !audioContext) return;

    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Calculate base frequency (with random variation if enabled)
    let baseFreq = 220; // A3
    if (randomRoot) {
        // Random variation ±600¢ (half octave in each direction)
        const randomCents = (Math.random() * 1200) - 600; // -600 to +600
        baseFreq = 220 * Math.pow(2, randomCents / 1200);
    }

    // Calculate interval frequency
    const intervalFreq = baseFreq * Math.pow(2, cents / 1200);

    // Determine actual waveform and whether to filter
    let actualWaveform = waveformType;
    let useFilter = false;

    if (waveformType === 'filtered-square') {
        actualWaveform = 'square';
        useFilter = true;
    } else if (waveformType === 'filtered-sawtooth') {
        actualWaveform = 'sawtooth';
        useFilter = true;
    }

    // Play root note
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();

    osc1.type = actualWaveform;
    osc1.frequency.value = baseFreq;

    // Connect with or without filter
    if (useFilter) {
        const filter1 = audioContext.createBiquadFilter();
        filter1.type = 'lowpass';
        filter1.frequency.value = 1000; // 1kHz cutoff
        filter1.Q.value = 1.0; // Standard Q value

        osc1.connect(filter1);
        filter1.connect(gain1);
    } else {
        osc1.connect(gain1);
    }

    gain1.connect(audioContext.destination);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

    osc1.start(now);
    osc1.stop(now + releaseTime);

    // Play interval note after 300ms
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();

    osc2.type = actualWaveform;
    osc2.frequency.value = intervalFreq;

    // Connect with or without filter
    if (useFilter) {
        const filter2 = audioContext.createBiquadFilter();
        filter2.type = 'lowpass';
        filter2.frequency.value = 1000; // 1kHz cutoff
        filter2.Q.value = 1.0; // Standard Q value

        osc2.connect(filter2);
        filter2.connect(gain2);
    } else {
        osc2.connect(gain2);
    }

    gain2.connect(audioContext.destination);
    gain2.gain.setValueAtTime(0.15, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + releaseTime);

    osc2.start(now + 0.3);
    osc2.stop(now + 0.3 + releaseTime);
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

// Event listeners to sync audio controls between settings and game panel
soundEnabledInput.addEventListener('change', () => {
    soundEnabled = soundEnabledInput.checked;
    soundEnabledGameInput.checked = soundEnabledInput.checked;
});

soundEnabledGameInput.addEventListener('change', () => {
    soundEnabled = soundEnabledGameInput.checked;
    soundEnabledInput.checked = soundEnabledGameInput.checked;
});

playIntervalsInput.addEventListener('change', () => {
    playIntervals = playIntervalsInput.checked;
    playIntervalsGameInput.checked = playIntervalsInput.checked;
});

playIntervalsGameInput.addEventListener('change', () => {
    playIntervals = playIntervalsGameInput.checked;
    playIntervalsInput.checked = playIntervalsGameInput.checked;
});

waveformTypeInput.addEventListener('change', () => {
    waveformType = waveformTypeInput.value;
    waveformTypeGameInput.value = waveformTypeInput.value;
});

waveformTypeGameInput.addEventListener('change', () => {
    waveformType = waveformTypeGameInput.value;
    waveformTypeInput.value = waveformTypeGameInput.value;
});

releaseTimeInput.addEventListener('input', () => {
    releaseTime = parseFloat(releaseTimeInput.value);
    releaseTimeValueSpan.textContent = releaseTime.toFixed(1);
    releaseTimeGameInput.value = releaseTimeInput.value;
    releaseTimeValueGameSpan.textContent = releaseTime.toFixed(1);
});

releaseTimeGameInput.addEventListener('input', () => {
    releaseTime = parseFloat(releaseTimeGameInput.value);
    releaseTimeValueGameSpan.textContent = releaseTime.toFixed(1);
    releaseTimeInput.value = releaseTimeGameInput.value;
    releaseTimeValueSpan.textContent = releaseTime.toFixed(1);
});

// Replay interval button
replayIntervalBtn.addEventListener('click', () => {
    if (currentAnswer !== null) {
        playIntervalAudio(currentAnswer);
    }
});

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

    const complexityMin = parseInt(complexityMinInput.value) || 0;
    const complexityMax = parseInt(complexityMaxInput.value) || 100;
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
            const complexity = num * den;

            if (complexity >= complexityMin && complexity <= complexityMax) {
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
        complexityMin: complexityMinInput.value,
        complexityMax: complexityMaxInput.value,
        centMin: centMinInput.value,
        centMax: centMaxInput.value,
        // Audio settings
        soundEnabled: soundEnabledInput.checked,
        playIntervals: playIntervalsInput.checked,
        waveformType: waveformTypeInput.value,
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
            if (settings.complexityMin !== undefined) complexityMinInput.value = settings.complexityMin;
            if (settings.complexityMax !== undefined) complexityMaxInput.value = settings.complexityMax;
            // Fallback for old format that only had complexityLimit
            if (settings.complexityLimit !== undefined && settings.complexityMax === undefined) {
                complexityMaxInput.value = settings.complexityLimit;
            }
            if (settings.centMin) centMinInput.value = settings.centMin;
            if (settings.centMax) centMaxInput.value = settings.centMax;

            // Load audio settings
            if (settings.soundEnabled !== undefined) soundEnabledInput.checked = settings.soundEnabled;
            if (settings.playIntervals !== undefined) playIntervalsInput.checked = settings.playIntervals;
            if (settings.waveformType !== undefined) waveformTypeInput.value = settings.waveformType;

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
            // Generate primes/2^x (primes only in numerator) and their reciprocals
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

                    // Also generate reciprocals (2^x/prime)
                    const denominator = numerator; // The prime power becomes denominator
                    for (let pow2 = 0; pow2 <= 10; pow2++) {
                        const recipNumerator = Math.pow(2, pow2);
                        const ratio = recipNumerator / denominator;
                        if (ratio >= 1 && ratio < 2) {
                            intervals.add(`${recipNumerator}/${denominator}`);
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

// Prevent non-numeric characters (except decimal, minus, and slash for fractions) in answer input
answerInput.addEventListener('keydown', (e) => {
    // Special handling for 'R' key - replay interval
    if (e.key === 'r' || e.key === 'R') {
        if (gameActive && currentAnswer !== null) {
            e.preventDefault();
            playIntervalAudio(currentAnswer);
        }
        return;
    }

    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    const allowedChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', '/'];

    // Allow special keys
    if (allowedKeys.includes(e.key)) {
        return;
    }

    // Allow Ctrl/Cmd shortcuts (like Ctrl+A, Ctrl+C, etc)
    if (e.ctrlKey || e.metaKey) {
        return;
    }

    // Block letters and other non-numeric characters
    if (!allowedChars.includes(e.key)) {
        e.preventDefault();
    }
});

// Help modal functionality
const helpBtn = document.getElementById('help-btn');
const helpBtnGame = document.getElementById('help-btn-game');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help-btn');

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'flex';
});

helpBtnGame.addEventListener('click', () => {
    helpModal.style.display = 'flex';
});

closeHelpBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

// Close modal when clicking outside
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.style.display = 'none';
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
        helpModal.style.display = 'none';
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
        if (centMode) {
            intervalValue.textContent = currentAnswer.toFixed(2) + '¢';
        } else {
            if (currentInterval.type === 'JI') {
                intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
            } else {
                intervalValue.textContent = currentInterval.display;
            }
        }
    }

    // Prepare answer text based on mode
    let answerText;
    if (centMode) {
        answerText = currentInterval.display;
    } else {
        answerText = currentAnswer.toFixed(2) + '¢';
    }

    feedback.textContent = `Skipped. The answer was ${answerText}`;
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
    waveformType = waveformTypeInput.value;
    releaseTime = parseFloat(releaseTimeInput.value) || 4.0;
    randomRoot = randomRootInput.checked;
    hideInterval = hideIntervalInput.checked;
    numRounds = parseInt(roundsInput.value) || 1;
    repeatMissed = repeatMissedInput.checked;
    repeatThreshold = parseFloat(repeatThresholdInput.value) || 5;
    centMode = centModeInput.checked;

    // Update input label based on mode
    if (centMode) {
        answerLabel.textContent = 'Enter ratio (e.g., 3/2):';
        answerInput.placeholder = '3/2';
    } else {
        answerLabel.textContent = 'Enter cents:';
        answerInput.placeholder = '0.00';
    }

    // Sync audio controls to game panel
    soundEnabledGameInput.checked = soundEnabled;
    playIntervalsGameInput.checked = playIntervals;
    waveformTypeGameInput.value = waveformType;
    releaseTimeGameInput.value = releaseTimeInput.value;
    releaseTimeValueGameSpan.textContent = releaseTime.toFixed(1);

    const edoInput = edoListInput.value.trim();
    edoList = edoInput.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);

    // Initialize game state
    gameActive = true;
    questionCount = 0;
    totalError = 0;
    intervalPool = [];
    missedIntervals = [];
    intervalsByAccuracy = {
        perfect: [],
        excellent: [],
        good: [],
        decent: [],
        poor: [],
        bad: []
    };

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
    levelSelectPanel.style.display = 'none';
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
        if (centMode) {
            // In cent mode, show the cent value rounded to nearest hundredth
            intervalValue.textContent = currentAnswer.toFixed(2) + '¢';
        } else {
            // Normal mode: show ratio/interval notation
            if (currentInterval.type === 'JI') {
                // Display JI intervals as vertical fractions
                intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
            } else {
                // Display EDO intervals as normal text
                intervalValue.textContent = currentInterval.display;
            }
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

    // Start question timer
    questionStartTime = Date.now();

    // Play the interval audio
    playIntervalAudio(currentAnswer);
}

function submitAnswer() {
    if (!gameActive) return;

    let userAnswer;

    if (centMode) {
        // In cent mode, expect ratio input (e.g., "3/2" or "5\12")
        const answerText = answerInput.value.trim();

        // Try parsing as JI ratio (e.g., "3/2")
        const jiMatch = answerText.match(/^(\d+)\/(\d+)$/);
        if (jiMatch) {
            const num = parseInt(jiMatch[1]);
            const den = parseInt(jiMatch[2]);
            if (den === 0) {
                alert('Please enter a valid ratio (denominator cannot be zero)');
                return;
            }
            userAnswer = 1200 * Math.log2(num / den);
        } else {
            // Try parsing as EDO notation (e.g., "7\12")
            const edoMatch = answerText.match(/^(-?\d+)\\(\d+)$/);
            if (edoMatch) {
                const step = parseInt(edoMatch[1]);
                const edo = parseInt(edoMatch[2]);
                if (edo === 0) {
                    alert('Please enter a valid EDO notation (EDO cannot be zero)');
                    return;
                }
                userAnswer = (step / edo) * 1200;
            } else {
                alert('Please enter a valid ratio (e.g., 3/2) or EDO notation (e.g., 7\\12)');
                return;
            }
        }
    } else {
        // Normal mode: expect cent value
        userAnswer = parseFloat(answerInput.value);

        if (isNaN(userAnswer)) {
            alert('Please enter a valid number');
            return;
        }
    }

    // Calculate error and time taken
    const error = Math.abs(userAnswer - currentAnswer);
    const timeTaken = (Date.now() - questionStartTime) / 1000; // Convert to seconds
    totalError += error;
    questionCount++;

    // Check if interval should be re-added to queue
    let shouldRepeat = false;
    if (repeatMissed && error > repeatThreshold) {
        shouldRepeat = true;
    }
    if (repeatSlow && timeTaken > repeatSlowThreshold) {
        shouldRepeat = true;
    }
    if (shouldRepeat) {
        remainingIntervals.push(currentInterval);
        shuffleArray(remainingIntervals);
    }

    // Update score display
    questionCountEl.textContent = questionCount;
    totalScoreEl.textContent = totalError.toFixed(2);
    avgScoreEl.textContent = (totalError / questionCount).toFixed(2);

    // Update continuum markers
    updateContinuumMarkers(currentAnswer, userAnswer);

    // Reveal interval if it was hidden
    if (hideInterval) {
        if (centMode) {
            intervalValue.textContent = currentAnswer.toFixed(2) + '¢';
        } else {
            if (currentInterval.type === 'JI') {
                intervalValue.innerHTML = `<span class="fraction"><span class="numerator">${currentInterval.numerator}</span><span class="denominator">${currentInterval.denominator}</span></span>`;
            } else {
                intervalValue.textContent = currentInterval.display;
            }
        }
    }

    // Prepare correct answer text based on mode
    let correctAnswerText;
    if (centMode) {
        // In cent mode, show the ratio as the correct answer
        correctAnswerText = currentInterval.display;
    } else {
        // In normal mode, show cents as the correct answer
        correctAnswerText = currentAnswer.toFixed(2) + '¢';
    }

    // Show feedback and play sound
    feedback.textContent = `Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;

    if (error < 1) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Excellent! Off by only ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
        // Track by accuracy
        intervalsByAccuracy.perfect.push({ ...currentInterval, error, timeTaken });
    } else if (error < 5) {
        feedback.className = 'feedback correct';
        feedback.textContent = `Great! Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('excellent');
        // Track by accuracy
        intervalsByAccuracy.excellent.push({ ...currentInterval, error, timeTaken });
    } else if (error < 10) {
        // Light green/yellow (lime-ish)
        feedback.className = 'feedback good';
        let feedbackText = `Good! Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        // Add explanation for JI intervals with error > 1c
        if (currentInterval.type === 'JI' && error > 1) {
            feedbackText += getIntervalExplanation(currentInterval.numerator, currentInterval.denominator, currentAnswer);
        }
        feedback.innerHTML = feedbackText;
        feedback.style.background = '#e7f4d3';
        feedback.style.color = '#5a7a2c';
        feedback.style.border = '2px solid #c4db9b';
        playSound('excellent');
        // Track by accuracy
        intervalsByAccuracy.good.push({ ...currentInterval, error, timeTaken });
        missedIntervals.push(currentInterval);
    } else if (error < 25) {
        // Yellow
        feedback.className = 'feedback medium';
        let feedbackText = `Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        // Add explanation for JI intervals with error > 1c
        if (currentInterval.type === 'JI' && error > 1) {
            feedbackText += getIntervalExplanation(currentInterval.numerator, currentInterval.denominator, currentAnswer);
        }
        feedback.innerHTML = feedbackText;
        feedback.style.background = '#fff3cd';
        feedback.style.color = '#856404';
        feedback.style.border = '2px solid #ffeaa7';
        playSound('good');
        // Track by accuracy
        intervalsByAccuracy.decent.push({ ...currentInterval, error, timeTaken });
        missedIntervals.push(currentInterval);
    } else if (error < 40) {
        // Orange
        feedback.className = 'feedback poor';
        let feedbackText = `Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        // Add explanation for JI intervals with error > 1c
        if (currentInterval.type === 'JI' && error > 1) {
            feedbackText += getIntervalExplanation(currentInterval.numerator, currentInterval.denominator, currentAnswer);
        }
        feedback.innerHTML = feedbackText;
        feedback.style.background = '#ffe5cc';
        feedback.style.color = '#cc5500';
        feedback.style.border = '2px solid #ffb366';
        playSound('good');
        // Track by accuracy
        intervalsByAccuracy.poor.push({ ...currentInterval, error, timeTaken });
        missedIntervals.push(currentInterval);
    } else {
        // Red
        feedback.className = 'feedback incorrect';
        let feedbackText = `Off by ${error.toFixed(2)}¢ (Correct: ${correctAnswerText})`;
        // Add explanation for JI intervals with error > 1c
        if (currentInterval.type === 'JI' && error > 1) {
            feedbackText += getIntervalExplanation(currentInterval.numerator, currentInterval.denominator, currentAnswer);
        }
        feedback.innerHTML = feedbackText;
        feedback.style.background = '';
        feedback.style.color = '';
        feedback.style.border = '';
        playSound('wrong');
        // Track by accuracy
        intervalsByAccuracy.bad.push({ ...currentInterval, error, timeTaken });
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
    const avgTimePerQuestion = questionCount > 0 ? (elapsed / 1000 / questionCount).toFixed(2) : 0;

    let message = 'Game Over!\n\n';
    message += `Time: ${seconds}s\n`;
    message += `Questions answered: ${questionCount}\n`;
    message += `Total error: ${totalError.toFixed(2)}¢\n`;
    if (questionCount > 0) {
        message += `Average error: ${(totalError / questionCount).toFixed(2)}¢\n`;
        message += `Average time per question: ${avgTimePerQuestion}s\n`;
    }
    if (missedIntervals.length > 0) {
        message += `\nMissed intervals: ${missedIntervals.length}`;
    }

    // Build accuracy breakdown HTML
    let accuracyHTML = '<br><strong>Accuracy Breakdown:</strong><br>';
    const ranges = [
        { key: 'perfect', label: 'Perfect (&lt;1¢)', count: intervalsByAccuracy.perfect.length },
        { key: 'excellent', label: 'Excellent (1-5¢)', count: intervalsByAccuracy.excellent.length },
        { key: 'good', label: 'Good (5-10¢)', count: intervalsByAccuracy.good.length },
        { key: 'decent', label: 'Decent (10-25¢)', count: intervalsByAccuracy.decent.length },
        { key: 'poor', label: 'Poor (25-40¢)', count: intervalsByAccuracy.poor.length },
        { key: 'bad', label: 'Bad (&gt;40¢)', count: intervalsByAccuracy.bad.length }
    ];

    ranges.forEach(range => {
        if (range.count > 0) {
            accuracyHTML += `${range.label}: ${range.count}<br>`;
        }
    });

    // Add "Repeat with intervals missed by more than X¢" section
    accuracyHTML += `<br><div style="margin-top: 10px;">
        <label>Repeat with all intervals missed by more than
        <input type="number" id="error-threshold-input" value="5" min="0" step="0.1" style="width: 60px; display: inline-block; margin: 0 5px;">¢
        <button id="load-threshold-btn" class="btn-secondary" style="margin-left: 10px; font-size: 0.85em; padding: 5px 12px;">Load to Bank</button>
        </label>
    </div>`;

    // Add "Repeat with intervals that took longer than X seconds" section
    accuracyHTML += `<br><div style="margin-top: 10px;">
        <label>Repeat with all intervals that took longer than
        <input type="number" id="time-threshold-input" value="5" min="0" step="0.5" style="width: 60px; display: inline-block; margin: 0 5px;">s
        <button id="load-time-threshold-btn" class="btn-secondary" style="margin-left: 10px; font-size: 0.85em; padding: 5px 12px;">Load to Bank</button>
        </label>
    </div>`;

    // Show summary in game panel instead of alert
    feedback.innerHTML = `
        <div style="text-align: left;">
            <strong>Game Over!</strong><br><br>
            Time: ${seconds}s<br>
            Questions answered: ${questionCount}<br>
            Total error: ${totalError.toFixed(2)}¢<br>
            ${questionCount > 0 ? `Average error: ${(totalError / questionCount).toFixed(2)}¢<br>` : ''}
            ${questionCount > 0 ? `Average time per question: ${avgTimePerQuestion}s<br>` : ''}
            ${accuracyHTML}
        </div>
    `;
    feedback.className = 'feedback';
    feedback.style.background = '#f8f9fa';
    feedback.style.color = '#333';
    feedback.style.border = '2px solid #ddd';
    feedback.style.padding = '20px';

    // Add event listeners for threshold-based load to bank buttons
    setTimeout(() => {
        const thresholdBtn = document.getElementById('load-threshold-btn');
        if (thresholdBtn) {
            thresholdBtn.addEventListener('click', loadThresholdToBank);
        }

        const timeThresholdBtn = document.getElementById('load-time-threshold-btn');
        if (timeThresholdBtn) {
            timeThresholdBtn.addEventListener('click', loadTimeThresholdToBank);
        }
    }, 0);

    // Hide interval display and input
    document.querySelector('.interval-display').style.display = 'none';
    document.querySelector('.input-section').style.display = 'none';
    document.querySelector('.continuum-container').style.display = 'none';
    skipBtn.style.display = 'none';

    // Change end button to "Return to Level Select"
    endBtn.textContent = 'Return to Level Select';
    endBtn.onclick = () => {
        // Reset display
        document.querySelector('.interval-display').style.display = '';
        document.querySelector('.input-section').style.display = '';
        document.querySelector('.continuum-container').style.display = '';
        skipBtn.style.display = '';
        endBtn.textContent = 'End Game';
        endBtn.onclick = endGame;

        // Return to level select
        gamePanel.style.display = 'none';
        showLevelSelect();
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

function loadThresholdToBank() {
    // Get the threshold value from the input
    const thresholdInput = document.getElementById('error-threshold-input');
    const threshold = parseFloat(thresholdInput.value);

    // Collect all intervals that were missed by more than the threshold
    const allIntervals = [];

    // Check each interval in all accuracy ranges
    for (const rangeKey in intervalsByAccuracy) {
        for (const interval of intervalsByAccuracy[rangeKey]) {
            if (interval.error > threshold) {
                allIntervals.push(interval.display);
            }
        }
    }

    // Clear the custom intervals textarea and fill with selected intervals
    customIntervalsInput.value = allIntervals.join('\n');

    // Reset display elements
    document.querySelector('.interval-display').style.display = '';
    document.querySelector('.input-section').style.display = '';
    document.querySelector('.continuum-container').style.display = '';
    skipBtn.style.display = '';
    submitBtn.style.display = '';
    endBtn.textContent = 'End Game';
    endBtn.onclick = endGame;

    // Show custom mode
    gamePanel.style.display = 'none';
    showCustomMode();

    alert(`Loaded ${allIntervals.length} intervals with error > ${threshold}¢ to the interval bank in Custom Mode.`);
}

function loadTimeThresholdToBank() {
    // Get the threshold value from the input
    const thresholdInput = document.getElementById('time-threshold-input');
    const threshold = parseFloat(thresholdInput.value);

    // Collect all intervals that took longer than the threshold
    const allIntervals = [];

    // Check each interval in all accuracy ranges
    for (const rangeKey in intervalsByAccuracy) {
        for (const interval of intervalsByAccuracy[rangeKey]) {
            if (interval.timeTaken > threshold) {
                allIntervals.push(interval.display);
            }
        }
    }

    // Clear the custom intervals textarea and fill with selected intervals
    customIntervalsInput.value = allIntervals.join('\n');

    // Reset display elements
    document.querySelector('.interval-display').style.display = '';
    document.querySelector('.input-section').style.display = '';
    document.querySelector('.continuum-container').style.display = '';
    skipBtn.style.display = '';
    submitBtn.style.display = '';
    endBtn.textContent = 'End Game';
    endBtn.onclick = endGame;

    // Show custom mode
    gamePanel.style.display = 'none';
    showCustomMode();

    alert(`Loaded ${allIntervals.length} intervals that took longer than ${threshold}s to the interval bank in Custom Mode.`);
}

function loadMissedToBank() {
    // Convert missed intervals to their display format
    const missedDisplays = missedIntervals.map(interval => interval.display);

    // Clear the custom intervals textarea and fill with missed intervals only
    customIntervalsInput.value = missedDisplays.join('\n');

    // Reset display elements
    document.querySelector('.interval-display').style.display = '';
    document.querySelector('.input-section').style.display = '';
    document.querySelector('.continuum-container').style.display = '';
    skipBtn.style.display = '';
    submitBtn.style.display = '';
    endBtn.textContent = 'End Game';
    endBtn.onclick = endGame;

    // Show custom mode
    gamePanel.style.display = 'none';
    showCustomMode();

    alert(`Loaded ${missedIntervals.length} missed intervals to the interval bank in Custom Mode. You can now start a new game with only these intervals.`);
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
    intervalsByAccuracy = {
        perfect: [],
        excellent: [],
        good: [],
        decent: [],
        poor: [],
        bad: []
    };

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
