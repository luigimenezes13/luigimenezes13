import { escapeXml, formatNumber, renderCard } from "./card-frame.mjs";

const HEIGHT = 190;
export const ACTIVITY_MONTHS = 12;
const LINE_LENGTH = 74;
const SPARK = { left: 365, top: 18, width: 105, height: 30 };
const DAY_MS = 86400000;

function wrap(text, maxLines) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (candidate.length <= LINE_LENGTH) {
      lines[lines.length - 1] = candidate;
      continue;
    }
    lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[\s,.;:]+$/, "")}…`;
  return visible;
}

export function relativeTime(date, now) {
  const days = Math.floor((now - new Date(date)) / DAY_MS);
  if (days < 1) return "hoje";
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  if (days < 365) return `há ${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(days / 365)} ${Math.floor(days / 365) === 1 ? "ano" : "anos"}`;
}

function monthsBetween(date, now) {
  return (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + now.getUTCMonth() - date.getUTCMonth();
}

export function monthlyCommits(commitDates, now) {
  const months = Array(ACTIVITY_MONTHS).fill(0);
  for (const date of commitDates) {
    const monthsAgo = monthsBetween(new Date(date), now);
    if (monthsAgo >= 0 && monthsAgo < ACTIVITY_MONTHS) months[ACTIVITY_MONTHS - 1 - monthsAgo] += 1;
  }
  return months;
}

function activityBars(months, palette) {
  const maximum = Math.sqrt(Math.max(...months, 1));
  const slot = SPARK.width / ACTIVITY_MONTHS;
  const bars = months
    .map((count, index) => {
      const height = count === 0 ? 1.5 : Math.max((Math.sqrt(count) / maximum) * SPARK.height, 3);
      const fill = count === 0 ? palette.track : palette.title;
      return `<rect class="bar" style="animation-delay:${index * 50}ms" x="${(SPARK.left + index * slot).toFixed(1)}" y="${(SPARK.top + SPARK.height - height).toFixed(1)}" width="${(slot - 2.5).toFixed(1)}" height="${height.toFixed(1)}" rx="1" fill="${fill}"><title>${count} commits</title></rect>`;
    })
    .join("");
  return `${bars}
  <text x="${SPARK.left + SPARK.width}" y="${SPARK.top + SPARK.height + 14}" class="axis" text-anchor="end">commits · 12 meses</text>`;
}

function chips(tags, palette) {
  let x = 25;
  return tags
    .map((tag) => {
      const width = tag.length * 6.4 + 16;
      const chip = `<rect x="${x}" y="122" width="${width.toFixed(1)}" height="20" rx="10" fill="none" stroke="${palette.title}" stroke-opacity="0.45"/>
  <text x="${(x + width / 2).toFixed(1)}" y="136" class="chip" text-anchor="middle">${escapeXml(tag)}</text>`;
      x += width + 8;
      return chip;
    })
    .join("\n  ");
}

function footer(project, now, palette) {
  const items = [
    `<circle cx="31" cy="166" r="6" fill="${project.language.color}"/><text x="43" y="170" class="meta">${escapeXml(project.language.name)}</text>`,
    `<text x="150" y="170" class="meta">★ ${formatNumber(project.stars)}</text>`,
    `<text x="205" y="170" class="meta">${formatNumber(project.totalCommits)} commits</text>`,
    `<text x="470" y="170" class="meta" text-anchor="end">atualizado ${relativeTime(project.pushedAt, now)}</text>`,
  ];
  return `<line x1="25" y1="152" x2="470" y2="152" stroke="${palette.track}"/>\n  ${items.join("\n  ")}`;
}

function liveBadge(project, palette) {
  if (!project.homepage) return "";
  const x = 25 + project.repository.length * 5.9 + 10;
  return `<a href="${escapeXml(project.homepage)}"><rect x="${x}" y="42" width="52" height="16" rx="8" fill="${palette.title}" opacity="0.18"/>
  <circle cx="${x + 10}" cy="50" r="3.5" fill="${palette.title}" class="pulse"/>
  <text x="${x + 17}" y="54" class="live">no ar</text></a>`;
}

export function renderProjectCard({ project, now, palette }) {
  const description = wrap(project.description, 2)
    .map((line, index) => `<text x="25" y="${84 + index * 18}" class="description">${escapeXml(line)}</text>`)
    .join("\n  ");
  return renderCard({
    title: project.title,
    subtitle: project.repository,
    palette,
    height: HEIGHT,
    styles: `
    .description { font: 400 13px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.text}; }
    .chip { font: 600 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .meta { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .live { font: 700 10px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    .bar { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); animation: grow 0.4s ease-out forwards; }
    @keyframes grow { to { transform: scaleY(1); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }`,
    body: `${activityBars(project.months, palette)}
  ${liveBadge(project, palette)}
  ${description}
  ${chips(project.tags, palette)}
  ${footer(project, now, palette)}`,
  });
}
