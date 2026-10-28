import { MONO, PLATE } from "./fonts.mjs";
import { escapeXml, formatNumber, renderCard } from "./card-frame.mjs";

const BUCKETS = [
  { label: "< 1h", limitHours: 1 },
  { label: "1–4h", limitHours: 4 },
  { label: "4–24h", limitHours: 24 },
  { label: "1–3 dias", limitHours: 72 },
  { label: "3–7 dias", limitHours: 168 },
  { label: "> 7 dias", limitHours: Infinity },
];
const BAR_LEFT = 262;
const BAR_MAX_WIDTH = 150;
const FIRST_ROW = 88;
const ROW_GAP = 22;

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.floor(hours)}h${String(Math.round((hours % 1) * 60)).padStart(2, "0")}`;
  return `${Math.round(hours / 24)} dias`;
}

function bucketCounts(hoursToMerge) {
  const counts = BUCKETS.map(() => 0);
  for (const hours of hoursToMerge) {
    counts[BUCKETS.findIndex((bucket) => hours < bucket.limitHours)] += 1;
  }
  return counts;
}

function bucketRow(bucket, count, index, maximum, total, palette) {
  const y = FIRST_ROW + index * ROW_GAP;
  const width = Math.max((count / maximum) * BAR_MAX_WIDTH, count > 0 ? 2 : 0);
  const color = count === maximum ? palette.levels[3] : palette.levels[2];
  const share = Math.round((count / Math.max(total, 1)) * 100);
  return `<g class="stagger" style="animation-delay:${index * 90}ms">
    <text x="${BAR_LEFT - 10}" y="${y + 9}" class="axis" text-anchor="end">${escapeXml(bucket.label)}</text>
    <rect class="bar" style="animation-delay:${index * 90}ms" x="${BAR_LEFT}" y="${y}" width="${width.toFixed(2)}" height="12" rx="2" fill="${color}"><title>${escapeXml(bucket.label)}: ${count} PRs</title></rect>
    <text x="${BAR_LEFT + width + 8}" y="${y + 9}" class="axis">${share}%</text>
  </g>`;
}

function headline(value, caption, y) {
  return `<text x="25" y="${y}" class="headline">${value}</text>
  <text x="25" y="${y + 18}" class="axis">${caption}</text>`;
}

export function renderMergeTimeCard({ pullRequests, palette }) {
  const hoursToMerge = pullRequests.map((pullRequest) => pullRequest.hoursToMerge);
  const counts = bucketCounts(hoursToMerge);
  const maximum = Math.max(...counts, 1);
  const medianSize = median(pullRequests.map((pullRequest) => pullRequest.linesChanged));
  return renderCard({
    title: "Do PR ao merge",
    subtitle: `${formatNumber(pullRequests.length)} pull requests mergeados no último ano`,
    palette,
    styles: `.headline { font: 600 46px ${PLATE}; fill: ${palette.signal}; letter-spacing: 0.5px; }
    .headline-small { font: 600 13px ${MONO}; fill: ${palette.heading}; }
    .bar { transform-box: fill-box; transform-origin: left; transform: scaleX(0); animation: grow 0.6s ease-out forwards; }
    @keyframes grow { to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .bar, .stagger { animation: none; transform: none; opacity: 1; } }`,
    body: `${headline(formatDuration(median(hoursToMerge)), "mediana até o merge", 122)}
  <text x="25" y="190" class="headline-small">${formatNumber(medianSize)} linhas</text>
  <text x="25" y="207" class="axis">tamanho mediano do PR</text>
  <line x1="190" y1="80" x2="190" y2="212" stroke="${palette.track}"/>
  ${BUCKETS.map((bucket, index) => bucketRow(bucket, counts[index], index, maximum, pullRequests.length, palette)).join("")}`,
  });
}
