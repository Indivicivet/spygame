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
    
    // Home screen
    inputs: {
        total: document.getElementById('input-total-players'),
        spies: document.getElementById('input-spy-count'),
        blanks: document.getElementById('input-blank-count'),
        source: document.getElementById('select-word-source'),
        customCivilian: document.getElementById('input-custom-civilian'),
        customSpy: document.getElementById('input-custom-spy')
    },
    warning: document.getElementById('player-count-warning'),
    customWordsArea: document.getElementById('custom-word-inputs'),
    btnStart: document.getElementById('btn-start-game'),
    
    // Setup Screen
    setupTitle: document.getElementById('setup-player-title'),
    video: document.getElementById('camera-view'),
    canvas: document.getElementById('camera-canvas'),
    preview: document.getElementById('selfie-preview'),
    btnSelfie: document.getElementById('btn-take-selfie'),
    btnRemember: document.getElementById('btn-i-remember'),
    wordRevealArea: document.getElementById('word-reveal-area'),
    wordRevealText: document.getElementById('word-reveal-text'),
    photoPrompt: document.getElementById('photo-taken-prompt'),
    
    // Main Game Screen
    lblRemain: document.getElementById('lbl-players-remaining'),
    lblDirection: document.getElementById('lbl-play-direction'),
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
    applyLanguage(state.lang);
}

function setupEventListeners() {
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

    // Home Inputs
    DOM.inputs.source.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            DOM.customWordsArea.classList.remove('hidden');
        } else {
            DOM.customWordsArea.classList.add('hidden');
        }
    });

    DOM.inputs.total.addEventListener('change', validateConfig);
    DOM.inputs.spies.addEventListener('change', validateConfig);
    DOM.inputs.blanks.addEventListener('change', validateConfig);

    DOM.btnStart.addEventListener('click', startGame);

    // Setup Actions
    DOM.btnSelfie.addEventListener('click', takeSelfie);
    DOM.btnRemember.addEventListener('click', nextSetupPlayer);

    // Modal Actions
    DOM.btnModalCancel.addEventListener('click', () => {
        closeActionModal();
    });
    
    DOM.btnModalForgot.addEventListener('click', () => {
        DOM.modalActions.classList.add('hidden');
        DOM.modalRevealWord.classList.remove('hidden');
        let text = "";
        if (activePlayerContext.role === 'civilian') text = state.currentWords.civilian;
        else if (activePlayerContext.role === 'spy') text = getLoc('spyWordPrompt').replace('{word}', state.currentWords.spy);
        else text = getLoc('blankWordPrompt');
        
        DOM.modalWordText.innerText = getLoc('yourWordIs') + " " + text;
    });

    DOM.btnModalRemember.addEventListener('click', () => {
        closeActionModal();
    });

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
    return localization[state.lang][key] || key;
}

function applyLanguage(lang) {
    const loc = localization[lang];
    document.title = loc.title;
    document.getElementById('app-title').innerText = loc.title;
    
    document.getElementById('lbl-total-players').innerText = loc.totalPlayers;
    document.getElementById('lbl-spy-count').innerText = loc.spyCount;
    document.getElementById('lbl-blank-count').innerText = loc.blankCount;
    document.getElementById('lbl-word-source').innerText = loc.wordSource;
    document.getElementById('opt-random-words').innerText = loc.randomWords;
    document.getElementById('opt-custom-words').innerText = loc.customWords;
    document.getElementById('custom-words-prompt').innerText = loc.customWordsPrompt;
    DOM.inputs.customCivilian.placeholder = loc.customCivilianWord;
    DOM.inputs.customSpy.placeholder = loc.customSpyWord;
    DOM.warning.innerText = loc.playerCountWarning;
    DOM.btnStart.innerText = loc.startGame;
    
    document.getElementById('photo-taken-prompt').innerText = loc.photoTakenPrompt;
    DOM.btnRemember.innerText = loc.iRemember;
    DOM.btnTakeSelfie = loc.playerReady; // updated dynamically
    
    document.getElementById('lbl-game-phase').innerText = loc.gamePhaseVoting;
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
    let t = parseInt(DOM.inputs.total.value),
        s = parseInt(DOM.inputs.spies.value),
        b = parseInt(DOM.inputs.blanks.value);
    
    let valid = true;
    if (t < 4 || t > 10) valid = false;
    else if (t === 4 && (s > 1 || b > 0)) valid = false;
    else if (t >= 5 && t <= 8 && (s + b > 2)) valid = false;
    else if (t >= 9 && (s + b > 3)) valid = false;
    else if (s < 1) valid = false;
    
    if (!valid) {
        DOM.warning.classList.remove('hidden');
        DOM.btnStart.disabled = true;
    } else {
        DOM.warning.classList.add('hidden');
        DOM.btnStart.disabled = false;
        state.config = { total: t, spies: s, blanks: b, source: DOM.inputs.source.value };
    }
    return valid;
}

// --- Game Logic ---
function startGame() {
    if (!validateConfig()) return;
    state.config.source = DOM.inputs.source.value;
    
    if (state.config.source === 'custom') {
        state.config.customCivilian = DOM.inputs.customCivilian.value.trim();
        state.config.customSpy = DOM.inputs.customSpy.value.trim();
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
    
    // shuffle
    roles.sort(() => Math.random() - 0.5);
    
    state.players = roles.map((r, idx) => ({
        id: idx + 1,
        role: r,
        word: r === 'civilian' ? 'civilian' : (r === 'spy' ? 'spy' : 'blank'),
        img: null,
        eliminated: false,
        initialPos: idx // retain global original order tracker
    }));
    
    // deep copy to original order
    state.originalOrder = JSON.parse(JSON.stringify(state.players));
}

// --- Screens Transition ---
function switchScreen(screenName) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[screenName].classList.remove('hidden');
}

// --- Camera & Setup Flow ---
async function initCamera() {
    DOM.video.classList.remove('hidden');
    DOM.preview.classList.add('hidden');
    DOM.wordRevealArea.classList.add('hidden');
    DOM.photoPrompt.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');

    try {
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
        }
        state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        DOM.video.srcObject = state.stream;
    } catch (err) {
        console.error("Camera access error:", err);
        // fallback to placeholder if error
        alert("Camera access denied or unavailable. Using fallback avatars.");
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

    DOM.video.classList.remove('hidden');
    DOM.preview.classList.add('hidden');
    DOM.wordRevealArea.classList.add('hidden');
    DOM.photoPrompt.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
}

function takeSelfie() {
    // Process selfie capturing
    if (state.stream) {
        DOM.canvas.width = DOM.video.videoWidth;
        DOM.canvas.height = DOM.video.videoHeight;
        DOM.canvas.getContext('2d').drawImage(DOM.video, 0, 0);
        state.players[state.setupIndex].img = DOM.canvas.toDataURL('image/jpeg', 0.8);
    } else {
        // Mock image if camera failed
        state.players[state.setupIndex].img = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23cbd5e1"><rect width="200" height="200" fill="%23475569"/><circle cx="100" cy="80" r="40"/><path d="M40 180 q 60 -100 120 0"/></svg>';
    }

    DOM.preview.src = state.players[state.setupIndex].img;
    DOM.video.classList.add('hidden');
    DOM.preview.classList.remove('hidden');

    DOM.btnSelfie.classList.add('hidden');
    DOM.photoPrompt.classList.remove('hidden');
    
    // Reveal word
    DOM.wordRevealArea.classList.remove('hidden');
    DOM.btnRemember.classList.remove('hidden');
    
    const role = state.players[state.setupIndex].role;
    let wordText = "";
    if (role === 'civilian') wordText = state.currentWords.civilian;
    else if (role === 'spy') wordText = getLoc('spyWordPrompt').replace('{word}', state.currentWords.spy);
    else wordText = getLoc('blankWordPrompt');
    
    DOM.wordRevealText.innerText = getLoc('yourWordIs') + " " + wordText;
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
    
    // Toggle play direction based on elimination
    state.playDirection *= -1;
    
    // Show Identity Reveal Modal
    let roleLocStr = getLoc(player.role === 'civilian' ? 'roleCivilian' : (player.role === 'spy' ? 'roleSpy' : 'roleBlank'));
    let identityMsg = getLoc('identityRevealed').replace('{player}', `Player ${player.id}`).replace('{role}', roleLocStr);
    
    DOM.identityText.innerText = identityMsg;
    // Set color based on role
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
    
    // Populate end grid
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
    // Keep internal order state reverse and offset 1
    // Example: Initially [1,2,3,4,5]
    // Next game: reverse([1,2,3,4,5]) => [5,4,3,2,1] and offset +1 => [1,5,4,3,2]
    
    let baseOrder = JSON.parse(JSON.stringify(state.originalOrder));
    baseOrder.reverse();
    // Offset forwards by 1
    const last = baseOrder.pop();
    baseOrder.unshift(last);
    
    state.originalOrder = JSON.parse(JSON.stringify(baseOrder));
    
    // Assign new words depending on custom/random
    if (state.config.source === 'random') {
        const wordList = WORDS_MAP[state.lang];
        const pair = wordList[Math.floor(Math.random() * wordList.length)];
        state.currentWords.civilian = pair.civilian;
        state.currentWords.spy = pair.spy;
        
        doRestartWithNewRoles();
    } else {
        // Prompt for custom words via prompt() so we don't need a full redraw
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
    
    // shuffle
    roles.sort(() => Math.random() - 0.5);
    
    // Reconstruct state.players using originalOrder and preserved selfies
    state.players = state.originalOrder.map((oldObj, index) => {
        return {
            id: oldObj.id,
            role: roles[index],
            word: roles[index] === 'civilian' ? 'civilian' : (roles[index] === 'spy' ? 'spy' : 'blank'),
            img: oldObj.img, // keep selfie
            eliminated: false,
            initialPos: oldObj.initialPos
        };
    });
    
    state.playDirection = 1;
    // We do NOT need to run setup since we have selfies.
    // However, they need to see their new words!
    // So we invoke setup phase again but WITHOUT camera.
    state.phase = 'setup';
    state.setupIndex = 0;
    
    switchScreen('setup');
    prepareReSetupNextPlayer();
}

function prepareReSetupNextPlayer() {
    const p = state.players[state.setupIndex];
    DOM.setupTitle.innerText = getLoc('handToPlayerN').replace('{n}', p.id);
    DOM.btnSelfie.innerText = getLoc('playerReady').replace('{n}', p.id) + " (View Word)";

    DOM.video.classList.add('hidden');
    DOM.preview.src = p.img;
    DOM.preview.classList.remove('hidden');
    
    DOM.wordRevealArea.classList.add('hidden');
    DOM.photoPrompt.classList.add('hidden');
    DOM.btnSelfie.classList.remove('hidden');
    DOM.btnRemember.classList.add('hidden');
    
    // Bind differently since no taking selfie
    DOM.btnSelfie.onclick = viewWordBypassSelfie;
}

function viewWordBypassSelfie() {
    DOM.btnSelfie.classList.add('hidden');
    DOM.wordRevealArea.classList.remove('hidden');
    DOM.btnRemember.classList.remove('hidden');
    
    const role = state.players[state.setupIndex].role;
    let wordText = "";
    if (role === 'civilian') wordText = state.currentWords.civilian;
    else if (role === 'spy') wordText = getLoc('spyWordPrompt').replace('{word}', state.currentWords.spy);
    else wordText = getLoc('blankWordPrompt');
    
    DOM.wordRevealText.innerText = getLoc('yourWordIs') + " " + wordText;
    
    DOM.btnRemember.onclick = nextReSetupPlayer;
}

function nextReSetupPlayer() {
    state.setupIndex++;
    if (state.setupIndex < state.players.length) {
        prepareReSetupNextPlayer();
    } else {
        // Reset onclick to standard camera logic for new games
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

// Kickoff
document.addEventListener('DOMContentLoaded', init);
