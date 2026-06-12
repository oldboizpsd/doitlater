/* ============================================================
   ITEMS — 建立各種待辦「視窗」的 DOM，並處理清除動畫
   每件待辦都是一個 .todo 元素，內含一種形式（便利貼 / 通知 / …）。
   ============================================================ */
const Items = {

  /* 建立一件待辦事項的 DOM 元素 */
  create(playfield, opts) {
    const typeDef = weightedPick(ITEM_TYPES);
    const type = (opts && opts.forceType) || typeDef.type;
    const text = pick(TODO_TEXTS);
    const urg = weightedPick(URGENCY);

    const el = document.createElement('div');
    el.className = `todo todo--${type} urg-${urg.tone}`;
    el.dataset.todo = '1';
    el.dataset.points = '1';

    el.innerHTML = this._markup(type, text, urg);

    /* 大小：第一階段較大，後期較小（更密更亂） */
    const sizeScale = opts && opts.sizeScale != null ? opts.sizeScale : 1;
    el.style.setProperty('--scale', sizeScale.toFixed(2));

    /* 位置：避開頂端選單列，允許後期重疊 */
    this.place(el, playfield, opts && opts.spread);

    /* 微小傾斜，模擬隨手散落 */
    const tilt = randRange(-5, 5) * (opts && opts.tiltMul || 1);
    el.style.setProperty('--tilt', tilt.toFixed(1) + 'deg');

    /* 進場動畫 */
    el.classList.add('todo--in');

    playfield.appendChild(el);
    return el;
  },

  place(el, playfield, spread) {
    const W = playfield.clientWidth, H = playfield.clientHeight;
    const margin = 24, topBar = 54;
    // spread 0..1：越大越能貼近邊緣與重疊
    const w = 230, h = 150;
    const x = randRange(margin, Math.max(margin, W - w - margin));
    const y = randRange(topBar + margin, Math.max(topBar + margin, H - h - margin));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.zIndex = String(20 + Math.floor(Math.random() * 60));
  },

  _markup(type, text, urg) {
    const tag = `<span class="todo__tag">${urg.label}</span>`;
    switch (type) {

      case 'sticky':
        return `
          <div class="sticky__pin"></div>
          <div class="sticky__body">
            <p class="sticky__text">${text}</p>
            ${tag}
          </div>`;

      case 'notify':
        return `
          <div class="win">
            <div class="win__head">
              <span class="dot"></span>
              <span class="win__app">${pick(APPS)}</span>
              <span class="win__time">現在</span>
            </div>
            <div class="win__body">
              <p class="win__title">${text}</p>
              ${tag}
            </div>
          </div>`;

      case 'chat':
        return `
          <div class="chat">
            <div class="chat__avatar">${pick(SENDERS).slice(0,1)}</div>
            <div class="chat__bubble">
              <span class="chat__name">${pick(SENDERS)}</span>
              <p class="chat__msg">${text}</p>
            </div>
            <span class="chat__badge">${randInt(1,9)}</span>
          </div>`;

      case 'email':
        return `
          <div class="win win--mail">
            <div class="win__head">
              <span class="mail__icon">✉</span>
              <span class="win__app">郵件</span>
              <span class="win__time">${randInt(1,59)} 分鐘前</span>
            </div>
            <div class="win__body">
              <p class="mail__from">${pick(SENDERS)}</p>
              <p class="win__title">${text}</p>
              ${tag}
            </div>
          </div>`;

      case 'calendar': {
        const m = randInt(1,12), d = randInt(1,28);
        return `
          <div class="win win--cal">
            <div class="cal__date"><span class="cal__m">${m}月</span><span class="cal__d">${d}</span></div>
            <div class="cal__info">
              <p class="win__title">${text}</p>
              ${tag}
            </div>
          </div>`;
      }

      case 'popup':
        return `
          <div class="win win--popup">
            <div class="win__bar">
              <span class="win__bar-title">提醒</span>
              <span class="win__x">×</span>
            </div>
            <div class="win__body">
              <p class="win__title">${text}</p>
              <div class="popup__btns"><span>稍後</span><span class="is-primary">現在做</span></div>
            </div>
          </div>`;

      case 'file': {
        const ext = pick(FILE_EXT);
        return `
          <div class="file">
            <div class="file__icon"><span>${ext.replace('.','').toUpperCase()}</span></div>
            <p class="file__name">${text}${ext}</p>
          </div>`;
      }

      case 'countdown':
        return `
          <div class="win win--count">
            <span class="count__label">倒數</span>
            <span class="count__time" data-count>--:--</span>
            <p class="win__title">${text}</p>
          </div>`;
    }
    return `<div class="win"><div class="win__body"><p class="win__title">${text}</p>${tag}</div></div>`;
  },

  /* 誘導文字（漂浮的小字） */
  createInduce(playfield) {
    const el = document.createElement('div');
    el.className = 'induce';
    el.textContent = pick(INDUCE_TEXTS);
    el.style.left = randRange(0.15, 0.7) * playfield.clientWidth + 'px';
    el.style.top = randRange(0.2, 0.75) * playfield.clientHeight + 'px';
    playfield.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  /* 錯誤視窗（後期） */
  createError(playfield) {
    const [title, body] = pick(ERROR_TEXTS);
    const el = document.createElement('div');
    el.className = 'todo todo--errwin urg-crit';
    el.dataset.todo = '1';
    el.innerHTML = `
      <div class="win win--err">
        <div class="win__bar win__bar--err">
          <span class="win__bar-title">⚠ ${title}</span>
          <span class="win__x">×</span>
        </div>
        <div class="win__body"><p class="win__title">${body}</p>
          <div class="popup__btns"><span class="is-primary">確定</span></div>
        </div>
      </div>`;
    this.place(el, playfield, 1);
    el.style.setProperty('--scale', '1.05');
    el.style.setProperty('--tilt', '0deg');
    el.classList.add('todo--in');
    el.style.zIndex = '90';
    playfield.appendChild(el);
    return el;
  },

  /* 清除某件待辦：碎裂 / 壓縮動畫後移除 */
  clear(el, kind) {
    if (!el || el.__clearing) return false;
    el.__clearing = true;
    el.classList.remove('todo--in');
    el.classList.add('todo--out', kind || 'fx-shatter');
    el.style.pointerEvents = 'none';
    const dur = el.classList.contains('reduce') ? 120 : 360;
    setTimeout(() => el.remove(), dur);
    return true;
  }
};
