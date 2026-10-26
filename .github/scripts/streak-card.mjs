import { MONO, SANS } from "./fonts.mjs";
import { formatNumber, renderCard } from "./card-frame.mjs";

const COLUMNS = [82, 247, 412];

function formatDay(day) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function streaks(days, dailyCounts) {
  let longest = { length: 0, start: null, end: null };
  let current = { length: 0, start: null, end: null };
  for (const day of days) {
    if ((dailyCounts.get(day) ?? 0) === 0) {
      current = { length: 0, start: null, end: null };
      continue;
    }
    current = { length: current.length + 1, start: current.start ?? day, end: day };
    if (current.length > longest.length) longest = current;
  }
  return { longest, current };
}

function ongoingStreak(days, current) {
  const today = days.at(-1);
  const yesterday = days.at(-2);
  if (current.end === today || current.end === yesterday) return current;
  return { length: 0, start: null, end: null };
}

function streakRange(streak) {
  if (streak.length === 0) return "—";
  return `${formatDay(streak.start)} – ${formatDay(streak.end)}`;
}

function column(x, value, label, detail, delay, highlighted) {
  return `<g class="stagger" style="animation-delay:${delay}ms">
    <text x="${x}" y="${highlighted ? 158 : 135}" class="${highlighted ? "hero" : "number"}" text-anchor="middle">${value}</text>
    <text x="${x}" y="${highlighted ? 205 : 160}" class="label" text-anchor="middle">${label}</text>
    <text x="${x}" y="${highlighted ? 220 : 178}" class="axis" text-anchor="middle">${detail}</text>
  </g>`;
}

export function renderStreakCard({ days, dailyCounts, palette }) {
  const { longest, current } = streaks(days, dailyCounts);
  const ongoing = ongoingStreak(days, current);
  const activeDays = days.filter((day) => (dailyCounts.get(day) ?? 0) > 0).length;
  return renderCard({
    title: "Sequência de commits",
    subtitle: "Dias seguidos com pelo menos um commit · último ano",
    palette,
    styles: `
    .number { font: 700 28px ${SANS}; fill: ${palette.text}; }
    .hero { font: 800 30px ${SANS}; fill: ${palette.title}; }
    .label { font: 600 13px ${SANS}; fill: ${palette.text}; }
    .ring { fill: none; stroke: ${palette.title}; stroke-width: 5; }`,
    body: `<line x1="165" y1="85" x2="165" y2="200" stroke="${palette.track}"/>
  <line x1="330" y1="85" x2="330" y2="200" stroke="${palette.track}"/>
  <circle cx="${COLUMNS[1]}" cy="148" r="38" class="ring"/>
  <circle cx="${COLUMNS[1]}" cy="110" r="13" fill="${palette.background}"/>
  <text x="${COLUMNS[1]}" y="117" text-anchor="middle" font-size="18">🔥</text>
  ${column(COLUMNS[0], formatNumber(activeDays), "Dias com commit", `de ${days.length} dias`, 200, false)}
  ${column(COLUMNS[1], ongoing.length, "Sequência atual", streakRange(ongoing), 400, true)}
  ${column(COLUMNS[2], longest.length, "Maior sequência", streakRange(longest), 600, false)}`,
  });
}
