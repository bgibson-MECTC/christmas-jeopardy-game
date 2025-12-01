(function () {
  // ===== GAME STATE =====
  let gameState = null;
  let sdkInitialized = false;

  // ===== HELPERS =====
  function el(id) { return document.getElementById(id); }

  function allowWritesEnabled() {
    const cb = el('allow-writes');
    return cb && cb.checked;
  }

  const dataHandler = {
    onDataChanged(data) {
      if (data && data.length > 0) {
        gameState = data[0];
        updateAllDisplays();
        log('📡 Game state updated from database', 'success');
        if (el('last-update')) el('last-update').textContent = new Date().toLocaleTimeString();
      }
    }
  };

  function log(message, type = 'info') {
    const logEntries = el('log-entries');
    if (!logEntries) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    logEntries.insertBefore(entry, logEntries.firstChild);

    while (logEntries.children.length > 50) {
      logEntries.removeChild(logEntries.lastChild);
    }
  }

  function clearLog() {
    if (!el('log-entries')) return;
    el('log-entries').innerHTML = '<div class="log-entry info">[READY] Log cleared. Continue testing...</div>';
  }

  function notify(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = 'notification' + (isError ? ' error' : '');
    notification.textContent = (isError ? '❌ ' : '✅ ') + message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  function updateButtonStatus(btnId, status) {
    const btn = el(btnId);
    if (!btn) return;
    btn.classList.remove('success', 'error');
    try {
      const ind = btn.querySelector('.status-indicator');
      if (status === 'success') {
        btn.classList.add('success');
        if (ind) ind.textContent = '✅';
      } else if (status === 'error') {
        btn.classList.add('error');
        if (ind) ind.textContent = '❌';
      }
    } catch (e) { /* ignore */ }
  }

  function safeSplit(s, fallback = []) {
    if (!s && s !== '') return fallback;
    return String(s).split(',').map(x => x);
  }

  function parseGameState() {
    if (!gameState) return null;
    try {
      return {
        usedQuestions: gameState.used_questions ? gameState.used_questions.split(',').filter(x => x).map(Number) : [],
        teamScores: gameState.team_scores ? gameState.team_scores.split(',').map(Number) : [0,0,0,0,0],
        teamNames: gameState.team_names ? gameState.team_names.split(',') : ['Team 1','Team 2','Team 3','Team 4','Team 5'],
        teamAvatars: gameState.team_avatars ? gameState.team_avatars.split(',') : ['🎅','🤶','🧝','⛄','🎄'],
        teamPowerups: gameState.team_powerups ? gameState.team_powerups.split(',').map(p => { const [c,o] = p.split('-').map(Number); return { candy: c||0, ornament: o||0 }; }) : [{candy:0,ornament:0},{candy:0,ornament:0},{candy:0,ornament:0},{candy:0,ornament:0},{candy:0,ornament:0}],
        currentTeam: Number(gameState.current_team) || 1,
        nextMultiplier: Number(gameState.next_multiplier) || 1,
        buzzerActive: String(gameState.buzzer_active) === 'true',
        buzzerWinner: gameState.buzzer_winner || '',
        activeQuestion: gameState.active_question || '',
        answerRevealed: String(gameState.answer_revealed) === 'true'
      };
    } catch (e) {
      log('❌ Failed to parse game state: ' + e.message, 'error');
      return null;
    }
  }

  async function updateGameState(updates) {
    if (!gameState) {
      log('❌ Cannot update: no game state loaded', 'error');
      notify('No game state loaded!', true);
      return false;
    }

    if (!allowWritesEnabled()) {
      log('⚠️ Live writes are disabled. Enable "Allow Live Writes" to perform updates.', 'warning');
      notify('Live writes disabled', true);
      return false;
    }

    if (!window.dataSdk || typeof window.dataSdk.update !== 'function') {
      log('❌ Data SDK not available', 'error');
      notify('Data SDK unavailable', true);
      return false;
    }

    const updatedState = { ...gameState, ...updates };
    try {
      const result = await window.dataSdk.update(updatedState);
      if (result && result.isOk) {
        gameState = updatedState;
        updateAllDisplays();
        return true;
      } else {
        log(`❌ Update failed: ${result && result.error ? result.error : 'unknown'}`, 'error');
        notify('Update failed!', true);
        return false;
      }
    } catch (e) {
      log('❌ Update exception: ' + e.message, 'error');
      notify('Update failed!', true);
      return false;
    }
  }

  function updateAllDisplays() {
    if (!gameState) {
      if (el('game-status')) { el('game-status').textContent = '❌ Not Loaded'; el('game-status').classList.add('error'); }
      return;
    }

    const state = parseGameState();
    if (!state) return;

    if (el('sdk-status')) { el('sdk-status').textContent = '✅ Connected'; el('sdk-status').classList.remove('error'); }
    if (el('game-status')) { el('game-status').textContent = '✅ Loaded'; el('game-status').classList.remove('error'); }

    if (el('current-team')) el('current-team').textContent = `Team ${state.currentTeam} (${state.teamNames[state.currentTeam - 1]})`;
    if (el('questions-used')) el('questions-used').textContent = `${state.usedQuestions.length} / 20`;
    if (el('multiplier')) el('multiplier').textContent = `${state.nextMultiplier}x`;

    if (el('buzzer-status')) el('buzzer-status').textContent = state.buzzerActive ? '✅ Active' : '❌ Inactive';
    if (el('active-question')) el('active-question').textContent = state.activeQuestion ? 'Yes (synced to teams)' : 'None';
    if (el('answer-revealed')) el('answer-revealed').textContent = state.answerRevealed ? 'Yes' : 'No';

    updateTeamScoresDisplay(state);
  }

  function updateTeamScoresDisplay(state) {
    const container = el('team-scores-display');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const card = document.createElement('div');
      card.className = 'team-score-card' + (i + 1 === state.currentTeam ? ' current' : '');

      const avatar = document.createElement('div');
      avatar.style.fontSize = '2em';
      avatar.style.marginBottom = '8px';
      avatar.textContent = state.teamAvatars[i] || '';

      const name = document.createElement('div');
      name.className = 'team-name';
      name.textContent = state.teamNames[i] || `Team ${i+1}`;

      const score = document.createElement('div');
      score.className = 'team-score' + (state.teamScores[i] < 0 ? ' negative' : '');
      score.textContent = state.teamScores[i] || 0;

      const powerups = document.createElement('div');
      powerups.style.fontSize = '0.9em';
      powerups.style.color = '#FFA500';
      powerups.style.marginTop = '8px';
      powerups.textContent = `🍬${state.teamPowerups[i].candy} 🎄${state.teamPowerups[i].ornament}`;

      card.appendChild(avatar);
      card.appendChild(name);
      card.appendChild(score);
      card.appendChild(powerups);
      container.appendChild(card);
    }
  }

  // ===== TEST FUNCTIONS (same semantics, safer parsing & checks) =====

  async function testSDKInit() {
    log('🔌 Initializing Data SDK...', 'info');
    try {
      if (!window.dataSdk || typeof window.dataSdk.init !== 'function') {
        throw new Error('Data SDK not present');
      }

      const result = await window.dataSdk.init(dataHandler);
      if (result && result.isOk) {
        sdkInitialized = true;
        if (el('sdk-status')) { el('sdk-status').textContent = '✅ Connected'; el('sdk-status').classList.remove('error'); }
        log('✅ SDK initialized successfully', 'success');
        notify('SDK Connected!');
        updateButtonStatus('btn-sdk-init', 'success');
        setTimeout(() => testLoadGame(), 500);
      } else {
        throw new Error('SDK init returned error');
      }
    } catch (error) {
      log(`❌ SDK init failed: ${error.message}`, 'error');
      notify('SDK Init Failed!', true);
      updateButtonStatus('btn-sdk-init', 'error');
    }
  }

  async function testCreateGame() {
    log('🎮 Creating new game state...', 'info');
    if (!sdkInitialized) { log('❌ SDK not initialized!', 'error'); notify('Initialize SDK first!', true); return; }
    if (!allowWritesEnabled()) { log('⚠️ Live writes disabled - cannot create game', 'warning'); notify('Enable Live Writes', true); updateButtonStatus('btn-create-game','error'); return; }

    try {
      const initialState = {
        used_questions: '',
        team_scores: '0,0,0,0,0',
        team_names: 'Team 1,Team 2,Team 3,Team 4,Team 5',
        team_avatars: '🎅,🤶,🧝,⛄,🎄',
        team_powerups: '0-0,0-0,0-0,0-0,0-0',
        current_team: 1,
        next_multiplier: 1,
        daily_doubles: '4,14',
        achievements: 'false,0-0,0-0,0-0-0-0-0',
        buzzer_active: 'false',
        buzzer_winner: '',
        active_question: '',
        answer_revealed: 'false'
      };
      if (!window.dataSdk || typeof window.dataSdk.create !== 'function') throw new Error('Data SDK create not available');
      const result = await window.dataSdk.create(initialState);
      if (result && result.isOk) {
        log('✅ Game state created successfully!', 'success');
        notify('Game Created!');
        updateButtonStatus('btn-create-game', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error('Create failed');
      }
    } catch (error) {
      log(`❌ Create failed: ${error.message}`, 'error');
      notify('Create Failed!', true);
      updateButtonStatus('btn-create-game', 'error');
    }
  }

  async function testLoadGame() {
    log('📥 Loading game state...', 'info');
    if (gameState) {
      updateAllDisplays();
      log('✅ Game state loaded from cache', 'success');
      notify('Game Loaded!');
      updateButtonStatus('btn-load-game', 'success');
    } else {
      log('⚠️ No game state available - create one first', 'warning');
      notify('No game state found', true);
      updateButtonStatus('btn-load-game', 'error');
    }
  }

  async function testResetGame() {
    if (!allowWritesEnabled()) { log('⚠️ Live writes disabled - cannot reset', 'warning'); notify('Enable Live Writes', true); return; }
    const token = prompt('Type DELETE to confirm full RESET (this cannot be undone):');
    if (token !== 'DELETE') { log('Reset cancelled by user', 'info'); return; }

    log('🔄 Resetting game (deleting data)...', 'warning');
    try {
      if (gameState) {
        if (!window.dataSdk || typeof window.dataSdk.delete !== 'function') throw new Error('Data SDK delete not available');
        const result = await window.dataSdk.delete(gameState);
        if (result && result.isOk) {
          log('✅ Game reset successful', 'success');
          notify('Game Reset!');
          gameState = null;
          updateButtonStatus('btn-reset-game', 'success');
          setTimeout(() => window.location.reload(), 1000);
        }
      }
    } catch (error) {
      log(`❌ Reset failed: ${error.message}`, 'error');
      notify('Reset Failed!', true);
      updateButtonStatus('btn-reset-game', 'error');
    }
  }

  // Team management functions (unchanged semantics)
  async function testUpdateName() {
    const teamId = parseInt(el('test-team-select').value);
    const newName = prompt('Enter new team name:', `Test Team ${teamId}`);
    if (!newName) return;
    log(`✏️ Updating Team ${teamId} name to "${newName}"...`, 'info');
    const state = parseGameState();
    state.teamNames[teamId - 1] = newName;
    const success = await updateGameState({ team_names: state.teamNames.join(',') });
    if (success) { log(`✅ Team ${teamId} renamed to "${newName}"`, 'success'); notify(`Team ${teamId} Renamed!`); updateButtonStatus('btn-update-name', 'success'); } else { updateButtonStatus('btn-update-name', 'error'); }
  }

  async function testChangeAvatar() {
    const teamId = parseInt(el('test-team-select').value);
    const avatars = ['🎅', '🤶', '🧝', '🧝‍♀️', '⛄', '☃️', '🦌', '🎄', '🎁', '🔔', '⭐', '❄️', '🍪'];
    const newAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    log(`🎨 Changing Team ${teamId} avatar to ${newAvatar}...`, 'info');
    const state = parseGameState();
    state.teamAvatars[teamId - 1] = newAvatar;
    const success = await updateGameState({ team_avatars: state.teamAvatars.join(',') });
    if (success) { log(`✅ Team ${teamId} avatar changed to ${newAvatar}`, 'success'); notify(`Avatar Changed: ${newAvatar}`); updateButtonStatus('btn-change-avatar', 'success'); } else { updateButtonStatus('btn-change-avatar', 'error'); }
  }

  async function testSetCurrent() {
    const teamId = parseInt(el('test-team-select').value);
    log(`👉 Setting Team ${teamId} as current team...`, 'info');
    const success = await updateGameState({ current_team: teamId });
    if (success) { log(`✅ Current team set to ${teamId}`, 'success'); notify(`Current Team: ${teamId}`); updateButtonStatus('btn-set-current', 'success'); } else { updateButtonStatus('btn-set-current', 'error'); }
  }

  async function testAddPoints() {
    const teamId = parseInt(el('test-team-select').value);
    const points = 200;
    log(`➕ Adding ${points} points to Team ${teamId}...`, 'info');
    const state = parseGameState(); state.teamScores[teamId - 1] += points;
    const success = await updateGameState({ team_scores: state.teamScores.join(',') });
    if (success) { log(`✅ Added ${points} points to Team ${teamId}`, 'success'); notify(`+${points} Points!`); updateButtonStatus('btn-add-points', 'success'); } else { updateButtonStatus('btn-add-points', 'error'); }
  }

  async function testSubtractPoints() {
    const teamId = parseInt(el('test-team-select').value); const points = 200; log(`➖ Subtracting ${points} points from Team ${teamId}...`, 'info'); const state = parseGameState(); state.teamScores[teamId - 1] -= points; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Subtracted ${points} points from Team ${teamId}`, 'success'); notify(`-${points} Points!`); updateButtonStatus('btn-subtract-points', 'success'); } else { updateButtonStatus('btn-subtract-points', 'error'); }
  }

  async function testNegativeScore() { const teamId = parseInt(el('test-team-select').value); log(`📉 Setting Team ${teamId} to -500...`, 'info'); const state = parseGameState(); state.teamScores[teamId - 1] = -500; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Team ${teamId} now at -500`, 'success'); notify('Negative Score Set!'); updateButtonStatus('btn-negative', 'success'); } else { updateButtonStatus('btn-negative', 'error'); } }

  async function testShowQuestion() { const cat = parseInt(el('test-category').value); const value = parseInt(el('test-value').value); log(`❓ Showing question: Category ${cat}, $${value}...`, 'info'); const questionData = { question: `Test question for category ${cat}, value $${value}. All team screens should see this!`, answer: `Test answer ${cat}-${value}`, value: value, isDailyDouble: false }; const success = await updateGameState({ active_question: JSON.stringify(questionData), answer_revealed: 'false' }); if (success) { log('✅ Question synced to all screens', 'success'); notify('Question Shown!'); updateButtonStatus('btn-show-question', 'success'); } else { updateButtonStatus('btn-show-question', 'error'); } }

  async function testRevealAnswer() { log('👁️ Revealing answer...', 'info'); const success = await updateGameState({ answer_revealed: 'true' }); if (success) { log('✅ Answer revealed to all screens', 'success'); notify('Answer Revealed!'); updateButtonStatus('btn-reveal-answer', 'success'); } else { updateButtonStatus('btn-reveal-answer', 'error'); } }

  async function testMarkCorrect() {
    log('✅ Marking answer correct...', 'info');
    const state = parseGameState();
    if (!state.activeQuestion) { log('❌ No active question!', 'error'); notify('No Active Question!', true); updateButtonStatus('btn-mark-correct', 'error'); return; }
    let questionData = null;
    try { questionData = JSON.parse(state.activeQuestion); } catch (e) { log('❌ Active question JSON invalid', 'error'); notify('Bad question data', true); updateButtonStatus('btn-mark-correct','error'); return; }
    state.teamScores[state.currentTeam - 1] += Number(questionData.value) || 0;
    const success = await updateGameState({ team_scores: state.teamScores.join(','), answer_revealed: 'true' });
    if (success) { log(`✅ Correct! +${questionData.value} to Team ${state.currentTeam}`, 'success'); notify(`Correct! +${questionData.value}`); updateButtonStatus('btn-mark-correct', 'success'); } else { updateButtonStatus('btn-mark-correct', 'error'); }
  }

  async function testMarkWrong() {
    log('❌ Marking answer wrong...', 'info');
    const state = parseGameState();
    if (!state.activeQuestion) { log('❌ No active question!', 'error'); notify('No Active Question!', true); updateButtonStatus('btn-mark-wrong', 'error'); return; }
    let questionData = null; try { questionData = JSON.parse(state.activeQuestion); } catch (e) { log('❌ Active question JSON invalid', 'error'); notify('Bad question data', true); updateButtonStatus('btn-mark-wrong','error'); return; }
    state.teamScores[state.currentTeam - 1] -= Number(questionData.value) || 0;
    const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Wrong! -${questionData.value} from Team ${state.currentTeam}`, 'success'); notify(`Wrong! -${questionData.value}`); updateButtonStatus('btn-mark-wrong', 'success'); } else { updateButtonStatus('btn-mark-wrong', 'error'); }
  }

  async function testReturnBoard() { log('🔙 Returning to board...', 'info'); const success = await updateGameState({ active_question: '', answer_revealed: 'false' }); if (success) { log('✅ Returned to board view', 'success'); notify('Returned to Board!'); updateButtonStatus('btn-return-board', 'success'); } else { updateButtonStatus('btn-return-board', 'error'); } }

  async function testUseAllQuestions() { log('📋 Marking all questions as used...', 'info'); const allQuestions = Array.from({ length: 20 }, (_, i) => i).join(','); const success = await updateGameState({ used_questions: allQuestions }); if (success) { log('✅ All 20 questions marked as used', 'success'); notify('All Questions Used!'); updateButtonStatus('btn-use-all', 'success'); } else { updateButtonStatus('btn-use-all', 'error'); } }

  async function testDoubleNext() { log('⚡ Activating 2x multiplier...', 'info'); const success = await updateGameState({ next_multiplier: 2 }); if (success) { log('✅ Next question will be worth 2x', 'success'); notify('2x Multiplier Active!'); updateButtonStatus('btn-double', 'success'); } else { updateButtonStatus('btn-double', 'error'); } }

  async function testTripleNext() { log('⚡ Activating 3x multiplier...', 'info'); const success = await updateGameState({ next_multiplier: 3 }); if (success) { log('✅ Next question will be worth 3x', 'success'); notify('3x Multiplier Active!'); updateButtonStatus('btn-triple', 'success'); } else { updateButtonStatus('btn-triple', 'error'); } }

  async function testGiveCandy() { const teamId = parseInt(el('test-team-select').value); log(`🍬 Giving candy cane to Team ${teamId}...`, 'info'); const state = parseGameState(); state.teamPowerups[teamId - 1].candy++; const success = await updateGameState({ team_powerups: state.teamPowerups.map(p => `${p.candy}-${p.ornament}`).join(',') }); if (success) { log(`✅ Team ${teamId} received candy cane!`, 'success'); notify('🍬 Candy Awarded!'); updateButtonStatus('btn-give-candy', 'success'); } else { updateButtonStatus('btn-give-candy', 'error'); } }

  async function testGiveOrnament() { const teamId = parseInt(el('test-team-select').value); log(`🎄 Giving ornament to Team ${teamId}...`, 'info'); const state = parseGameState(); state.teamPowerups[teamId - 1].ornament++; const success = await updateGameState({ team_powerups: state.teamPowerups.map(p => `${p.candy}-${p.ornament}`).join(',') }); if (success) { log(`✅ Team ${teamId} received ornament!`, 'success'); notify('🎄 Ornament Awarded!'); updateButtonStatus('btn-give-ornament', 'success'); } else { updateButtonStatus('btn-give-ornament', 'error'); } }

  async function testUseCandy() { const teamId = parseInt(el('test-team-select').value); log(`🍬 Using candy for Team ${teamId}...`, 'info'); const state = parseGameState(); if (state.teamPowerups[teamId - 1].candy <= 0) { log('❌ No candy canes available!', 'error'); notify('No Candy!', true); updateButtonStatus('btn-use-candy', 'error'); return; } state.teamPowerups[teamId - 1].candy--; state.teamScores[teamId - 1] += 50; const success = await updateGameState({ team_powerups: state.teamPowerups.map(p => `${p.candy}-${p.ornament}`).join(','), team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Team ${teamId} used candy for +50`, 'success'); notify('🍬 +50 Points!'); updateButtonStatus('btn-use-candy', 'success'); } else { updateButtonStatus('btn-use-candy', 'error'); } }

  async function testUseOrnament() { const teamId = parseInt(el('test-team-select').value); log(`🎄 Using ornament for Team ${teamId}...`, 'info'); const state = parseGameState(); if (state.teamPowerups[teamId - 1].ornament <= 0) { log('❌ No ornaments available!', 'error'); notify('No Ornaments!', true); updateButtonStatus('btn-use-ornament', 'error'); return; } state.teamPowerups[teamId - 1].ornament--; const success = await updateGameState({ team_powerups: state.teamPowerups.map(p => `${p.candy}-${p.ornament}`).join(','), next_multiplier: 2 }); if (success) { log(`✅ Team ${teamId} activated 2x multiplier!`, 'success'); notify('🎄 2x Active!'); updateButtonStatus('btn-use-ornament', 'success'); } else { updateButtonStatus('btn-use-ornament', 'error'); } }

  async function testEnableBuzzer() { log('🔔 Enabling buzzer...', 'info'); const success = await updateGameState({ buzzer_active: 'true', buzzer_winner: '' }); if (success) { log('✅ Buzzer enabled for all teams', 'success'); notify('🔔 Buzzer Active!'); updateButtonStatus('btn-enable-buzzer', 'success'); } else { updateButtonStatus('btn-enable-buzzer', 'error'); } }

  async function testDisableBuzzer() { log('🔕 Disabling buzzer...', 'info'); const success = await updateGameState({ buzzer_active: 'false' }); if (success) { log('✅ Buzzer disabled', 'success'); notify('🔕 Buzzer Disabled!'); updateButtonStatus('btn-disable-buzzer', 'success'); } else { updateButtonStatus('btn-disable-buzzer', 'error'); } }

  async function testBuzzIn() { const teamId = parseInt(el('test-team-select').value); log(`⚡ Team ${teamId} buzzing in...`, 'info'); const success = await updateGameState({ buzzer_active: 'false', buzzer_winner: String(teamId) }); if (success) { log(`✅ Team ${teamId} buzzed in!`, 'success'); notify(`🔔 Team ${teamId} Buzzed!`); updateButtonStatus('btn-buzz-in', 'success'); } else { updateButtonStatus('btn-buzz-in', 'error'); } }

  async function testClearBuzzer() { log('🧹 Clearing buzzer state...', 'info'); const success = await updateGameState({ buzzer_active: 'false', buzzer_winner: '' }); if (success) { log('✅ Buzzer cleared', 'success'); notify('Buzzer Cleared!'); updateButtonStatus('btn-clear-buzzer', 'success'); } else { updateButtonStatus('btn-clear-buzzer', 'error'); } }

  async function testSantaShuffle() { log('🎅 Santa Shuffle!', 'info'); const state = parseGameState(); const randomTeam = Math.floor(Math.random() * 5); const swings = [100, 200, 300, -100, -200, -300]; const randomSwing = swings[Math.floor(Math.random() * swings.length)]; state.teamScores[randomTeam] += randomSwing; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Santa gave ${randomSwing > 0 ? '+' : ''}${randomSwing} to Team ${randomTeam + 1}`, 'success'); notify(`🎅 ${randomSwing > 0 ? '+' : ''}${randomSwing}!`); updateButtonStatus('btn-santa', 'success'); } else { updateButtonStatus('btn-santa', 'error'); } }

  async function testGingerbread() { log('🍪 Gingerbread Explosion!', 'warning'); const state = parseGameState(); for (let i = 0; i < 5; i++) state.teamScores[i] -= 100; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log('✅ All teams lost 100 points!', 'success'); notify('🍪 Everyone -100!'); updateButtonStatus('btn-gingerbread', 'success'); } else { updateButtonStatus('btn-gingerbread', 'error'); } }

  async function testStockingSteal() { log('🧦 Stocking Steal!', 'info'); const state = parseGameState(); let lowestIdx = 0, highestIdx = 0; let lowestScore = state.teamScores[0]; let highestScore = state.teamScores[0]; for (let i = 1; i < 5; i++) { if (state.teamScores[i] < lowestScore) { lowestScore = state.teamScores[i]; lowestIdx = i; } if (state.teamScores[i] > highestScore) { highestScore = state.teamScores[i]; highestIdx = i; } } if (lowestIdx === highestIdx) { log('⚠️ All scores equal, nothing to steal', 'warning'); notify('Scores too close!', true); return; } state.teamScores[highestIdx] -= 150; state.teamScores[lowestIdx] += 150; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Team ${lowestIdx + 1} stole 150 from Team ${highestIdx + 1}`, 'success'); notify('🧦 Stocking Steal!'); updateButtonStatus('btn-stocking', 'success'); } else { updateButtonStatus('btn-stocking', 'error'); } }

  async function testSwapScores() { const teamId = parseInt(el('test-team-select').value); const targetId = (teamId % 5) + 1; log(`🔄 Swapping Team ${teamId} and Team ${targetId} scores...`, 'info'); const state = parseGameState(); const temp = state.teamScores[teamId - 1]; state.teamScores[teamId - 1] = state.teamScores[targetId - 1]; state.teamScores[targetId - 1] = temp; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) { log(`✅ Scores swapped between Team ${teamId} and ${targetId}`, 'success'); notify('🔄 Scores Swapped!'); updateButtonStatus('btn-swap', 'success'); } else { updateButtonStatus('btn-swap', 'error'); } }

  async function testRapidUpdates() { log('⚡ Starting rapid updates test (10 updates)...', 'info'); const state = parseGameState(); let successCount = 0; for (let i = 0; i < 10; i++) { const randomTeam = Math.floor(Math.random() * 5); const randomPoints = Math.floor(Math.random() * 200) - 100; state.teamScores[randomTeam] += randomPoints; const success = await updateGameState({ team_scores: state.teamScores.join(',') }); if (success) successCount++; await new Promise(resolve => setTimeout(resolve, 200)); } log(`✅ Rapid updates complete: ${successCount}/10 successful`, 'success'); notify(`Rapid Updates: ${successCount}/10`); updateButtonStatus('btn-rapid', successCount === 10 ? 'success' : 'error'); }

  async function testAllNegative() { log('📉 Setting all teams to negative...', 'info'); const success = await updateGameState({ team_scores: '-500,-300,-700,-200,-400' }); if (success) { log('✅ All teams now negative', 'success'); notify('All Negative!'); updateButtonStatus('btn-all-negative', 'success'); } else { updateButtonStatus('btn-all-negative', 'error'); } }

  async function testMaxScores() { log('📈 Setting all teams to max score (9999)...', 'info'); const success = await updateGameState({ team_scores: '9999,9999,9999,9999,9999' }); if (success) { log('✅ All teams at 9999', 'success'); notify('Max Scores!'); updateButtonStatus('btn-max-scores', 'success'); } else { updateButtonStatus('btn-max-scores', 'error'); } }

  async function testStateFlood() { log('🌊 Flooding state changes (20 rapid changes)...', 'warning'); let successCount = 0; for (let i = 0; i < 20; i++) { const success = await updateGameState({ next_multiplier: (i % 3) + 1, current_team: (i % 5) + 1 }); if (success) successCount++; await new Promise(resolve => setTimeout(resolve, 100)); } log(`✅ State flood complete: ${successCount}/20 successful`, 'success'); notify(`Flood Test: ${successCount}/20`); updateButtonStatus('btn-flood', successCount === 20 ? 'success' : 'error'); }

  // Expose functions to global for button onclick handlers
  window.testSDKInit = testSDKInit;
  window.testCreateGame = testCreateGame;
  window.testLoadGame = testLoadGame;
  window.testResetGame = testResetGame;
  window.testUpdateName = testUpdateName;
  window.testChangeAvatar = testChangeAvatar;
  window.testSetCurrent = testSetCurrent;
  window.testAddPoints = testAddPoints;
  window.testSubtractPoints = testSubtractPoints;
  window.testNegativeScore = testNegativeScore;
  window.testShowQuestion = testShowQuestion;
  window.testRevealAnswer = testRevealAnswer;
  window.testMarkCorrect = testMarkCorrect;
  window.testMarkWrong = testMarkWrong;
  window.testReturnBoard = testReturnBoard;
  window.testUseAllQuestions = testUseAllQuestions;
  window.testDoubleNext = testDoubleNext;
  window.testTripleNext = testTripleNext;
  window.testGiveCandy = testGiveCandy;
  window.testGiveOrnament = testGiveOrnament;
  window.testUseCandy = testUseCandy;
  window.testUseOrnament = testUseOrnament;
  window.testEnableBuzzer = testEnableBuzzer;
  window.testDisableBuzzer = testDisableBuzzer;
  window.testBuzzIn = testBuzzIn;
  window.testClearBuzzer = testClearBuzzer;
  window.testSantaShuffle = testSantaShuffle;
  window.testGingerbread = testGingerbread;
  window.testStockingSteal = testStockingSteal;
  window.testSwapScores = testSwapScores;
  window.testRapidUpdates = testRapidUpdates;
  window.testAllNegative = testAllNegative;
  window.testMaxScores = testMaxScores;
  window.testStateFlood = testStateFlood;

  window.clearLog = clearLog;

  window.addEventListener('load', async () => {
    log('🎮 Test suite loaded and ready', 'info');
    log('👉 Click "Initialize SDK" to begin testing', 'info');
  });
})();
