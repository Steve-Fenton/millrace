import { resolveCardSwimlaneIndex } from "../../assets/js/ini/swimlaneResolve.js";
import { columnIsDone } from "../../assets/js/models/boardModel.js";
import { loadBoardColumnAndSwimlaneDefsForSlug } from "../board/model.js";
import { gatherOpenBoardRows } from "./cardRows/openBoard.js";
import { medianSample } from "./cycleTime.js";
import { MS_PER_DAY, parseIsoMs, utcDayStartMs } from "./time.js";

/**
 * Open-card counts per column, stacked by swimlane (snapshot of the live board).
 * @param {string} slug
 */
export async function aggregateColumnSwimlaneStack(slug) {
  const { columns, swimlanes } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const rows = await gatherOpenBoardRows(slug);

  /** @type {Map<number, Map<number, number>>} column index → lane index → count */
  const byColumn = new Map();

  for (const row of rows) {
    const colIdx = row.columnIndex;
    const laneIdx = resolveCardSwimlaneIndex(
      /** @type {string | undefined} */ (row.swimlane),
      swimlanes
    );
    if (!byColumn.has(colIdx)) byColumn.set(colIdx, new Map());
    const inner = byColumn.get(colIdx);
    inner.set(laneIdx, (inner.get(laneIdx) ?? 0) + 1);
  }

  /** @type {Set<number>} */
  const usedLanes = new Set();
  for (const m of byColumn.values()) {
    for (const k of m.keys()) usedLanes.add(k);
  }
  const fromDef = swimlanes.map((l) => l.index);
  const laneIndices = [...new Set([...fromDef, ...usedLanes])].sort(
    (a, b) => a - b
  );

  /**
   * @param {number} i
   */
  function labelForLaneIndex(i) {
    const lane = swimlanes.find((l) => l.index === i);
    const t = lane?.title && String(lane.title).trim();
    if (t) return t;
    if (!swimlanes.length) return "Cards";
    return `Lane ${i}`;
  }

  const series =
    laneIndices.length > 0
      ? laneIndices.map((index) => ({
          key: String(index),
          label: labelForLaneIndex(index),
          index,
        }))
      : [{ key: "0", label: "Cards", index: 0 }];

  const colList = [...columns]
    .filter((col) => !columnIsDone(col))
    .sort((a, b) => a.index - b.index);
  const columnPayload = colList.map((col) => {
    const inner = byColumn.get(col.index) ?? new Map();
    /** @type {Record<string, number>} */
    const counts = {};
    for (const s of series) {
      counts[s.key] = inner.get(s.index) ?? 0;
    }
    return {
      key: String(col.index),
      label: String(col.title ?? "").trim() || `Column ${col.index}`,
      index: col.index,
      counts,
    };
  });

  return { series, columns: columnPayload, totalOpen: rows.length };
}

/**
 * @param {number} maxAgeDays
 */
function chooseAgeBinWidthDays(maxAgeDays) {
  if (maxAgeDays <= 14) return 1;
  if (maxAgeDays <= 60) return 7;
  if (maxAgeDays <= 180) return 14;
  return 30;
}

/**
 * @param {number} lo
 * @param {number} hi
 */
function formatAgeBinLabel(lo, hi) {
  if (hi - lo <= 1) return `${lo} d`;
  return `${lo}–${hi - 1} d`;
}

/**
 * Histogram of open-card age in whole UTC days (today − created).
 * @param {string} slug
 */
export async function buildCardAgeDistribution(slug) {
  const rows = await gatherOpenBoardRows(slug);
  const todayMs = utcDayStartMs(Date.now());
  /** @type {number[]} */
  const ages = [];

  for (const row of rows) {
    const createdMs = parseIsoMs(row.created);
    if (createdMs == null) continue;
    const ageDays = (todayMs - utcDayStartMs(createdMs)) / MS_PER_DAY;
    if (!Number.isFinite(ageDays) || ageDays < 0) continue;
    ages.push(ageDays);
  }

  if (ages.length === 0) {
    return {
      bins: [],
      binWidthDays: 7,
      medianDays: null,
      count: 0,
    };
  }

  const maxAge = Math.max(...ages);
  const binWidthDays = chooseAgeBinWidthDays(maxAge);
  const binCount = Math.max(1, Math.ceil((maxAge + 1) / binWidthDays));

  /** @type {{ lo: number, hi: number, n: number, label: string }[]} */
  const bins = [];
  for (let i = 0; i < binCount; i++) {
    const lo = i * binWidthDays;
    const hi = lo + binWidthDays;
    const n = ages.filter((a) => a >= lo && a < hi).length;
    if (n > 0 || i === binCount - 1) {
      bins.push({ lo, hi, n, label: formatAgeBinLabel(lo, hi) });
    }
  }

  return {
    bins,
    binWidthDays,
    medianDays: medianSample(ages),
    count: ages.length,
  };
}
