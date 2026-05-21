const FIXED_SCHEDULE = {
  "2025-12": { members: ["薮内", "成尾", "佐藤"], theme: "冬料理" },
  "2026-02": { members: ["斎藤", "谷村"], theme: "バレンタイン" },
  "2026-03": { members: ["鶴田", "松尾"], theme: "春食材" },
  "2026-04": { members: ["薮内", "佐藤"], theme: "新生活" },
  "2026-05": { members: ["斎藤", "成尾"], theme: "夏バテ予防クイズ？" },
  "2026-06": { members: ["鶴田", "谷村"], theme: "夏食材" },
  "2026-08": { members: ["松尾", "佐藤"], theme: null },
  "2026-09": { members: ["中田", "伊藤"], theme: null },
  "2026-10": { members: ["吉野", "佐藤(由)"], theme: null },
  "2026-11": { members: ["鶴田(斎藤)", "成尾"], theme: null },
  "2026-12": { members: ["谷村", "松尾"], theme: null },
  "2027-02": { members: ["薮内", "佐藤(祐)"], theme: null },
  "2027-03": { members: ["中田", "伊藤"], theme: null },
};

const ROTATION = [
  ["中田", "伊藤"],
  ["吉野", "佐藤(由)"],
  ["鶴田(斎藤)", "成尾"],
  ["谷村", "松尾"],
  ["薮内", "佐藤(祐)"],
];

const SKIP_MONTHS = [1, 7];

function getRotationMembers(year, month) {
  if (SKIP_MONTHS.includes(month)) return null;
  const startYear = 2027, startMonth = 4;
  let count = 0, y = startYear, m = startMonth;
  while (!(y === year && m === month)) {
    if (!SKIP_MONTHS.includes(m)) count++;
    m++;
    if (m > 12) { m = 1; y++; }
    if (y > year + 10) break;
  }
  return ROTATION[count % ROTATION.length];
}

async function getJapaneseHolidays(year) {
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    return Object.keys(await res.json());
  } catch (e) {
    return [];
  }
}

async function getNextBusinessDay(date) {
  const holidays = await getJapaneseHolidays(date.getFullYear());
  let d = new Date(date);
  while (true) {
    const dow = d.getDay();
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (dow !== 0 && dow !== 6 && !holidays.includes(ds)) return d;
    d.setDate(d.getDate() + 1);
  }
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (SKIP_MONTHS.includes(month)) {
    console.log(`${month}月はお休み月のためスキップ`);
    return;
  }

  const tenth = new Date(year, month - 1, 10);
  const businessDay = await getNextBusinessDay(tenth);

  if (!(businessDay.getFullYear() === year && businessDay.getMonth() + 1 === month && businessDay.getDate() === day)) {
    console.log(`今日(${day}日)は送信日ではありません`);
    return;
  }

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  let members, theme;

  if (FIXED_SCHEDULE[yearMonth]) {
    members = FIXED_SCHEDULE[yearMonth].members;
    theme = FIXED_SCHEDULE[yearMonth].theme;
  } else if (year > 2027 || (year === 2027 && month >= 4)) {
    members = getRotationMembers(year, month);
    theme = null;
  } else {
    console.log(`${yearMonth} のデータなし`);
    return;
  }

  const membersText = members.join("・");
  const themeText = theme ? `\n📌 *テーマ:* ${theme}` : "";
  const message = `🍽️ *食トークのリマインドです！*\n\n*${year}年${month}月の担当者:* ${membersText}${themeText}\n\n今月もよろしくお願いします！ :raised_hands:`;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: process.env.SLACK_CHANNEL_ID, text: message, mrkdwn: true }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log(`✅ ${yearMonth} のリマインドを送信しました`);
  } else {
    console.error(`❌ 送信失敗:`, data.error);
    process.exit(1);
  }
}

main();
