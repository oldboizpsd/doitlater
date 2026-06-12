/* ============================================================
   CONFIG —《等等再做 / DO IT LATER》
   所有可調整的設定參數集中於此：
   時間階段、生成速度、壓力、難度。
   顏色與字體請見 css/styles.css 的 :root 變數。
   ============================================================ */
const CONFIG = {

  /* 各階段的時間界線（秒） */
  phases: {
    p1End: 15,     // 第一階段：乾淨、可控
    p2End: 30,     // 第二階段：開始重疊
    p3End: 45,     // 第三階段：失控
    finaleAt: 45,  // 進入最終狀態的時間點
    freezeMs: 1600 // 最終訊息前的靜止時間
  },

  /* 各階段的生成間隔（毫秒）[最小, 最大] */
  spawn: {
    p1: [2000, 3000],
    p2: [1000, 1500],
    p3: [400, 800]
  },

  /* 「清得越快，生成越快」的動態加速邏輯 */
  speed: {
    clearWindowMs: 5000,  // 計算最近清除速度的時間窗
    accelPerClear: 0.05,  // 最近每清一件，生成間隔縮短的比例
    minIntervalMs: 170,   // 生成間隔下限（避免瀏覽器崩潰）
    burstChance: 0.18     // 第三階段一次生成兩件的機率
  },

  maxOnScreen: 150,       // 畫面上同時存在的待辦數上限

  /* 壓力值（0–100），驅動視覺逐步失控 */
  pressure: {
    perItem: 0.85,        // 每件畫面上的待辦貢獻的壓力
    perRecentClear: 0.6,  // 最近每清一件貢獻的壓力
    max: 100,
    smoothing: 0.08       // 壓力變化的平滑係數（越小越緩）
  },

  /* 誘導文字（第二階段後偶爾出現） */
  induce: {
    startPhase: 2,
    everyMsMin: 4000,
    everyMsMax: 7000
  },

  /* 錯誤視窗（第三階段偶爾彈出） */
  errorWindow: {
    startPhase: 3,
    everyMsMin: 2500,
    everyMsMax: 5000
  },

  /* 鏡頭手勢 */
  gesture: {
    cursorRadius: 46,     // 指尖游標清除半徑（px）
    sweepSpeed: 22,       // 判定為「掃除」的手掌橫移速度（px/frame）
    smoothing: 0.35,      // 游標位置平滑
    failTimeoutMs: 9000   // 多久偵測不到手 → 提示切換滑鼠
  },

  audio: { onByDefault: true },
  reduceMotionByDefault: false
};
