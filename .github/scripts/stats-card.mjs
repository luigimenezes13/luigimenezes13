const WIDTH = 495;
const HEIGHT = 235;
const ROW_HEIGHT = 25;
const FIRST_ROW_Y = 85;
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
const LEVEL_THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];

export const ICONS = {
  star: "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z",
  commits: "M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.75.75 0 017 8.25v-3.5A.75.75 0 017.75 4z",
  pullRequests: "M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z",
  reviews: "M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z",
  issues: "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z",
  repositories: "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z",
};

function exponentialCdf(value) {
  return 1 - 2 ** -value;
}

function logNormalCdf(value) {
  return value / (1 + value);
}

/**
 * Same weighted percentile used by github-readme-stats with `include_all_commits`,
 * so the grade stays comparable with the cards other profiles show.
 * @param {{commits: number, pullRequests: number, issues: number, reviews: number, stars: number, followers: number}} activity
 * @returns {{level: string, percentile: number}} Lower percentile means a better rank.
 */
export function rankOf(activity) {
  const weighted = [
    [2, exponentialCdf(activity.commits / 1000)],
    [3, exponentialCdf(activity.pullRequests / 50)],
    [1, exponentialCdf(activity.issues / 25)],
    [1, exponentialCdf(activity.reviews / 2)],
    [4, logNormalCdf(activity.stars / 50)],
    [1, logNormalCdf(activity.followers / 10)],
  ];
  const totalWeight = weighted.reduce((sum, [weight]) => sum + weight, 0);
  const score = weighted.reduce((sum, [weight, value]) => sum + weight * value, 0) / totalWeight;
  const percentile = (1 - score) * 100;
  return { level: LEVELS[LEVEL_THRESHOLDS.findIndex((threshold) => percentile <= threshold)], percentile };
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function row(item, index) {
  const y = FIRST_ROW_Y + index * ROW_HEIGHT;
  return `<g class="stagger" style="animation-delay:${450 + index * 150}ms" transform="translate(25, ${y - 13})">
    <svg class="icon" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="${item.icon}"/></svg>
    <text class="stat bold" x="25" y="12.5">${escapeXml(item.label)}:</text>
    <text class="stat bold value" x="215" y="12.5">${escapeXml(new Intl.NumberFormat("pt-BR").format(item.value))}</text>
  </g>`;
}

function rankRing(rank) {
  return `<g transform="translate(400, ${FIRST_ROW_Y + 2.5 * ROW_HEIGHT - 5})">
    <circle class="rank-circle-rim" r="${RING_RADIUS}"/>
    <circle class="rank-circle" r="${RING_RADIUS}"/>
    <text class="rank-text" text-anchor="middle" dominant-baseline="central">${rank.level}</text>
    <text class="rank-caption" y="${RING_RADIUS + 20}" text-anchor="middle">top ${Math.max(Math.round(rank.percentile), 1)}%</text>
  </g>`;
}

export function renderStatsCard({ title, subtitle, items, rank, palette }) {
  const finalOffset = (RING_CIRCUMFERENCE * (rank.percentile / 100)).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; animation: fadeIn 0.8s ease-in-out forwards; }
    .subtitle { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .stat { font: 600 14px 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif; fill: ${palette.text}; }
    .value { fill: ${palette.title}; }
    .icon { fill: ${palette.icon}; }
    .stagger { opacity: 0; animation: fadeIn 0.3s ease-in-out forwards; }
    .rank-text { transform-box: fill-box; transform-origin: center; font: 800 26px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.text}; animation: scaleIn 0.3s ease-in-out forwards; }
    .rank-caption { font: 600 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .rank-circle-rim { stroke: ${palette.icon}; fill: none; stroke-width: 6; opacity: 0.2; }
    .rank-circle { stroke: ${palette.icon}; fill: none; stroke-width: 6; stroke-linecap: round; opacity: 0.85;
      stroke-dasharray: ${RING_CIRCUMFERENCE.toFixed(2)}; stroke-dashoffset: ${finalOffset};
      transform: rotate(-90deg); animation: rankAnimation 1s ease-in-out; }
    @keyframes rankAnimation { from { stroke-dashoffset: ${RING_CIRCUMFERENCE.toFixed(2)}; } to { stroke-dashoffset: ${finalOffset}; } }
    @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="12" fill="${palette.background}"/>
  <text x="25" y="35" class="title">${escapeXml(title)}</text>
  <text x="25" y="53" class="subtitle">${escapeXml(subtitle)}</text>
  ${items.map(row).join("\n  ")}
  ${rankRing(rank)}
</svg>`;
}
