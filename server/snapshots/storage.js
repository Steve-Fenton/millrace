import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { columnIsDone } from "../../assets/js/models/boardModel.js";
import { aggregateCompletionBuckets } from "../analytics/completionCharts.js";
import { bucketStartMsForGranularity } from "../analytics/time.js";
import { loadBoardCatalog } from "../board/catalog.js";
import {
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardModelForSlug,
} from "../board/model.js";
import { isAggregateBoard } from "../../assets/js/models/aggregateBoard.js";
import { SNAPSHOTS_JSON_BASENAME } from "../constants.js";
import {
  boardSnapshotsJsonPath,
  dataRoot,
  legacySnapshotsJsonPath,
  millraceDataDirPath,
} from "../dataRoot.js";
import {
  captureInFlightColumnCountsForSlug,
  enumerateBucketRange,
  mergeSourceBoardSnapshotsByType,
  nextBucketStartMs,
  parseBoardSnapshotsFile,
  parseSnapshotsDocument,
  serializeBoardSnapshots,
  snapshotDateToUtcMs,
  upsertTodayBoardSnapshot,
  wipCountFromSnapshot,
} from "./format.js";

/**
 * @param {{
 *   readdir?: typeof fs.readdir;
 * }} [deps]
 * @returns {Promise<string[]>} board slugs with `tasks/{slug}/snapshots.json`
 */
export async function discoverBoardSnapshotSlugs(deps = {}) {
  const readdir = deps.readdir ?? fs.readdir.bind(fs);
  const tasksDir = path.join(dataRoot(), "tasks");
  /** @type {string[]} */
  const slugs = [];
  let dirents;
  try {
    dirents = await readdir(tasksDir, { withFileTypes: true });
  } catch {
    return slugs;
  }
  for (const ent of dirents) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const snapPath = path.join(tasksDir, ent.name, SNAPSHOTS_JSON_BASENAME);
    if (existsSync(snapPath)) slugs.push(ent.name);
  }
  return slugs.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * @param {string} slug
 * @param {{
 *   readFile?: typeof fs.readFile;
 * }} [deps]
 * @returns {Promise<BoardColumnSnapshot[]>}
 */
export async function loadBoardSnapshotsForSlug(slug, deps = {}) {
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  try {
    const text = await readFile(boardSnapshotsJsonPath(slug), "utf8");
    return parseBoardSnapshotsFile(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    return [];
  }
}

/**
 * @param {{
 *   discoverBoardSnapshotSlugs?: typeof discoverBoardSnapshotSlugs;
 *   loadBoardSnapshotsForSlug?: typeof loadBoardSnapshotsForSlug;
 *   loadBoardCatalog?: typeof loadBoardCatalog;
 * }} [deps]
 * @returns {Promise<BoardSnapshotsBySlug>}
 */
export async function loadSnapshotsDocument(deps = {}) {
  const discoverSlugs = deps.discoverBoardSnapshotSlugs ?? discoverBoardSnapshotSlugs;
  const loadBoardSnaps =
    deps.loadBoardSnapshotsForSlug ?? loadBoardSnapshotsForSlug;
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;

  const [discovered, catalog] = await Promise.all([discoverSlugs(), loadCatalog()]);

  const slugSet = new Set(discovered);
  for (const entry of catalog) {
    if (entry.kind === "aggregate") continue;
    slugSet.add(entry.slug);
  }

  /** @type {BoardSnapshotsBySlug} */
  const boardSnapshots = {};
  await Promise.all(
    [...slugSet].map(async (slug) => {
      boardSnapshots[slug] = await loadBoardSnaps(slug);
    })
  );

  return boardSnapshots;
}

/** Obsolete settings file from an earlier per-board snapshot layout. */
const OBSOLETE_SNAPSHOT_SETTINGS_BASENAME = "snapshot-settings.json";

/**
 * Move legacy `tasks/.millrace/snapshots.json` into per-board files.
 * @param {{
 *   readFile?: typeof fs.readFile;
 *   writeFile?: typeof fs.writeFile;
 *   unlink?: typeof fs.unlink;
 *   mkdir?: typeof fs.mkdir;
 * }} [deps]
 * @returns {Promise<boolean>} whether migration ran
 */
export async function migrateLegacySnapshotsJson(deps = {}) {
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  const writeFile = deps.writeFile ?? fs.writeFile.bind(fs);
  const unlink = deps.unlink ?? fs.unlink.bind(fs);
  const mkdir = deps.mkdir ?? fs.mkdir.bind(fs);

  const legacyPath = legacySnapshotsJsonPath();
  let text;
  try {
    text = await readFile(legacyPath, "utf8");
  } catch {
    return false;
  }

  const boardSnapshots = parseSnapshotsDocument(
    JSON.parse(text.replace(/^\uFEFF/, ""))
  );

  for (const [slug, snapshots] of Object.entries(boardSnapshots)) {
    const boardDir = path.join(dataRoot(), "tasks", slug);
    await mkdir(boardDir, { recursive: true });
    await writeFile(
      boardSnapshotsJsonPath(slug),
      serializeBoardSnapshots(snapshots),
      "utf8"
    );
  }

  await unlink(legacyPath);
  return true;
}

/**
 * Remove obsolete `snapshot-settings.json` if present.
 * @param {{ unlink?: typeof fs.unlink }} [deps]
 */
export async function removeObsoleteSnapshotSettings(deps = {}) {
  const unlink = deps.unlink ?? fs.unlink.bind(fs);
  try {
    await unlink(
      path.join(millraceDataDirPath(), OBSOLETE_SNAPSHOT_SETTINGS_BASENAME)
    );
  } catch {
    /* absent */
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
        doc
      )
    : doc[slug] ?? [];

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
 *   loadBoardSnapshotsForSlug?: typeof loadBoardSnapshotsForSlug;
 *   readFile?: typeof fs.readFile;
 *   writeFile?: typeof fs.writeFile;
 *   mkdir?: typeof fs.mkdir;
 *   nowMs?: () => Promise<number>;
 * }} [deps]
 * @returns {Promise<boolean>} whether any board `snapshots.json` was rewritten
 */
export async function captureTodayColumnSnapshots(deps = {}) {
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;
  const captureFn =
    deps.captureInFlightColumnCountsForSlug ?? captureInFlightColumnCountsForSlug;
  const loadBoardSnaps =
    deps.loadBoardSnapshotsForSlug ?? loadBoardSnapshotsForSlug;
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  const writeFile = deps.writeFile ?? fs.writeFile.bind(fs);
  const mkdir = deps.mkdir ?? fs.mkdir.bind(fs);
  const nowMs = deps.nowMs ?? (async () => Date.now());

  const catalog = await loadCatalog();
  const boards = catalog.filter((entry) => entry.kind !== "aggregate");

  let anyWritten = false;
  for (const entry of boards) {
    const today = await captureFn(entry.slug, nowMs);
    const existing = await loadBoardSnaps(entry.slug, { readFile });
    const next = upsertTodayBoardSnapshot(existing, today);
    const nextText = serializeBoardSnapshots(next);
    const jsonPath = boardSnapshotsJsonPath(entry.slug);

    let previous = "";
    try {
      previous = await readFile(jsonPath, "utf8");
    } catch {
      /* new file */
    }
    if (previous === nextText) continue;

    await mkdir(path.dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, nextText, "utf8");
    anyWritten = true;
  }

  return anyWritten;
}
