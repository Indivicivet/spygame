/**
 * Who is Spy? Game Logic
 */

// Data Sources mapping
const WORDS_MAP = {
    'en': words_en,
    'zh-CN': words_zh_CN,
    'zh-TW': words_zh_TW,
    'ja': words_ja
};

const LOCALIZATION_MAP = {
    'en': lang_en,
    'zh-CN': lang_zh_CN,
    'zh-TW': lang_zh_TW,
    'ja': lang_ja
};

// Application State
const state = {
    lang: 'en',
    phase: 'home', // 'home', 'setup', 'game', 'end'
    
    config: {
        total: 4,
        spies: 1,
        blanks: 0,
        source: 'random',
        customCivilian: '',
        customSpy: ''
    },
    
    currentWords: {
        civilian: '',
        spy: ''
    },
    
    // Players Array holds current active order
    players: [],
    // Original Order holds initial sequence on first game start
    originalOrder: [], 
    
    setupIndex: 0,
    globalPlayDirection: 1,
    playDirection: 1, // 1 (forward), -1 (backward)
    turnFocusIndex: 0, // indicates whose turn started
    selectedPlayerIndex: null,
    isRestarting: false,
    stream: null
};

// DOM Elements cache
const DOM = {
    screens: {
        home: document.getElementById('home-screen'),
        setup: document.getElementById('setup-action-screen'),
        game: document.getElementById('main-game-screen')
    },
    flags: document.querySelectorAll('.flag'),
    btnTopReset: document.getElementById('btn-top-reset'),
    
    // Home screen
    ui: {
        vBar: document.getElementById('role-visualization'),
        lblTotal: document.getElementById('lbl-total-players'),
        lblSpy: document.getElementById('lbl-spy-count'),
        lblBlank: document.getElementById('lbl-blank-count'),
        lblToggle: document.getElementById('lbl-custom-toggle'),
        valTotal: document.getElementById('val-total'),
        valSpy: document.getElementById('val-spy'),
        valBlank: document.getElementById('val-blank'),
        configCounters: document.getElementById('config-counters'),
        existingPlayersGroup: document.getElementById('existing-players-group'),
        lblExisting: document.getElementById('lbl-existing-players'),
        btnResetPlayers: document.getElementById('btn-reset-players'),
        toggleCustom: document.getElementById('toggle-custom-words'),
        customArea: document.getElementById('custom-word-inputs'),
        customCiv: document.getElementById('input-custom-civilian'),
        customSpy: document.getElementById('input-custom-spy'),
        btnStart: document.getElementById('btn-start-game')
    },
    
    // Setup Screen
    setupTitle: document.getElementById('setup-player-title'),
    video: document.getElementById('camera-view'),
    canvas: document.getElementById('camera-canvas'),
    preview: document.getElementById('selfie-preview'),
    btnSelfie: document.getElementById('btn-take-selfie'),
    btnRemember: document.getElementById('btn-i-remember'),
    wordRevealArea: document.getElementById('word-reveal-area'),
    wordRevealText: document.getElementById('word-reveal-text'),
    doNotShowOthers: document.getElementById('do-not-show-others'),
    
    // Main Game Screen
    ingameVBar: document.getElementById('ingame-role-visualization'),
    playerGrid: document.getElementById('player-grid'),
    ingameActions: document.getElementById('ingame-actions'),
    btnIngameForgot: document.getElementById('btn-ingame-forgot'),
    btnIngameExec: document.getElementById('btn-ingame-execute'),
    ingameRevealOverlay: document.getElementById('ingame-reveal-overlay'),
    ingameWordText: document.getElementById('ingame-forgot-word-text'),
    btnIngameRemember: document.getElementById('btn-ingame-remember'),
    
    postgameActions: document.getElementById('postgame-actions'),
    endgameWordsReveal: document.getElementById('endgame-words-reveal'),
    endgameWordsText: document.getElementById('endgame-words-text'),
    
    // End Game Modal
    endModal: document.getElementById('end-modal'),
    winnerText: document.getElementById('end-winner-text'),
    endGuessArea: document.getElementById('end-guess-area'),
    endGuessPrompt: document.getElementById('end-guess-prompt'),
    endSpyWord: document.getElementById('end-spy-word'),
    btnEndSeeResults: document.getElementById('btn-end-see-results'),
    
    btnRestartSame: document.getElementById('btn-restart-same'),
    btnNewGame: document.getElementById('btn-new-game')
};

let activePlayerContext = null;

// Initialization
function init() {
    setupEventListeners();
    updateVisualization();
    applyLanguage(state.lang);
}

const maxSpiesBlanks = (total) => {
    if (total <= 4) return 1;
    if (total <= 8) return 2;
    return 3;
};

const maxBlanks = (total) => {
    if (total <= 4) return 0;
    return 1;
};

function enforceConstraintsAfterTotalDrop() {
    let t = state.config.total;
    let allowedCombined = maxSpiesBlanks(t);
    let allowedBlanks = maxBlanks(t);
    
    // Check blanks
    if (state.config.blanks > allowedBlanks) {
        state.config.blanks = allowedBlanks;
    }
    // Check combined
    while (state.config.spies + state.config.blanks > allowedCombined) {
        if (state.config.blanks > 0) {
            state.config.blanks--;
        } else {
            state.config.spies--;
            if (state.config.spies < 1) state.config.spies = 1;
        }
        if (state.config.spies === 1 && state.config.blanks === 0) break;
    }
    
    DOM.ui.valTotal.innerText = state.config.total;
    DOM.ui.valSpy.innerText = state.config.spies;
    DOM.ui.valBlank.innerText = state.config.blanks;
    updateVisualization();
}

function processCounterChange(type, delta) {
    if (type === 'total') {
        let n = state.config.total + delta;
        if (n >= 4 && n <= 10) { 
            state.config.total = n; 
            enforceConstraintsAfterTotalDrop();
        }
    } else if (type === 'spy') {
        let n = state.config.spies + delta;
        let allowed = maxSpiesBlanks(state.config.total);
        if (n >= 1 && n <= 3 && (n + state.config.blanks <= allowed)) { 
            state.config.spies = n; 
            DOM.ui.valSpy.innerText = state.config.spies;
            updateVisualization();
        }
    } else if (type === 'blank') {
        let n = state.config.blanks + delta;
        let allowedCombined = maxSpiesBlanks(state.config.total);
        let allowedBlanks = maxBlanks(state.config.total);
        if (n >= 0 && n <= allowedBlanks && (n + state.config.spies <= allowedCombined)) { 
            state.config.blanks = n; 
            DOM.ui.valBlank.innerText = state.config.blanks;
            updateVisualization();
        }
    }
}

function updateVisualization() {
    DOM.ui.vBar.innerHTML = '';
    let total = state.config.total;
    let spy = state.config.spies;
    let blk = state.config.blanks;
    let civ = total - spy - blk;
    
    if (civ < 0) civ = 0;
    
    let civPct = (civ / total) * 100;
    let spyPct = (spy / total) * 100;
    let blkPct = (blk / total) * 100;
    
    const colors = [
        { c: 'rb-civ', w: civPct },
        { c: 'rb-blk', w: blkPct },
        { c: 'rb-spy', w: spyPct }
    ];
    
    colors.forEach(col => {
        if (col.w > 0) {
            let div = document.createElement('div');
            div.className = col.c;
            div.style.width = col.w + '%';
            DOM.ui.vBar.appendChild(div);
        }
    });
    updateDisabledCounters();
}

function updateDisabledCounters() {
    const total = state.config.total;
    const spies = state.config.spies;
    const blanks = state.config.blanks;
    const allowedCombined = maxSpiesBlanks(total);

    document.getElementById('btn-minus-total').disabled = (total <= 4);
    document.getElementById('btn-plus-total').disabled = (total >= 10);
    
    document.getElementById('btn-minus-spy').disabled = (spies <= 1);
    document.getElementById('btn-plus-spy').disabled = (spies + blanks >= allowedCombined);
    
    document.getElementById('btn-minus-blank').disabled = (blanks <= 0);
    document.getElementById('btn-plus-blank').disabled = (blanks >= 1 || spies + blanks >= allowedCombined);
}

function updateStartButtonState() {
    if (state.config.source === 'custom') {
        const cWord = DOM.ui.customCiv.value.trim();
        const sWord = DOM.ui.customSpy.value.trim();
        DOM.ui.btnStart.disabled = (!cWord || !sWord);
    } else {
        DOM.ui.btnStart.disabled = false;
    }
}

function setupEventListeners() {
    // Top Reset button
    DOM.btnTopReset.addEventListener('click', () => {
        if (state.phase === 'game' || state.phase === 'setup' || state.phase === 'setup-bypass') {
            if (!confirm(getLoc('resetConfirmation'))) return;
        }
        resetToHome();
    });
    
    // Language selection
    DOM.flags.forEach(flag => {
        flag.addEventListener('click', () => {
            const newLang = flag.dataset.lang;
            if (state.lang === newLang) return;
            if (state.phase !== 'home') {
                if (!confirm(getLoc('languageChangeWarning'))) return;
                resetToHome();
            }
            state.lang = newLang;
            DOM.flags.forEach(f => f.classList.remove('active'));
            flag.classList.add('active');
            applyLanguage(state.lang);
        });
    });

    // Counters
    document.getElementById('btn-minus-total').addEventListener('click', () => processCounterChange('total', -1));
    document.getElementById('btn-plus-total').addEventListener('click', () => processCounterChange('total', 1));
    document.getElementById('btn-minus-spy').addEventListener('click', () => processCounterChange('spy', -1));
    document.getElementById('btn-plus-spy').addEventListener('click', () => processCounterChange('spy', 1));
    document.getElementById('btn-minus-blank').addEventListener('click', () => processCounterChange('blank', -1));
    document.getElementById('btn-plus-blank').addEventListener('click', () => processCounterChange('blank', 1));

    // Custom Words Toggle
    DOM.ui.toggleCustom.addEventListener('change', (e) => {
        state.config.source = e.target.checked ? 'custom' : 'random';
        if (e.target.checked) DOM.ui.customArea.classList.remove('hidden');
        else DOM.ui.customArea.classList.add('hidden');
        updateStartButtonState();
    });

    DOM.ui.customCiv.addEventListener('input', updateStartButtonState);
    DOM.ui.customSpy.addEventListener('input', updateStartButtonState);

    DOM.ui.btnStart.addEventListener('click', startGame);
    
    DOM.ui.btnResetPlayers.addEventListener('click', () => {
        state.isRestarting = false;
        state.players = [];
        state.originalOrder = [];
        updateHomeUI();
    });

    // Setup Actions
    DOM.btnSelfie.addEventListener('click', () => {
        if (state.phase === 'setup-bypass') viewWordBypassSelfie();
        else takeSelfie();
    });
    DOM.btnRemember.addEventListener('click', () => {
        if (state.phase === 'setup-bypass') nextReSetupPlayer();
        else nextSetupPlayer();
    });

    // Ingame Actions
    DOM.btnIngameForgot.addEventListener('click', () => {
        if (state.selectedPlayerIndex === null) return;
        DOM.ingameActions.classList.add('hidden');
        DOM.ingameRevealOverlay.classList.remove('hidden');
        DOM.ingameWordText.innerHTML = getPlayerWordRevealString(state.players[state.selectedPlayerIndex].role);
        DOM.playerGrid.classList.add('hidden'); // hide grid to prevent cheating
    });

    DOM.btnIngameRemember.addEventListener('click', () => {
        DOM.ingameRevealOverlay.classList.add('hidden');
        state.selectedPlayerIndex = null;
        DOM.playerGrid.classList.remove('hidden');
        renderPlayerGrid();
    });

    DOM.btnIngameExec.addEventListener('click', executePlayer);

    DOM.btnEndSeeResults.addEventListener('click', () => {
        DOM.endModal.classList.add('hidden');
        state.phase = 'end';
        DOM.postgameActions.classList.remove('hidden');
        DOM.endgameWordsReveal.classList.remove('hidden');
        DOM.endgameWordsText.innerHTML = `${getLoc('roleCivilian')}: ${state.currentWords.civilian} <br> ${getLoc('roleSpy')}: ${state.currentWords.spy}`;
        renderPlayerGrid();
    });

    // End Game Actions
    DOM.btnRestartSame.addEventListener('click', restartWithSamePlayers);
    DOM.btnNewGame.addEventListener('click', resetToHome);
}

// --- Localization ---
function getLoc(key) {
    return LOCALIZATION_MAP[state.lang][key] || key;
}

function applyLanguage(lang) {
    const loc = LOCALIZATION_MAP[lang];
    document.title = loc.title;
    DOM.btnTopReset.innerText = loc.resetGame;
    DOM.btnEndSeeResults.innerText = loc.seeResults;
    
    DOM.ui.lblTotal.innerText = loc.totalPlayers;
    DOM.ui.lblSpy.innerText = loc.spyCount;
    DOM.ui.lblBlank.innerText = loc.blankCount;
    DOM.ui.lblToggle.innerText = loc.customWordsToggle;
    
    DOM.ui.customCiv.placeholder = loc.customCivilianWord;
    DOM.ui.customSpy.placeholder = loc.customSpyWord;
    DOM.ui.btnStart.innerText = loc.startGame;
    
    DOM.doNotShowOthers.innerText = loc.doNotShowOthers;
    DOM.btnRemember.innerText = loc.iRemember;
    
    if (DOM.btnIngameForgot) DOM.btnIngameForgot.innerText = loc.forgotWord;
    if (DOM.btnIngameExec) DOM.btnIngameExec.innerText = loc.execute;
    if (DOM.btnIngameRemember) DOM.btnIngameRemember.innerText = loc.iRemember;
    
    DOM.btnRestartSame.innerText = loc.restartSamePlayers;
    DOM.btnNewGame.innerText = loc.newGame;
    
    updateGameHeaderStrings();
}

function updateGameHeaderStrings() {
    // Replaced by visual bar
}

// --- Configuration & Validation ---
function validateConfig() {
    return state.config.spies + state.config.blanks < state.config.total;
}

// --- Game Logic ---
function startGame() {
    if (!state.isRestarting && !validateConfig()) return;
    
    state.config.source = DOM.ui.toggleCustom.checked ? 'custom' : 'random';
    
    if (state.config.source === 'custom') {
        state.config.customCivilian = DOM.ui.customCiv.value.trim();
        state.config.customSpy = DOM.ui.customSpy.value.trim();
        if (!state.config.customCivilian || !state.config.customSpy) return;
        state.currentWords.civilian = state.config.customCivilian;
        state.currentWords.spy = state.config.customSpy;
    } else {
        const wordList = WORDS_MAP[state.lang];
        const pair = wordList[Math.floor(Math.random() * wordList.length)];
        state.currentWords.civilian = pair.civilian;
        state.currentWords.spy = pair.spy;
    }
    
    DOM.postgameActions.classList.add('hidden');
    DOM.endgameWordsReveal.classList.add('hidden');

    if (state.isRestarting) {
        state.globalPlayDirection = (state.globalPlayDirection === 1) ? -1 : 1;
        state.playDirection = state.globalPlayDirection;
        state.turnFocusIndex = state.playDirection === 1 ? 0 : state.players.length - 1;
        
        doRestartWithNewRoles();
    } else {
        generateRoles();
        state.phase = 'setup';
        state.setupIndex = 0;
        state.turnFocusIndex = 0;
        state.playDirection = 1;
        state.globalPlayDirection = 1;
        state.selectedPlayerIndex = null;

        switchScreen('setup');
        initCamera();
        prepareSetupNextPlayer();
    }
}

function generateRoles() {
    let roles = [];
    for(let i=0; i<state.config.spies; i++) roles.push('spy');
    for(let i=0; i<state.config.blanks; i++) roles.push('blank');
    while(roles.length < state.config.total) roles.push('civilian');
    
    roles.sort(() => Math.random() - 0.5);
    
    state.players = roles.map((r, idx) => ({
        id: idx + 1,
        role: r,
        word: r === 'civilian' ? state.currentWords.civilian : (r === 'spy' ? state.currentWords.spy : 'blank'),
        img: null,
        eliminated: false,
        initialPos: idx 
    }));
    
    state.originalOrder = JSON.parse(JSON.stringify(state.players));
}

// --- Screens Transition ---
function switchScreen(screenName) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[screenName].classList.remove('hidden');
    
    // Header Logic
    if (screenName === 'game' || screenName === 'end' || screenName === 'setup') {
        DOM.btnTopReset.classList.remove('hidden');
    } else {
        DOM.btnTopReset.classList.add('hidden');
    }
}

// --- Camera & Setup Flow ---
async function initCamera() {
    DOM.video.classList.remove('hidden');
    DOM.preview.classList.add('hidden');
    DOM.wordRevealArea.classList.add('hidden');
    DOM.doNotShowOthers.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
    DOM.setupTitle.classList.remove('hidden');

    try {
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
        state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        DOM.video.srcObject = state.stream;
    } catch (err) {
        console.error("Camera access error:", err);
        // Do not block UX if camera error, they'll get mocked avatars
    }
}

function stopCamera() {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    DOM.video.srcObject = null;
}

function prepareSetupNextPlayer() {
    const p = state.players[state.setupIndex];
    DOM.setupTitle.innerText = getLoc('handToPlayerN').replace('{n}', p.id);
    DOM.btnSelfie.innerText = getLoc('playerReady').replace('{n}', p.id);

    DOM.setupTitle.classList.remove('hidden');
    DOM.video.classList.remove('hidden');
    DOM.preview.classList.add('hidden');
    DOM.wordRevealArea.classList.add('hidden');
    DOM.doNotShowOthers.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
}

function getPlayerWordRevealString(role) {
    if (role === 'civilian') return state.currentWords.civilian;
    if (role === 'spy') return state.currentWords.spy;
    return `<span class="small-text">${getLoc('blankWordPrompt')}</span>`;
}

function takeSelfie() {
    if (state.stream) {
        DOM.canvas.width = DOM.video.videoWidth;
        DOM.canvas.height = DOM.video.videoHeight;
        DOM.canvas.getContext('2d').drawImage(DOM.video, 0, 0);
        state.players[state.setupIndex].img = DOM.canvas.toDataURL('image/jpeg', 0.8);
    } else {
        state.players[state.setupIndex].img = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23cbd5e1"><rect width="200" height="200" fill="%23475569"/><circle cx="100" cy="80" r="40"/><path d="M40 180 q 60 -100 120 0"/></svg>';
    }

    // Persist to originalOrder so repeating games retain images
    const originalRef = state.originalOrder.find(p => p.id === state.players[state.setupIndex].id);
    if (originalRef) originalRef.img = state.players[state.setupIndex].img;

    DOM.preview.src = state.players[state.setupIndex].img;
    DOM.video.classList.add('hidden');
    DOM.preview.classList.remove('hidden');

    DOM.btnSelfie.classList.add('hidden');
    DOM.setupTitle.classList.add('hidden'); // Remove Hand to Player X
    DOM.doNotShowOthers.classList.remove('hidden');
    
    // Reveal word
    DOM.wordRevealArea.classList.remove('hidden');
    DOM.btnRemember.classList.remove('hidden');
    
    DOM.wordRevealText.innerHTML = getPlayerWordRevealString(state.players[state.setupIndex].role);
}

function nextSetupPlayer() {
    state.setupIndex++;
    if (state.setupIndex < state.players.length) {
        prepareSetupNextPlayer();
    } else {
        stopCamera();
        startMainGame();
    }
}

// --- Main Game Flow ---
function startMainGame() {
    state.phase = 'game';
    state.selectedPlayerIndex = null;
    switchScreen('game');
    renderPlayerGrid();
    updateInGameVisualization();
}

function getRemainingCount() {
    return state.players.filter(p => !p.eliminated).length;
}

function updateInGameVisualization() {
    DOM.ingameVBar.innerHTML = '';
    const counts = { civ: 0, spy: 0, blk: 0, deadCiv: 0, deadSpy: 0, deadBlk: 0 };
    
    state.players.forEach(p => {
        if (p.eliminated) {
            if (p.role === 'civilian') counts.deadCiv++;
            else if (p.role === 'spy') counts.deadSpy++;
            else counts.deadBlk++;
        } else {
            if (p.role === 'civilian') counts.civ++;
            else if (p.role === 'spy') counts.spy++;
            else counts.blk++;
        }
    });

    const total = state.players.length;
    const segments = [
        { c: 'rb-civ', w: (counts.civ/total)*100, dead: false },
        { c: 'rb-civ rb-dead', w: (counts.deadCiv/total)*100, dead: true },
        { c: 'rb-blk', w: (counts.blk/total)*100, dead: false },
        { c: 'rb-blk rb-dead', w: (counts.deadBlk/total)*100, dead: true },
        { c: 'rb-spy', w: (counts.spy/total)*100, dead: false },
        { c: 'rb-spy rb-dead', w: (counts.deadSpy/total)*100, dead: true }
    ];

    segments.forEach(seg => {
        if (seg.w > 0) {
            let div = document.createElement('div');
            div.className = seg.c;
            div.style.width = seg.w + '%';
            if (seg.dead) {
                div.innerHTML = '💀';
            }
            DOM.ingameVBar.appendChild(div);
        }
    });
}

function renderPlayerGrid() {
    DOM.playerGrid.innerHTML = '';
    state.players.forEach((p, index) => {
        let classes = 'player-item';
        if (p.eliminated) classes += ' eliminated';
        if (state.selectedPlayerIndex === index && state.phase === 'game') classes += ' selected';
        
        let arrowHtml = '';
        if (!p.eliminated && index === state.turnFocusIndex && state.phase === 'game') {
            const dirClass = state.playDirection === 1 ? 'dir-right' : 'dir-left';
            const arrowChar = state.playDirection === 1 ? '→' : '←';
            arrowHtml = `
            <div class="turn-indicator ${dirClass}">
                <div class="turn-indicator-text">ROUND</div>
                <div class="turn-arrow">${arrowChar}</div>
                <div class="turn-indicator-text">START</div>
            </div>`;
        }
        
        // Show role label if eliminated OR if game has ended
        let roleHtml = '';
        if (p.eliminated || state.phase === 'end') {
            roleHtml = `<div class="player-role-label">${getLoc(p.role === 'civilian' ? 'roleCivilian' : (p.role === 'spy' ? 'roleSpy' : 'roleBlank'))}</div>`;
            classes += (p.role === 'civilian') ? ' bg-civ' : (p.role === 'spy' ? ' bg-spy' : ' bg-blk');
            if (p.eliminated) classes += ' striped-dead';
        }
        
        const item = document.createElement('div');
        item.className = classes;
        
        let skullHtml = p.eliminated ? ' 💀' : '';
        item.innerHTML = `
            ${arrowHtml}
            <div class="player-img-wrapper">
                <img src="${p.img}" alt="Player ${p.id}">
            </div>
            <div class="player-number">P${p.id}${skullHtml}</div>
            ${roleHtml}
        `;
        if (!p.eliminated && state.phase === 'game') {
            item.addEventListener('click', () => togglePlayerSelection(index));
        }
        DOM.playerGrid.appendChild(item);
    });
    
    if (state.selectedPlayerIndex !== null && state.phase === 'game') {
        DOM.ingameActions.classList.remove('hidden');
    } else {
        DOM.ingameActions.classList.add('hidden');
    }
}

// --- Player Actions ---
function togglePlayerSelection(index) {
    if (state.selectedPlayerIndex === index) {
        state.selectedPlayerIndex = null;
    } else {
        state.selectedPlayerIndex = index;
    }
    renderPlayerGrid();
}

function executePlayer() {
    if (state.selectedPlayerIndex === null) return;
    const idx = state.selectedPlayerIndex;
    state.players[idx].eliminated = true;
    const player = state.players[idx];
    
    state.selectedPlayerIndex = null;
    state.playDirection *= -1;
    
    let nextIdx = idx;
    let found = false;
    for (let i = 0; i < state.players.length; i++) {
        nextIdx = (nextIdx + state.playDirection + state.players.length) % state.players.length;
        if (!state.players[nextIdx].eliminated) {
            state.turnFocusIndex = nextIdx;
            found = true;
            break;
        }
    }
    if (!found) state.turnFocusIndex = idx;
    
    checkWinCondition();
}

function checkWinCondition() {
    const remainingPlayers = state.players.filter(p => !p.eliminated);
    const spies = remainingPlayers.filter(p => p.role === 'spy').length;
    const civiliansAndBlanks = remainingPlayers.length - spies; // Blanks act as civilians
    
    let winner = null;
    
    if (spies >= civiliansAndBlanks) {
        winner = 'Spies';
    } else if (spies === 0) {
        winner = 'Civilians';
    }

    if (winner) {
        showEndGame(winner);
    } else {
        updateInGameVisualization();
        renderPlayerGrid();
    }
}

function showEndGame(winner) {
    DOM.endModal.classList.remove('hidden');
    DOM.postgameActions.classList.add('hidden');
    
    DOM.winnerText.innerText = winner === 'Spies' ? getLoc('spiesWin') : getLoc('civiliansWin');
    DOM.winnerText.style.background = winner === 'Spies' ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 'linear-gradient(90deg, #10b981, #3b82f6)';
    DOM.winnerText.style.webkitBackgroundClip = 'text';
    
    if (winner === 'Civilians') {
        DOM.endSpyWord.classList.remove('hidden');
        DOM.endSpyWord.innerHTML = `${getLoc('spyWordLabel')}<span style="color: var(--accent-color)">${state.currentWords.spy}</span>`;
        DOM.endGuessPrompt.innerText = getLoc('civiliansWinPrompt');
    } else {
        DOM.endGuessPrompt.innerText = getLoc('spiesWinPrompt');
        DOM.endSpyWord.classList.add('hidden');
    }
    
    renderPlayerGrid();
    updateInGameVisualization();
}

function restartWithSamePlayers() {
    state.isRestarting = true;
    state.phase = 'home';
    switchScreen('home');
    updateHomeUI();
}

function updateHomeUI() {
    if (state.isRestarting) {
        DOM.ui.configCounters.classList.add('hidden');
        DOM.ui.existingPlayersGroup.classList.remove('hidden');
        DOM.ui.lblExisting.innerText = getLoc('usingExistingPlayers').replace('{n}', state.players.length);
        DOM.ui.vBar.parentElement.classList.add('hidden');
    } else {
        DOM.ui.configCounters.classList.remove('hidden');
        DOM.ui.existingPlayersGroup.classList.add('hidden');
        DOM.ui.vBar.parentElement.classList.remove('hidden');
    }
}

function doRestartWithNewRoles() {
    let roles = [];
    for(let i=0; i<state.config.spies; i++) roles.push('spy');
    for(let i=0; i<state.config.blanks; i++) roles.push('blank');
    while(roles.length < state.config.total) roles.push('civilian');
    
    roles.sort(() => Math.random() - 0.5);
    
    state.players = state.originalOrder.map((oldObj, index) => {
        return {
            id: oldObj.id,
            role: roles[index],
            word: roles[index] === 'civilian' ? 'civilian' : (roles[index] === 'spy' ? 'spy' : 'blank'),
            img: oldObj.img,
            eliminated: false,
            initialPos: oldObj.initialPos
        };
    });
    
    state.selectedPlayerIndex = null;
    state.phase = 'setup-bypass';
    state.setupIndex = 0;
    
    DOM.postgameActions.classList.add('hidden');
    switchScreen('setup');
    prepareReSetupNextPlayer();
}

function prepareReSetupNextPlayer() {
    const p = state.players[state.setupIndex];
    DOM.setupTitle.innerText = getLoc('handToPlayerN').replace('{n}', p.id);
    DOM.btnSelfie.innerText = getLoc('thatsMe');

    DOM.setupTitle.classList.remove('hidden');
    DOM.video.classList.add('hidden');
    DOM.preview.src = p.img;
    DOM.preview.classList.remove('hidden');
    
    DOM.wordRevealArea.classList.add('hidden');
    DOM.doNotShowOthers.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
}

function viewWordBypassSelfie() {
    DOM.btnSelfie.classList.add('hidden');
    DOM.setupTitle.classList.add('hidden');
    DOM.doNotShowOthers.classList.remove('hidden');
    
    DOM.wordRevealArea.classList.remove('hidden');
    DOM.btnRemember.classList.remove('hidden');
    
    DOM.wordRevealText.innerHTML = getPlayerWordRevealString(state.players[state.setupIndex].role);
}

function nextReSetupPlayer() {
    state.setupIndex++;
    if (state.setupIndex < state.players.length) {
        prepareReSetupNextPlayer();
    } else {
        startMainGame();
    }
}

function resetToHome() {
    stopCamera();
    state.isRestarting = false;
    state.phase = 'home';
    state.players = [];
    state.originalOrder = [];
    switchScreen('home');
    updateHomeUI();
}

document.addEventListener('DOMContentLoaded', init);
