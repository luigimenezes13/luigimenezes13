import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { calendarStart, renderContributionHeatmap } from "./contribution-heatmap.mjs";
import { ICONS, rankOf, renderStatsCard } from "./stats-card.mjs";

const token = process.env.STATS_TOKEN;
const login = process.env.STATS_LOGIN;
const organization = process.env.STATS_ORGANIZATION;
const outputDirectory = process.env.STATS_OUTPUT ?? "dist";
const SEARCH_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;
const CARD_HEIGHT = 235;

const palette = {
  background: "#161b22",
  title: "#ff4d5a",
  icon: "#ff4d5a",
  text: "#c9d1d9",
  muted: "#8b949e",
  track: "#30363d",
  empty: "#21262d",
  levels: ["#4c0d12", "#8b1a24", "#d7263d", "#ff6b6b"],
};

const TIME_ZONE = "America/Sao_Paulo";

const REPOSITORY_FIELDS = `
  nameWithOwner
  isFork
  languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
    edges { size node { name color } }
  }`;

const ACCOUNT_QUERY = `
query ($login: String!) {
  user(login: $login) {
    name
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER) { nodes { stargazerCount ${REPOSITORY_FIELDS} } }
    repositoriesContributedTo(first: 100, includeUserRepositories: true, contributionTypes: [COMMIT, PULL_REQUEST]) {
      nodes { ${REPOSITORY_FIELDS} }
    }
  }
}`;

const PULL_REQUEST_REPOSITORIES_QUERY = `
query ($query: String!, $cursor: String) {
  search(type: ISSUE, query: $query, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { repository { ${REPOSITORY_FIELDS} } } }
  }
}`;

const ISSUE_COUNT_QUERY = `query ($query: String!) { search(type: ISSUE, query: $query, first: 0) { issueCount } }`;

function isRateLimited(response) {
  return response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") || response.headers.has("retry-after");
}

function rateLimitDelay(response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (retryAfter > 0) return retryAfter * 1000;
  const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
  return Math.max(reset - Date.now(), 0) + 1000;
}

async function requestJson(url, options, attempt = 1) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (response.ok) return JSON.parse(body);
  const retryable = isRateLimited(response) || response.status >= 500;
  if (attempt >= MAX_ATTEMPTS || !retryable) {
    throw new Error(`GitHub request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  await wait(isRateLimited(response) ? rateLimitDelay(response) : RETRY_DELAY_MS * attempt);
  return requestJson(url, options, attempt + 1);
}

async function queryGitHub(query, variables) {
  const payload = await requestJson("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (payload.errors) {
    throw new Error(`GitHub GraphQL failed: ${JSON.stringify(payload.errors)}`);
  }
  return payload.data;
}

async function searchCommits(qualifiers, page = 1, perPage = 1) {
  await wait(SEARCH_INTERVAL_MS);
  const query = encodeURIComponent(`author:${login} ${qualifiers}`.trim());
  return requestJson(`https://api.github.com/search/commits?q=${query}&per_page=${perPage}&page=${page}`, {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json" },
  });
}

async function commitCount(qualifiers) {
  const payload = await searchCommits(qualifiers);
  return payload.total_count;
}

function localDate(date) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function monthlyRanges(firstDay, today) {
  const ranges = [];
  const cursor = new Date(`${firstDay.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= today) {
    const start = cursor.toISOString().slice(0, 10);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    const end = new Date(cursor.getTime() - 86400000).toISOString().slice(0, 10);
    ranges.push(`${start}..${end}`);
  }
  return ranges;
}

async function commitDatesIn(range) {
  const dates = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = await searchCommits(`author-date:${range}`, page, 100);
    dates.push(...payload.items.map((item) => localDate(item.commit.author.date)));
    if (payload.items.length < 100) return dates;
  }
  return dates;
}

async function dailyCommitCounts(today) {
  const firstDay = calendarStart(today).toISOString().slice(0, 10);
  const counts = new Map();
  for (const range of monthlyRanges(firstDay, today)) {
    for (const date of await commitDatesIn(range)) {
      if (date >= firstDay && date <= today) counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }
  return counts;
}

async function pullRequestCount(qualifiers) {
  const data = await queryGitHub(ISSUE_COUNT_QUERY, { query: `is:pr ${qualifiers}` });
  return data.search.issueCount;
}

async function issueCount(qualifiers) {
  const data = await queryGitHub(ISSUE_COUNT_QUERY, { query: `is:issue ${qualifiers}` });
  return data.search.issueCount;
}

async function pullRequestRepositories() {
  const repositories = [];
  let cursor = null;
  do {
    const data = await queryGitHub(PULL_REQUEST_REPOSITORIES_QUERY, { query: `is:pr author:${login}`, cursor });
    repositories.push(...data.search.nodes.map((node) => node.repository));
    cursor = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
  } while (cursor);
  return repositories;
}

function distinctRepositories(repositories) {
  const byName = new Map(repositories.filter((repository) => !repository.isFork).map((repository) => [repository.nameWithOwner, repository]));
  return [...byName.values()];
}

async function repositoriesWithCommits(repositories) {
  const contributed = [];
  for (const repository of repositories) {
    const commits = await commitCount(`repo:${repository.nameWithOwner}`);
    if (commits > 0) contributed.push({ repository, commits });
  }
  return contributed;
}

function languageWeights(contributions) {
  const weights = new Map();
  for (const contribution of contributions) {
    addRepositoryLanguages(weights, contribution);
  }
  return weights;
}

function addRepositoryLanguages(weights, { repository, commits }) {
  const edges = repository.languages.edges;
  const repositorySize = edges.reduce((total, edge) => total + edge.size, 0);
  if (repositorySize === 0) return;
  for (const edge of edges) {
    const current = weights.get(edge.node.name) ?? { color: edge.node.color ?? palette.muted, weight: 0 };
    current.weight += (edge.size / repositorySize) * commits;
    weights.set(edge.node.name, current);
  }
}

function topLanguages(weights, limit) {
  const total = [...weights.values()].reduce((sum, language) => sum + language.weight, 0);
  return [...weights.entries()]
    .map(([name, language]) => ({ name, color: language.color, share: language.weight / total }))
    .sort((left, right) => right.share - left.share)
    .slice(0, limit);
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function cardFrame(title, subtitle, body) {
  const height = CARD_HEIGHT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="${height}" viewBox="0 0 495 ${height}" role="img" aria-label="${escapeXml(title)}">
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .subtitle { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .label { font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.text}; }
    .value { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .language { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.text}; }
  </style>
  <rect width="495" height="${height}" rx="12" fill="${palette.background}"/>
  <text x="25" y="35" class="title">${escapeXml(title)}</text>
  <text x="25" y="53" class="subtitle">${escapeXml(subtitle)}</text>
  ${body}
</svg>`;
}

function languagesCard(languages) {
  const legend = languages.map((language, index) => languageLegend(language, index)).join("\n  ");
  return cardFrame("Linguagens mais usadas", "Ponderado pelos seus commits em cada repositório", `${progressBar(languages)}\n  ${legend}`);
}

function progressBar(languages) {
  let offset = 25;
  const segments = languages.map((language) => {
    const width = Math.max(language.share * 445, 1);
    const segment = `<rect x="${offset.toFixed(2)}" y="70" width="${width.toFixed(2)}" height="8" fill="${language.color}"/>`;
    offset += width;
    return segment;
  });
  return `<clipPath id="bar"><rect x="25" y="70" width="445" height="8" rx="4"/></clipPath>
  <rect x="25" y="70" width="445" height="8" rx="4" fill="${palette.track}"/>
  <g clip-path="url(#bar)">${segments.join("")}</g>`;
}

function languageLegend(language, index) {
  const x = 25 + (index % 2) * 230;
  const y = 112 + Math.floor(index / 2) * 32;
  const percent = (language.share * 100).toFixed(2);
  return `<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${language.color}"/>
  <text x="${x + 16}" y="${y}" class="language">${escapeXml(language.name)} ${percent}%</text>`;
}

async function main() {
  if (!token || !login || !organization) {
    throw new Error("STATS_TOKEN, STATS_LOGIN and STATS_ORGANIZATION must be set");
  }
  const now = new Date();
  const { user } = await queryGitHub(ACCOUNT_QUERY, { login });
  const repositories = distinctRepositories([
    ...user.repositories.nodes,
    ...user.repositoriesContributedTo.nodes,
    ...(await pullRequestRepositories()),
  ]);
  const contributions = await repositoriesWithCommits(repositories);
  const activity = {
    commits: await commitCount(""),
    organizationCommits: await commitCount(`org:${organization}`),
    pullRequests: await pullRequestCount(`author:${login}`),
    reviews: await pullRequestCount(`reviewed-by:${login} -author:${login}`),
    issues: await issueCount(`author:${login}`),
    stars: user.repositories.nodes.reduce((sum, repository) => sum + repository.stargazerCount, 0),
    followers: user.followers.totalCount,
  };
  const items = [
    { icon: ICONS.commits, label: "Commits (total)", value: activity.commits },
    { icon: ICONS.commits, label: "Commits na V4", value: activity.organizationCommits },
    { icon: ICONS.pullRequests, label: "Pull requests", value: activity.pullRequests },
    { icon: ICONS.reviews, label: "Code reviews", value: activity.reviews },
    { icon: ICONS.issues, label: "Issues", value: activity.issues },
    { icon: ICONS.repositories, label: "Contribuiu em", value: contributions.length },
  ];
  const generatedAt = now.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
  const today = localDate(now);
  const dailyCounts = await dailyCommitCounts(today);
  const total = [...dailyCounts.values()].reduce((sum, count) => sum + count, 0);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    `${outputDirectory}/stats.svg`,
    renderStatsCard({
      title: `${user.name ?? login} · GitHub Stats`,
      subtitle: `Inclui repositórios privados e da V4 Company · atualizado em ${generatedAt}`,
      items,
      rank: rankOf(activity),
      palette,
    }),
  );
  await writeFile(
    `${outputDirectory}/contributions.svg`,
    renderContributionHeatmap({ dailyCounts, today, total, palette, subtitle: `Inclui repositórios privados e da V4 Company · atualizado em ${generatedAt}` }),
  );
  await writeFile(`${outputDirectory}/languages.svg`, languagesCard(topLanguages(languageWeights(contributions), 8)));
}

await main();
