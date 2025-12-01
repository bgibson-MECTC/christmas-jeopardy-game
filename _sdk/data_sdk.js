(function(){
  // Simple mock data SDK for local testing
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

    function notifyChange() {
      if (handler && typeof handler.onDataChanged === 'function') {
        // send array as original code expects data[0]
        handler.onDataChanged([state]);
      }
    }

    return {
      init(h) {
        handler = h || null;
        // simulate async init
        return new Promise(resolve => {
          setTimeout(() => {
            notifyChange();
            resolve({ isOk: true });
          }, 150);
        });
      },
      create(initialState) {
        return new Promise(resolve => {
          // shallow copy
          state = Object.assign({}, initialState);
          setTimeout(() => { notifyChange(); resolve({ isOk: true }); }, 100);
        });
      },
      update(updatedState) {
        return new Promise(resolve => {
          state = Object.assign({}, state, updatedState);
          setTimeout(() => { notifyChange(); resolve({ isOk: true }); }, 80);
        });
      },
      delete() {
        return new Promise(resolve => {
          state = null;
          setTimeout(() => { if (handler && typeof handler.onDataChanged === 'function') handler.onDataChanged([]); resolve({ isOk: true }); }, 80);
        });
      },
      // helper for dev console
      __getState() { return state; }
    };
  })();

  // expose to window as dataSdk
  if (typeof window !== 'undefined') {
    window.dataSdk = mock;
  } else if (typeof global !== 'undefined') {
    global.dataSdk = mock;
  }
})();
