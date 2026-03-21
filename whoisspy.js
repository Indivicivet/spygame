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
        total: 6,
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
    
    playDirection: 1, // 1 (forward), -1 (backward)
    
    stream: null
};

// DOM Elements cache
const DOM = {
    screens: {
        home: document.getElementById('home-screen'),
        setup: document.getElementById('setup-action-screen'),
        game: document.getElementById('main-game-screen'),
        end: document.getElementById('end-game-screen')
    },
    flags: document.querySelectorAll('.flag'),
    appTitle: document.getElementById('app-title'),
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
    lblRemain: document.getElementById('lbl-players-remaining'),
    lblDirection: document.getElementById('lbl-play-direction'),
    lblGamePhase: document.getElementById('lbl-game-phase'),
    playerGrid: document.getElementById('player-grid'),
    
    // Modals
    actionModal: document.getElementById('action-modal'),
    modalName: document.getElementById('modal-player-name'),
    modalImg: document.getElementById('modal-player-img'),
    modalRevealWord: document.getElementById('modal-reveal-word'),
    modalWordText: document.getElementById('modal-forgot-word-text'),
    modalActions: document.getElementById('modal-actions'),
    btnModalForgot: document.getElementById('btn-modal-forgot'),
    btnModalExec: document.getElementById('btn-modal-execute'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalRemember: document.getElementById('btn-modal-remember'),
    
    identityModal: document.getElementById('identity-modal'),
    identityText: document.getElementById('identity-revealed-text'),
    btnIdentityContinue: document.getElementById('btn-identity-continue'),
    
    // End Game Screen
    winnerText: document.getElementById('end-winner-text'),
    winningWordText: document.getElementById('end-winning-word-text'),
    endPlayerList: document.getElementById('end-players-list'),
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
        { c: 'rb-spy', w: spyPct },
        { c: 'rb-blk', w: blkPct }
    ];
    
    colors.forEach(col => {
        if (col.w > 0) {
            let div = document.createElement('div');
            div.className = col.c;
            div.style.width = col.w + '%';
            DOM.ui.vBar.appendChild(div);
        }
    });
}

function setupEventListeners() {
    // Top Reset button
    DOM.btnTopReset.addEventListener('click', resetToHome);
    
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
        if (e.target.checked) DOM.ui.customArea.classList.remove('hidden');
        else DOM.ui.customArea.classList.add('hidden');
    });

    DOM.ui.btnStart.addEventListener('click', startGame);

    // Setup Actions
    DOM.btnSelfie.addEventListener('click', takeSelfie);
    DOM.btnRemember.addEventListener('click', nextSetupPlayer);

    // Modal Actions
    DOM.btnModalCancel.addEventListener('click', closeActionModal);
    
    DOM.btnModalForgot.addEventListener('click', () => {
        DOM.modalActions.classList.add('hidden');
        DOM.modalRevealWord.classList.remove('hidden');
        DOM.modalWordText.innerHTML = getPlayerWordRevealString(activePlayerContext.role);
    });

    DOM.btnModalRemember.addEventListener('click', closeActionModal);
    DOM.btnModalExec.addEventListener('click', executePlayer);

    DOM.btnIdentityContinue.addEventListener('click', () => {
        DOM.identityModal.classList.add('hidden');
        checkWinCondition();
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
    DOM.appTitle.innerText = loc.title;
    DOM.btnTopReset.innerText = loc.resetGame;
    
    DOM.ui.lblTotal.innerText = loc.totalPlayers;
    DOM.ui.lblSpy.innerText = loc.spyCount;
    DOM.ui.lblBlank.innerText = loc.blankCount;
    DOM.ui.lblToggle.innerText = loc.customWordsToggle;
    
    DOM.ui.customCiv.placeholder = loc.customCivilianWord;
    DOM.ui.customSpy.placeholder = loc.customSpyWord;
    DOM.ui.btnStart.innerText = loc.startGame;
    
    DOM.doNotShowOthers.innerText = loc.doNotShowOthers;
    DOM.btnRemember.innerText = loc.iRemember;
    
    DOM.lblGamePhase.innerText = loc.gamePhaseVoting;
    DOM.btnModalForgot.innerText = loc.forgotWord;
    DOM.btnModalExec.innerText = loc.execute;
    DOM.btnModalCancel.innerText = loc.cancel;
    DOM.btnModalRemember.innerText = loc.iRemember;
    
    DOM.btnRestartSame.innerText = loc.restartSamePlayers;
    DOM.btnNewGame.innerText = loc.newGame;
    
    updateGameHeaderStrings();
}

function updateGameHeaderStrings() {
    if (state.phase === 'game') {
        DOM.lblRemain.innerText = getLoc('playersRemaining') + ": " + getRemainingCount();
        const dirText = state.playDirection === 1 ? getLoc('directionForward') : getLoc('directionBackward');
        DOM.lblDirection.innerText = getLoc('playDirection') + dirText;
    }
}

// --- Configuration & Validation ---
function validateConfig() {
    return state.config.spies + state.config.blanks < state.config.total;
}

// --- Game Logic ---
function startGame() {
    if (!validateConfig()) return;
    state.config.source = DOM.ui.toggleCustom.checked ? 'custom' : 'random';
    
    if (state.config.source === 'custom') {
        state.config.customCivilian = DOM.ui.customCiv.value.trim();
        state.config.customSpy = DOM.ui.customSpy.value.trim();
        if (!state.config.customCivilian || !state.config.customSpy) {
            alert("Please enter custom words.");
            return;
        }
        state.currentWords.civilian = state.config.customCivilian;
        state.currentWords.spy = state.config.customSpy;
    } else {
        const wordList = WORDS_MAP[state.lang];
        const pair = wordList[Math.floor(Math.random() * wordList.length)];
        state.currentWords.civilian = pair.civilian;
        state.currentWords.spy = pair.spy;
    }

    generateRoles();
    state.phase = 'setup';
    state.setupIndex = 0;
    state.playDirection = 1;

    switchScreen('setup');
    initCamera();
    prepareSetupNextPlayer();
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
    if (screenName === 'game' || screenName === 'end') {
        DOM.appTitle.classList.add('hidden');
        DOM.btnTopReset.classList.remove('hidden');
    } else {
        DOM.appTitle.classList.remove('hidden');
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
    switchScreen('game');
    renderPlayerGrid();
    updateGameHeaderStrings();
}

function getRemainingCount() {
    return state.players.filter(p => !p.eliminated).length;
}

function renderPlayerGrid() {
    DOM.playerGrid.innerHTML = '';
    state.players.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'player-item' + (p.eliminated ? ' eliminated' : '');
        item.innerHTML = `
            <div class="player-img-wrapper">
                <img src="${p.img}" alt="Player ${p.id}">
            </div>
            <div class="player-number">P${p.id}</div>
            ${p.eliminated ? `<div class="player-role-label">${getLoc(p.role === 'civilian' ? 'roleCivilian' : (p.role === 'spy' ? 'roleSpy' : 'roleBlank'))}</div>` : ''}
        `;
        if (!p.eliminated) {
            item.addEventListener('click', () => openActionModal(p, index));
        }
        DOM.playerGrid.appendChild(item);
    });
}

// --- Player Actions ---
function openActionModal(player, index) {
    activePlayerContext = { ...player, index };
    DOM.modalName.innerText = `Player ${player.id}`;
    DOM.modalImg.src = player.img;
    DOM.modalActions.classList.remove('hidden');
    DOM.modalRevealWord.classList.add('hidden');
    DOM.actionModal.classList.remove('hidden');
}

function closeActionModal() {
    DOM.actionModal.classList.add('hidden');
    activePlayerContext = null;
}

function executePlayer() {
    const idx = activePlayerContext.index;
    state.players[idx].eliminated = true;
    const player = state.players[idx];
    
    closeActionModal();
    
    state.playDirection *= -1;
    
    let roleLocStr = getLoc(player.role === 'civilian' ? 'roleCivilian' : (player.role === 'spy' ? 'roleSpy' : 'roleBlank'));
    let identityMsg = getLoc('identityRevealed').replace('{player}', `Player ${player.id}`).replace('{role}', roleLocStr);
    
    DOM.identityText.innerText = identityMsg;
    DOM.identityText.style.color = (player.role === 'spy' || player.role === 'blank') ? 'var(--danger-color)' : 'var(--accent-color)';
    DOM.identityModal.classList.remove('hidden');
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
        renderPlayerGrid();
        updateGameHeaderStrings();
    }
}

function showEndGame(winner) {
    state.phase = 'end';
    switchScreen('end');
    
    DOM.winnerText.innerText = winner === 'Spies' ? getLoc('spiesWin') : getLoc('civiliansWin');
    DOM.winnerText.style.background = winner === 'Spies' ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 'linear-gradient(90deg, #10b981, #3b82f6)';
    DOM.winnerText.style.webkitBackgroundClip = 'text';
    
    let winningWordStr = getLoc('winningWordWas')
        .replace('{civilian}', state.currentWords.civilian)
        .replace('{spy}', state.currentWords.spy);
    DOM.winningWordText.innerText = winningWordStr;
    
    DOM.endPlayerList.innerHTML = '';
    state.players.forEach(p => {
        let roleLocStr = getLoc(p.role === 'civilian' ? 'roleCivilian' : (p.role === 'spy' ? 'roleSpy' : 'roleBlank'));
        const row = document.createElement('div');
        row.className = 'end-player-row';
        row.innerHTML = `
            <span>Player ${p.id}</span>
            <span style="color: ${p.role === 'spy' ? 'var(--danger-color)' : 'inherit'}">${roleLocStr}</span>
        `;
        DOM.endPlayerList.appendChild(row);
    });
}

function restartWithSamePlayers() {
    let baseOrder = JSON.parse(JSON.stringify(state.originalOrder));
    baseOrder.reverse();
    const last = baseOrder.pop();
    baseOrder.unshift(last);
    
    state.originalOrder = JSON.parse(JSON.stringify(baseOrder));
    
    if (state.config.source === 'random') {
        const wordList = WORDS_MAP[state.lang];
        const pair = wordList[Math.floor(Math.random() * wordList.length)];
        state.currentWords.civilian = pair.civilian;
        state.currentWords.spy = pair.spy;
        
        doRestartWithNewRoles();
    } else {
        let cWord = prompt("Next round custom " + getLoc('customCivilianWord'));
        let sWord = prompt("Next round custom " + getLoc('customSpyWord'));
        if (cWord && sWord) {
            state.currentWords.civilian = cWord.trim();
            state.currentWords.spy = sWord.trim();
            doRestartWithNewRoles();
        } else {
            alert("Custom words cancelled. Going to home screen.");
            resetToHome();
        }
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
    
    state.playDirection = 1;
    state.phase = 'setup';
    state.setupIndex = 0;
    
    switchScreen('setup');
    prepareReSetupNextPlayer();
}

function prepareReSetupNextPlayer() {
    const p = state.players[state.setupIndex];
    DOM.setupTitle.innerText = getLoc('handToPlayerN').replace('{n}', p.id);
    DOM.btnSelfie.innerText = getLoc('playerReady').replace('{n}', p.id) + " (View Word)";

    DOM.setupTitle.classList.remove('hidden');
    DOM.video.classList.add('hidden');
    DOM.preview.src = p.img;
    DOM.preview.classList.remove('hidden');
    
    DOM.wordRevealArea.classList.add('hidden');
    DOM.doNotShowOthers.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
    
    DOM.btnSelfie.onclick = viewWordBypassSelfie;
}

function viewWordBypassSelfie() {
    DOM.btnSelfie.classList.add('hidden');
    DOM.setupTitle.classList.add('hidden');
    DOM.doNotShowOthers.classList.remove('hidden');
    
    DOM.wordRevealArea.classList.remove('hidden');
    DOM.btnRemember.classList.remove('hidden');
    
    DOM.wordRevealText.innerHTML = getPlayerWordRevealString(state.players[state.setupIndex].role);
    
    DOM.btnRemember.onclick = nextReSetupPlayer;
}

function nextReSetupPlayer() {
    state.setupIndex++;
    if (state.setupIndex < state.players.length) {
        prepareReSetupNextPlayer();
    } else {
        DOM.btnSelfie.onclick = takeSelfie;
        DOM.btnRemember.onclick = nextSetupPlayer;
        startMainGame();
    }
}

function resetToHome() {
    stopCamera();
    state.phase = 'home';
    state.players = [];
    state.originalOrder = [];
    switchScreen('home');
}

document.addEventListener('DOMContentLoaded', init);
