const { App, LogLevel } = require("@slack/bolt");
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
});

// ==============================
// 担当者名 → Slack ユーザーID マッピング
// ==============================
const MEMBER_IDS = {
  "薮内":    "UUT63NEUT",      // megumi.yabuuchi
  "成尾":    "UAG5R8DAN",      // saki.naruo
  "佐藤":    "U08Q0B4PB6W",   // yuka.sato
  "佐藤(祐)": "U08Q0B4PB6W",  // yuka.sato（佐藤祐花）
  "斎藤":    "U7BPUUZ3N",     // kaori.saito
  "谷村":    "U500N1AFP",     // sena.tanimura
  "鶴田":    "U055FG850R2",   // saki.tsuruta
  "松尾":    "U044FF9PJ8L",   // mariko.matsuo
  "中田":    "U4BRDU55G",      // kana.nakata
  "伊藤":    "U09VBSSGC3V",   // sayaka.ito
  "吉野":    "UQJ0H7SUU",     // chiho.yoshino
};

// ==============================
// 当番表データ
// ==============================
const SCHEDULE = {
  "2025-12": { members: ["薮内", "成尾", "佐藤"], theme: "冬料理" },
  "2026-02": { members: ["斎藤", "谷村"], theme: "バレンタイン" },
  "2026-03": { members: ["鶴田", "松尾"], theme: "春食材" },
  "2026-04": { members: ["薮内", "佐藤"], theme: "新生活" },
  "2026-05": { members: ["斎藤", "成尾"], theme: "夏バテ予防クイズ？" },
  "2026-06": { members: ["鶴田", "松尾"], theme: "夏食材" },
  "2026-08": { members: ["谷村", "佐藤"], theme: null },
  "2026-09": { members: ["中田", "斎藤"], theme: null },
  "2026-10": { members: ["鶴田", "成尾"], theme: null },
  "2026-11": { members: ["谷村", "松尾"], theme: null },
  "2026-12": { members: ["薮内", "佐藤(祐)"], theme: null },
  "2027-02": { members: ["中田", "斎藤"], theme: null },
  "2027-03": { members: ["鶴田", "成尾"], theme: null },
};

const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "CUK9AE6H2";
const SKIP_MONTHS = [1, 7];

// ==============================
// 名前をメンション or テキストに変換
// ==============================
function formatMember(name) {
  const id = MEMBER_IDS[name];
  return id ? `<@${id}>` : name;
}

// ==============================
// 翌月のyearMonthを取得
// ==============================
function getNextYearMonth() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthNum = nextMonth.getMonth() + 1;
  if (SKIP_MONTHS.includes(nextMonthNum)) {
    return null;
  }
  return `${nextMonth.getFullYear()}-${String(nextMonthNum).padStart(2, "0")}`;
}

// ==============================
// メッセージ送信関数
// ==============================
async function sendReminder(yearMonth) {
  const entry = SCHEDULE[yearMonth];
  if (!entry) {
    console.log(`${yearMonth} の当番データが見つかりません`);
    return;
  }
  const [year, month] = yearMonth.split("-");
  const membersText = entry.members.map(formatMember).join("・");
  const themeText = entry.theme ? `\n📌 *テーマ:* ${entry.theme}` : "";
  const message =
    `🍽️ *食トークのリマインドです！*\n\n` +
    `*${year}年${parseInt(month)}月の担当者:* ${membersText}${themeText}\n\n` +
    `今月もよろしくお願いします！ :raised_hands:`;
  await app.client.chat.postMessage({
    channel: CHANNEL_ID,
    text: message,
    mrkdwn: true,
  });
  console.log(`✅ ${yearMonth} のリマインドを送信しました`);
}

// ==============================
// 毎月10日 午前9時に自動送信
// ==============================
const cron = require("node-cron");
cron.schedule(
  "0 9 10 * *",
  async () => {
    const yearMonth = getNextYearMonth();
    if (!yearMonth) {
      const nextMonthNum = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getMonth() + 1;
      console.log(`翌月(${nextMonthNum}月)はスキップ月のためリマインドなし`);
      return;
    }
    console.log(`⏰ 定期実行: ${yearMonth} のリマインドを送信します`);
    await sendReminder(yearMonth);
  },
  { timezone: "Asia/Tokyo" }
);

// ==============================
// 手動テスト用スラッシュコマンド
// ==============================
app.command("/shoku-reminder", async ({ command, ack, respond }) => {
  await ack();
  const yearMonth = getNextYearMonth();
  if (!yearMonth) {
    await respond(`⏭️ 翌月はスキップ月のためリマインドなし`);
    return;
  }
  await sendReminder(yearMonth);
  await respond(`✅ ${yearMonth} のリマインドをチャンネルに送信しました！`);
});

// ==============================
// アプリ起動
// ==============================
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("🚀 食トークリマインダーbot 起動中 (port 3000)");
})();
