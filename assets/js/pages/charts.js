import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import { setFlowDocumentTitle } from "../ui/documentTitle.js";
import { parseBoardIni } from "../models/boardModel.js";
import { enrichAggregateBoardModel } from "../models/aggregateBoard.js";
import {
  fetchBoardIni,
  fetchLocalUserProfile,
  patchLocalUserChartsGranularity,
} from "../client.js";
import { boardSlugFrom } from "../html/slug.js";
import {
  createBoardTitlePicker,
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "../ui/boardSelector.js";
import { escapeHtml } from "../html/escape.js";
import { initFlowTheme } from "../ui/applyTheme.js";

const NO_STORE = /** @type {const} */ ({ cache: "no-store" });

/** @typedef {"weekly" | "monthly"} Granularity */

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

/** @param {string} iso */
function formatCloseDateLabel(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * @param {{ closed?: string, t?: string, bucket?: string, d: number }} p
 */
function cyclePointClosedMs(p) {
  if (typeof p.closed === "string") return Date.parse(p.closed);
  return Date.parse(p.t ?? "");
}

/**
 * @param {{ closed?: string, t?: string, bucket?: string, d: number }} p
 */
function cyclePointBucketKey(p) {
  if (typeof p.bucket === "string") return p.bucket;
  return p.t ?? "";
}

/**
 * @param {{ t: string, n: number }[]} buckets
 * @param {{ closed?: string, t?: string, bucket?: string, d: number }[]} cyclePoints
 * @param {{ t: string }[]} [extraBuckets]
 * @returns {{ tLo: number, tHi: number }}
 */
function sharedTimeDomain(buckets, cyclePoints, extraBuckets = []) {
  const ts = [];
  for (const b of buckets) ts.push(Date.parse(b.t));
  for (const p of cyclePoints) {
    const ms = cyclePointClosedMs(p);
    if (Number.isFinite(ms)) ts.push(ms);
  }
  for (const b of extraBuckets) ts.push(Date.parse(b.t));
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

/**
 * @param {string} boardSlug
 * @param {Granularity} granularity
 */
async function fetchColumnSwimlaneStack(boardSlug) {
  const q = new URLSearchParams({ boardSlug });
  const res = await fetch(`/api/column-swimlane-stack?${q}`, NO_STORE);
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

async function fetchCardAgeDistribution(boardSlug) {
  const q = new URLSearchParams({ boardSlug });
  const res = await fetch(`/api/card-age-distribution?${q}`, NO_STORE);
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

async function fetchCompletionSwimlaneStack(boardSlug, granularity) {
  const q = new URLSearchParams({ boardSlug, granularity });
  const res = await fetch(`/api/completion-swimlane-stack?${q}`, NO_STORE);
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
 * @param {string} boardSlug
 * @param {Granularity} granularity
 */
async function fetchCumulativeFlowStack(boardSlug, granularity) {
  const q = new URLSearchParams({ boardSlug, granularity });
  const res = await fetch(`/api/cumulative-flow-stack?${q}`, NO_STORE);
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
 * @param {number} i
 * @param {number} n
 */
function swimlaneStackFill(i, n) {
  const hue = ((i * 47) % 360) + (n > 1 ? 0 : 200);
  const sat = n <= 1 ? 45 : 52;
  const light = 48 - (i % 3) * 4;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/**
 * Bottom-to-top stack order for cumulative flow (done band at the base).
 * @param {{ key: string, label: string, index: number }[]} logicalSeries
 */
function cumulativeFlowStackSeries(logicalSeries) {
  const done = logicalSeries.find((s) => s.key === "done");
  const wip = logicalSeries.filter((s) => s.key !== "done");
  return done ? [done, ...wip] : wip;
}

/**
 * @param {Record<string, unknown>} stackPayload
 * @param {Granularity} granularity
 * @param {{ tLo: number, tHi: number }} timeDomain
 */
function renderStackedAreaSvg(stackPayload, granularity, timeDomain) {
  const series = Array.isArray(stackPayload.series)
    ? /** @type {{ key: string, label: string, index: number }[]} */ (
        stackPayload.series
      )
    : [];
  const stackSeries = Array.isArray(stackPayload.stackSeries)
    ? /** @type {{ key: string, label: string, index: number }[]} */ (
        stackPayload.stackSeries
      )
    : series;
  const buckets = Array.isArray(stackPayload.buckets)
    ? /** @type {{ t: string, counts: Record<string, number> }[]} */ (
        stackPayload.buckets
      )
    : [];

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
  svg.setAttribute("class", "charts-scatter-svg charts-stack-svg");
  svg.setAttribute("role", "img");
  const ariaLabel =
    typeof stackPayload.ariaLabel === "string" && stackPayload.ariaLabel.trim()
      ? stackPayload.ariaLabel.trim()
      : `Completions by swimlane per ${granularity} period (UTC buckets)`;
  svg.setAttribute("aria-label", ariaLabel);

  const { tLo, tHi } = timeDomain;
  /** @param {number} tm */
  const xAt = (tm) => padL + ((tm - tLo) / (tHi - tLo)) * plotW;

  const emptyLabel =
    typeof stackPayload.emptyLabel === "string" &&
    stackPayload.emptyLabel.trim()
      ? stackPayload.emptyLabel.trim()
      : "No completions with a close date yet.";

  if (buckets.length === 0) {
    const msg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    msg.setAttribute("x", String(vbW / 2));
    msg.setAttribute("y", String(vbH / 2));
    msg.setAttribute("text-anchor", "middle");
    msg.setAttribute("class", "charts-empty-label");
    msg.textContent = emptyLabel;
    svg.append(msg);
    return svg;
  }

  let yMax = 1;
  for (const b of buckets) {
    let sum = 0;
    for (const s of series) {
      sum += Number(b.counts[s.key] ?? 0) || 0;
    }
    yMax = Math.max(yMax, sum);
  }
  const yTop = yMax * 1.08;

  /** @param {number} v */
  const yAt = (v) => padT + plotH - (v / yTop) * plotH;

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
  yLabel.textContent =
    typeof stackPayload.yAxisLabel === "string" && stackPayload.yAxisLabel.trim()
      ? stackPayload.yAxisLabel.trim()
      : "Completions";
  svg.append(yLabel);

  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", String(padL + plotW / 2));
  xLabel.setAttribute("y", String(vbH - 12));
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.setAttribute("class", "charts-axis-title");
  xLabel.textContent =
    typeof stackPayload.xAxisLabel === "string" && stackPayload.xAxisLabel.trim()
      ? stackPayload.xAxisLabel.trim()
      : "Close period (UTC)";
  svg.append(xLabel);

  const yTicks = Math.min(5, Math.max(2, Math.ceil(yMax)));
  for (let i = 0; i <= yTicks; i++) {
    const v = (i / yTicks) * yTop;
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
    lab.textContent = String(Math.round(v));
    svg.append(line, lab);
  }

  const xTickN = Math.min(7, buckets.length);
  for (let i = 0; i < xTickN; i++) {
    const idx =
      xTickN <= 1 ? 0 : Math.round((i / (xTickN - 1)) * (buckets.length - 1));
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

  const n = buckets.length;
  const nStack = stackSeries.length;

  /**
   * @param {string} key
   */
  function seriesColorIndex(key) {
    const idx = series.findIndex((entry) => entry.key === key);
    return idx >= 0 ? idx : 0;
  }

  for (let si = 0; si < nStack; si++) {
    const s = stackSeries[si];
    let any = false;
    for (const b of buckets) {
      if ((Number(b.counts[s.key] ?? 0) || 0) > 0) {
        any = true;
        break;
      }
    }
    if (!any) continue;

    /** @param {number} i */
    function stackY0(i) {
      let y0 = 0;
      for (let j = 0; j < si; j++) {
        y0 += Number(buckets[i].counts[stackSeries[j].key] ?? 0) || 0;
      }
      return y0;
    }
    /** @param {number} i */
    function stackY1(i) {
      return stackY0(i) + (Number(buckets[i].counts[s.key] ?? 0) || 0);
    }

    const fill = swimlaneStackFill(seriesColorIndex(s.key), series.length);

    if (n === 1) {
      const tm = Date.parse(buckets[0].t);
      const xc = xAt(tm);
      const barW = Math.min(48, plotW * 0.12);
      const y0 = yAt(stackY0(0));
      const y1 = yAt(stackY1(0));
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(xc - barW / 2));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("y", String(Math.min(y0, y1)));
      rect.setAttribute("height", String(Math.max(1, Math.abs(y1 - y0))));
      rect.setAttribute("fill", fill);
      rect.setAttribute("class", "charts-stack-area");
      const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
      const c = Number(buckets[0].counts[s.key] ?? 0) || 0;
      tip.textContent = `${s.label}: ${c} in ${formatBucketLabel(buckets[0].t, granularity)}`;
      rect.append(tip);
      svg.append(rect);
      continue;
    }

    const parts = [];
    for (let i = 0; i < n; i++) {
      const tm = Date.parse(buckets[i].t);
      parts.push({ x: xAt(tm), y0: yAt(stackY0(i)), y1: yAt(stackY1(i)) });
    }

    let d = `M ${parts[0].x} ${parts[0].y1}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${parts[i].x} ${parts[i].y1}`;
    }
    for (let i = n - 1; i >= 0; i--) {
      d += ` L ${parts[i].x} ${parts[i].y0}`;
    }
    d += " Z";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", fill);
    path.setAttribute("class", "charts-stack-area");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    const bits = buckets
      .map((b) => {
        const c = Number(b.counts[s.key] ?? 0) || 0;
        return c > 0
          ? `${formatBucketLabel(b.t, granularity)}: ${c}`
          : null;
      })
      .filter(Boolean);
    tip.textContent = `${s.label} — ${bits.join("; ") || "0"}`;
    path.append(tip);
    svg.append(path);
  }

  return svg;
}

/**
 * @param {Record<string, unknown>} stackPayload
 */
function renderStackedColumnSvg(stackPayload) {
  const series = Array.isArray(stackPayload.series)
    ? /** @type {{ key: string, label: string, index: number }[]} */ (
        stackPayload.series
      )
    : [];
  const columns = Array.isArray(stackPayload.columns)
    ? /** @type {{ key: string, label: string, counts: Record<string, number> }[]} */ (
        stackPayload.columns
      )
    : [];

  const vbW = 720;
  const vbH = 360;
  const padL = 52;
  const padR = 20;
  const padT = 28;
  const padB = 64;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("class", "charts-scatter-svg charts-column-stack-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Open cards per column stacked by swimlane"
  );

  let yMax = 1;
  for (const col of columns) {
    let sum = 0;
    for (const s of series) {
      sum += Number(col.counts[s.key] ?? 0) || 0;
    }
    yMax = Math.max(yMax, sum);
  }

  if (columns.length === 0 || yMax === 0) {
    const msg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    msg.setAttribute("x", String(vbW / 2));
    msg.setAttribute("y", String(vbH / 2));
    msg.setAttribute("text-anchor", "middle");
    msg.setAttribute("class", "charts-empty-label");
    msg.textContent = "No open cards on the board.";
    svg.append(msg);
    return svg;
  }

  const yTop = yMax * 1.08;
  /** @param {number} v */
  const yAt = (v) => padT + plotH - (v / yTop) * plotH;

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
  yLabel.textContent = "Cards";
  svg.append(yLabel);

  const yTicks = Math.min(5, Math.max(2, Math.ceil(yMax)));
  for (let i = 0; i <= yTicks; i++) {
    const v = (i / yTicks) * yTop;
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
    lab.textContent = String(Math.round(v));
    svg.append(line, lab);
  }

  const nCols = columns.length;
  const nSeries = series.length;
  const slotW = plotW / Math.max(nCols, 1);
  const barW = Math.min(56, slotW * 0.55);

  for (let ci = 0; ci < nCols; ci++) {
    const col = columns[ci];
    const xc = padL + (ci + 0.5) * slotW;

    const xLab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLab.setAttribute("x", String(xc));
    xLab.setAttribute("y", String(padT + plotH + 22));
    xLab.setAttribute("text-anchor", "middle");
    xLab.setAttribute("class", "charts-tick-label charts-tick-label--x");
    const title =
      col.label.length > 14 ? `${col.label.slice(0, 12)}…` : col.label;
    xLab.textContent = title;
    const tipCol = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tipCol.textContent = col.label;
    xLab.append(tipCol);
    svg.append(xLab);

    for (let si = 0; si < nSeries; si++) {
      const s = series[si];
      const count = Number(col.counts[s.key] ?? 0) || 0;
      if (count <= 0) continue;

      let y0 = 0;
      for (let j = 0; j < si; j++) {
        y0 += Number(col.counts[series[j].key] ?? 0) || 0;
      }
      const y1 = y0 + count;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(xc - barW / 2));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("y", String(Math.min(yAt(y0), yAt(y1))));
      rect.setAttribute(
        "height",
        String(Math.max(1, Math.abs(yAt(y1) - yAt(y0))))
      );
      rect.setAttribute("fill", swimlaneStackFill(si, nSeries));
      rect.setAttribute("class", "charts-stack-bar");
      const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
      tip.textContent = `${col.label} — ${s.label}: ${count}`;
      rect.append(tip);
      svg.append(rect);
    }
  }

  return svg;
}

/**
 * @param {Record<string, unknown>} distPayload
 */
function renderAgeDistributionSvg(distPayload) {
  const bins = Array.isArray(distPayload.bins)
    ? /** @type {{ lo: number, hi: number, n: number, label: string }[]} */ (
        distPayload.bins
      )
    : [];

  const vbW = 720;
  const vbH = 360;
  const padL = 52;
  const padR = 20;
  const padT = 28;
  const padB = 64;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("class", "charts-scatter-svg charts-histogram-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Distribution of open card age in days since created"
  );

  if (bins.length === 0) {
    const msg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    msg.setAttribute("x", String(vbW / 2));
    msg.setAttribute("y", String(vbH / 2));
    msg.setAttribute("text-anchor", "middle");
    msg.setAttribute("class", "charts-empty-label");
    msg.textContent =
      "No open cards with a created date on the board.";
    svg.append(msg);
    return svg;
  }

  let nMax = 1;
  for (const b of bins) {
    nMax = Math.max(nMax, Number(b.n) || 0);
  }
  const nTop = nMax * 1.08;

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
  yLabel.textContent = "Cards";
  svg.append(yLabel);

  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", String(padL + plotW / 2));
  xLabel.setAttribute("y", String(vbH - 10));
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.setAttribute("class", "charts-axis-title");
  xLabel.textContent = "Age (days, UTC)";
  svg.append(xLabel);

  const yTicks = Math.min(5, Math.max(2, nMax));
  for (let i = 0; i <= yTicks; i++) {
    const v = (i / yTicks) * nTop;
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
    lab.textContent = String(Math.round(v));
    svg.append(line, lab);
  }

  const nBins = bins.length;
  const slotW = plotW / Math.max(nBins, 1);
  const barW = Math.min(48, slotW * 0.7);

  for (let i = 0; i < nBins; i++) {
    const b = bins[i];
    const n = Number(b.n) || 0;
    const xc = padL + (i + 0.5) * slotW;
    const y0 = yAt(0);
    const y1 = yAt(n);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(xc - barW / 2));
    rect.setAttribute("width", String(barW));
    rect.setAttribute("y", String(Math.min(y0, y1)));
    rect.setAttribute("height", String(Math.max(1, Math.abs(y1 - y0))));
    rect.setAttribute("class", "charts-hist-bar");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${b.label}: ${n} card${n === 1 ? "" : "s"}`;
    rect.append(tip);
    svg.append(rect);

    const xLab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLab.setAttribute("x", String(xc));
    xLab.setAttribute("y", String(padT + plotH + 22));
    xLab.setAttribute("text-anchor", "middle");
    xLab.setAttribute("class", "charts-tick-label charts-tick-label--x");
    const short =
      b.label.length > 10 ? `${b.label.slice(0, 8)}…` : b.label;
    xLab.textContent = short;
    const tipX = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tipX.textContent = b.label;
    xLab.append(tipX);
    svg.append(xLab);
  }

  return svg;
}

/**
 * @param {Record<string, unknown>} stackPayload
 */
function renderSwimlaneStackLegend(stackPayload) {
  const series = Array.isArray(stackPayload.series)
    ? /** @type {{ key: string, label: string }[]} */ (stackPayload.series)
    : [];
  const wrap = document.createElement("div");
  wrap.className = "charts-stack-legend";
  const n = series.length;
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const row = document.createElement("span");
    row.className = "charts-stack-legend-item";
    const sw = document.createElement("span");
    sw.className = "charts-stack-swatch";
    sw.style.background = swimlaneStackFill(i, n);
    const lab = document.createElement("span");
    lab.textContent = s.label;
    row.append(sw, lab);
    wrap.append(row);
  }
  return wrap;
}

function fmtDays(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} d`;
}

/** Same expand icon as the card description editor (`editCard.js`). */
function createChartExpandButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "flow-btn flow-btn-icon flow-description-expand-toggle charts-chart-expand-btn";
  btn.setAttribute("aria-label", "Expand chart");
  btn.title = "Expand chart";
  const expandIcon = document.createElement("span");
  expandIcon.className = "flow-description-expand-icon";
  expandIcon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  btn.append(expandIcon);
  return btn;
}

let chartExpandDialogUid = 0;

/**
 * @param {string} titleText
 * @param {SVGElement} svgEl live chart SVG (cloned for the dialog)
 * @param {{ beforeChart?: HTMLElement[], afterChart?: HTMLElement[] }} [blocks]
 */
function openChartExpandDialog(titleText, svgEl, blocks = {}) {
  const beforeChart = blocks.beforeChart ?? [];
  const afterChart = blocks.afterChart ?? [];

  const uid = ++chartExpandDialogUid;
  const titleId = `flow-chart-expand-title-${uid}`;

  const dialog = document.createElement("dialog");
  dialog.className = "flow-modal flow-modal--chart-expand";
  dialog.setAttribute("aria-labelledby", titleId);

  const h2 = document.createElement("h2");
  h2.id = titleId;
  h2.className = "flow-modal-title";
  h2.textContent = titleText;

  const wrap = document.createElement("div");
  wrap.className = "charts-svg-wrap charts-svg-wrap--expanded";
  const svgClone = /** @type {SVGElement} */ (svgEl.cloneNode(true));
  wrap.append(svgClone);

  const actions = document.createElement("div");
  actions.className = "flow-modal-actions flow-modal-actions--chart-expand";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "flow-btn flow-btn-primary";
  closeBtn.textContent = "Close";
  actions.append(closeBtn);

  dialog.append(h2);
  for (const node of beforeChart) {
    dialog.append(node.cloneNode(true));
  }
  dialog.append(wrap);
  for (const node of afterChart) {
    dialog.append(node.cloneNode(true));
  }
  dialog.append(actions);

  document.body.append(dialog);

  function destroy() {
    dialog.remove();
  }

  closeBtn.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("close", destroy);

  let backdropPointerDown = false;
  dialog.addEventListener("pointerdown", (e) => {
    backdropPointerDown = e.target === dialog;
  });
  dialog.addEventListener("click", (e) => {
    const isBackdrop = backdropPointerDown && e.target === dialog;
    backdropPointerDown = false;
    if (isBackdrop) dialog.close();
  });

  dialog.showModal();
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.note
 * @param {SVGElement} opts.svgElement
 * @param {HTMLElement | null} [opts.footer]
 * @param {HTMLElement[]} [opts.beforeChart]
 * @param {HTMLElement[]} [opts.afterChart]
 */
function createChartCard(opts) {
  const {
    title,
    note,
    svgElement,
    footer = null,
    beforeChart = [],
    afterChart = [],
  } = opts;

  const card = document.createElement("section");
  card.className = "charts-chart-card";

  const header = document.createElement("div");
  header.className = "charts-chart-card__header";

  const h = document.createElement("h2");
  h.className = "charts-chart-card__title";
  h.textContent = title;

  const expandBtn = createChartExpandButton();
  expandBtn.addEventListener("click", () => {
    openChartExpandDialog(title, svgElement, { beforeChart, afterChart });
  });

  header.append(h, expandBtn);
  card.append(header);

  const noteEl = document.createElement("p");
  noteEl.className = "charts-note charts-chart-card__note";
  noteEl.textContent = note;
  card.append(noteEl);

  const chartWrap = document.createElement("div");
  chartWrap.className = "charts-svg-wrap charts-svg-wrap--tile";
  chartWrap.append(svgElement);
  card.append(chartWrap);

  if (footer) {
    card.append(footer);
  }

  return card;
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
  xLabel.textContent = "Close period (UTC)";
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
 * @param {number[]} values
 * @returns {number | null}
 */
function medianSampleClient(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {number[]} values
 * @returns {number | null}
 */
function sampleStdDevClient(values) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const varSum = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

/**
 * @param {{ closed?: string, t?: string, bucket?: string, d: number }[]} points
 */
function buildCycleTimePeriodStatsFromPoints(points) {
  /** @type {Map<string, number[]>} */
  const byBucket = new Map();
  for (const p of points) {
    const key = cyclePointBucketKey(p);
    if (!key) continue;
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key).push(p.d);
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([t, values]) => ({
      t,
      medianDays: medianSampleClient(values),
      stdevDays: sampleStdDevClient(values),
      count: values.length,
    }));
}

/**
 * @param {string[]} sortedBucketIsos sorted ascending
 * @param {number} i
 * @param {(tm: number) => number} xAt
 * @param {number} padL
 * @param {number} plotRight
 * @param {number} plotW
 * @returns {{ x0: number, x1: number }}
 */
function cyclePeriodXRange(sortedBucketIsos, i, xAt, padL, plotRight, plotW) {
  const n = sortedBucketIsos.length;
  if (n === 0) return { x0: padL, x1: plotRight };
  const tm = Date.parse(sortedBucketIsos[i]);
  if (n === 1) {
    return { x0: padL, x1: plotRight };
  }

  let leftMs;
  let rightMs;
  if (i === 0) {
    const nextMs = Date.parse(sortedBucketIsos[i + 1]);
    const halfSpan = (nextMs - tm) / 2;
    leftMs = tm - halfSpan;
    rightMs = tm + halfSpan;
  } else if (i === n - 1) {
    const prevMs = Date.parse(sortedBucketIsos[i - 1]);
    const halfSpan = (tm - prevMs) / 2;
    leftMs = tm - halfSpan;
    rightMs = tm + halfSpan;
  } else {
    leftMs = (Date.parse(sortedBucketIsos[i - 1]) + tm) / 2;
    rightMs = (tm + Date.parse(sortedBucketIsos[i + 1])) / 2;
  }

  let x0 = Math.max(padL, xAt(leftMs));
  let x1 = Math.min(plotRight, xAt(rightMs));
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) {
    const cx = xAt(tm);
    const w = Math.max(12, plotW / Math.max(n * 1.5, 1));
    x0 = Math.max(padL, cx - w / 2);
    x1 = Math.min(plotRight, cx + w / 2);
  }
  return { x0, x1: Math.max(x0 + 1, x1) };
}

/**
 * @param {{ x0: number, x1: number, y: number }[]} segments
 * @returns {string}
 */
function buildCycleStepPath(segments) {
  let d = "";
  for (const seg of segments) {
    if (!Number.isFinite(seg.y)) continue;
    if (d === "") {
      d = `M ${seg.x0} ${seg.y} H ${seg.x1}`;
    } else {
      d += ` V ${seg.y} H ${seg.x1}`;
    }
  }
  return d;
}

/**
 * @param {Record<string, unknown>} cyclePayload
 * @param {Granularity} granularity
 * @param {{ tLo: number, tHi: number }} timeDomain
 */
function renderCycleScatterSvg(cyclePayload, granularity, timeDomain) {
  const points = Array.isArray(cyclePayload.points)
    ? /** @type {{ closed?: string, t?: string, bucket?: string, d: number }[]} */ (
        cyclePayload.points
      )
    : [];
  const periodStats = Array.isArray(cyclePayload.periodStats)
    ? /** @type {{ t: string, medianDays: number | null, stdevDays: number | null, count: number }[]} */ (
        cyclePayload.periodStats
      )
    : [];
  const effectivePeriodStats =
    periodStats.length > 0
      ? periodStats
      : buildCycleTimePeriodStatsFromPoints(points);
  const medianDays =
    typeof cyclePayload.medianDays === "number" ? cyclePayload.medianDays : null;
  const stdevDays =
    typeof cyclePayload.stdevDays === "number" ? cyclePayload.stdevDays : null;

  const vbW = 720;
  const vbH = 360;
  const padL = 52;
  const padR = 20;
  const padT = 28;
  const padB = 52;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;
  const plotRight = padL + plotW;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("class", "charts-scatter-svg charts-scatter-svg--cycle");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Cycle time in days by close date (UTC); median and σ per ${granularity} period`
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
  for (const ps of effectivePeriodStats) {
    if (typeof ps.medianDays === "number" && Number.isFinite(ps.medianDays)) {
      dMax = Math.max(dMax, ps.medianDays);
    }
    if (
      typeof ps.medianDays === "number" &&
      typeof ps.stdevDays === "number" &&
      Number.isFinite(ps.medianDays) &&
      Number.isFinite(ps.stdevDays)
    ) {
      dMax = Math.max(
        dMax,
        ps.medianDays + ps.stdevDays,
        ps.medianDays - ps.stdevDays,
        0
      );
    }
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

  const sortedPeriodTs = effectivePeriodStats.map((ps) => ps.t);
  const uniqT = sortedPeriodTs.length > 0 ? sortedPeriodTs : [];
  const xTickN = Math.min(7, uniqT.length);
  for (let i = 0; i < xTickN; i++) {
    const idx =
      xTickN <= 1 ? 0 : Math.round((i / (xTickN - 1)) * (uniqT.length - 1));
    const tIso = uniqT[idx];
    const tm = Date.parse(tIso);
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("x", String(xAt(tm)));
    lab.setAttribute("y", String(padT + plotH + 22));
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("class", "charts-tick-label charts-tick-label--x");
    lab.textContent = formatBucketLabel(tIso, granularity);
    svg.append(lab);
  }

  /** @type {{ x0: number, x1: number, y: number }[]} */
  const medianSegments = [];
  /** @type {{ x0: number, x1: number, y: number }[]} */
  const sigmaUpperSegments = [];
  /** @type {{ x0: number, x1: number, y: number }[]} */
  const sigmaLowerSegments = [];

  for (let i = 0; i < effectivePeriodStats.length; i++) {
    const ps = effectivePeriodStats[i];
    const { x0, x1 } = cyclePeriodXRange(
      sortedPeriodTs,
      i,
      xAt,
      padL,
      plotRight,
      plotW
    );
    const width = Math.max(1, x1 - x0);
    const periodMedian =
      typeof ps.medianDays === "number" && Number.isFinite(ps.medianDays)
        ? ps.medianDays
        : null;
    const periodStdev =
      typeof ps.stdevDays === "number" && Number.isFinite(ps.stdevDays)
        ? ps.stdevDays
        : null;
    const periodCount = Number(ps.count) || 0;

    if (periodMedian != null && periodStdev != null && periodCount >= 2) {
      const lo = Math.max(0, periodMedian - periodStdev);
      const hi = Math.min(periodMedian + periodStdev, dTop);
      const yTopPx = yAt(hi);
      const yBotPx = yAt(lo);
      const band = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      band.setAttribute("x", String(x0));
      band.setAttribute("width", String(width));
      band.setAttribute("y", String(yTopPx));
      band.setAttribute("height", String(Math.max(1, yBotPx - yTopPx)));
      band.setAttribute("class", "charts-cycle-sigma-band");
      svg.append(band);
      sigmaUpperSegments.push({ x0, x1, y: yTopPx });
      sigmaLowerSegments.push({ x0, x1, y: yBotPx });
    }

    if (periodMedian != null && periodCount > 0) {
      medianSegments.push({
        x0,
        x1,
        y: yAt(Math.min(periodMedian, dTop)),
      });
    }
  }

  const appendStepPath = (segments, className) => {
    const d = buildCycleStepPath(segments);
    if (!d) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", className);
    path.setAttribute("fill", "none");
    svg.append(path);
  };

  appendStepPath(sigmaLowerSegments, "charts-cycle-sigma-line");
  appendStepPath(sigmaUpperSegments, "charts-cycle-sigma-line");
  appendStepPath(medianSegments, "charts-cycle-median-line");

  for (const p of points) {
    const tm = cyclePointClosedMs(p);
    if (!Number.isFinite(tm)) continue;
    const cx = xAt(tm);
    const cy = yAt(p.d);
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", "5.5");
    c.setAttribute("class", "charts-point charts-point--cycle");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    const closedIso =
      typeof p.closed === "string" ? p.closed : typeof p.t === "string" ? p.t : "";
    tip.textContent = `${formatCloseDateLabel(closedIso)} — ${p.d.toFixed(2)} d (close − create)`;
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
 * @param {Record<string, unknown>} swimlaneStackData
 * @param {Record<string, unknown>} cumulativeFlowData
 * @param {Record<string, unknown>} columnStackData
 * @param {Record<string, unknown>} ageDistData
 * @param {{ boards: { slug: string, name: string }[], activeSlug: string }} flowCtx
 */
function renderChartsShell(
  model,
  granularity,
  completionData,
  cycleData,
  swimlaneStackData,
  cumulativeFlowData,
  columnStackData,
  ageDistData,
  flowCtx
) {
  const name = model.board.name?.trim() || "Board";
  setFlowDocumentTitle("Charts", name);
  const buckets = Array.isArray(completionData.buckets)
    ? completionData.buckets
    : [];
  const cyclePoints = Array.isArray(cycleData.points)
    ? /** @type {{ closed?: string, t?: string, bucket?: string, d: number }[]} */ (
        cycleData.points
      )
    : [];
  const stackBuckets = Array.isArray(swimlaneStackData.buckets)
    ? /** @type {{ t: string }[]} */ (swimlaneStackData.buckets)
    : [];
  const cumulativeBuckets = Array.isArray(cumulativeFlowData.buckets)
    ? /** @type {{ t: string }[]} */ (cumulativeFlowData.buckets)
    : [];
  const timeDomain = sharedTimeDomain(buckets, cyclePoints, [
    ...stackBuckets,
    ...cumulativeBuckets,
  ]);
  const totalClosedCards = buckets.reduce(
    (sum, b) => sum + (Number(b.n) || 0),
    0
  );
  const medianDays =
    typeof cycleData.medianDays === "number" ? cycleData.medianDays : null;
  const stdevDays =
    typeof cycleData.stdevDays === "number" ? cycleData.stdevDays : null;
  const cycleCount = Number(cycleData.count) || 0;
  const ageMedianDays =
    typeof ageDistData.medianDays === "number" ? ageDistData.medianDays : null;
  const ageCount = Number(ageDistData.count) || 0;

  const root = document.createElement("div");
  root.className = "board-shell charts-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";

  const brand = createMillraceBrandMark();

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
  topLeft.append(brand, titleOrPicker, toolbar);

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

  const svgScatter = renderScatterSvg(buckets, granularity, timeDomain);

  const completionStats = document.createElement("div");
  completionStats.className = "charts-cycle-stats";
  const completionTotalRow = document.createElement("span");
  completionTotalRow.className = "charts-stat";
  const completionTotalN = document.createElement("strong");
  completionTotalN.textContent = String(totalClosedCards);
  completionTotalRow.append("Total ", completionTotalN, " closed cards");
  completionStats.append(completionTotalRow);

  const cardScatter = createChartCard({
    title: "Completions",
    note:
      "Cards closed in the selected period (UTC buckets)",
    svgElement: svgScatter,
    footer: completionStats,
    afterChart: [completionStats],
  });

  const svgStack = renderStackedAreaSvg(
    swimlaneStackData,
    granularity,
    timeDomain
  );
  const stackLegend = renderSwimlaneStackLegend(swimlaneStackData);
  const cardStack = createChartCard({
    title: "Completions by swimlane",
    note: "Completions: cards closed grouped by swimlane.",
    svgElement: svgStack,
    footer: stackLegend,
    afterChart: [stackLegend],
  });

  const cumulativeFlowSeries = Array.isArray(cumulativeFlowData.series)
    ? /** @type {{ key: string, label: string, index: number }[]} */ (
        cumulativeFlowData.series
      )
    : [];
  const cumulativeFlowPayload = {
    ...cumulativeFlowData,
    stackSeries: cumulativeFlowStackSeries(cumulativeFlowSeries),
    yAxisLabel: "Cards",
    xAxisLabel: "Period (UTC)",
    emptyLabel: "No snapshot or completion data yet.",
    ariaLabel: `Cumulative flow by column per ${granularity} period (UTC buckets)`,
  };
  const svgCumulativeFlow = renderStackedAreaSvg(
    cumulativeFlowPayload,
    granularity,
    timeDomain
  );
  const cumulativeLegend = renderSwimlaneStackLegend(cumulativeFlowData);
  const cardCumulativeFlow = createChartCard({
    title: "Cumulative flow",
    note:
      "Column counts from snapshots; done is a running total of cards closed each period.",
    svgElement: svgCumulativeFlow,
    footer: cumulativeLegend,
    afterChart: [cumulativeLegend],
  });

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

  const svgCycle = renderCycleScatterSvg(cycleData, granularity, timeDomain);
  const cardCycle = createChartCard({
    title: "Cycle time (created → closed)",
    note:
      "Shaded bands show median ± one standard deviation for each close period",
    svgElement: svgCycle,
    footer: stats,
    afterChart: [stats],
  });

  const svgColumnStack = renderStackedColumnSvg(columnStackData);
  const columnLegend = renderSwimlaneStackLegend(columnStackData);
  const columnFooter = document.createElement("div");
  columnFooter.className = "charts-column-footer";
  columnFooter.append(columnLegend);

  const cardColumnStack = createChartCard({
    title: "Open cards by column",
    note: "Open cards on the board, stacked by swimlane",
    svgElement: svgColumnStack,
    footer: columnFooter,
    afterChart: [columnLegend],
  });

  const svgAge = renderAgeDistributionSvg(ageDistData);
  const ageStats = document.createElement("div");
  ageStats.className = "charts-cycle-stats";
  const ageMed = document.createElement("span");
  ageMed.className = "charts-stat";
  const ageMedK = document.createElement("strong");
  ageMedK.textContent = fmtDays(ageMedianDays);
  ageMed.append("Median ", ageMedK);
  const ageN = document.createElement("span");
  ageN.className = "charts-stat";
  const ageNK = document.createElement("strong");
  ageNK.textContent = String(ageCount);
  ageN.append("n = ", ageNK);
  ageStats.append(ageMed, ageN);

  const cardAge = createChartCard({
    title: "Age of open cards",
    note: "Age of open cards in UTC days (today − created)",
    svgElement: svgAge,
    footer: ageStats,
    afterChart: [ageStats],
  });

  const dashboard = document.createElement("div");
  dashboard.className = "charts-dashboard";
  dashboard.append(
    cardScatter,
    cardStack,
    cardCumulativeFlow,
    cardCycle,
    cardColumnStack,
    cardAge
  );

  body.append(dashboard);
  root.append(top, body);
  return root;
}

async function main() {
  void initFlowTheme();
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

  setFlowDocumentTitle("Charts");
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
    let model = parseBoardIni(text);
    model = enrichAggregateBoardModel(model, boards);
    if (model.columns.length === 0) {
      mount.innerHTML = `<div class="app-error">No columns found in board.ini.</div>`;
      return;
    }
    const boardSlug = boardSlugFrom(model.board);
    const [
      completionData,
      cycleData,
      swimlaneStackData,
      cumulativeFlowData,
      columnStackData,
      ageDistData,
    ] = await Promise.all([
      fetchCompletionBuckets(boardSlug, granularity),
      fetchCycleTimeScatter(boardSlug, granularity),
      fetchCompletionSwimlaneStack(boardSlug, granularity),
      fetchCumulativeFlowStack(boardSlug, granularity),
      fetchColumnSwimlaneStack(boardSlug),
      fetchCardAgeDistribution(boardSlug),
    ]);

    mount.replaceChildren();
    mount.append(
      renderChartsShell(
        model,
        granularity,
        completionData,
        cycleData,
        swimlaneStackData,
        cumulativeFlowData,
        columnStackData,
        ageDistData,
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
