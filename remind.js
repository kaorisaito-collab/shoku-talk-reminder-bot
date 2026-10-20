// ==============================
// 食トークリマインダー（GitHub Actions 単発実行版）
// 毎日 JST12:00 に起動 → 「10日（土日祝なら翌営業日）」の日だけ送信して終了
// 手動実行（Run workflow）の場合は日付に関係なく今月分を送信
// ==============================

// ==============================
// 担当者名 → Slack ユーザーID マッピング
// ==============================
const MEMBER_IDS = {
  "薮内":     "UUT63NEUT",    // megumi.yabuuchi
  "成尾":     "UAG5R8DAN",    // saki.naruo
  "佐藤":     "U08Q0B4PB6W",  // yuka.sato
  "佐藤(祐)": "U08Q0B4PB6W",  // yuka.sato
  "斎藤":     "U7BPUUZ3N",    // kaori.saito
  "谷村":     "U500N1AFP",    // sena.tanimura
  "鶴田":     "U055FG850R2",  // saki.tsuruta
  "松尾":     "U044FF9PJ8L",  // mariko.matsuo
  "中田":     "U4BRDU55G",    // kana.nakata
  "吉野":     "UQJ0H7SUU",    // chiho.yoshino
};

// ==============================
// 固定スケジュール（キー = リマインドを送る月）
// ==============================
const FIXED_SCHEDULE = {
  "2026-08": { members: ["谷村", "佐藤"], theme: null },
  "2026-09": { members: ["中田", "斎藤"], theme: null },
  "2026-10": { members: ["鶴田", "成尾"], theme: null },
  "2026-11": { members: ["谷村", "松尾"], theme: null },
  "2026-12": { members: ["薮内", "佐藤(祐)"], theme: null },
  "2027-02": { members: ["中田", "斎藤"], theme: null },
  "2027-03": { members: ["鶴田", "成尾"], theme: null },
};

// ==============================
// ローテーション（2027年4月以降・お休み月を除いて順番に回る）
// ==============================
const ROTATION = [
  ["谷村", "松尾"],
  ["薮内", "佐藤(祐)"],
  ["中田", "斎藤"],
  ["鶴田", "成尾"],
];

const SKIP_MONTHS = [1, 7]; // 1月と7月はお休み
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "CUK9AE6H2";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

// ==============================
// JSTの今日（Actionsのランナーは UTC のため明示的に変換）
// ==============================
function getTodayJST() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

function formatDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatMember(name) {
  const id = MEMBER_IDS[name];
  return id ? `<@${id}>` : name;
}

// ==============================
// 祝日・営業日判定
// ==============================
async function getJapaneseHolidays(year) {
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    return Object.keys(await res.json());
  } catch (e) {
    console.warn("祝日APIの取得に失敗しました（土日のみで判定します）", e);
    return [];
  }
}

async function getSendDay(year, month) {
  const holidays = await getJapaneseHolidays(year);
  const d = new Date(Date.UTC(year, month - 1, 10));
  while (true) {
    const dow = d.getUTCDay();
    const ds = formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (dow !== 0 && dow !== 6 && !holidays.includes(ds)) {
      return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

// ==============================
// 担当者の決定
// ==============================
function getRotationMembers(year, month) {
  let count = 0;
  let y = 2027;
  let m = 4;
  while (!(y === year && m === month)) {
    if (!SKIP_MONTHS.includes(m)) count++;
    m++;
    if (m > 12) { m = 1; y++; }
    if (y > year + 10) break;
  }
  return ROTATION[count % ROTATION.length];
}

function getEntry(year, month) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  if (FIXED_SCHEDULE[key]) return FIXED_SCHEDULE[key];
  if (year > 2027 || (year === 2027 && month >= 4)) {
    return { members: getRotationMembers(year, month), theme: null };
  }
  return null;
}

// ==============================
// メイン
// ==============================
async function main() {
  const { year, month, day } = getTodayJST();
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  if (SKIP_MONTHS.includes(month)) {
    console.log(`${month}月はお休み月のためスキップ`);
    return;
  }

  if (!IS_MANUAL) {
    const sendDay = await getSendDay(year, month);
    if (!(sendDay.month === month && sendDay.day === day)) {
      console.log(`今日(${month}/${day})は送信日ではありません（今月の送信日: ${sendDay.month}/${sendDay.day}）`);
      return;
    }
  } else {
    console.log("手動実行のため日付チェックをスキップします");
  }

  const entry = getEntry(year, month);
  if (!entry) {
    console.error(`❌ ${yearMonth} の当番データがありません`);
    process.exit(1);
  }

  const membersText = entry.members.map(formatMember).join("・");
  const themeText = entry.theme ? `\n📌 *テーマ:* ${entry.theme}` : "";
  const message =
    `🍽️ *食トークのリマインドです！*\n\n` +
    `*${year}年${month}月の担当者:* ${membersText}${themeText}\n\n` +
    `今月もよろしくお願いします！ :raised_hands:`;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: CHANNEL_ID, text: message, mrkdwn: true }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log(`✅ ${yearMonth} のリマインドを送信しました`);
  } else {
    console.error("❌ 送信失敗:", data.error);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ 予期しないエラー:", e);
  process.exit(1);
});
