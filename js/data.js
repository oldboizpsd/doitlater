/* ============================================================
   DATA — 待辦事項內容與標籤
   所有文字集中存放於陣列，方便後續修改。
   ============================================================ */

/* 至少 30 組待辦事項內容 */
const TODO_TEXTS = [
  '回老師訊息', '做期末簡報', '修改作業', '整理桌面', '回覆群組',
  '上傳檔案', '整理參考資料', '找老師簽名', '填寫表單', '輸出作品',
  '補交作業', '處理未讀郵件', '確認截止日期', '修改排版', '檢查錯字',
  '剪輯影片', '整理資料夾', '備份檔案', '回覆合作訊息', '預約討論時間',
  '完成進度報告', '更新作品集', '寄出申請資料', '記得吃飯', '記得喝水',
  '記得睡覺', '明天再說', '等一下處理', '五分鐘後開始', '先休息一下'
];

/* 緊急程度標籤：label 顯示文字，tone 對應 CSS class，weight 出現權重 */
const URGENCY = [
  { label: '一般',      tone: 'calm',   weight: 30 },
  { label: '今天完成',  tone: 'soon',   weight: 18 },
  { label: '即將截止',  tone: 'soon',   weight: 14 },
  { label: '已逾期',    tone: 'over',   weight: 12 },
  { label: '非常重要',  tone: 'crit',   weight: 10 },
  { label: '老師已讀',  tone: 'crit',   weight: 9  },
  { label: '第三次提醒', tone: 'over',   weight: 7  }
];

/* 誘導文字（讓人以為快結束了） */
const INDUCE_TEXTS = [
  '還有幾件而已', '快做完了', '再清最後一件', '你做得很好',
  '就快結束了', '只剩一點點', '再一下下', '差不多了'
];

/* 待辦事項的形式（畫面上的視窗種類）與出現權重 */
const ITEM_TYPES = [
  { type: 'sticky',   weight: 20 },  // 便利貼
  { type: 'notify',   weight: 18 },  // 系統通知
  { type: 'chat',     weight: 16 },  // 聊天訊息
  { type: 'email',    weight: 14 },  // 電子郵件
  { type: 'calendar', weight: 10 },  // 行事曆提醒
  { type: 'popup',    weight: 9  },  // 瀏覽器彈出視窗
  { type: 'file',     weight: 8  },  // 桌面檔案
  { type: 'countdown',weight: 5  }   // 倒數計時提醒
];

/* 假的寄件人 / 應用程式名稱，增加擬真感 */
const SENDERS = ['指導老師', '系辦公室', '小組群組', '合作廠商', '招生組',
  '助教', '學長姐', '系統管理員', '行事曆', '雲端硬碟'];
const APPS = ['訊息', '郵件', '行事曆', '雲端', '備忘錄', '社團', '專題群組'];

/* 假的副檔名（桌面檔案用） */
const FILE_EXT = ['.psd', '.pdf', '.docx', '.pptx', '.ai', '.mp4', '.zip', '.fig'];

/* 錯誤視窗文字（後期出現） */
const ERROR_TEXTS = [
  ['系統忙碌中', '無法回應，請稍候再試。'],
  ['儲存失敗', '檔案來不及儲存。'],
  ['記憶體不足', '開啟的事項太多了。'],
  ['連線逾時', '伺服器沒有回應。'],
  ['未完成項目過多', '是否要全部忽略？']
];

/* 工具：依 weight 加權隨機 */
function weightedPick(arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) { if ((r -= x.weight) <= 0) return x; }
  return arr[arr.length - 1];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function randRange(a, b) { return a + Math.random() * (b - a); }
