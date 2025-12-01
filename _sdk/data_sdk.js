(function(){
  // Simple mock data SDK for local testing with error simulation support
  const mock = (function(){
    let state = {
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

    let handler = null;
    let simulateErrors = false;
    let latency = 0;

    function notifyChange() {
      if (handler && typeof handler.onDataChanged === 'function') {
        handler.onDataChanged([state]);
      }
    }

    function getLatency() {
      const latencyEl = document.getElementById('mock-latency');
      return latencyEl ? parseInt(latencyEl.value) || 0 : latency;
    }

    function shouldSimulateError() {
      const checkbox = document.getElementById('mock-simulate-errors');
      return checkbox ? checkbox.checked : simulateErrors;
    }

    return {
      init(h) {
        handler = h || null;
        return new Promise((resolve, reject) => {
          const delay = getLatency() + 100;
          setTimeout(() => {
            if (shouldSimulateError() && Math.random() < 0.3) {
              reject({ isOk: false, error: 'Mock: Init failed' });
            } else {
              notifyChange();
              resolve({ isOk: true });
            }
          }, delay);
        });
      },
      create(initialState) {
        return new Promise((resolve, reject) => {
          const delay = getLatency() + 80;
          setTimeout(() => {
            if (shouldSimulateError() && Math.random() < 0.2) {
              reject({ isOk: false, error: 'Mock: Create failed' });
            } else {
              state = Object.assign({}, initialState);
              notifyChange();
              resolve({ isOk: true });
            }
          }, delay);
        });
      },
      update(updatedState) {
        return new Promise((resolve, reject) => {
          const delay = getLatency() + 60;
          setTimeout(() => {
            if (shouldSimulateError() && Math.random() < 0.15) {
              reject({ isOk: false, error: 'Mock: Update failed' });
            } else {
              state = Object.assign({}, state, updatedState);
              notifyChange();
              resolve({ isOk: true });
            }
          }, delay);
        });
      },
      delete() {
        return new Promise((resolve, reject) => {
          const delay = getLatency() + 60;
          setTimeout(() => {
            if (shouldSimulateError() && Math.random() < 0.25) {
              reject({ isOk: false, error: 'Mock: Delete failed' });
            } else {
              state = null;
              if (handler && typeof handler.onDataChanged === 'function') handler.onDataChanged([]);
              resolve({ isOk: true });
            }
          }, delay);
        });
      },
      __getState() { return state; },
      __setSimulateErrors(val) { simulateErrors = val; },
      __setLatency(val) { latency = val; }
    };
  })();

  // expose to window as dataSdk
  if (typeof window !== 'undefined') {
    window.dataSdk = mock;
  } else if (typeof global !== 'undefined') {
    global.dataSdk = mock;
  }
})();
