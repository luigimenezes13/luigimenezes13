const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 52;
const TOP = 78;
const WEEKS = 53;
const WIDTH = LEFT + WEEKS * STEP + 20;
const HEIGHT = TOP + 7 * STEP + 40;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = [[1, "seg"], [3, "qua"], [5, "sex"]];

export function calendarStart(today) {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (WEEKS - 1) * 7 - start.getUTCDay());
  return start;
}

function calendarDays(today) {
  const days = [];
  const cursor = calendarStart(today);
  while (cursor.toISOString().slice(0, 10) <= today) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function levelThresholds(counts) {
  const active = counts.filter((count) => count > 0).sort((left, right) => left - right);
  if (active.length === 0) return [1, 1, 1];
  const at = (ratio) => active[Math.floor((active.length - 1) * ratio)];
  return [at(0.25), at(0.5), at(0.75)];
}

function levelOf(count, thresholds) {
  if (count === 0) return 0;
  return 1 + thresholds.filter((threshold) => count > threshold).length;
}

function cell(day, index, count, level, colors) {
  const week = Math.floor(index / 7);
  const weekday = index % 7;
  const delay = (week * 0.03).toFixed(2);
  return `<rect class="day" style="animation-delay:${delay}s" x="${LEFT + week * STEP}" y="${TOP + weekday * STEP}" width="${CELL}" height="${CELL}" rx="2" fill="${colors[level]}"><title>${day}: ${count} commits</title></rect>`;
}

function monthLabels(days) {
  return days
    .map((day, index) => ({ day, index }))
    .filter(({ day, index }) => day.endsWith("-01") || (index === 0 && Number(day.slice(8)) < 8))
    .map(({ day, index }) => `<text x="${LEFT + Math.floor(index / 7) * STEP}" y="${TOP - 8}" class="axis">${MONTHS[Number(day.slice(5, 7)) - 1]}</text>`)
    .join("");
}

function weekdayLabels() {
  return WEEKDAYS.map(([weekday, label]) => `<text x="${LEFT - 30}" y="${TOP + weekday * STEP + 10}" class="axis">${label}</text>`).join("");
}

function legend(colors) {
  const x = WIDTH - 20 - colors.length * STEP - 70;
  const y = TOP + 7 * STEP + 18;
  const swatches = colors.map((color, index) => `<rect x="${x + 40 + index * STEP}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`).join("");
  return `<text x="${x}" y="${y + 10}" class="axis">menos</text>${swatches}<text x="${x + 46 + colors.length * STEP}" y="${y + 10}" class="axis">mais</text>`;
}

export function renderContributionHeatmap({ dailyCounts, today, total, palette, subtitle }) {
  const colors = [palette.empty, ...palette.levels];
  const days = calendarDays(today);
  const counts = days.map((day) => dailyCounts.get(day) ?? 0);
  const thresholds = levelThresholds(counts);
  const cells = days.map((day, index) => cell(day, index, counts[index], levelOf(counts[index], thresholds), colors)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Contribuições no último ano">
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .subtitle { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .axis { font: 400 10px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .day { opacity: 0; animation: reveal 0.4s ease-out forwards; }
    @keyframes reveal { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="12" fill="${palette.background}"/>
  <text x="25" y="35" class="title">${new Intl.NumberFormat("pt-BR").format(total)} commits no último ano</text>
  <text x="25" y="53" class="subtitle">${subtitle}</text>
  ${monthLabels(days)}${weekdayLabels()}${cells}${legend(colors)}
</svg>`;
}
