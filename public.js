(() => { let toastTimer; const state={ repo:null,starSnapshot:window.DATAMIND_STAR_SNAPSHOT,trend:[],activeRange:'all',starHistory:[] };
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
    const every = Math.max(1, Math.ceil(data.length / 14));
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
function renderBase() {
  const repo = state.repo;

  if (repo) {
    document.querySelector("#metricStars").textContent = formatNumber(repo.stargazers_count);
    document.querySelector("#metricStarsNote").textContent = `读取于 ${formatDate(new Date(), true)}`;
  } else if (state.starSnapshot) {
    document.querySelector("#metricStars").textContent = formatNumber(state.starSnapshot.stars);
    document.querySelector("#metricStarsNote").textContent = `精确快照 · ${formatDate(state.starSnapshot.fetched_at, true)}`;
  }
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(todayParts.map(part => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const month = today.slice(0, 7);
  const completedDays = (state.starSnapshot?.daily || []).filter(point => point.date.startsWith(`${month}-`) && point.date < today);
  const monthStars = completedDays.reduce((sum, point) => sum + point.count, 0);
  document.querySelector("#metricOctoberAverageLabel").textContent = `${Number(dateParts.month)}月日均新增 Star`;
  document.querySelector("#metricOctoberAverage").textContent = completedDays.length
    ? (monthStars / completedDays.length).toFixed(1)
    : "—";
  document.querySelector("#metricOctoberAverageNote").textContent = completedDays.length
    ? `截至 ${Number(completedDays.at(-1).date.slice(5, 7))}/${Number(completedDays.at(-1).date.slice(8, 10))} · ${formatNumber(monthStars)} Stars / ${completedDays.length} 天`
    : "等待完整日 Star 数据";
  document.querySelector("#metricOctoberAverageSource").textContent = state.starSnapshot
    ? `数据更新于 ${formatDate(state.starSnapshot.fetched_at, true)}`
    : "GitHub Star 日统计";
  document.querySelector("#trendSummary").textContent = state.trend.length
    ? state.starSnapshot
      ? `已加载 ${state.trend.length} 个日历日 · 快照截至 ${formatDate(state.starSnapshot.fetched_at, true)}`
      : `已加载 ${state.starHistory.length} 个 GitHub Star History 周记录`
    : "Star 时间序列受 GitHub API 限制";
  renderTrendChart();
}
function getActionsForChart(data, baseline=189) { const dates=["2026-10-22","2026-10-16","2026-10-15","2026-10-09","2026-10-08","2026-09-16","2026-09-14","2026-09-30"]; return data.map((point,index)=>{if(!dates.includes(point.date))return '';const x=46+(1160-46-22)/Math.max(1,data.length)*(index+.5);return '<g><line x1="'+x+'" x2="'+x+'" y1="43" y2="'+baseline+'" stroke="#df6a5b" stroke-dasharray="3 4" opacity="0.3"></line><circle class="action-marker" cx="'+x+'" cy="35" r="5"><title>运营 action</title></circle></g>';}).join('');}
state.trend=buildSnapshotTrend(state.starSnapshot); renderBase(); setDataStatus('最后更新：'+formatDate(state.starSnapshot.fetched_at,true)); document.querySelector('#refreshButton').addEventListener('click',()=>location.reload()); })();
