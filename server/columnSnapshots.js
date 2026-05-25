import fs from "fs/promises";
import {
  columnIsDone,
  columnTypeOf,
} from "../assets/js/models/boardModel.js";
import {
  aggregateCompletionBuckets,
  bucketStartMsForGranularity,
  gatherOpenBoardRows,
} from "./archiveAnalytics.js";
import { loadBoardCatalog, loadBoardColumnAndSwimlaneDefsForSlug, loadBoardModelForSlug } from "./boardCatalog.js";
import {
  isAggregateBoard,
} from "../assets/js/models/aggregateBoard.js";
import { snapshotsJsonPath } from "./dataRoot.js";

/** Reserved top-level key for snapshot settings (not a board slug). */
export const SNAPSHOTS_SETTINGS_KEY = "settings";

/**
 * @typedef {{ name: string, type: string, count: number }} ColumnCountSnapshot
 * @typedef {{ date: string, columns: ColumnCountSnapshot[] }} BoardColumnSnapshot
 * @typedef {{ boards?: string[] }} SnapshotsSettings
 * @typedef {{ settings: SnapshotsSettings, boardSnapshots: Record<string, BoardColumnSnapshot[]> }} SnapshotsDocument
 */

/**
 * @param {number} [ms]
 * @returns {string} UTC calendar date `YYYY-MM-DD`
 */
export function utcSnapshotDateString(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {SnapshotsSettings | undefined} settings
 * @returns {string[] | null} `null` = all non-aggregate catalog boards
 */
export function boardSlugsFromSnapshotSettings(settings) {
  const raw = settings?.boards;
  if (!Array.isArray(raw)) return null;
  const list = raw.map((s) => String(s).trim()).filter(Boolean);
  return list.length > 0 ? list : null;
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
 * @returns {SnapshotsDocument}
 */
export function parseSnapshotsDocument(raw) {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};
  const settingsRaw =
    data[SNAPSHOTS_SETTINGS_KEY] && typeof data[SNAPSHOTS_SETTINGS_KEY] === "object"
      ? /** @type {SnapshotsSettings} */ (data[SNAPSHOTS_SETTINGS_KEY])
      : {};
  const settings = {
    boards: Array.isArray(settingsRaw.boards)
      ? settingsRaw.boards.map((s) => String(s).trim()).filter(Boolean)
      : [],
  };

  /** @type {Record<string, BoardColumnSnapshot[]>} */
  const boardSnapshots = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === SNAPSHOTS_SETTINGS_KEY || !Array.isArray(value)) continue;
    boardSnapshots[key] = value.map(normalizeBoardSnapshot);
  }

  return { settings, boardSnapshots };
}

/**
 * @param {SnapshotsSettings} settings
 * @param {Record<string, BoardColumnSnapshot[]>} boardSnapshots
 * @returns {string}
 */
export function serializeSnapshotsDocument(settings, boardSnapshots) {
  /** @type {Record<string, unknown>} */
  const out = {
    [SNAPSHOTS_SETTINGS_KEY]: {
      boards: settings.boards ?? [],
    },
  };

  const slugs = Object.keys(boardSnapshots).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  for (const slug of slugs) {
    out[slug] = boardSnapshots[slug] ?? [];
  }

  return `${JSON.stringify(out, null, 2)}\n`;
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

/**
 * @param {{
 *   readFile?: typeof fs.readFile;
 * }} [deps]
 * @returns {Promise<SnapshotsDocument>}
 */
export async function loadSnapshotsDocument(deps = {}) {
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  try {
    const text = await readFile(snapshotsJsonPath(), "utf8");
    return parseSnapshotsDocument(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    return { settings: { boards: [] }, boardSnapshots: {} };
  }
}

/**
 * Cumulative flow stack: WIP column counts from snapshots, cumulative done from completions.
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 * @param {{
 *   loadSnapshotsDocument?: typeof loadSnapshotsDocument;
 *   aggregateCompletionBuckets?: typeof aggregateCompletionBuckets;
 *   loadBoardColumnAndSwimlaneDefsForSlug?: typeof loadBoardColumnAndSwimlaneDefsForSlug;
 *   loadBoardModelForSlug?: typeof loadBoardModelForSlug;
 * }} [deps]
 */
export async function buildCumulativeFlowStack(slug, granularity, deps = {}) {
  const loadDoc = deps.loadSnapshotsDocument ?? loadSnapshotsDocument;
  const completionBucketsFn =
    deps.aggregateCompletionBuckets ?? aggregateCompletionBuckets;
  const loadColsFn =
    deps.loadBoardColumnAndSwimlaneDefsForSlug ??
    loadBoardColumnAndSwimlaneDefsForSlug;
  const loadModelFn = deps.loadBoardModelForSlug ?? loadBoardModelForSlug;

  const [model, { columns }, doc, completionBuckets] = await Promise.all([
    loadModelFn(slug),
    loadColsFn(slug),
    loadDoc(),
    completionBucketsFn(slug, granularity),
  ]);

  const aggregate = isAggregateBoard(model);
  const matchSnapshotsByType = aggregate;
  const snapshots = aggregate
    ? mergeSourceBoardSnapshotsByType(
        (model.sources ?? [])
          .map((src) => String(src.slug ?? "").trim())
          .filter(Boolean),
        doc.boardSnapshots
      )
    : doc.boardSnapshots[slug] ?? [];

  const wipCols = [...columns]
    .filter((col) => !columnIsDone(col))
    .sort((a, b) => a.index - b.index);
  const doneCol = columns.find((col) => columnIsDone(col));
  const doneLabel = String(doneCol?.title ?? "").trim() || "Done";

  const series = [
    ...wipCols.map((col) => ({
      key: String(col.index),
      label: String(col.title ?? "").trim() || `Column ${col.index}`,
      index: col.index,
    })),
    { key: "done", label: doneLabel, index: 9999 },
  ];

  /** @type {Map<number, BoardColumnSnapshot>} */
  const snapshotByBucket = new Map();
  for (const snap of snapshots) {
    const ms = snapshotDateToUtcMs(snap.date);
    if (!Number.isFinite(ms)) continue;
    const bucketMs = bucketStartMsForGranularity(ms, granularity);
    const existing = snapshotByBucket.get(bucketMs);
    if (!existing || snap.date >= existing.date) {
      snapshotByBucket.set(bucketMs, snap);
    }
  }

  /** @type {Set<number>} */
  const bucketKeys = new Set();
  for (const b of completionBuckets) {
    const ms = Date.parse(b.t);
    if (Number.isFinite(ms)) bucketKeys.add(ms);
  }
  for (const bm of snapshotByBucket.keys()) bucketKeys.add(bm);

  if (bucketKeys.size === 0) {
    return { series, buckets: [] };
  }

  const sortedKeys = [...bucketKeys].sort((a, b) => a - b);
  const allBuckets = enumerateBucketRange(
    sortedKeys[0],
    sortedKeys[sortedKeys.length - 1],
    granularity
  );

  /** @type {Map<number, number>} */
  const completionsByBucket = new Map();
  for (const b of completionBuckets) {
    const ms = Date.parse(b.t);
    if (Number.isFinite(ms)) completionsByBucket.set(ms, b.n);
  }

  /** @type {Record<string, number>} */
  const lastWip = Object.fromEntries(
    wipCols.map((col) => [String(col.index), 0])
  );
  let cumulativeDone = 0;
  /** @type {{ t: string, counts: Record<string, number> }[]} */
  const buckets = [];

  for (const bm of allBuckets) {
    cumulativeDone += completionsByBucket.get(bm) ?? 0;

    const snap = snapshotByBucket.get(bm);
    if (snap) {
      for (const col of wipCols) {
        lastWip[String(col.index)] = wipCountFromSnapshot(snap, col, {
          byType: matchSnapshotsByType,
        });
      }
    }

    /** @type {Record<string, number>} */
    const counts = { ...lastWip, done: cumulativeDone };
    buckets.push({ t: new Date(bm).toISOString(), counts });
  }

  return { series, buckets };
}

/**
 * @param {{
 *   loadBoardCatalog?: typeof loadBoardCatalog;
 *   captureInFlightColumnCountsForSlug?: typeof captureInFlightColumnCountsForSlug;
 *   readFile?: typeof fs.readFile;
 *   writeFile?: typeof fs.writeFile;
 *   nowMs?: () => Promise<number>;
 * }} [deps]
 * @returns {Promise<boolean>} whether `snapshots.json` was rewritten
 */
export async function captureTodayColumnSnapshots(deps = {}) {
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;
  const captureFn =
    deps.captureInFlightColumnCountsForSlug ?? captureInFlightColumnCountsForSlug;
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  const writeFile = deps.writeFile ?? fs.writeFile.bind(fs);
  const nowMs = deps.nowMs ?? (async () => Date.now());

  const jsonPath = snapshotsJsonPath();
  let doc = await loadSnapshotsDocument({ readFile });

  const catalog = await loadCatalog();
  const filter = boardSlugsFromSnapshotSettings(doc.settings);
  const boards = catalog.filter((entry) => {
    if (entry.kind === "aggregate") return false;
    if (!filter) return true;
    return filter.includes(entry.slug);
  });

  const boardSnapshots = { ...doc.boardSnapshots };
  for (const entry of boards) {
    const today = await captureFn(entry.slug, nowMs);
    boardSnapshots[entry.slug] = upsertTodayBoardSnapshot(
      boardSnapshots[entry.slug] ?? [],
      today
    );
  }

  const nextText = serializeSnapshotsDocument(doc.settings, boardSnapshots);
  let previous = "";
  try {
    previous = await readFile(jsonPath, "utf8");
  } catch {
    /* new file */
  }
  if (previous === nextText) return false;
  await writeFile(jsonPath, nextText, "utf8");
  return true;
}
