/* ============================================================
   MAIN — 畫面狀態管理與互動串接
   開始畫面 → 互動畫面 → 最終訊息 → 休息畫面 / 再整理一次
   滑鼠模式可獨立完整運作；手勢失敗時自動提示改用滑鼠。
   ============================================================ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const root = document.documentElement;
  const app = $('#app');
  const playfield = $('#playfield');

  // 畫面
  const startScreen = $('#screen-start');
  const finaleScreen = $('#screen-finale');
  const restScreen = $('#screen-rest');

  // HUD
  const hudCleared = $('#hud-cleared');
  const hudGenerated = $('#hud-generated');
  const hudClock = $('#hud-clock');
  const hudPhase = $('#hud-phase');
  const pressureBar = $('#pressure-bar');

  // 鏡頭 UI
  const camWrap = $('#camera');
  const camVideo = $('#cam-video');
  const camSkel = $('#cam-skeleton');
  const camCursor = $('#hand-cursor');
  const toast = $('#toast');

  let mode = 'mouse';

  /* ---------- 設定開關 ---------- */
  Game.init(playfield, root);

  const soundToggle = $('#toggle-sound');
  const motionToggle = $('#toggle-motion');

  function syncSound() {
    Audio.setEnabled(Audio.enabled);
    soundToggle.dataset.on = Audio.enabled ? '1' : '0';
    soundToggle.querySelector('.toggle__state').textContent = Audio.enabled ? '音效 開' : '音效 關';
  }
  function syncMotion() {
    const reduced = root.classList.contains('reduce-motion');
    motionToggle.dataset.on = reduced ? '1' : '0';
    motionToggle.querySelector('.toggle__state').textContent = reduced ? '減少動態 開' : '減少動態 關';
    if (Game.state) Game.state.reduceMotion = reduced;
  }

  Audio.enabled = CONFIG.audio.onByDefault;
  if (CONFIG.reduceMotionByDefault) root.classList.add('reduce-motion');
  syncSound(); syncMotion();

  soundToggle.addEventListener('click', () => { Audio.init(); Audio.enabled = !Audio.enabled; syncSound(); });
  motionToggle.addEventListener('click', () => { root.classList.toggle('reduce-motion'); syncMotion(); });

  /* ---------- 開始畫面按鈕 ---------- */
  $('#btn-start').addEventListener('click', () => beginGame('mouse'));
  $('#btn-mouse').addEventListener('click', () => beginGame('mouse'));
  $('#btn-camera').addEventListener('click', () => startCameraThenPlay());

  /* ---------- 開始遊戲 ---------- */
  function showScreen(which) {
    startScreen.classList.toggle('is-on', which === 'start');
    finaleScreen.classList.toggle('is-on', which === 'finale');
    restScreen.classList.toggle('is-on', which === 'rest');
    app.dataset.screen = which;
  }

  function clearPlayfield() {
    playfield.querySelectorAll('.todo, .induce').forEach(n => n.remove());
  }

  function beginGame(m) {
    mode = m;
    Audio.init(); Audio.resume();
    clearPlayfield();
    root.classList.remove('is-frozen');
    root.style.setProperty('--p', '0');
    showScreen('play');
    finaleScreen.classList.remove('is-on');
    Game.start();
  }

  async function startCameraThenPlay() {
    showToast('正在啟動鏡頭…影像僅在本機處理，不會上傳或儲存', 4000);
    camWrap.classList.add('is-on');
    Gestures.onFail = (msg) => {
      showToast((msg || '手勢辨識失敗') + '，已切換為滑鼠模式', 4500);
      camWrap.classList.remove('is-on');
      Gestures.disable();
      mode = 'mouse';
    };
    Gestures.onClearAt = (x, y, r, kind) => clearAtPoint(x, y, r, kind);

    const ok = await Gestures.enable(camVideo, camSkel, camCursor);
    if (ok) {
      mode = 'camera';
      beginGame('camera');
    } else {
      // enable 內部已呼叫 onFail
      camWrap.classList.remove('is-on');
      if (app.dataset.screen !== 'play') beginGame('mouse');
    }
  }

  $('#cam-close').addEventListener('click', () => {
    Gestures.disable();
    camWrap.classList.remove('is-on');
    mode = 'mouse';
    showToast('已關閉鏡頭，改用滑鼠清除', 2500);
  });

  /* ---------- 在某座標清除待辦（手勢用） ---------- */
  function clearAtPoint(x, y, radius, kind) {
    const items = playfield.querySelectorAll('.todo:not([data-clearing])');
    for (const el of items) {
      if (el.__clearing) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist < radius + Math.min(r.width, r.height) * 0.4) {
        Game.clearItem(el, kind);
        if (kind !== 'fx-sweep') break; // 非掃除一次只清一件
      }
    }
  }

  /* ---------- 滑鼠互動：點擊 + 拖曳連續清除 ---------- */
  let dragging = false;
  playfield.addEventListener('pointerdown', (e) => {
    if (app.dataset.screen !== 'play') return;
    dragging = true;
    tryClearFromEvent(e, 'fx-shatter');
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  playfield.addEventListener('pointermove', (e) => {
    if (!dragging || app.dataset.screen !== 'play') return;
    tryClearFromEvent(e, 'fx-sweep');
  });

  function tryClearFromEvent(e, kind) {
    const el = e.target.closest('.todo');
    if (el && !el.__clearing) {
      Game.clearItem(el, kind);
      Audio.click();
    }
  }

  /* ---------- HUD 更新 ---------- */
  Game.onTick = (s) => {
    hudCleared.textContent = s.cleared;
    hudGenerated.textContent = s.generated;
    const t = Math.floor(s.elapsed);
    hudClock.textContent = `00:${String(Math.min(99, t)).padStart(2, '0')}`;
    const names = ['', '可控', '增加中', '失控', '超載'];
    hudPhase.textContent = names[s.phase] || '';
    pressureBar.style.setProperty('--fill', Math.min(1, s.pressure / 100).toFixed(3));
  };

  /* ---------- 最終訊息 ---------- */
  Game.onFinale = (snap) => {
    $('#stat-cleared').textContent = snap.cleared;
    $('#stat-generated').textContent = snap.generated;
    showScreen('finale');
    // 結尾畫面疊在凍結的混亂之上，逐漸變暗模糊
    requestAnimationFrame(() => finaleScreen.classList.add('is-revealed'));
  };

  $('#btn-again').addEventListener('click', () => {
    finaleScreen.classList.remove('is-revealed');
    beginGame(mode);
    if (mode === 'camera') camWrap.classList.add('is-on');
  });

  $('#btn-rest').addEventListener('click', () => {
    Gestures.disable();
    camWrap.classList.remove('is-on');
    Game.stop();
    clearPlayfield();
    root.classList.remove('is-frozen');
    root.style.setProperty('--p', '0');
    finaleScreen.classList.remove('is-revealed');
    showScreen('rest');
  });

  $('#btn-rest-back').addEventListener('click', () => {
    showScreen('start');
  });

  /* ---------- Toast 提示 ---------- */
  let toastTimer = null;
  function showToast(msg, ms = 3000) {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), ms);
  }

  /* ---------- 初始畫面 ---------- */
  showScreen('start');

  // 暴露給除錯
  window.__GAME = Game;
})();
