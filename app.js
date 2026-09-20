const REPO = "OpenDCAI/DataMind";
const API_ROOT = "https://api.github.com";
const BADGE_ROOT = "https://img.shields.io/github";
const STAR_SNAPSHOT_URL = "./data/stars.json";
const state = {
  repo: null,
  stargazers: [],
  regionSnapshot: window.DATAMIND_REGIONS_SNAPSHOT || null,
  networkSnapshot: window.DATAMIND_NETWORK_SNAPSHOT || null,
  starSnapshot: null,
  starHistory: [],
  commits: [],
  releases: [],
  contributors: [],
  trend: [],
  releaseBadge: null,
  activeRange: "30",
  calendarDate: new Date()
};

// Operations actions are user-provided only; never infer or import them from GitHub activity.
const promotionActions = [
  {
    date: "2026-09-16",
    project: "datamind-oss",
    platform: "Reddit",
    community: "r/AgentsOfAI",
    url: "https://www.reddit.com/r/AgentsOfAI/comments/1whpppc/agents_need_a_data_workspace_not_just_a_context/"
  },
  {
    date: "2026-09-16",
    project: "datamind-oss",
    platform: "Reddit",
    community: "r/aiagents",
    url: "https://www.reddit.com/r/aiagents/comments/1whr8o0/i_built_a_data_workspace_for_agents_do_agents/"
  },
  {
    date: "2026-09-16",
    project: "datamind-oss",
    platform: "LinkedIn",
    community: "群组 43875",
    url: "http://linkedin.com/groups/43875/"
  },
  {
    date: "2026-09-16",
    project: "datamind-codex插件",
    platform: "Reddit",
    community: "r/codex",
    url: "https://www.reddit.com/r/codex/comments/1whsg38/i_built_a_codex_plugin_for_storing_and_retrieving/"
  },
  {
    date: "2026-09-14",
    project: "datamind-workspace",
    platform: "Reddit",
    community: "r/ContextEngineering",
    url: "https://www.reddit.com/r/ContextEngineering/comments/1wfrje8/agent_workspaces_are_a_realtime_data_problem/"
  },
  {
    date: "2026-09-14",
    project: "datamind-工作空间",
    platform: "小红书",
    community: "",
    url: "https://www.xiaohongshu.com/explore/6aa770890000000025036b91?xsec_token=ABJyaheSp0xnh2lzvBbt-518ggKzFw6Ffy3GKtmmLlYQQ=&xsec_source=pc_user"
  }
];

const trafficSnapshot = {
  startDate: "2026-08-31",
  period: "08/31–09/13",
  days: ["08/31", "09/01", "09/02", "09/03", "09/04", "09/05", "09/06", "09/07", "09/08", "09/09", "09/10", "09/11", "09/12", "09/13"],
  metrics: [
    { key: "clones", title: "Clones", total: "317", values: [3, 9, 3, 3, 43, 20, 5, 4, 4, 3, 8, 44, 36, 132] },
    { key: "unique-cloners", title: "Unique cloners", total: "136", values: [3, 4, 3, 3, 16, 10, 2, 2, 3, 2, 5, 17, 13, 63] },
    { key: "views", title: "Views", total: "247", values: [11, 7, 13, 8, 28, 4, 2, 7, 16, 8, 14, 64, 36, 29] },
    { key: "unique-visitors", title: "Unique visitors", total: "67", values: [5, 5, 8, 4, 13, 3, 2, 5, 7, 6, 4, 18, 4, 7] }
  ],
  referringSites: [
    ["github.com", 81, 23],
    ["Google", 15, 4],
    ["zwt233.github.io", 7, 6]
  ],
  popularContent: [
    ["Overview", 116, 55],
    ["/tree/main", 35, 8],
    ["/blob/main/README_zh.md", 18, 12],
    ["/tree/codex/migrate-codex-plugin", 9, 3],
    ["/compare/main...jjk9090:DataMind", 6, 1],
    ["/issues", 5, 3],
    ["/blob/main/LICENSE", 4, 4],
    ["/pull/3", 4, 1],
    ["/actions/workflows/python-ci.yml", 3, 3],
    ["/blob/main/assets/inference-time", 3, 3]
  ]
};

let toastTimer;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    : { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(message, isError = false) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setDataStatus(message, isError = false) {
  const node = document.querySelector("#dataStatus");
  node.textContent = message;
  node.closest(".snapshot-status").classList.toggle("status-error", isError);
}

async function githubFetch(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers
    }
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error("GitHub API rate limit reached");
    if (response.status === 404) throw new Error("GitHub resource not found");
    throw new Error(`GitHub API error ${response.status}`);
  }
  return response.json();
}

async function badgeValue(path) {
  const response = await fetch(`${BADGE_ROOT}/${path}.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Badge request failed: ${response.status}`);
  const payload = await response.json();
  return payload.value;
}

async function loadBaseData() {
  setDataStatus("读取 GitHub 公开数据…");
  const badges = await Promise.allSettled([
    badgeValue(`stars/${REPO}`),
    badgeValue(`forks/${REPO}`),
    badgeValue(`issues/${REPO}`),
    badgeValue(`v/release/${REPO}`)
  ]);
  const badgeValues = badges.map(result => result.status === "fulfilled" ? result.value : null);
  renderBadgeFallbacks(badgeValues);
  state.releaseBadge = badgeValues[3];

  const repoResult = await Promise.allSettled([
    githubFetch(`/repos/${REPO}`),
    loadStarHistory(),
    loadStarSnapshot(),
    githubFetch(`/repos/${REPO}/commits?per_page=100`),
    githubFetch(`/repos/${REPO}/releases?per_page=30`),
    githubFetch(`/repos/${REPO}/contributors?per_page=100`),
    githubFetch(`/repos/${REPO}/tags?per_page=10`)
  ]);
  const [repoResultItem, historyResult, snapshotResult, commitsResult, releasesResult, contributorsResult, tagsResult] = repoResult;
  state.repo = repoResultItem.status === "fulfilled" ? { ...repoResultItem.value, tags: tagsResult.status === "fulfilled" ? tagsResult.value : [] } : null;
  state.starHistory = historyResult.status === "fulfilled" ? historyResult.value : [];
  state.starSnapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
  state.stargazers = [];
  state.commits = commitsResult.status === "fulfilled" ? commitsResult.value : [];
  state.releases = releasesResult.status === "fulfilled" ? releasesResult.value : [];
  state.contributors = contributorsResult.status === "fulfilled" ? contributorsResult.value : [];
  state.trend = state.starSnapshot?.daily?.length
    ? buildSnapshotTrend(state.starSnapshot)
    : buildHistoryTrend(state.starHistory);
  renderBase();
  const updatedAt = state.starSnapshot?.fetched_at;
  setDataStatus(updatedAt ? `最后更新：${formatDate(updatedAt, true)}` : "快照更新时间不可用", !updatedAt);
}

async function loadStarSnapshot() {
  if (window.location.protocol === "file:" && window.DATAMIND_STAR_SNAPSHOT) {
    return window.DATAMIND_STAR_SNAPSHOT;
  }
  try {
    const response = await fetch(`${STAR_SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Star snapshot request failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    if (window.DATAMIND_STAR_SNAPSHOT) return window.DATAMIND_STAR_SNAPSHOT;
    throw error;
  }
}

async function loadStarHistory() {
  const history = [];
  for (let page = 1; page <= 4; page += 1) {
    const batch = await githubFetch(`/repos/${REPO}/stargazers/history?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || !batch.length) break;
    history.push(...batch);
    if (batch.length < 100) break;
  }
  return history;
}

function buildSnapshotTrend(snapshot) {
  let cumulative = 0;
  return snapshot.daily
    .map(point => ({ date: point.date, label: point.date.slice(5), daily: Number(point.count) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(point => {
      cumulative += point.daily;
      return { ...point, cumulative };
    });
}

function renderBadgeFallbacks([stars, forks, issues, release]) {
  if (stars) document.querySelector("#metricStars").textContent = stars;
  if (forks) document.querySelector("#metricForks").textContent = forks;
  if (issues) document.querySelector("#metricIssues").textContent = issues;
  if (release) document.querySelector("#metricRelease").textContent = release;
  document.querySelector("#metricStarsNote").textContent = stars ? "Shields.io → GitHub 公开数据" : "等待 GitHub 数据";
  document.querySelector("#metricForksNote").textContent = forks ? "Shields.io → GitHub 公开数据" : "等待 GitHub 数据";
  document.querySelector("#metricIssuesNote").textContent = issues ? "Shields.io → GitHub 公开数据" : "等待 GitHub 数据";
  document.querySelector("#metricReleaseNote").textContent = release ? "Shields.io → GitHub 公开数据" : "等待 GitHub 数据";
}

function buildHistoryTrend(history) {
  if (!history.length) return [];
  const weeks = [...history].sort((a, b) => Number(a.week) - Number(b.week));
  const daily = [];
  weeks.forEach(week => {
    const start = new Date(Number(week.week) * 1000);
    const values = Array.isArray(week.days) ? week.days : [];
    values.forEach((count, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      daily.push({ date: isoDate(date), label: isoDate(date).slice(5), daily: Number(count) || 0 });
    });
  });
  const byDate = new Map();
  daily.forEach(point => byDate.set(point.date, point));
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const offset = state.repo && Number.isFinite(state.repo.stargazers_count)
    ? state.repo.stargazers_count - points.reduce((sum, point) => sum + point.daily, 0)
    : 0;
  let cumulative = Math.max(0, offset);
  return points.map(point => {
    cumulative += point.daily;
    return { ...point, cumulative };
  });
}

function renderBase() {
  const repo = state.repo;
  const latestRelease = state.releases[0];
  const latestTag = repo?.tags?.[0]?.name;
  const latestCommit = state.commits[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const newStars = state.trend
    .filter(point => new Date(`${point.date}T00:00:00`) >= thirtyDaysAgo)
    .reduce((sum, point) => sum + point.daily, 0);

  if (state.starSnapshot) {
    document.querySelector("#metricStars").textContent = formatNumber(state.starSnapshot.stars);
    document.querySelector("#metricForks").textContent = formatNumber(state.starSnapshot.forks);
    document.querySelector("#metricIssues").textContent = formatNumber(state.starSnapshot.open_issues);
    document.querySelector("#metricStarsNote").textContent = `精确快照 · ${formatDate(state.starSnapshot.fetched_at, true)}`;
    document.querySelector("#metricForksNote").textContent = `精确快照 · ${formatDate(state.starSnapshot.fetched_at, true)}`;
    document.querySelector("#metricIssuesNote").textContent = `仅 Issues · ${formatDate(state.starSnapshot.fetched_at, true)}`;
  } else if (repo) {
    document.querySelector("#metricStars").textContent = formatNumber(repo.stargazers_count);
    document.querySelector("#metricForks").textContent = formatNumber(repo.forks_count);
    document.querySelector("#metricIssues").textContent = formatNumber(repo.open_issues_count);
    document.querySelector("#metricStarsNote").textContent = "GitHub API 实时数据";
    document.querySelector("#metricForksNote").textContent = "GitHub API 实时数据";
    document.querySelector("#metricIssuesNote").textContent = "含 Pull Requests";
  }
  document.querySelector("#metricNewStars").textContent = state.trend.length ? formatNumber(newStars) : "—";
  document.querySelector("#metricNewStarsNote").textContent = state.trend.length
    ? `最近 30 个日历日 · ${state.starSnapshot ? "Star 日统计快照" : "Star History"}`
    : "Star 时间序列受 GitHub API 限制";
  if (latestRelease?.tag_name || latestTag) {
    document.querySelector("#metricRelease").textContent = latestRelease?.tag_name || latestTag;
  } else if (!state.releaseBadge) {
    document.querySelector("#metricRelease").textContent = "—";
  }
  document.querySelector("#metricReleaseNote").textContent = latestRelease
    ? `发布于 ${formatDate(latestRelease.published_at || latestRelease.created_at)}`
    : latestCommit ? `最新提交 ${formatDate(latestCommit.commit?.author?.date || latestCommit.commit?.committer?.date)}` : state.releaseBadge ? "Shields.io → GitHub 公开数据" : "暂无公开 release / tag";
  document.querySelector("#releaseStatus").textContent = latestRelease ? "GitHub 公开 release" : latestTag ? "GitHub 公开 tag" : "暂无公开 release / tag";
  document.querySelector("#trendSummary").textContent = state.trend.length
    ? state.starSnapshot
      ? `已加载 ${state.trend.length} 个日历日 · 快照截至 ${formatDate(state.starSnapshot.fetched_at, true)}`
      : `已加载 ${state.starHistory.length} 个 GitHub Star History 周记录`
    : "Star 时间序列受 GitHub API 限制";
  renderTrendChart();
  renderCalendar();
  renderTrafficDetails();
  if (state.regionSnapshot?.records?.length) renderRegions(state.regionSnapshot.records);
  else renderRegionsEmpty();
  if (state.networkSnapshot) renderNetwork(state.networkSnapshot);
  else renderNetworkEmpty();
}

function renderTrafficSnapshot() {
  const colors = ["#2a9d78", "#8b5cf6", "#3b73e8", "#e99028"];
  const metrics = trafficSnapshot.metrics.map((metric, index) => ({ ...metric, color: colors[index] }));
  document.querySelector("#trafficDailyCharts").innerHTML = `
    <article class="traffic-chart-card">
      <div class="traffic-combined-legend" aria-label="指标与 14 日汇总">${metrics.map(metric => `
        <span class="traffic-series-key" style="--series-color: ${metric.color}"><i aria-hidden="true"></i><span>${escapeHtml(metric.title)}</span><strong>${escapeHtml(metric.total)}</strong></span>`).join("")}</div>
      <div class="traffic-chart-canvas" id="traffic-combined"></div>
    </article>`;
  renderTrafficLineChart(document.querySelector("#traffic-combined"), metrics);
  renderTrafficDetails();
  const renderTable = (title, headers, rows) => `
    <div class="traffic-table-card">
      <div class="subsection-heading"><h3>${title}</h3><span>last 14 days</span></div>
      <div class="table-scroll"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => `<td class="${index === 0 ? "traffic-name" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    </div>`;
  document.querySelector("#trafficTables").innerHTML = [
    renderTable("Referring sites", ["Site", "Views", "Unique Visitors"], trafficSnapshot.referringSites),
    renderTable("Popular content", ["Content", "Views", "Unique Visitors"], trafficSnapshot.popularContent)
  ].join("");
}

function renderTrafficDetails() {
  const metrics = new Map(trafficSnapshot.metrics.map(metric => [metric.key, metric.values]));
  const starsByDate = new Map(state.trend.map(point => [point.date, point.daily]));
  const start = new Date(`${trafficSnapshot.startDate}T00:00:00Z`);
  const rows = trafficSnapshot.days.map((_, index) => {
    const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    const visitors = metrics.get("unique-visitors")[index];
    const stars = starsByDate.get(date);
    const ratio = Number.isFinite(stars) && visitors > 0 ? `${(stars / visitors * 100).toFixed(1)}%` : "—";
    const values = [date, ratio, formatNumber(visitors), formatNumber(stars), formatNumber(metrics.get("views")[index]), formatNumber(metrics.get("clones")[index]), formatNumber(metrics.get("unique-cloners")[index])];
    return `<tr>${values.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
  }).reverse();
  document.querySelector("#trafficDailyTableBody").innerHTML = rows.join("");
}

function renderTrafficLineChart(target, metrics) {
  const width = 1160;
  const height = 330;
  const left = 46;
  const right = 24;
  const top = 20;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(5, Math.ceil(Math.max(...metrics.flatMap(metric => metric.values)) / 25) * 25);
  const step = plotWidth / Math.max(1, trafficSnapshot.days.length - 1);
  const x = index => left + step * index;
  const y = value => top + plotHeight - (value / maxValue) * plotHeight;
  const grid = [0, 0.2, 0.4, 0.6, 0.8, 1].map(ratio => {
    const lineY = top + plotHeight - plotHeight * ratio;
    return `<line class="traffic-grid-line" x1="${left}" x2="${width - right}" y1="${lineY}" y2="${lineY}"></line><text class="traffic-axis-label" x="${left - 8}" y="${lineY + 3}" text-anchor="end">${Math.round(maxValue * ratio)}</text>`;
  }).join("");
  const series = metrics.map(metric => {
    const line = metric.values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const points = metric.values.map((value, index) => `<circle class="traffic-point-mark" cx="${x(index)}" cy="${y(value)}" r="3.5"></circle>`).join("");
    return `<g style="color: ${metric.color}" data-series="${metric.key}"><polyline class="traffic-line-mark" points="${line}"><title>${escapeHtml(metric.title)}</title></polyline>${points}</g>`;
  }).join("");
  const labels = trafficSnapshot.days.map((day, index) => `<text class="traffic-axis-label" x="${x(index)}" y="${height - 12}" text-anchor="middle">${day}</text>`).join("");
  const hitAreas = trafficSnapshot.days.map((day, index) => {
    const start = Math.max(left - 8, x(index) - step / 2);
    const end = Math.min(width - right + 8, x(index) + step / 2);
    const summary = `${day}，${metrics.map(metric => `${metric.title}: ${metric.values[index]}`).join('，')}`;
    return `<rect class="traffic-date-hit" data-traffic-index="${index}" x="${start}" y="${top - 8}" width="${end - start}" height="${plotHeight + 16}" tabindex="0" aria-label="${escapeHtml(summary)}"></rect>`;
  }).join("");
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="Clones、Unique cloners、Views、Unique visitors 最近 14 天趋势，共用数值刻度">${grid}${series}${labels}<line class="traffic-hover-guide" y1="${top}" y2="${top + plotHeight}" visibility="hidden"></line>${hitAreas}</svg><div class="traffic-tooltip" role="tooltip" hidden></div>`;
  const tooltip = target.querySelector(".traffic-tooltip");
  const guide = target.querySelector(".traffic-hover-guide");
  const hideTooltip = () => {
    tooltip.hidden = true;
    guide.setAttribute("visibility", "hidden");
  };
  const showTooltip = (index, event) => {
    tooltip.innerHTML = `<strong>${trafficSnapshot.days[index]}</strong>${metrics.map(metric => `<div class="traffic-tooltip-row"><i style="background: ${metric.color}"></i><span>${escapeHtml(metric.title)}</span><b>${formatNumber(metric.values[index])}</b></div>`).join("")}`;
    tooltip.hidden = false;
    guide.setAttribute("x1", x(index));
    guide.setAttribute("x2", x(index));
    guide.setAttribute("visibility", "visible");
    const bounds = target.getBoundingClientRect();
    const hit = event.currentTarget.getBoundingClientRect();
    const pointerX = Number.isFinite(event.clientX) ? event.clientX : hit.left + hit.width / 2;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : bounds.top + 20;
    let tooltipX = pointerX - bounds.left + 14;
    if (tooltipX + tooltip.offsetWidth > target.clientWidth - 8) tooltipX = pointerX - bounds.left - tooltip.offsetWidth - 14;
    tooltip.style.left = `${target.scrollLeft + Math.max(8, Math.min(tooltipX, target.clientWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${target.scrollTop + Math.max(8, Math.min(pointerY - bounds.top + 14, target.clientHeight - tooltip.offsetHeight - 8))}px`;
  };
  target.querySelectorAll(".traffic-date-hit").forEach(node => {
    const index = Number(node.dataset.trafficIndex);
    node.addEventListener("pointerenter", event => showTooltip(index, event));
    node.addEventListener("pointermove", event => showTooltip(index, event));
    node.addEventListener("pointerleave", hideTooltip);
    node.addEventListener("focus", event => showTooltip(index, event));
    node.addEventListener("blur", hideTooltip);
    node.addEventListener("keydown", event => { if (event.key === "Escape") hideTooltip(); });
  });
  target.onscroll = hideTooltip;
}

function getTrendWindow(range) {
  if (!state.trend.length) return [];
  if (range === "all") return state.trend;
  return state.trend.slice(-(range === "90" ? 90 : 30));
}

function renderTrendChart() {
  const target = document.querySelector("#trendChart");
  const data = getTrendWindow(state.activeRange);
  if (!data.length) {
    target.innerHTML = `<div class="empty-state"><strong>暂无每日新增数据</strong><span>请稍后刷新，重新读取 GitHub Star 日统计。</span></div>`;
    document.querySelector("#trendPeak").textContent = "—";
    return;
  }
  const width = 1160;
  const height = 231;
  const left = 46;
  const right = 22;
  const top = 18;
  const plotWidth = width - left - right;
  const plotHeight = height - top - 42;
  const maxDaily = Math.max(1, Math.max(...data.map(point => point.daily)) * 1.25);
  const step = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(3, Math.min(18, step * 0.5));
  const x = index => left + step * index + step / 2;
  const yDaily = value => top + plotHeight - (value / maxDaily) * plotHeight;
  const peak = data.reduce((best, point) => point.daily > best.daily ? point : best, data[0]);
  document.querySelector("#trendPeak").textContent = `峰值日：${peak.label} · ${peak.daily} Star`;
  const gridMarkup = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = top + plotHeight - ratio * plotHeight;
    return `<line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line><text class="chart-axis-label" x="${left - 10}" y="${y + 3}" text-anchor="end">${Math.round(maxDaily * ratio)}</text>`;
  }).join("");
  const bars = data.map((point, index) => {
    const y = yDaily(point.daily);
    const weekday = new Date(`${point.date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    return `<rect class="chart-bar${weekend ? " chart-bar-weekend" : ""}" x="${x(index) - barWidth / 2}" y="${y}" width="${barWidth}" height="${top + plotHeight - y}" data-index="${index}"><title>${point.date} · ${point.daily} 新增 Star</title></rect>`;
  }).join("");
  const labels = data.map((point, index) => {
    const every = data.length > 45 ? 7 : data.length > 20 ? 3 : 1;
    if (index % every !== 0 && index !== data.length - 1) return "";
    return `<text class="chart-axis-label" x="${x(index)}" y="${height - 15}" text-anchor="middle">${point.label}</text>`;
  }).join("");
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="DataMind GitHub Star 真实时间趋势">
    ${gridMarkup}
    <text class="chart-axis-label" x="${left}" y="${top - 5}">Daily new stars</text>
    ${bars}
    ${getActionsForChart(data, top + plotHeight)}
    ${labels}
  </svg><div class="chart-tooltip" id="trendTooltip"></div>`;
  target.querySelectorAll(".chart-bar").forEach(node => {
    node.addEventListener("mouseenter", event => {
      const point = data[Number(event.currentTarget.dataset.index)];
      const tooltip = target.querySelector("#trendTooltip");
      const bar = event.currentTarget.getBoundingClientRect();
      const wrap = target.getBoundingClientRect();
      tooltip.innerHTML = `<strong>${point.date}</strong><span>新增 Star：${point.daily}</span><span>累计 Star：${point.cumulative}</span>`;
      tooltip.style.left = `${bar.left - wrap.left + bar.width / 2}px`;
      tooltip.style.top = `${bar.top - wrap.top + 5}px`;
      tooltip.classList.add("is-visible");
    });
    node.addEventListener("mouseleave", () => target.querySelector("#trendTooltip").classList.remove("is-visible"));
  });
}

function getActionsForChart(data, baseline = 189) {
  const byDate = new Map();
  promotionActions.forEach(action => {
    const label = `${action.platform}${action.community ? ` · ${action.community}` : ""} · ${action.project}`;
    byDate.set(action.date, [byDate.get(action.date), label].filter(Boolean).join("\n"));
  });
  return data.map((point, index) => {
    if (!byDate.has(point.date)) return "";
    const step = (1160 - 46 - 22) / Math.max(1, data.length);
    const x = 46 + step * index + step / 2;
    return `<g><line x1="${x}" x2="${x}" y1="43" y2="${baseline}" stroke="#df6a5b" stroke-dasharray="3 4" opacity="0.3"></line><circle class="action-marker" cx="${x}" cy="35" r="5"><title>${escapeHtml(byDate.get(point.date))}</title></circle></g>`;
  }).join("");
}

function renderRegionsEmpty(message = "尚未读取公开 profile location") {
  document.querySelector("#regionGrid").innerHTML = `<div class="empty-state region-empty"><strong>${escapeHtml(message)}</strong><span>地区数据来自 stargazer 的公开 GitHub profile，不使用估算值。</span></div>`;
}

const reviewedLocations = {
  "beijing": "china",
  "hong kong sar": "china",
  "china": "china",
  "shanghai": "china",
  "fengxian district, shanghai, china": "china",
  "san diego": "overseas",
  "shenzhen": "china",
  "beijing, china": "china",
  "beijing/china": "china",
  "sioux falls, sd": "overseas",
  "korea": "overseas",
  "shenzhen, guangdong, china": "china",
  "семей‎": "overseas",
  "seoul": "overseas",
  "hong kong": "china",
  "nanjing": "china",
  "chicago, il": "overseas",
  "india": "overseas",
  "nanchang": "china",
  "clifton park, ny": "overseas",
  "birmingham, al": "overseas",
  "tokyo, japan": "overseas",
  "singapore": "overseas",
  "oslo, norway": "overseas",
  "japan": "overseas",
  "cambridge, ma": "overseas",
  "new territories": "china",
  "peking": "china",
  "pune, maharashtra, india": "overseas",
  "shandong": "china",
  "tokyo": "overseas",
  "philadelphia, pa": "overseas",
  "pittsburgh, pennsylvania": "overseas",
  "sapporo": "overseas",
  "puchong batu dua belas, selangor, malaysia": "overseas",
  "taichung city": "china",
  "los angeles, ca": "overseas",
  "milwaukee, wisconsin": "overseas",
  "boston, usa": "overseas",
  "kansas city, mo": "overseas",
  "ho chi minh city, vietnam": "overseas",
  "ontario": "overseas",
  "united arab emirates": "overseas",
  "nantong": "china",
  "hefei, anhui": "china",
  "taiwan": "china",
  "nz": "overseas",
  ".beijing": "china",
  "spokane, wa": "overseas",
  "bavaria": "overseas",
  "university of bristol, uk": "overseas",
  "perth, australia": "overseas",
  "chengdu, china": "china",
  "san jose, ca": "overseas",
  "chicago, illinois": "overseas",
  "macao": "china",
  "miami, fl": "overseas",
  "hangzhou": "china",
  "monterey park, ca": "overseas",
  "hawaii": "overseas",
  "nagoya": "overseas"
};

function classifyLocation(location) {
  return reviewedLocations[String(location || "").trim().toLowerCase()] || "unknown";
}

async function ensureStargazers() {
  if (state.stargazers.length) return state.stargazers;
  const records = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubFetch(`/repos/${REPO}/stargazers?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github.star+json" }
    });
    if (!Array.isArray(batch)) throw new Error("GitHub stargazer 返回格式异常");
    records.push(...batch);
    if (batch.length < 100) break;
  }
  state.stargazers = records;
  return records;
}

async function loadRegions() {
  const button = document.querySelector("#loadRegionsButton");
  button.disabled = true;
  button.textContent = "读取中…";
  renderRegionsEmpty("正在读取公开 profile location…");
  try {
    state.stargazers = [];
    await ensureStargazers();
    const records = await mapWithConcurrency(state.stargazers, 5, async item => {
      const user = item.user || item;
      try {
        const profile = await githubFetch(`/users/${encodeURIComponent(user.login)}`);
        return { login: user.login, starred_at: item.starred_at, date: (item.starred_at || "").slice(0, 7), location: profile.location || "", region: classifyLocation(profile.location), profile_status: "ok" };
      } catch {
        return { login: user.login, starred_at: item.starred_at, date: (item.starred_at || "").slice(0, 7), location: "", region: "unknown", profile_status: "failed" };
      }
    });
    if (records.some(record => record.profile_status === "failed")) throw new Error("部分 profile 读取失败，保留已抓取的完整快照");
    state.regionSnapshot = { fetched_at: new Date().toISOString(), records };
    renderRegions(records);
    showToast(`已读取 ${records.length} 个公开 profile`);
  } catch (error) {
    if (state.regionSnapshot?.records?.length) renderRegions(state.regionSnapshot.records);
    else renderRegionsEmpty(error.message);
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "重新读取公开 profile location";
  }
}

function renderRegions(records) {
  records = records.filter(record => record.date === "2026-09");
  const grouped = new Map();
  records.forEach(record => {
    const key = record.date || "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  });
  const cards = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, items]) => {
    const china = items.filter(item => (item.region || classifyLocation(item.location)) === "china").length;
    const overseas = items.filter(item => (item.region || classifyLocation(item.location)) === "overseas").length;
    const unknown = items.filter(item => (item.region || classifyLocation(item.location)) === "unknown").length;
    const total = items.length || 1;
    const locations = [...new Set(items.map(item => item.location).filter(Boolean))].slice(0, 3).join(" · ") || "公开 profile 未填写 location";
    return `<article class="region-card"><div class="region-card-header"><div><strong>${period === "unknown" ? "日期未知" : escapeHtml(period.replace("-", " / "))}</strong><small>按加星月份 · UTC</small></div><span class="region-total">${items.length} users</span></div>
      <div class="region-bar" style="--china: ${china / total * 100}%; --overseas: ${overseas / total * 100}%; --unknown: ${unknown / total * 100}%"><i></i><i></i><i></i></div>
      <div class="region-meta"><span>中国 <b>${china} 人 · ${(china / total * 100).toFixed(1)}%</b></span><span>海外 <b>${overseas} 人 · ${(overseas / total * 100).toFixed(1)}%</b></span><span>未知 <b>${unknown} 人 · ${(unknown / total * 100).toFixed(1)}%</b></span></div>
      <div class="region-meta" style="margin-top: 10px"><span>Locations</span><span>${escapeHtml(locations)}</span></div></article>`;
  }).join("");
  const total = records.length || 1;
  const overseas = records.filter(item => (item.region || classifyLocation(item.location)) === "overseas").length;
  document.querySelector("#regionFooterNote").textContent = `9 月新增 ${records.length} 个 profile · 海外 ${(overseas / total * 100).toFixed(1)}% · 更新于 ${formatDate(state.regionSnapshot?.fetched_at, true)}`;
  document.querySelector("#loadRegionsButton").textContent = "重新读取公开 profile location";
  const labels = { china: "中国地区", overseas: "海外地区", unknown: "未知" };
  document.querySelector("#regionDetailsBody").innerHTML = [...records].sort((a, b) => String(b.starred_at).localeCompare(String(a.starred_at))).map(record => `<tr><td><a href="https://github.com/${encodeURIComponent(record.login)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.login)}</a></td><td>${escapeHtml((record.starred_at || "").slice(0, 10))}</td><td>${escapeHtml(record.location || "未填写")}</td><td>${labels[record.region || classifyLocation(record.location)]}</td></tr>`).join("");
  document.querySelector("#regionGrid").innerHTML = cards || `<div class="empty-state region-empty"><strong>公开 profile 没有 location 数据</strong><span>GitHub 用户可以不填写所在地。</span></div>`;
}

function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  document.querySelector("#calendarLabel").textContent = `${year} 年 ${String(month + 1).padStart(2, "0")} 月`;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const counts = new Map(state.trend.map(point => [point.date, point.daily]));
  const trend = [...state.trend].sort((a, b) => a.date.localeCompare(b.date));
  const firstKnownDate = trend[0]?.date;
  const lastKnownDate = state.starSnapshot?.fetched_at?.slice(0, 10) || trend[trend.length - 1]?.date;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"].map(day => `<div class="weekday" role="columnheader">${day}</div>`).join("");
  const empty = Array.from({ length: firstDay }, () => `<div class="calendar-cell is-empty"></div>`).join("");
  const trailing = Array.from({ length: (7 - (firstDay + days) % 7) % 7 }, () => `<div class="calendar-cell is-empty"></div>`).join("");
  const cells = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = (firstDay + index) % 7;
    const known = firstKnownDate && date >= firstKnownDate && date <= lastKnownDate;
    const previousPoint = known ? trend.filter(point => point.date <= date).at(-1) : null;
    const daily = known ? `+${formatNumber(counts.get(date) || 0)}` : "—";
    const cumulative = previousPoint ? formatNumber(previousPoint.cumulative) : "—";
    const actionMarkup = promotionActions.filter(action => action.date === date).map(action => {
      const channel = `${action.platform}${action.community ? ` · ${action.community}` : ""}`;
      return `<a class="calendar-action calendar-promotion" data-platform="${escapeHtml(action.platform)}" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(`${action.date} · ${channel} · ${action.project}`)}"><span class="promotion-platform">${escapeHtml(action.platform)}</span> <span class="promotion-project">${escapeHtml(action.project)}</span></a>`;
    }).join("");
    return `<div class="calendar-cell ${weekday === 0 || weekday === 6 ? "weekend" : ""}" data-date="${date}"><div class="date-row"><strong>${day}</strong></div>
      <div class="day-count" title="${known ? "UTC 日增 / 累计 Star" : "暂无当日 Star 数据"}"><strong aria-label="日增 Star">${daily}</strong><span aria-label="累计 Star">${cumulative}</span></div>
      <div class="calendar-actions">${actionMarkup}</div></div>`;
  }).join("");
  document.querySelector("#actionCalendar").innerHTML = `<div class="calendar-grid">${weekdays}${empty}${cells}${trailing}</div>`;
}

function renderNetworkEmpty(message = "共同关注网络未加载") {
  document.querySelector("#categoryList").innerHTML = `<div class="empty-state compact-empty"><strong>${escapeHtml(message)}</strong><span>加载后按公开 starred repos 的真实共现次数排序。</span></div>`;
  document.querySelector("#networkTable").innerHTML = `<tr><td colspan="6" class="table-empty">暂无真实共同关注数据</td></tr>`;
  document.querySelector("#networkScore").textContent = "—";
  document.querySelector("#networkScoreSuffix").textContent = "等待抓取";
  document.querySelector("#networkMetaUsers").textContent = "样本：—";
  document.querySelector("#networkMetaSuccess").textContent = "成功：—";
}

function renderNetwork(snapshot) {
  const top = snapshot.ranking.slice(0, 8);
  const best = top[0];
  document.querySelector("#networkScore").textContent = best ? best.percent.toFixed(1) : "—";
  document.querySelector("#networkScoreSuffix").textContent = "% 最高共现";
  document.querySelector("#networkSummaryTitle").textContent = best ? `${best.name} · ${best.count} 人共同关注` : "暂无共同关注项目";
  document.querySelector("#networkSummaryText").textContent = `仅分析 2026 年 9 月新增的 ${snapshot.cohort_size} 位用户，成功读取 ${snapshot.success} 位；每人最近 ${snapshot.limit_per_user} 个公开收藏中，发现 ${formatNumber(snapshot.shared_repos)} 个至少 2 人共同关注的项目。`;
  document.querySelector("#networkMetaUsers").textContent = `9 月样本：${snapshot.cohort_size}`;
  document.querySelector("#networkMetaSuccess").textContent = `读取成功：${snapshot.success} / ${snapshot.cohort_size}`;
  document.querySelector("#networkLoadNote").textContent = `更新于 ${formatDate(snapshot.fetched_at, true)} · ${snapshot.truncated_users} 人的历史收藏超过读取上限`;
  document.querySelector("#categoryList").innerHTML = snapshot.categories.map(category => `
    <div class="category-row" title="${escapeHtml(`${category.repos} 个共同项目 · 例如 ${category.examples.join('、')}`)}"><span class="category-name">${escapeHtml(category.name)}</span><span class="category-track"><i style="width: ${Math.min(100, category.percent)}%"></i></span><span class="category-value">${category.users} 人</span></div>`).join("");
  const renderRow = (repo, withUsers = false) => {
    const users = withUsers ? `<details class="network-users"><summary>${repo.count} 人</summary><div>${repo.users.map(login => `<a href="https://github.com/${encodeURIComponent(login)}?tab=stars" target="_blank" rel="noopener noreferrer">${escapeHtml(login)}</a>`).join(" · ")}</div></details>` : String(repo.count);
    return `<tr><td><a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a></td><td>${users}</td><td>${repo.percent.toFixed(1)}%</td><td>${escapeHtml(repo.language || "—")}</td><td>${formatNumber(repo.stars)}</td><td><span class="network-category-tag">${escapeHtml(repo.category)}</span> ${escapeHtml(repo.description || repo.topics.join(" · ") || "暂无描述")}</td></tr>`;
  };
  document.querySelector("#networkTable").innerHTML = top.map(repo => renderRow(repo, true)).join("");
  document.querySelector("#networkRankingBody").innerHTML = snapshot.ranking.slice(0, 30).map(repo => renderRow(repo)).join("");
  document.querySelector("#networkInsights").innerHTML = snapshot.insights.map((insight, index) => `<article class="insight-card insight-${["blue", "orange", "green"][index]}"><span class="insight-index">0${index + 1}</span><strong>${escapeHtml(insight.title)}</strong><p>${escapeHtml(insight.evidence)}</p><p>${escapeHtml(insight.hypothesis)}</p></article>`).join("");
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

document.querySelectorAll("[data-range]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-range]").forEach(item => item.classList.remove("is-active"));
  button.classList.add("is-active");
  state.activeRange = button.dataset.range;
  renderTrendChart();
}));

document.querySelector("#calendarPrev").addEventListener("click", () => {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("#calendarNext").addEventListener("click", () => {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("#calendarToday").addEventListener("click", () => {
  state.calendarDate = new Date();
  renderCalendar();
});

document.querySelector("#loadRegionsButton").addEventListener("click", loadRegions);
document.querySelector("#refreshButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.style.transform = "rotate(180deg)";
  window.setTimeout(() => button.style.transform = "", 280);
  try {
    await loadBaseData();
    showToast("已从 GitHub 重新读取公开数据");
  } catch (error) {
    setDataStatus(error.message, true);
    showToast(error.message, true);
  }
});

renderTrafficSnapshot();
if (window.DATAMIND_STAR_SNAPSHOT) {
  state.starSnapshot = window.DATAMIND_STAR_SNAPSHOT;
  state.trend = buildSnapshotTrend(state.starSnapshot);
  renderBase();
} else {
  renderCalendar();
}
loadBaseData().catch(error => {
  setDataStatus(error.message, true);
  document.querySelector("#trendSummary").textContent = "无法读取 GitHub 公开数据";
  document.querySelector("#trendPeak").textContent = "—";
  document.querySelector("#trendChart").innerHTML = `<div class="empty-state"><strong>${escapeHtml(error.message)}</strong><span>顶部指标已尝试从 Shields.io 读取；请稍后刷新。</span></div>`;
  if (state.regionSnapshot?.records?.length) renderRegions(state.regionSnapshot.records);
  else renderRegionsEmpty("等待 GitHub 公开 profile 数据");
  if (state.networkSnapshot) renderNetwork(state.networkSnapshot);
  else renderNetworkEmpty("等待 GitHub 公开数据");
  showToast(error.message, true);
});
