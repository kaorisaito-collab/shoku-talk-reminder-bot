const { App, LogLevel } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
});

// ==============================
// 当番表データ（画像より転記）
// ==============================
const SCHEDULE = {
  // 2025年度
  "2025-12": { members: ["薮内", "成尾", "佐藤"], theme: "冬料理" },
  "2026-02": { members: ["斎藤", "谷村"], theme: "バレンタイン" },
  "2026-03": { members: ["鶴田", "松尾"], theme: "春食材" },
  "2026-04": { members: ["薮内", "佐藤"], theme: "新生活" },
  "2026-05": { members: ["斎藤", "成尾"], theme: "夏バテ予防クイズ？" },
  "2026-06": { members: ["鶴田", "松尾"], theme: "夏食材" },
  "2026-08": { members: ["谷村", "佐藤"], theme: null },
  // 2026年度
  "2026-09": { members: ["中田", "伊藤"], theme: null },
  "2026-10": { members: ["吉野", "佐藤(由)"], theme: null },
  "2026-11": { members: ["鶴田(斎藤)", "成尾"], theme: null },
  "2026-12": { members: ["谷村", "松尾"], theme: null },
  "2027-02": { members: ["薮内", "佐藤(祐)"], theme: null },
  "2027-03": { members: ["中田", "伊藤"], theme: null },
};

// 通知先チャンネルID（環境変数で上書き可能）
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "CUK9AE6H2";

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
  const membersText = entry.members.join("・");
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
// node-cron を使用: "0 9 10 * *"
// ==============================
const cron = require("node-cron");

cron.schedule(
  "0 9 10 * *",
  async () => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    console.log(`⏰ 定期実行: ${yearMonth} のリマインドを送信します`);
    await sendReminder(yearMonth);
  },
  {
    timezone: "Asia/Tokyo",
  }
);

// ==============================
// 手動テスト用コマンド
// スラッシュコマンド: /shoku-reminder
// ==============================
app.command("/shoku-reminder", async ({ command, ack, respond }) => {
  await ack();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
