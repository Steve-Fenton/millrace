import { createFlowNavMenu } from "./flowNavMenu.js";
import { parseBoardIni } from "./boardModel.js";
import {
  fetchBoardIni,
  fetchLocalUserProfile,
  patchLocalUserChartsGranularity,
} from "./repoAccess.js";
import { boardSlugFrom } from "./flowBoardSlug.js";
import {
  createBoardTitlePicker,
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "./flowBoardPicker.js";

const NO_STORE = /** @type {const} */ ({ cache: "no-store" });

/** @typedef {"weekly" | "monthly"} Granularity */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} boardSlug
 * @param {Granularity} granularity
 */
async function fetchCompletionBuckets(boardSlug, granularity) {
  const q = new URLSearchParams({ boardSlug, granularity });
  const res = await fetch(`/api/completion-buckets?${q}`, NO_STORE);
  const ct = res.headers.get("content-type") ?? "";
  /** @type {Record<string, unknown>} */
  let data = {};
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    await res.text().catch(() => {});
  }
  if (!res.ok) {
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/**
 * @param {string} iso
 * @param {Granularity} granularity
 */
function formatBucketLabel(iso, granularity) {
  const d = new Date(iso);
  if (granularity === "monthly") {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * @param {{ t: string, n: number }[]} buckets
 * @param {{ t: string, d: number }[]} cyclePoints
 * @returns {{ tLo: number, tHi: number }}
 */
function sharedTimeDomain(buckets, cyclePoints) {
  const ts = [];
  for (const b of buckets) ts.push(Date.parse(b.t));
  for (const p of cyclePoints) ts.push(Date.parse(p.t));
  if (ts.length === 0) {
    const n = Date.now();
    return { tLo: n - 30 * 86400000, tHi: n + 86400000 };
  }
  let tMin = Math.min(...ts);
  let tMax = Math.max(...ts);
  if (!(tMax > tMin)) {
    tMax = tMin + 86400000;
  }
  const span = tMax - tMin;
  return { tLo: tMin - span * 0.05, tHi: tMax + span * 0.05 };
}

/**
 * @param {string} boardSlug
 * @param {Granularity} granularity
 */
async function fetchCycleTimeScatter(boardSlug, granularity) {
  const q = new URLSearchParams({ boardSlug, granularity });
  const res = await fetch(`/api/cycle-time-scatter?${q}`, NO_STORE);
  const ct = res.headers.get("content-type") ?? "";
  /** @type {Record<string, unknown>} */
  let data = {};
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    await res.text().catch(() => {});
  }
  if (!res.ok) {
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

function fmtDays(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} d`;
}

/**
 * @param {{ t: string, n: number }[]} buckets
 * @param {Granularity} granularity
 * @param {{ tLo: number, tHi: number } | null} [timeDomain]
 */
function renderScatterSvg(buckets, granularity, timeDomain = null) {
  const vbW = 720;
  const vbH = 360;
  const padL = 52;
  const padR = 20;
  const padT = 28;
  const padB = 52;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("class", "charts-scatter-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Completions per ${granularity} period (UTC buckets)`
  );

  if (buckets.length === 0) {
    const msg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    msg.setAttribute("x", String(vbW / 2));
    msg.setAttribute("y", String(vbH / 2));
    msg.setAttribute("text-anchor", "middle");
    msg.setAttribute("class", "charts-empty-label");
    msg.textContent = "No completions with a close date yet.";
    svg.append(msg);
    return svg;
  }

  const counts = buckets.map((b) => b.n);
  let tLo;
  let tHi;
  if (
    timeDomain &&
    Number.isFinite(timeDomain.tLo) &&
    Number.isFinite(timeDomain.tHi) &&
    timeDomain.tHi > timeDomain.tLo
  ) {
    tLo = timeDomain.tLo;
    tHi = timeDomain.tHi;
  } else {
    const times = buckets.map((b) => Date.parse(b.t));
    let tMin = Math.min(...times);
    let tMax = Math.max(...times);
    if (!(tMax > tMin)) {
      tMax = tMin + 86400000;
    }
    const span = tMax - tMin;
    tLo = tMin - span * 0.05;
    tHi = tMax + span * 0.05;
  }

  const nMax = Math.max(...counts, 1);
  const nTop = nMax * 1.08;

  /** @param {number} tm */
  const xAt = (tm) => padL + ((tm - tLo) / (tHi - tLo)) * plotW;
  /** @param {number} n */
  const yAt = (n) => padT + plotH - (n / nTop) * plotH;

  const axes = document.createElementNS("http://www.w3.org/2000/svg", "path");
  axes.setAttribute(
    "d",
    `M${padL} ${padT + plotH}L${padL + plotW} ${padT + plotH}M${padL} ${padT}L${padL} ${padT + plotH}`
  );
  axes.setAttribute("class", "charts-axis");
  svg.append(axes);

  const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yLabel.setAttribute("x", String(14));
  yLabel.setAttribute("y", String(padT + plotH / 2));
  yLabel.setAttribute(
    "transform",
    `rotate(-90 14 ${padT + plotH / 2})`
  );
  yLabel.setAttribute("class", "charts-axis-title");
  yLabel.textContent = "Completions";
  svg.append(yLabel);

  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", String(padL + plotW / 2));
  xLabel.setAttribute("y", String(vbH - 12));
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.setAttribute("class", "charts-axis-title");
  xLabel.textContent = "Period (UTC)";
  svg.append(xLabel);

  const yTicks = Math.min(5, Math.max(2, nMax));
  for (let i = 0; i <= yTicks; i++) {
    const v = (i / yTicks) * nTop;
    const yy = yAt(v);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(padL));
    line.setAttribute("x2", String(padL + plotW));
    line.setAttribute("y1", String(yy));
    line.setAttribute("y2", String(yy));
    line.setAttribute("class", "charts-grid-line");
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("x", String(padL - 8));
    lab.setAttribute("y", String(yy + 4));
    lab.setAttribute("text-anchor", "end");
    lab.setAttribute("class", "charts-tick-label");
    lab.textContent = String(Math.round(v));
    g.append(line, lab);
    svg.append(g);
  }

  const xTickN = Math.min(7, buckets.length);
  for (let i = 0; i < xTickN; i++) {
    const idx =
      xTickN <= 1
        ? 0
        : Math.round((i / (xTickN - 1)) * (buckets.length - 1));
    const b = buckets[idx];
    const tm = Date.parse(b.t);
    const xx = xAt(tm);
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("x", String(xx));
    lab.setAttribute("y", String(padT + plotH + 22));
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("class", "charts-tick-label charts-tick-label--x");
    lab.textContent = formatBucketLabel(b.t, granularity);
    svg.append(lab);
  }

  for (const b of buckets) {
    const tm = Date.parse(b.t);
    const cx = xAt(tm);
    const cy = yAt(b.n);
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", "6");
    c.setAttribute("class", "charts-point");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${formatBucketLabel(b.t, granularity)} — ${b.n} card${b.n === 1 ? "" : "s"}`;
    c.append(tip);
    svg.append(c);
  }

  return svg;
}

/**
 * @param {Record<string, unknown>} cyclePayload
 * @param {Granularity} granularity
 * @param {{ tLo: number, tHi: number }} timeDomain
 */
function renderCycleScatterSvg(cyclePayload, granularity, timeDomain) {
  const points = Array.isArray(cyclePayload.points)
    ? /** @type {{ t: string, d: number }[]} */ (cyclePayload.points)
    : [];
  const medianDays =
    typeof cyclePayload.medianDays === "number" ? cyclePayload.medianDays : null;
  const stdevDays =
    typeof cyclePayload.stdevDays === "number" ? cyclePayload.stdevDays : null;
  const count = Number(cyclePayload.count) || 0;

  const vbW = 720;
  const vbH = 360;
  const padL = 52;
  const padR = 20;
  const padT = 28;
  const padB = 52;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("class", "charts-scatter-svg charts-scatter-svg--cycle");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Cycle time in days per ${granularity} close bucket (UTC)`
  );

  const { tLo, tHi } = timeDomain;
  /** @param {number} tm */
  const xAt = (tm) => padL + ((tm - tLo) / (tHi - tLo)) * plotW;

  if (points.length === 0) {
    const msg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    msg.setAttribute("x", String(vbW / 2));
    msg.setAttribute("y", String(vbH / 2));
    msg.setAttribute("text-anchor", "middle");
    msg.setAttribute("class", "charts-empty-label");
    msg.textContent =
      "No cards with both created and close dates (or no positive cycle length).";
    svg.append(msg);
    return svg;
  }

  let dMax = 0.01;
  for (const p of points) {
    if (Number.isFinite(p.d)) dMax = Math.max(dMax, p.d);
  }
  if (medianDays != null && Number.isFinite(medianDays)) {
    dMax = Math.max(dMax, medianDays);
  }
  if (medianDays != null && stdevDays != null && Number.isFinite(stdevDays)) {
    dMax = Math.max(dMax, medianDays + stdevDays, medianDays - stdevDays, 0);
  }
  const dTop = Math.max(dMax * 1.12, 0.25);

  /** @param {number} d */
  const yAt = (d) => padT + plotH - (Math.min(d, dTop) / dTop) * plotH;

  const axes = document.createElementNS("http://www.w3.org/2000/svg", "path");
  axes.setAttribute(
    "d",
    `M${padL} ${padT + plotH}L${padL + plotW} ${padT + plotH}M${padL} ${padT}L${padL} ${padT + plotH}`
  );
  axes.setAttribute("class", "charts-axis");
  svg.append(axes);

  const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yLabel.setAttribute("x", String(12));
  yLabel.setAttribute("y", String(padT + plotH / 2));
  yLabel.setAttribute("transform", `rotate(-90 12 ${padT + plotH / 2})`);
  yLabel.setAttribute("class", "charts-axis-title");
  yLabel.textContent = "Cycle (days)";
  svg.append(yLabel);

  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", String(padL + plotW / 2));
  xLabel.setAttribute("y", String(vbH - 12));
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.setAttribute("class", "charts-axis-title");
  xLabel.textContent = "Close period (UTC)";
  svg.append(xLabel);

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = (i / yTicks) * dTop;
    const yy = yAt(v);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(padL));
    line.setAttribute("x2", String(padL + plotW));
    line.setAttribute("y1", String(yy));
    line.setAttribute("y2", String(yy));
    line.setAttribute("class", "charts-grid-line");
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("x", String(padL - 8));
    lab.setAttribute("y", String(yy + 4));
    lab.setAttribute("text-anchor", "end");
    lab.setAttribute("class", "charts-tick-label");
    lab.textContent = v < 10 ? v.toFixed(1) : String(Math.round(v));
    svg.append(line, lab);
  }

  const uniqT = [...new Set(points.map((p) => p.t))].sort(
    (a, b) => Date.parse(a) - Date.parse(b)
  );
  const xTickN = Math.min(7, uniqT.length);
  for (let i = 0; i < xTickN; i++) {
    const idx =
      xTickN <= 1 ? 0 : Math.round((i / (xTickN - 1)) * (uniqT.length - 1));
    const tIso = uniqT[idx];
    const tm = Date.parse(tIso);
    const xx = xAt(tm);
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("x", String(xx));
    lab.setAttribute("y", String(padT + plotH + 22));
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("class", "charts-tick-label charts-tick-label--x");
    lab.textContent = formatBucketLabel(tIso, granularity);
    svg.append(lab);
  }

  if (medianDays != null && stdevDays != null && count >= 2) {
    const lo = Math.max(0, medianDays - stdevDays);
    const hi = Math.min(medianDays + stdevDays, dTop);
    const yTopPx = yAt(hi);
    const yBotPx = yAt(lo);
    const band = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    band.setAttribute("x", String(padL));
    band.setAttribute("width", String(plotW));
    band.setAttribute("y", String(yTopPx));
    band.setAttribute("height", String(Math.max(1, yBotPx - yTopPx)));
    band.setAttribute("class", "charts-cycle-sigma-band");
    svg.append(band);
  }

  if (medianDays != null && count > 0) {
    const yMed = yAt(Math.min(medianDays, dTop));
    const medLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    medLine.setAttribute("x1", String(padL));
    medLine.setAttribute("x2", String(padL + plotW));
    medLine.setAttribute("y1", String(yMed));
    medLine.setAttribute("y2", String(yMed));
    medLine.setAttribute("class", "charts-cycle-median-line");
    svg.append(medLine);
  }

  for (const p of points) {
    const tm = Date.parse(p.t);
    const cx = xAt(tm);
    const cy = yAt(p.d);
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", "5.5");
    c.setAttribute("class", "charts-point charts-point--cycle");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${formatBucketLabel(p.t, granularity)} — ${p.d.toFixed(2)} d (close − create)`;
    c.append(tip);
    svg.append(c);
  }

  return svg;
}

/**
 * @param {object} model
 * @param {Granularity} granularity
 * @param {{ buckets: { t: string, n: number }[] }} completionData
 * @param {Record<string, unknown>} cycleData
 * @param {{ boards: { slug: string, name: string }[], activeSlug: string }} flowCtx
 */
function renderChartsShell(model, granularity, completionData, cycleData, flowCtx) {
  const name = model.board.name?.trim() || "Board";
  const buckets = Array.isArray(completionData.buckets)
    ? completionData.buckets
    : [];
  const cyclePoints = Array.isArray(cycleData.points)
    ? /** @type {{ t: string, d: number }[]} */ (cycleData.points)
    : [];
  const timeDomain = sharedTimeDomain(buckets, cyclePoints);
  const medianDays =
    typeof cycleData.medianDays === "number" ? cycleData.medianDays : null;
  const stdevDays =
    typeof cycleData.stdevDays === "number" ? cycleData.stdevDays : null;
  const cycleCount = Number(cycleData.count) || 0;

  const root = document.createElement("div");
  root.className = "board-shell charts-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";

  const titleOrPicker = createBoardTitlePicker(
    { boards: flowCtx.boards, activeSlug: flowCtx.activeSlug },
    (slug) => {
      writeStoredActiveBoardSlug(slug);
      document.dispatchEvent(new CustomEvent("flow:active-board-changed"));
    }
  );
  if (titleOrPicker instanceof HTMLHeadingElement) {
    titleOrPicker.textContent = name;
    titleOrPicker.title = name;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "charts-toolbar";

  const granLabel = document.createElement("label");
  granLabel.className = "board-owner-filter-label";
  granLabel.htmlFor = "flow-chart-granularity";
  granLabel.textContent = "Group by";

  const granSelect = document.createElement("select");
  granSelect.id = "flow-chart-granularity";
  granSelect.className = "board-owner-filter-select";
  granSelect.setAttribute("aria-label", "Bucket size for completion chart");

  for (const [value, label] of /** @type {const} */ ([
    ["weekly", "Weekly"],
    ["monthly", "Monthly"],
  ])) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    granSelect.append(o);
  }
  granSelect.value = granularity;

  granSelect.addEventListener("change", () => {
    const v = granSelect.value;
    const next =
      v === "monthly" ? "monthly" : /** @type {Granularity} */ ("weekly");
    void (async () => {
      try {
        await patchLocalUserChartsGranularity(next);
      } catch {
        /* static host / offline — still update URL */
      }
      const u = new URL(window.location.href);
      u.searchParams.set("g", next);
      window.location.href = u.pathname + u.search + u.hash;
    })();
  });

  toolbar.append(granLabel, granSelect);
  topLeft.append(titleOrPicker, toolbar);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";

  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "Charts";

  const navMenu = createFlowNavMenu({ current: "charts" });

  topActions.append(badge, navMenu);
  top.append(topLeft, topActions);

  const body = document.createElement("div");
  body.className = "charts-body";

  const note = document.createElement("p");
  note.className = "charts-note";
  note.textContent =
    "Completions: cards closed in the selected period.";

  const wrap = document.createElement("div");
  wrap.className = "charts-svg-wrap";
  wrap.append(renderScatterSvg(buckets, granularity, timeDomain));

  const secTitle = document.createElement("h2");
  secTitle.className = "charts-section-title";
  secTitle.textContent = "Cycle time (created → closed)";

  const stats = document.createElement("div");
  stats.className = "charts-cycle-stats";
  const stMed = document.createElement("span");
  stMed.className = "charts-stat";
  const medK = document.createElement("strong");
  medK.textContent = fmtDays(medianDays);
  stMed.append("Median ", medK);
  const stSig = document.createElement("span");
  stSig.className = "charts-stat";
  const sigK = document.createElement("strong");
  sigK.textContent =
    cycleCount >= 2 &&
    stdevDays != null &&
    typeof stdevDays === "number" &&
    Number.isFinite(stdevDays)
      ? fmtDays(stdevDays)
      : "—";
  stSig.append("σ ", sigK);
  const stN = document.createElement("span");
  stN.className = "charts-stat";
  const nK = document.createElement("strong");
  nK.textContent = String(cycleCount);
  stN.append("n = ", nK);
  stats.append(stMed, stSig, stN);

  const note2 = document.createElement("p");
  note2.className = "charts-note";
  note2.textContent =
    "Cycle times: Each dot is one card shown by close date. The shaded band is median ± one standard deviation (when n ≥ 2).";

  const wrap2 = document.createElement("div");
  wrap2.className = "charts-svg-wrap";
  wrap2.append(renderCycleScatterSvg(cycleData, granularity, timeDomain));

  body.append(note, wrap, secTitle, stats, note2, wrap2);
  root.append(top, body);
  return root;
}

async function main() {
  const mount = document.getElementById("app");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const gParam = params.get("g");
  /** @type {Granularity} */
  let granularity = "weekly";
  if (gParam != null && gParam !== "") {
    granularity =
      gParam.toLowerCase() === "monthly" ? "monthly" : "weekly";
  }

  mount.innerHTML = `<div class="app-loading">Loading…</div>`;

  try {
    if (gParam == null || gParam === "") {
      const profile = await fetchLocalUserProfile();
      const saved = String(profile.chartsGranularity ?? "")
        .trim()
        .toLowerCase();
      if (saved === "monthly" || saved === "weekly") {
        granularity = /** @type {Granularity} */ (saved);
      }
    }

    const { boards, activeSlug } = await resolveActiveBoardSelection();
    const flowCtx = { boards, activeSlug };
    const text = await fetchBoardIni(activeSlug);
    const model = parseBoardIni(text);
    if (model.columns.length === 0) {
      mount.innerHTML = `<div class="app-error">No columns found in board.ini.</div>`;
      return;
    }
    const boardSlug = boardSlugFrom(model.board);
    const [completionData, cycleData] = await Promise.all([
      fetchCompletionBuckets(boardSlug, granularity),
      fetchCycleTimeScatter(boardSlug, granularity),
    ]);

    mount.replaceChildren();
    mount.append(
      renderChartsShell(
        model,
        granularity,
        completionData,
        cycleData,
        flowCtx
      )
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load chart: ${escapeHtml(msg)}</div>`;
  }
}

document.addEventListener("flow:refresh-board", () => {
  void main();
});

document.addEventListener("flow:active-board-changed", () => {
  void main();
});

void main();
