import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { calendarDays, calendarStart, renderContributionHeatmap } from "./contribution-heatmap.mjs";
import { renderLanguagesCard } from "./languages-card.mjs";
import { renderProductiveTimeCard } from "./productive-time-card.mjs";
import { renderStreakCard } from "./streak-card.mjs";
import { ICONS, rankOf, renderStatsCard } from "./stats-card.mjs";

const token = process.env.STATS_TOKEN;
const login = process.env.STATS_LOGIN;
const organization = process.env.STATS_ORGANIZATION;
const outputDirectory = process.env.STATS_OUTPUT ?? "dist";
const SEARCH_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;

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

const SECONDARY_RATE_LIMIT_DELAY_MS = 90000;

function isRateLimited(response, body) {
  if (response.status === 429 || response.headers.has("retry-after")) return true;
  return response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || body.includes("secondary rate limit"));
}

function rateLimitDelay(response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (retryAfter > 0) return retryAfter * 1000;
  if (response.headers.get("x-ratelimit-remaining") !== "0") return SECONDARY_RATE_LIMIT_DELAY_MS;
  const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
  return Math.max(reset - Date.now(), 0) + 1000;
}

async function requestJson(url, options, attempt = 1) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (response.ok) return JSON.parse(body);
  const rateLimited = isRateLimited(response, body);
  const retryable = rateLimited || response.status >= 500;
  if (attempt >= MAX_ATTEMPTS || !retryable) {
    throw new Error(`GitHub request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  await wait(rateLimited ? rateLimitDelay(response) : RETRY_DELAY_MS * attempt);
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

function localHour(date) {
  return Number(new Date(date).toLocaleString("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }));
}

async function commitTimestampsIn(range) {
  const dates = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = await searchCommits(`author-date:${range}`, page, 100);
    dates.push(...payload.items.map((item) => item.commit.author.date));
    if (payload.items.length < 100) return dates;
  }
  return dates;
}

async function commitActivity(today) {
  const firstDay = calendarStart(today).toISOString().slice(0, 10);
  const dailyCounts = new Map();
  const hourlyCounts = Array(24).fill(0);
  for (const range of monthlyRanges(firstDay, today)) {
    for (const timestamp of await commitTimestampsIn(range)) {
      const date = localDate(timestamp);
      if (date < firstDay || date > today) continue;
      dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
      hourlyCounts[localHour(timestamp)] += 1;
    }
  }
  return { dailyCounts, hourlyCounts };
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
  const { dailyCounts, hourlyCounts } = await commitActivity(today);
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
  await writeFile(`${outputDirectory}/languages.svg`, renderLanguagesCard({ languages: topLanguages(languageWeights(contributions), 8), palette }));
  await writeFile(`${outputDirectory}/productive-time.svg`, renderProductiveTimeCard({ hourlyCounts, palette }));
  await writeFile(`${outputDirectory}/streak.svg`, renderStreakCard({ days: calendarDays(today), dailyCounts, palette }));
}

await main();
