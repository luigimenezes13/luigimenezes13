import { renderCard } from "./card-frame.mjs";

const LEFT = 25;
const RIGHT = 470;
const BASELINE = 205;
const MAX_BAR_HEIGHT = 120;
const SLOT = (RIGHT - LEFT) / 24;

function peakHour(hourlyCounts) {
  return hourlyCounts.indexOf(Math.max(...hourlyCounts));
}

function bar(count, hour, maximum, peak, palette) {
  const height = Math.max((count / maximum) * MAX_BAR_HEIGHT, count > 0 ? 2 : 0);
  const color = hour === peak ? palette.levels[3] : palette.levels[2];
  return `<rect class="bar" style="animation-delay:${hour * 30}ms" x="${(LEFT + hour * SLOT + 2).toFixed(2)}" y="${(BASELINE - height).toFixed(2)}" width="${(SLOT - 4).toFixed(2)}" height="${height.toFixed(2)}" rx="2" fill="${color}"><title>${hour}h: ${count} commits</title></rect>`;
}

function hourLabels() {
  return [0, 3, 6, 9, 12, 15, 18, 21]
    .map((hour) => `<text x="${(LEFT + hour * SLOT + SLOT / 2).toFixed(2)}" y="${BASELINE + 15}" class="axis" text-anchor="middle">${hour}h</text>`)
    .join("");
}

export function renderProductiveTimeCard({ hourlyCounts, palette }) {
  const maximum = Math.max(...hourlyCounts, 1);
  const peak = peakHour(hourlyCounts);
  const total = hourlyCounts.reduce((sum, count) => sum + count, 0);
  const peakShare = Math.round((hourlyCounts[peak] / Math.max(total, 1)) * 100);
  return renderCard({
    title: "Horário mais produtivo",
    subtitle: `Pico às ${peak}h (${peakShare}% dos commits) · último ano, horário de Brasília`,
    palette,
    styles: `.bar { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); animation: grow 0.5s ease-out forwards; }
    @keyframes grow { to { transform: scaleY(1); } }`,
    body: `<line x1="${LEFT}" y1="${BASELINE + 0.5}" x2="${RIGHT}" y2="${BASELINE + 0.5}" stroke="${palette.track}"/>
  ${hourlyCounts.map((count, hour) => bar(count, hour, maximum, peak, palette)).join("")}
  ${hourLabels()}`,
  });
}
