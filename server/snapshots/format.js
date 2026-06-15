import {
  columnIsDone,
  columnTypeOf,
} from "../../assets/js/models/boardModel.js";
import { bucketStartMsForGranularity } from "../analytics/time.js";
import { gatherOpenBoardRows } from "../analytics/cardRows/openBoard.js";
import { loadBoardColumnAndSwimlaneDefsForSlug } from "../board/model.js";

/** Reserved top-level key in legacy `tasks/.millrace/snapshots.json`. */
export const SNAPSHOTS_SETTINGS_KEY = "settings";

/**
 * @typedef {{ name: string, type: string, count: number }} ColumnCountSnapshot
 * @typedef {{ date: string, columns: ColumnCountSnapshot[] }} BoardColumnSnapshot
 * @typedef {Record<string, BoardColumnSnapshot[]>} BoardSnapshotsBySlug
 */

/**
 * @param {number} [ms]
 * @returns {string} UTC calendar date `YYYY-MM-DD`
 */
export function utcSnapshotDateString(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {unknown} snap
 * @returns {BoardColumnSnapshot}
 */
export function normalizeBoardSnapshot(snap) {
  const o = snap && typeof snap === "object" ? /** @type {Record<string, unknown>} */ (snap) : {};
  const columnsRaw = Array.isArray(o.columns) ? o.columns : [];
  /** @type {ColumnCountSnapshot[]} */
  const columns = [];
  for (const col of columnsRaw) {
    if (!col || typeof col !== "object") continue;
    const c = /** @type {Record<string, unknown>} */ (col);
    columns.push({
      name: String(c.name ?? "").trim(),
      type: String(c.type ?? "").trim(),
      count: Number(c.count) || 0,
    });
  }
  return {
    date: String(o.date ?? "").trim(),
    columns,
  };
}

/**
 * @param {unknown} raw
 * @returns {BoardColumnSnapshot[]}
 */
export function parseBoardSnapshotsFile(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(normalizeBoardSnapshot);
}

/**
 * @param {BoardColumnSnapshot[]} snapshots
 * @returns {string}
 */
export function serializeBoardSnapshots(snapshots) {
  return `${JSON.stringify(snapshots, null, 2)}\n`;
}

/**
 * Parse legacy monolithic `tasks/.millrace/snapshots.json`.
 * @param {unknown} raw
 * @returns {BoardSnapshotsBySlug}
 */
export function parseSnapshotsDocument(raw) {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};

  /** @type {BoardSnapshotsBySlug} */
  const boardSnapshots = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === SNAPSHOTS_SETTINGS_KEY || !Array.isArray(value)) continue;
    boardSnapshots[key] = value.map(normalizeBoardSnapshot);
  }

  return boardSnapshots;
}

/**
 * @param {string} slug
 * @param {() => Promise<number>} [nowMs]
 * @returns {Promise<BoardColumnSnapshot>}
 */
export async function captureInFlightColumnCountsForSlug(
  slug,
  nowMs = async () => Date.now()
) {
  const { columns } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const rows = await gatherOpenBoardRows(slug);
  const colList = [...columns]
    .filter((col) => !columnIsDone(col))
    .sort((a, b) => a.index - b.index);

  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const row of rows) {
    const idx = row.columnIndex;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }

  return {
    date: utcSnapshotDateString(await nowMs()),
    columns: colList.map((col) => ({
      name: String(col.title ?? "").trim() || `Column ${col.index}`,
      type: columnTypeOf(col),
      count: counts.get(col.index) ?? 0,
    })),
  };
}

/**
 * Replace today's snapshot for `slug` or append a new dated entry.
 * @param {BoardColumnSnapshot[]} existing
 * @param {BoardColumnSnapshot} today
 */
export function upsertTodayBoardSnapshot(existing, today) {
  const next = [...existing];
  const idx = next.findIndex((snap) => snap.date === today.date);
  if (idx >= 0) {
    next[idx] = today;
    return next;
  }
  next.push(today);
  return next;
}

/**
 * Sum source-board snapshots into one series per date, keyed by column type.
 * @param {string[]} sourceSlugs
 * @param {Record<string, BoardColumnSnapshot[]>} boardSnapshots
 * @returns {BoardColumnSnapshot[]}
 */
export function mergeSourceBoardSnapshotsByType(
  sourceSlugs,
  boardSnapshots
) {
  /** @type {Map<string, Map<string, number>>} date → type → count */
  const byDate = new Map();

  for (const sourceSlug of sourceSlugs) {
    for (const snap of boardSnapshots[sourceSlug] ?? []) {
      if (!byDate.has(snap.date)) byDate.set(snap.date, new Map());
      const typeCounts = byDate.get(snap.date);
      for (const col of snap.columns) {
        const type = String(col.type ?? "").trim().toLowerCase();
        if (!type || type === "done") continue;
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + (Number(col.count) || 0));
      }
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, typeCounts]) => ({
      date,
      columns: [...typeCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => ({
          name: type,
          type,
          count,
        })),
    }));
}

/**
 * @param {BoardColumnSnapshot} snap
 * @param {import("../assets/js/models/boardModel.js").ColumnDef} col
 * @param {{ byType?: boolean }} [opts]
 */
export function wipCountFromSnapshot(snap, col, opts = {}) {
  if (opts.byType) {
    const type = columnTypeOf(col);
    let sum = 0;
    for (const entry of snap.columns) {
      if (String(entry.type ?? "").trim().toLowerCase() === type) {
        sum += Number(entry.count) || 0;
      }
    }
    return sum;
  }
  const title = String(col.title ?? "").trim();
  const hit = snap.columns.find((c) => String(c.name).trim() === title);
  return hit?.count ?? 0;
}

/**
 * @param {number} bucketMs
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export function nextBucketStartMs(bucketMs, granularity) {
  if (granularity === "monthly") {
    const d = new Date(bucketMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  if (granularity === "weekly") {
    return bucketMs + 7 * 86400000;
  }
  return bucketMs + 86400000;
}

/**
 * @param {number} minMs
 * @param {number} maxMs
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export function enumerateBucketRange(minMs, maxMs, granularity) {
  const out = [];
  let cur = bucketStartMsForGranularity(minMs, granularity);
  const end = bucketStartMsForGranularity(maxMs, granularity);
  while (cur <= end) {
    out.push(cur);
    cur = nextBucketStartMs(cur, granularity);
  }
  return out;
}

/**
 * @param {string} dateStr `YYYY-MM-DD`
 */
export function snapshotDateToUtcMs(dateStr) {
  return Date.parse(`${String(dateStr).trim()}T00:00:00.000Z`);
}
