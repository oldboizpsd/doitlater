/* ============================================================
   ENGINE — 遊戲狀態與主迴圈
   負責：生成待辦、難度階段、清除統計、壓力值、最終狀態。
   視覺失控由壓力值（0–100）驅動 CSS 變數 --p (0–1)。
   ============================================================ */
const Game = {
  state: null,
  playfield: null,
  root: null,
  _spawnTimer: null,
  _induceTimer: null,
  _errorTimer: null,
  _raf: null,
  onFinale: null,      // 回呼：進入最終狀態時呼叫
  onTick: null,        // 回呼：每幀更新 HUD

  reset() {
    this.state = {
      running: false,
      paused: false,
      startTime: 0,
      elapsed: 0,
      cleared: 0,
      generated: 0,
      onScreen: 0,
      clearTimes: [],      // 最近清除的時間戳
      pressure: 0,
      pressureRaw: 0,
      phase: 1,
      finished: false,
      reduceMotion: this.root.classList.contains('reduce-motion')
    };
  },

  init(playfield, root) {
    this.playfield = playfield;
    this.root = root;
    this.reset();
  },

  start() {
    this.reset();
    this.state.running = true;
    this.state.startTime = performance.now();
    Audio.muted = false;
    Audio.setEnabled(Audio.enabled);
    this._scheduleSpawn();
    this._scheduleInduce();
    this._scheduleError();
    this._loop();
  },

  stop() {
    this.state.running = false;
    clearTimeout(this._spawnTimer);
    clearTimeout(this._induceTimer);
    clearTimeout(this._errorTimer);
    cancelAnimationFrame(this._raf);
  },

  /* 直接由時鐘計算經過時間（不依賴 rAF，避免分頁切換時暫停） */
  elapsedNow() {
    return (performance.now() - this.state.startTime) / 1000;
  },

  /* ---------- 階段判定 ---------- */
  phaseOf(t) {
    const p = CONFIG.phases;
    if (t < p.p1End) return 1;
    if (t < p.p2End) return 2;
    if (t < p.p3End) return 3;
    return 4;
  },

  /* ---------- 最近 5 秒清除速度 ---------- */
  recentClears() {
    const now = performance.now();
    const win = CONFIG.speed.clearWindowMs;
    this.state.clearTimes = this.state.clearTimes.filter(t => now - t < win);
    return this.state.clearTimes.length;
  },

  /* ---------- 計算下一個生成間隔 ---------- */
  nextInterval() {
    const t = this.elapsedNow();
    const ph = this.phaseOf(t);
    let range;
    if (ph === 1) range = CONFIG.spawn.p1;
    else if (ph === 2) range = CONFIG.spawn.p2;
    else range = CONFIG.spawn.p3;
    let base = randRange(range[0], range[1]);

    // 清得越快 → 生成越快
    const recent = this.recentClears();
    const factor = 1 / (1 + recent * CONFIG.speed.accelPerClear);
    let interval = base * factor;
    return Math.max(CONFIG.speed.minIntervalMs, interval);
  },

  _scheduleSpawn() {
    if (!this.state.running) return;
    const t = this.elapsedNow();
    // 到達結尾：即使 rAF 被分頁暫停，也由此處觸發最終狀態
    if (t >= CONFIG.phases.finaleAt) {
      if (!this.state.finished) { this.state.finished = true; this._enterFinale(); }
      return;
    }
    this.spawnOne();

    // 第三階段偶爾一次兩件
    if (this.phaseOf(t) >= 3 && Math.random() < CONFIG.speed.burstChance) {
      this.spawnOne();
    }
    this._spawnTimer = setTimeout(() => this._scheduleSpawn(), this.nextInterval());
  },

  spawnOne() {
    if (this.state.onScreen >= CONFIG.maxOnScreen) return;
    const t = this.elapsedNow();
    const ph = this.phaseOf(t);
    // 後期尺寸變小、傾斜變大、更易重疊
    const sizeScale = ph === 1 ? randRange(1.0, 1.12)
                    : ph === 2 ? randRange(0.9, 1.05)
                    : randRange(0.74, 0.96);
    const el = Items.create(this.playfield, {
      sizeScale,
      tiltMul: ph >= 3 ? 1.8 : 1,
      spread: Math.min(1, t / CONFIG.phases.p3End)
    });
    if (this.state.reduceMotion) el.classList.add('reduce');
    this.state.generated++;
    this.state.onScreen++;

    // 倒數計時器：讓 data-count 真的在跳
    const cd = el.querySelector('[data-count]');
    if (cd) this._runCountdown(cd, el);

    // 音效：依階段選擇 + 後期偶爾鍵盤聲
    this._spawnSound(ph);
  },

  _spawnSound(ph) {
    const r = Math.random();
    if (r < 0.4) Audio.notify();
    else if (r < 0.65) Audio.email();
    else if (r < 0.8) Audio.countdown();
    else Audio.key();
    if (ph >= 3 && Math.random() < 0.25) Audio.key();
  },

  _runCountdown(node, el) {
    let s = randInt(8, 40);
    const tick = () => {
      if (!el.isConnected || el.__clearing) return;
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      node.textContent = `${mm}:${ss}`;
      if (s <= 5) node.classList.add('count--urgent');
      s--;
      if (s >= 0) el.__cdTimer = setTimeout(tick, 1000);
    };
    tick();
  },

  _scheduleInduce() {
    if (!this.state.running) return;
    const c = CONFIG.induce;
    this._induceTimer = setTimeout(() => {
      const t = this.elapsedNow();
      if (this.phaseOf(t) >= c.startPhase && t < CONFIG.phases.finaleAt) {
        Items.createInduce(this.playfield);
      }
      this._scheduleInduce();
    }, randRange(c.everyMsMin, c.everyMsMax));
  },

  _scheduleError() {
    if (!this.state.running) return;
    const c = CONFIG.errorWindow;
    this._errorTimer = setTimeout(() => {
      const t = this.elapsedNow();
      if (this.phaseOf(t) >= c.startPhase &&
          t < CONFIG.phases.finaleAt &&
          this.state.onScreen < CONFIG.maxOnScreen) {
        const el = Items.createError(this.playfield);
        this.state.onScreen++;
        this.state.generated++;
        Audio.error();
      }
      this._scheduleError();
    }, randRange(c.everyMsMin, c.everyMsMax));
  },

  /* ---------- 清除一件（由滑鼠或手勢呼叫） ---------- */
  clearItem(el, kind) {
    if (!el || el.__clearing) return false;
    if (el.__cdTimer) clearTimeout(el.__cdTimer);
    const ok = Items.clear(el, kind);
    if (!ok) return false;
    this.state.cleared++;
    this.state.onScreen = Math.max(0, this.state.onScreen - 1);
    this.state.clearTimes.push(performance.now());
    Audio.clear();
    return true;
  },

  /* ---------- 壓力值 ---------- */
  updatePressure() {
    const s = this.state;
    const c = CONFIG.pressure;
    let raw = s.onScreen * c.perItem + this.recentClears() * c.perRecentClear;
    raw = Math.min(c.max, raw);
    // 平滑
    s.pressureRaw = raw;
    s.pressure += (raw - s.pressure) * c.smoothing;
    const p = Math.min(1, s.pressure / c.max);
    this.root.style.setProperty('--p', p.toFixed(3));
    this.root.dataset.phase = String(s.phase);

    // 後期晃動（壓力越高越明顯，reduce-motion 時關閉）
    if (!s.reduceMotion && p > 0.35) {
      const amp = (p - 0.35) * 10;
      const dx = (Math.random() - 0.5) * amp;
      const dy = (Math.random() - 0.5) * amp;
      this.playfield.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    } else {
      this.playfield.style.transform = '';
    }
  },

  /* ---------- 主迴圈 ---------- */
  _loop() {
    if (!this.state.running) return;
    const s = this.state;
    s.elapsed = (performance.now() - s.startTime) / 1000;
    const ph = this.phaseOf(s.elapsed);
    if (ph !== s.phase) s.phase = ph;

    this.updatePressure();
    if (this.onTick) this.onTick(s);

    // 進入最終狀態
    if (s.elapsed >= CONFIG.phases.finaleAt && !s.finished) {
      s.finished = true;
      this._enterFinale();
      return;
    }
    this._raf = requestAnimationFrame(() => this._loop());
  },

  _enterFinale() {
    // 停止生成，但畫面暫時凍結（所有待辦留在原地）
    clearTimeout(this._spawnTimer);
    clearTimeout(this._induceTimer);
    clearTimeout(this._errorTimer);
    this.playfield.style.transform = '';
    // 所有聲音突然停止
    Audio.silence();
    // 短暫靜止後再交給 main 顯示訊息
    this.root.classList.add('is-frozen');
    setTimeout(() => {
      this.state.running = false;
      cancelAnimationFrame(this._raf);
      if (this.onFinale) this.onFinale(this.snapshot());
    }, CONFIG.phases.freezeMs);
  },

  snapshot() {
    return {
      cleared: this.state.cleared,
      generated: this.state.generated,
      onScreen: this.state.onScreen,
      elapsed: this.state.elapsed
    };
  }
};
