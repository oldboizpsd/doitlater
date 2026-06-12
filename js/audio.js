/* ============================================================
   AUDIO — 以 Web Audio API 即時合成音效（無需外部檔案）
   可關閉，預設開啟。後期音效隨待辦增加而變密集。
   最終訊息出現前會被 stopAll() 全部停止，形成情緒落差。
   ============================================================ */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = CONFIG.audio.onByDefault;
    this.muted = false; // 進入結尾時整體靜音
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.ctx.destination);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEnabled(b) {
    this.enabled = b;
    if (this.master) this.master.gain.value = (b && !this.muted) ? 0.5 : 0;
  }

  /* 進入結尾：突然全部靜音 */
  silence() {
    this.muted = true;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 0.04);
    }
  }

  _on() { return this.enabled && !this.muted && this.ctx; }

  /* 基本單音 */
  blip(freq = 880, dur = 0.06, type = 'square', peak = 0.3) {
    if (!this._on()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* 雜訊爆裂（清除 / 碎裂用） */
  _noise(dur = 0.12, peak = 0.25, hp = 1200) {
    if (!this._on()) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = peak;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  click()     { this.blip(620, 0.035, 'square', 0.18); }
  notify()    { this.blip(880, 0.07, 'sine', 0.22); setTimeout(() => this.blip(1320, 0.08, 'sine', 0.16), 60); }
  email()     { this.blip(523, 0.10, 'triangle', 0.2); }
  key()       { this.blip(1900 + Math.random() * 400, 0.018, 'square', 0.06); }
  countdown() { this.blip(440, 0.05, 'sawtooth', 0.18); }
  error()     { this.blip(150, 0.20, 'sawtooth', 0.28); setTimeout(() => this.blip(120, 0.18, 'sawtooth', 0.24), 90); }
  clear()     { this._noise(0.11, 0.22, 1400); this.blip(300, 0.05, 'square', 0.1); }
  trash()     { this._noise(0.16, 0.2, 600); }
}

const Audio = new AudioEngine();
