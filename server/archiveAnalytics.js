import fs from "fs/promises";
import path from "path";
import { MS_PER_MONTH } from "./constants.js";
import { readMillraceCatalogRetentionSettings } from "./catalogRetention.js";
import { dataRoot } from "./dataRoot.js";
import { ensureDir } from "./fsUtil.js";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import { parseTaskCardIni } from "../assets/js/models/taskModel.js";
import {
  loadBoardCatalog,
  loadBoardColumnAndSwimlaneDefsForSlug,
} from "./boardCatalog.js";

export async function archiveStaleClosedTaskFiles(slug, maxAgeDays) {
  if (maxAgeDays <= 0) return 0;

  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const archiveDir = path.join(boardRoot, "archive");
  const msCutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  let dirents;
  try {
    dirents = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    return 0;
  }

  let moved = 0;
  for (const ent of dirents) {
    if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;

    const src = path.join(boardRoot, ent.name);
    let raw;
    try {
      raw = await fs.readFile(src, "utf8");
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = parseTaskCardIni(raw);
    } catch {
      continue;
    }

    const closedMs = parseIsoMs(parsed.closed);
    if (closedMs == null || closedMs > msCutoff) continue;

    await ensureDir(archiveDir);
    const dest = path.join(archiveDir, ent.name);
    try {
      await fs.access(dest);
      console.warn(
        `[flow] archive: skipped ${ent.name} — already exists in archive/`
      );
      continue;
    } catch {
      /* available */
    }

    try {
      await fs.rename(src, dest);
      moved++;
      console.error(`[flow] Archived closed task (>${maxAgeDays}d): ${slug}/${ent.name}`);
    } catch (e) {
      console.warn("[flow] archive: could not move", ent.name, e);
    }
  }

  return moved;
}

/** @type {Map<string, Promise<void>>} */
const archiveStaleInFlight = new Map();

/**
 * @param {string} slug
 */
export async function runArchiveStaleClosedForSlug(slug) {
  let p = archiveStaleInFlight.get(slug);
  if (p) return p;

  p = (async () => {
    const { archiveClosedAfterDays, coldStorageArchiveAfterMonths } =
      await readMillraceCatalogRetentionSettings();
    await archiveStaleClosedTaskFiles(slug, archiveClosedAfterDays);
    await moveStaleArchiveFilesToColdStorage(
      slug,
      coldStorageArchiveAfterMonths
    );
  })().finally(() => {
    archiveStaleInFlight.delete(slug);
  });

  archiveStaleInFlight.set(slug, p);
  return p;
}

/**
 * Archive stale closed cards and cold-storage moves — once per board at process start.
 * Avoids doing this on every column / completed-cards request (parallel column loads
 * were each queuing work and made the board feel slow).
 */
export async function runStartupArchiveStaleForCatalogSlugs() {
  try {
    const catalog = await loadBoardCatalog();
    const slugs = [...new Set(catalog.map((e) => e.slug))];
    for (const slug of slugs) {
      await runArchiveStaleClosedForSlug(slug);
    }
  } catch (e) {
    console.error("[flow] startup archive:", e);
  }
}
export function parseIsoMs(raw) {
  const t = raw && String(raw).trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Move `tasks/{slug}/archive/*.ini` whose `closed` is older than `ageMonths` into `tasks/{slug}/cold-storage/{year}/`.
 * `year` is the UTC calendar year of `closed`. Files without a parseable `closed` are left in archive.
 * @returns {Promise<number>} files moved
 */
export async function moveStaleArchiveFilesToColdStorage(slug, ageMonths) {
  if (ageMonths <= 0) return 0;

  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const archiveDir = path.join(boardRoot, "archive");
  const coldDir = path.join(boardRoot, "cold-storage");
  const cutoff = Date.now() - ageMonths * MS_PER_MONTH;

  let dirents;
  try {
    dirents = await fs.readdir(archiveDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let moved = 0;
  for (const ent of dirents) {
    if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;

    const src = path.join(archiveDir, ent.name);
    let raw;
    try {
      raw = await fs.readFile(src, "utf8");
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = parseTaskCardIni(raw);
    } catch {
      continue;
    }

    const closedMs = parseIsoMs(parsed.closed);
    if (closedMs == null || !Number.isFinite(closedMs) || closedMs >= cutoff) {
      continue;
    }

    const year = new Date(closedMs).getUTCFullYear();
    if (!Number.isFinite(year)) continue;

    const yearDir = path.join(coldDir, String(year));
    await ensureDir(yearDir);
    const dest = path.join(yearDir, ent.name);
    try {
      await fs.access(dest);
      console.warn(
        `[flow] cold-storage: skipped ${ent.name} — already exists in cold-storage/${year}/`
      );
      continue;
    } catch {
      /* available */
    }

    try {
      await fs.rename(src, dest);
      moved++;
      console.error(
        `[flow] cold-storage: moved from archive (>${ageMonths}mo): ${slug}/archive/${ent.name} → cold-storage/${year}/`
      );
    } catch (e) {
      console.warn("[flow] cold-storage: could not move", ent.name, e);
    }
  }

  return moved;
}

/**
 * Board cards with `closed` plus `archive/*.ini` (not `cold-storage/**`), merged and sorted by completion time (newest first).
 * @param {string} slug
 */
export async function gatherCompletedAndArchiveRows(slug) {
  const { columns: columnsDef } = await loadBoardColumnAndSwimlaneDefsForSlug(
    slug
  );
  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const archiveDir = path.join(boardRoot, "archive");

  /** @type {Set<string>} */
  const boardSeen = new Set();

  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addBoardIfClosed(fullPath, filename) {
    if (boardSeen.has(filename)) return;
    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch {
      return;
    }
    let parsed;
    try {
      parsed = parseTaskCardIni(raw);
    } catch {
      return;
    }
    const closedMs = parseIsoMs(parsed.closed);
    if (closedMs == null) return;
    boardSeen.add(filename);
    const columnIndex = resolveCardColumnIndex(parsed.column, columnsDef);
    rows.push({
      sortMs: closedMs,
      source: "board",
      filename,
      columnIndex,
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      closed: parsed.closed,
      created: parsed.created,
      links: parsed.links,
    });
  }

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addArchiveCard(fullPath, filename) {
    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch {
      return;
    }
    let parsed;
    try {
      parsed = parseTaskCardIni(raw);
    } catch {
      return;
    }
    let sortMs = parseIsoMs(parsed.closed);
    if (sortMs == null) sortMs = parseIsoMs(parsed.created);
    if (sortMs == null) {
      try {
        const st = await fs.stat(fullPath);
        sortMs = st.mtimeMs;
      } catch {
        sortMs = 0;
      }
    }
    rows.push({
      sortMs,
      source: "archive",
      filename,
      columnIndex: null,
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      closed: parsed.closed,
      created: parsed.created,
      links: parsed.links,
    });
  }

  let rootEntries;
  try {
    rootEntries = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    rootEntries = [];
  }

  for (const ent of rootEntries) {
    if (ent.isFile() && ent.name.endsWith(".ini")) {
      await addBoardIfClosed(path.join(boardRoot, ent.name), ent.name);
    }
  }

  for (const ent of rootEntries) {
    if (!ent.isDirectory() || !/^columns\.\d+$/i.test(ent.name)) continue;
    const colDir = path.join(boardRoot, ent.name);
    let files;
    try {
      files = await fs.readdir(colDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.isFile() && f.name.endsWith(".ini")) {
        await addBoardIfClosed(path.join(colDir, f.name), f.name);
      }
    }
  }

  try {
    const archived = await fs.readdir(archiveDir, { withFileTypes: true });
    for (const f of archived) {
      if (f.isFile() && f.name.endsWith(".ini")) {
        await addArchiveCard(path.join(archiveDir, f.name), f.name);
      }
    }
  } catch {
    /* no archive dir */
  }

  rows.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return String(a.filename).localeCompare(String(b.filename));
  });

  return rows;
}

/**
 * Completed cards under `tasks/{slug}/cold-storage/**` (same row shape as archive; `source: "cold"`).
 * @param {string} slug
 */
export async function gatherColdStorageCardRows(slug) {
  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const coldRoot = path.join(boardRoot, "cold-storage");
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addColdCard(fullPath, filename) {
    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch {
      return;
    }
    let parsed;
    try {
      parsed = parseTaskCardIni(raw);
    } catch {
      return;
    }
    let sortMs = parseIsoMs(parsed.closed);
    if (sortMs == null) sortMs = parseIsoMs(parsed.created);
    if (sortMs == null) {
      try {
        const st = await fs.stat(fullPath);
        sortMs = st.mtimeMs;
      } catch {
        sortMs = 0;
      }
    }
    rows.push({
      sortMs,
      source: "cold",
      filename,
      columnIndex: null,
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      closed: parsed.closed,
      created: parsed.created,
      links: parsed.links,
    });
  }

  /**
   * @param {string} dir
   */
  async function walk(dir) {
    let ents;
    try {
      ents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(p);
      } else if (ent.isFile() && ent.name.endsWith(".ini")) {
        await addColdCard(p, ent.name);
      }
    }
  }

  await walk(coldRoot);
  return rows;
}

/**
 * @param {string} slug
 * @param {boolean} includeColdStorage
 */
export async function gatherCompletedArchiveAndOptionalCold(slug, includeColdStorage) {
  const base = await gatherCompletedAndArchiveRows(slug);
  if (!includeColdStorage) return base;
  const cold = await gatherColdStorageCardRows(slug);
  const merged = [...base, ...cold];
  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return String(a.filename).localeCompare(String(b.filename));
  });
  return merged;
}

/**
 * @param {object} row
 * @param {string} qLower
 */
export function completedRowMatchesSearch(row, qLower) {
  if (!qLower) return true;
  /** @type {(string | undefined)[]} */
  const parts = [
    row.title,
    row.description,
    row.filename,
    row.owner,
    row.id,
    row.created,
    row.closed,
  ];
  if (Array.isArray(row.links)) {
    for (const l of row.links) {
      if (l && typeof l === "object") {
        parts.push(
          /** @type {{ text?: string, url?: string }} */ (l).text,
          /** @type {{ text?: string, url?: string }} */ (l).url
        );
      }
    }
  }
  return parts.join("\n").toLowerCase().includes(qLower);
}

/**
 * Distinct non-empty swimlane strings stored on completed rows (`item.swimlane`).
 * @param {Array<{ swimlane?: string }>} rows
 * @returns {string[]}
 */
export function distinctSwimlaneRawStrings(rows) {
  const set = new Set();
  for (const row of rows) {
    const s = String(row.swimlane ?? "").trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Swimlane raw strings on cards that cannot be selected via current board swimlane tokens
 * (renamed/removed lanes on archived cards). Filtering uses case-insensitive equality on the stored raw string.
 * @param {Array<{ swimlane?: string }>} rows
 * @param {Array<{ index: number, title: string }>} swimlanes
 */
export function legacySwimlaneFilterCandidates(rows, swimlanes) {
  const distinct = distinctSwimlaneRawStrings(rows);
  if (!swimlanes.length) return distinct;
  return distinct.filter(
    (s) => resolveCompletedLaneFilterIndices(s, swimlanes) == null
  );
}

export function utcDayBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function utcMonthBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Monday 00:00 UTC of the calendar week containing `ms`. */
export function utcWeekBucketStartMs(ms) {
  const d = new Date(ms);
  const utcMidnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
  const dow = d.getUTCDay();
  const delta = dow === 0 ? 6 : dow - 1;
  return utcMidnight - delta * 86400000;
}

/**
 * @param {number} ms
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export function bucketStartMsForGranularity(ms, granularity) {
  if (granularity === "weekly") return utcWeekBucketStartMs(ms);
  if (granularity === "monthly") return utcMonthBucketMs(ms);
  return utcDayBucketMs(ms);
}

/**
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function aggregateCompletionBuckets(slug, granularity) {
  const rows = await gatherCompletedAndArchiveRows(slug);
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    if (closedMs == null) continue;
    const k = bucketStartMsForGranularity(closedMs, granularity);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts.keys()].sort((a, b) => a - b);
  return sorted.map((t) => ({
    t: new Date(t).toISOString(),
    n: counts.get(t) ?? 0,
  }));
}

/**
 * Completions per time bucket, split by resolved swimlane index (for stacked charts).
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function aggregateCompletionSwimlaneStack(slug, granularity) {
  const { swimlanes } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const rows = await gatherCompletedAndArchiveRows(slug);

  /** @type {Map<number, Map<number, number>>} bucket start ms → lane index → count */
  const byBucket = new Map();

  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    if (closedMs == null) continue;
    const bucketMs = bucketStartMsForGranularity(closedMs, granularity);
    const laneIdx = resolveCardSwimlaneIndex(
      /** @type {string | undefined} */ (row.swimlane),
      swimlanes
    );
    if (!byBucket.has(bucketMs)) byBucket.set(bucketMs, new Map());
    const inner = byBucket.get(bucketMs);
    inner.set(laneIdx, (inner.get(laneIdx) ?? 0) + 1);
  }

  /** @type {Set<number>} */
  const usedLanes = new Set();
  for (const m of byBucket.values()) {
    for (const k of m.keys()) usedLanes.add(k);
  }
  const fromDef = swimlanes.map((l) => l.index);
  const indices = [...new Set([...fromDef, ...usedLanes])].sort(
    (a, b) => a - b
  );

  /**
   * @param {number} i
   */
  function labelForLaneIndex(i) {
    const lane = swimlanes.find((l) => l.index === i);
    const t = lane?.title && String(lane.title).trim();
    if (t) return t;
    if (!swimlanes.length) return "Completed";
    return `Lane ${i}`;
  }

  const series = indices.map((index) => ({
    key: String(index),
    label: labelForLaneIndex(index),
    index,
  }));

  const sortedBuckets = [...byBucket.keys()].sort((a, b) => a - b);
  const buckets = sortedBuckets.map((bm) => {
    const inner = byBucket.get(bm) ?? new Map();
    /** @type {Record<string, number>} */
    const counts = {};
    for (const s of series) {
      counts[s.key] = inner.get(s.index) ?? 0;
    }
    return { t: new Date(bm).toISOString(), counts };
  });

  return { series, buckets };
}

/**
 * @param {number[]} values
 * @returns {number | null}
 */
export function medianSample(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Sample standard deviation (n >= 2); otherwise null.
 * @param {number[]} values
 * @returns {number | null}
 */
export function sampleStdDev(values) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const varSum = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

/**
 * Per-card cycle length (closed − created) in days, x = UTC bucket of `closed`.
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function buildCycleTimeScatter(slug, granularity) {
  const rows = await gatherCompletedAndArchiveRows(slug);
  /** @type {{ t: string, d: number }[]} */
  const points = [];
  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    const createdMs = parseIsoMs(row.created);
    if (closedMs == null || createdMs == null) continue;
    const cycleMs = closedMs - createdMs;
    if (!Number.isFinite(cycleMs) || cycleMs < 0) continue;
    const bucketMs = bucketStartMsForGranularity(closedMs, granularity);
    const d = cycleMs / (24 * 60 * 60 * 1000);
    points.push({ t: new Date(bucketMs).toISOString(), d });
  }
  const values = points.map((p) => p.d);
  return {
    granularity,
    points,
    medianDays: medianSample(values),
    stdevDays: sampleStdDev(values),
    count: values.length,
  };
}

/**
 * @param {string} laneRaw
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @returns {Set<number> | null} indices to keep, or null if param should be ignored
 */
export function resolveCompletedLaneFilterIndices(laneRaw, swimlanes) {
  const s = String(laneRaw ?? "").trim();
  if (!s) return null;
  if (!swimlanes.length) return null;

  const list = [...swimlanes].sort((a, b) => a.index - b.index);
  const lower = s.toLowerCase();

  const byTitle = list.filter(
    (l) => String(l.title ?? "").trim().toLowerCase() === lower
  );
  if (byTitle.length > 0) {
    return new Set(byTitle.map((l) => l.index));
  }

  const key = s.match(/^swimlanes\.(\d+)$/i);
  if (key) {
    const n = Number(key[1]);
    if (list.some((l) => l.index === n)) return new Set([n]);
  }

  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    if (list.some((l) => l.index === n)) return new Set([n]);
  }

  return null;
}
