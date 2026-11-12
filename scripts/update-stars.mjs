import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REPO = "OpenDCAI/DataMind";
const API_ROOT = "https://api.github.com";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

async function github(path) {
  const response = await fetch(`${API_ROOT}${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path}: GitHub API ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json();
}

async function allPages(path, limit = 10) {
  const records = [];
  for (let page = 1; page <= limit; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await github(`${path}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`${path}: expected an array response`);
    records.push(...batch);
    if (batch.length < 100) break;
  }
  return records;
}

function dailyHistory(weeks, throughDate) {
  const counts = new Map();
  for (const week of weeks) {
    const start = new Date(Number(week.week) * 1000);
    (week.days || []).forEach((count, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      counts.set(date.toISOString().slice(0, 10), Number(count) || 0);
    });
  }

  const firstDate = [...counts.keys()].sort()[0];
  if (!firstDate) throw new Error("GitHub Star History returned no dates");
  const daily = [];
  const end = new Date(`${throughDate}T00:00:00Z`);
  for (let cursor = new Date(`${firstDate}T00:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    daily.push({ date, count: counts.get(date) || 0 });
  }
  return daily;
}

export function preserveHistory(previous, incoming) {
  const points = new Map(incoming.map(point => [point.date, { ...point }]));
  const partialDate = previous?.fetched_at?.slice(0, 10);
  for (const point of previous?.daily || []) {
    const fresh = points.get(point.date);
    points.set(point.date, {
      date: point.date,
      count: point.date === partialDate ? Math.max(point.count, fresh?.count || 0) : point.count
    });
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildSnapshot({ previous = null, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let [repo, weeks, openItems] = await Promise.all([
    github(`/repos/${REPO}`),
    allPages(`/repos/${REPO}/stargazers/history`),
    allPages(`/repos/${REPO}/issues?state=open`)
  ]);
  let fetchedAt, daily, total;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    fetchedAt = new Date();
    daily = dailyHistory(weeks, fetchedAt.toISOString().slice(0, 10));
    total = daily.reduce((sum, point) => sum + point.count, 0);
    if (total === repo.stargazers_count || attempt === 2) break;
    await pause(5000);
    [repo, weeks] = await Promise.all([
      github(`/repos/${REPO}`),
      allPages(`/repos/${REPO}/stargazers/history`)
    ]);
  }
  if (total !== repo.stargazers_count) {
    console.warn(`Star History total ${total} differs from repository total ${repo.stargazers_count} after 3 reads; preserving both values without altering daily counts.`);
  }

  return {
    repo: REPO,
    fetched_at: fetchedAt.toISOString(),
    source: "GitHub REST API stargazers/history daily counts",
    source_url: `${API_ROOT}/repos/${REPO}/stargazers/history`,
    stars: repo.stargazers_count,
    history_total: total,
    history_difference: repo.stargazers_count - total,
    forks: repo.forks_count,
    open_issues: openItems.filter(item => !item.pull_request).length,
    scope: "历史日增保留已记录值；新日期追加，上次抓取当日仅补增；日增累计可能与当前 Star 总数不同",
    timezone: "UTC",
    daily: preserveHistory(previous, daily)
  };
}

async function main() {
const previous = JSON.parse(await readFile("data/stars.json", "utf8"));
const snapshot = await buildSnapshot({ previous });
const serialized = JSON.stringify(snapshot, null, 2);
await writeFile("data/stars.json", `${serialized}\n`);
await writeFile("data/stars.js", `window.DATAMIND_STAR_SNAPSHOT = ${serialized};\n`);

const cacheVersion = snapshot.fetched_at.replace(/\D/g, "").slice(0, 12);
const indexHtml = await readFile("index.html", "utf8");
await writeFile(
  "index.html",
  indexHtml.replace(/\.\/data\/stars\.js\?v=[^"']+/, `./data/stars.js?v=${cacheVersion}`)
);

console.log(JSON.stringify({
  fetched_at: snapshot.fetched_at,
  stars: snapshot.stars,
  forks: snapshot.forks,
  open_issues: snapshot.open_issues,
  latest: snapshot.daily.slice(-7)
}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
