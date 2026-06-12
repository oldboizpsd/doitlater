/* ============================================================
   GESTURES — 鏡頭手部辨識（MediaPipe Hands via CDN）
   - 指尖游標：碰觸待辦 → 清除單一事項
   - 手掌橫向快速移動：掃除路徑上多個事項
   - 握拳：壓縮一件事項
   - 張開手掌：小範圍清除
   影像僅在瀏覽器本地處理，不上傳、不儲存。
   若載入或偵測失敗 → 回呼 onFail，由 main 提示改用滑鼠。
   ============================================================ */
const Gestures = {
  active: false,
  hands: null,
  camera: null,
  videoEl: null,
  skelCanvas: null,
  skelCtx: null,
  cursor: null,
  onFail: null,
  onClearAt: null,     // (x, y, radius, kind) → main 處理清除
  _last: { x: 0, y: 0, t: 0 },
  _smooth: { x: 0, y: 0 },
  _lastSeen: 0,
  _failTimer: null,

  async enable(videoEl, skelCanvas, cursor) {
    this.videoEl = videoEl;
    this.skelCanvas = skelCanvas;
    this.skelCtx = skelCanvas.getContext('2d');
    this.cursor = cursor;

    // 動態載入 MediaPipe Hands
    try {
      await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js');
      await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
    } catch (e) {
      this._fail('無法載入手部辨識模組');
      return false;
    }
    if (!window.Hands || !window.Camera) { this._fail('手部辨識模組不可用'); return false; }

    try {
      this.hands = new window.Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
      });
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,      // 低延遲優先
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });
      this.hands.onResults((r) => this._onResults(r));

      this.camera = new window.Camera(this.videoEl, {
        onFrame: async () => { try { await this.hands.send({ image: this.videoEl }); } catch (e) {} },
        width: 640, height: 360
      });
      await this.camera.start();
    } catch (e) {
      this._fail('無法啟動鏡頭');
      return false;
    }

    this.active = true;
    this._lastSeen = performance.now();
    this._watchFail();
    return true;
  },

  disable() {
    this.active = false;
    clearTimeout(this._failTimer);
    try { if (this.camera) this.camera.stop(); } catch (e) {}
    try {
      const s = this.videoEl && this.videoEl.srcObject;
      if (s) s.getTracks().forEach(t => t.stop());
      if (this.videoEl) this.videoEl.srcObject = null;
    } catch (e) {}
    if (this.cursor) this.cursor.style.opacity = '0';
  },

  _loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = () => rej(new Error('load fail: ' + src));
      document.head.appendChild(s);
    });
  },

  _fail(msg) {
    if (this.onFail) this.onFail(msg);
  },

  _watchFail() {
    clearTimeout(this._failTimer);
    this._failTimer = setTimeout(() => {
      if (this.active && performance.now() - this._lastSeen > CONFIG.gesture.failTimeoutMs) {
        this._fail('偵測不到手部，建議改用滑鼠模式');
      }
      if (this.active) this._watchFail();
    }, 2000);
  },

  _onResults(r) {
    const ctx = this.skelCtx, cv = this.skelCanvas;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!r.multiHandLandmarks || !r.multiHandLandmarks.length) {
      if (this.cursor) this.cursor.style.opacity = '0';
      return;
    }
    this._lastSeen = performance.now();
    const lm = r.multiHandLandmarks[0];

    // 在小視窗畫骨架（鏡像）
    this._drawSkeleton(ctx, cv, lm);

    // 指尖（食指 8）映射到全螢幕座標（鏡像 x）
    const vw = window.innerWidth, vh = window.innerHeight;
    const tip = lm[8];
    const tx = (1 - tip.x) * vw;
    const ty = tip.y * vh;
    const sm = CONFIG.gesture.smoothing;
    this._smooth.x += (tx - this._smooth.x) * sm;
    this._smooth.y += (ty - this._smooth.y) * sm;
    const x = this._smooth.x, y = this._smooth.y;

    // 偵測手勢狀態
    const g = this._classify(lm);

    // 更新游標
    if (this.cursor) {
      this.cursor.style.opacity = '1';
      this.cursor.style.left = x + 'px';
      this.cursor.style.top = y + 'px';
      this.cursor.dataset.state = g.state;
    }

    // 手掌橫移速度 → 掃除
    const now = performance.now();
    const dt = Math.max(1, now - this._last.t);
    const vx = (x - this._last.x);
    const speed = Math.abs(vx) / (dt / 16.7);
    this._last = { x, y, t: now };

    const R = CONFIG.gesture.cursorRadius;
    if (this.onClearAt) {
      if (speed > CONFIG.gesture.sweepSpeed || g.state === 'open') {
        // 掃除 / 張開手掌：大範圍
        this.onClearAt(x, y, R * 1.8, 'fx-sweep');
      } else if (g.state === 'fist') {
        // 握拳：壓縮一件
        this.onClearAt(x, y, R * 0.8, 'fx-compress');
      } else {
        // 指尖碰觸：清除單一
        this.onClearAt(x, y, R, 'fx-shatter');
      }
    }
  },

  /* 以指尖是否伸直，粗略分類 open / fist / point */
  _classify(lm) {
    const fingers = [[8,6],[12,10],[16,14],[20,18]];
    let ext = 0;
    for (const [tip, pip] of fingers) if (lm[tip].y < lm[pip].y) ext++;
    if (ext >= 3) return { state: 'open' };
    if (ext === 0) return { state: 'fist' };
    return { state: 'point' };
  },

  _drawSkeleton(ctx, cv, lm) {
    const W = cv.width, H = cv.height;
    const conn = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]];
    ctx.save();
    ctx.strokeStyle = 'rgba(216,58,42,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of conn) {
      ctx.moveTo((1 - lm[a].x) * W, lm[a].y * H);
      ctx.lineTo((1 - lm[b].x) * W, lm[b].y * H);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(127,255,106,0.95)';
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc((1 - p.x) * W, p.y * H, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};
