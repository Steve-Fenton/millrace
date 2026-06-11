import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { MS_PER_MONTH } from "./constants.js";
import { readMillraceCatalogRetentionSettings } from "./catalogRetention.js";
import { localUserMatchesMillraceAdmin } from "./millraceCatalogSettings.js";
import { dataRoot } from "./dataRoot.js";
import { ensureDir } from "./fsUtil.js";
import {
  commitOutstandingTasksDir,
  execFileAsync,
  gitChildEnv,
  gitPullWithOptionalAutostash,
  runGitSerialized,
} from "./gitOps.js";
import {
  clearDataRootPendingSync,
  markDataRootPendingSync,
} from "./localUserIni.js";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import { parseTaskCardIni } from "../assets/js/models/taskModel.js";
import { columnIsDone, parseBoardIni } from "../assets/js/models/boardModel.js";
import {
  aggregateColumnIndexForSourceColumn,
  enrichAggregateBoardModel,
  isAggregateBoard,
  standardAggregateColumns,
} from "../assets/js/models/aggregateBoard.js";
import {
  loadBoardCatalog,
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardModelForSlug,
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
        `[millrace] archive: skipped ${ent.name} — already exists in archive/`
      );
      continue;
    } catch {
      /* available */
    }

    try {
      await fs.rename(src, dest);
      moved++;
      console.error(`[millrace] Archived closed task (>${maxAgeDays}d): ${slug}/${ent.name}`);
    } catch (e) {
      console.warn("[millrace] archive: could not move", ent.name, e);
    }
  }

  return moved;
}

/** @type {Map<string, Promise<void>>} */
const archiveStaleInFlight = new Map();

/**
 * @param {string} slug
 * @returns {Promise<number>} files moved to archive/ or cold-storage/
 */
export async function runArchiveStaleClosedForSlug(slug) {
  let p = archiveStaleInFlight.get(slug);
  if (p) return p;

  p = (async () => {
    const { archiveClosedAfterDays, coldStorageArchiveAfterMonths } =
      await readMillraceCatalogRetentionSettings();
    const archived = await archiveStaleClosedTaskFiles(slug, archiveClosedAfterDays);
    const coldMoved = await moveStaleArchiveFilesToColdStorage(
      slug,
      coldStorageArchiveAfterMonths
    );
    return archived + coldMoved;
  })().finally(() => {
    archiveStaleInFlight.delete(slug);
  });

  archiveStaleInFlight.set(slug, p);
  return p;
}

/**
 * Commit `tasks/` changes and push after archive/cold-storage moves.
 * @param {number} movedCount
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 * @param {{
 *   commitOutstandingTasksDir?: typeof commitOutstandingTasksDir;
 *   gitPush?: (opts: { cwd: string, env: Record<string, string | undefined>, maxBuffer: number }) => Promise<void>;
 *   markDataRootPendingSync?: typeof markDataRootPendingSync;
 *   clearDataRootPendingSync?: typeof clearDataRootPendingSync;
 * }} [deps]
 */
export async function syncGitAfterArchiveMoves(movedCount, opts, deps = {}) {
  if (movedCount <= 0) return;

  const commitFn = deps.commitOutstandingTasksDir ?? commitOutstandingTasksDir;
  const pushFn =
    deps.gitPush ??
    (async (pushOpts) => {
      await execFileAsync("git", ["push"], pushOpts);
    });
  const markPendingFn = deps.markDataRootPendingSync ?? markDataRootPendingSync;
  const clearPendingFn = deps.clearDataRootPendingSync ?? clearDataRootPendingSync;

  await markPendingFn();

  try {
    await commitFn(opts);
    await pushFn(opts);
    await clearPendingFn();
    console.error("[millrace] archive: git commit/push ok");
  } catch (e) {
    console.error("[millrace] archive: git commit/push failed", e);
  }
}

/**
 * Archive stale closed cards and cold-storage moves — once per board at process start.
 * Pulls latest changes before archiving so another host's archive run is visible first;
 * commits and pushes when this run moved files.
 * @param {{
 *   dataRootHasGit?: () => boolean;
 *   gitPullWithOptionalAutostash?: typeof gitPullWithOptionalAutostash;
 *   commitOutstandingTasksDir?: typeof commitOutstandingTasksDir;
 *   gitPush?: (opts: { cwd: string, env: Record<string, string | undefined>, maxBuffer: number }) => Promise<void>;
 *   runGitSerialized?: typeof runGitSerialized;
 *   markDataRootPendingSync?: typeof markDataRootPendingSync;
 *   clearDataRootPendingSync?: typeof clearDataRootPendingSync;
 *   localUserMatchesMillraceAdmin?: typeof localUserMatchesMillraceAdmin;
 * }} [deps]
 * @returns {Promise<number>} total files moved
 */
export async function runStartupArchiveStaleForCatalogSlugs(deps = {}) {
  const ownerCheckFn =
    deps.localUserMatchesMillraceAdmin ?? localUserMatchesMillraceAdmin;
  if (!(await ownerCheckFn())) {
    console.error(
      "[millrace] archive: skipped (Mine preference does not match Millrace admin)"
    );
    return 0;
  }

  const hasGitFn =
    deps.dataRootHasGit ?? (() => existsSync(path.join(dataRoot(), ".git")));
  const pullFn =
    deps.gitPullWithOptionalAutostash ?? gitPullWithOptionalAutostash;
  const serializeFn = deps.runGitSerialized ?? runGitSerialized;
  const markPendingFn = deps.markDataRootPendingSync ?? markDataRootPendingSync;

  const runArchiveWork = async () => {
    let totalMoved = 0;
    try {
      const catalog = await loadBoardCatalog();
      const slugs = [...new Set(catalog.map((e) => e.slug))];
      for (const slug of slugs) {
        totalMoved += await runArchiveStaleClosedForSlug(slug);
      }
    } catch (e) {
      console.error("[millrace] startup archive:", e);
    }
    return totalMoved;
  };

  if (!hasGitFn()) {
    const totalMoved = await runArchiveWork();
    if (totalMoved > 0) await markPendingFn();
    return totalMoved;
  }

  const cwd = dataRoot();
  const opts = {
    cwd,
    env: gitChildEnv(),
    maxBuffer: 10 * 1024 * 1024,
  };

  let totalMoved = 0;
  try {
    await serializeFn(async () => {
      let pullOk = true;
      try {
        await pullFn(opts);
      } catch (e) {
        pullOk = false;
        console.error("[millrace] archive: git pull failed", e);
      }

      totalMoved = await runArchiveWork();

      if (!pullOk) return;

      await syncGitAfterArchiveMoves(totalMoved, opts, deps);
    });
  } catch (e) {
    console.error("[millrace] archive: git safety failed", e);
  }
  return totalMoved;
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
        `[millrace] cold-storage: skipped ${ent.name} — already exists in cold-storage/${year}/`
      );
      continue;
    } catch {
      /* available */
    }

    try {
      await fs.rename(src, dest);
      moved++;
      console.error(
        `[millrace] cold-storage: moved from archive (>${ageMonths}mo): ${slug}/archive/${ent.name} → cold-storage/${year}/`
      );
    } catch (e) {
      console.warn("[millrace] cold-storage: could not move", ent.name, e);
    }
  }

  return moved;
}

/**
 * Board cards with `closed` plus `archive/*.ini` (not `cold-storage/**`), merged and sorted by completion time (newest first).
 * @param {string} slug
 */
export async function gatherCompletedAndArchiveRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateCompletedAndArchiveRows(model);
  }
  return gatherPhysicalBoardCompletedAndArchiveRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateCompletedAndArchiveRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalBoardCompletedAndArchiveRows(sourceSlug);
    for (const row of rows) {
      const sourceColumnIndex = row.columnIndex;
      let columnIndex = row.columnIndex;
      if (columnIndex != null) {
        columnIndex = aggregateColumnIndexForSourceColumn(
          columnIndex,
          sourceColumns,
          aggregateColumns
        );
      }
      merged.push({
        ...row,
        columnIndex,
        sourceColumnIndex,
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }

  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    const af = `${a.sourceBoardSlug ?? ""}/${a.filename}`;
    const bf = `${b.sourceBoardSlug ?? ""}/${b.filename}`;
    return af.localeCompare(bf);
  });
  return merged;
}

/**
 * @param {string} slug physical board slug (task folder)
 */
async function gatherPhysicalBoardCompletedAndArchiveRows(slug) {
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
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateColdStorageCardRows(model);
  }
  return gatherPhysicalColdStorageCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateColdStorageCardRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalColdStorageCardRows(sourceSlug);
    for (const row of rows) {
      const sourceColumnIndex = row.columnIndex;
      let columnIndex = row.columnIndex;
      if (columnIndex != null) {
        columnIndex = aggregateColumnIndexForSourceColumn(
          columnIndex,
          sourceColumns,
          aggregateColumns
        );
      }
      merged.push({
        ...row,
        columnIndex,
        sourceColumnIndex,
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }

  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    const af = `${a.sourceBoardSlug ?? ""}/${a.filename}`;
    const bf = `${b.sourceBoardSlug ?? ""}/${b.filename}`;
    return af.localeCompare(bf);
  });
  return merged;
}

async function gatherPhysicalColdStorageCardRows(slug) {
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
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
 * Abandoned cards under `tasks/{slug}/abandoned/**` (same row shape as archive; `source: "abandoned"`).
 * @param {string} slug
 */
export async function gatherAbandonedCardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateAbandonedCardRows(model);
  }
  return gatherPhysicalAbandonedCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateAbandonedCardRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalAbandonedCardRows(sourceSlug);
    for (const row of rows) {
      const sourceColumnIndex = row.columnIndex;
      let columnIndex = row.columnIndex;
      if (columnIndex != null) {
        columnIndex = aggregateColumnIndexForSourceColumn(
          columnIndex,
          sourceColumns,
          aggregateColumns
        );
      }
      merged.push({
        ...row,
        columnIndex,
        sourceColumnIndex,
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }

  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    const af = `${a.sourceBoardSlug ?? ""}/${a.filename}`;
    const bf = `${b.sourceBoardSlug ?? ""}/${b.filename}`;
    return af.localeCompare(bf);
  });
  return merged;
}

async function gatherPhysicalAbandonedCardRows(slug) {
  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const abandonedRoot = path.join(boardRoot, "abandoned");
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addAbandonedCard(fullPath, filename) {
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
      source: "abandoned",
      filename,
      columnIndex: null,
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
        await addAbandonedCard(p, ent.name);
      }
    }
  }

  await walk(abandonedRoot);
  return rows;
}

/**
 * Open (not closed) board cards for completed-view search-all (`source: "in-flight"`).
 * @param {string} slug
 */
export async function gatherInFlightCardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateInFlightCardRows(model);
  }
  return gatherPhysicalInFlightCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateInFlightCardRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalInFlightCardRows(sourceSlug);
    for (const row of rows) {
      const sourceColumnIndex = row.columnIndex;
      let columnIndex = row.columnIndex;
      if (columnIndex != null) {
        columnIndex = aggregateColumnIndexForSourceColumn(
          columnIndex,
          sourceColumns,
          aggregateColumns
        );
      }
      merged.push({
        ...row,
        columnIndex,
        sourceColumnIndex,
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }

  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    const af = `${a.sourceBoardSlug ?? ""}/${a.filename}`;
    const bf = `${b.sourceBoardSlug ?? ""}/${b.filename}`;
    return af.localeCompare(bf);
  });
  return merged;
}

async function gatherPhysicalInFlightCardRows(slug) {
  const { columns: columnsDef } = await loadBoardColumnAndSwimlaneDefsForSlug(
    slug
  );
  const boardRoot = path.join(dataRoot(), "tasks", slug);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addInFlightCard(fullPath, filename) {
    if (seen.has(filename)) return;
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
    if (parseIsoMs(parsed.closed) != null) return;
    seen.add(filename);
    let sortMs = parseIsoMs(parsed.created);
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
      source: "in-flight",
      filename,
      columnIndex: resolveCardColumnIndex(parsed.column, columnsDef),
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
      await addInFlightCard(path.join(boardRoot, ent.name), ent.name);
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
        await addInFlightCard(path.join(colDir, f.name), f.name);
      }
    }
  }

  rows.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return String(a.filename).localeCompare(String(b.filename));
  });

  return rows;
}

/**
 * @param {string} slug
 * @param {boolean} searchAll — include cold storage, abandoned, and in-flight cards
 */
export async function gatherCompletedArchiveAndOptionalCold(slug, searchAll) {
  const base = await gatherCompletedAndArchiveRows(slug);
  if (!searchAll) return base;
  const [cold, abandoned, inFlight] = await Promise.all([
    gatherColdStorageCardRows(slug),
    gatherAbandonedCardRows(slug),
    gatherInFlightCardRows(slug),
  ]);
  const merged = [...base, ...cold, ...abandoned, ...inFlight];
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
    row.note,
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

/** @typedef {"all" | "this_week" | "this_month" | "last_week" | "last_month"} CompletedWhenFilter */

/**
 * @param {string | undefined} raw
 * @returns {CompletedWhenFilter}
 */
export function parseCompletedWhenFilter(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (v === "this_week" || v === "thisweek") return "this_week";
  if (v === "this_month" || v === "thismonth") return "this_month";
  if (v === "last_week" || v === "lastweek") return "last_week";
  if (v === "last_month" || v === "lastmonth") return "last_month";
  return "all";
}

/**
 * UTC `[startMs, endMs)` for filtering completed cards by `closed` (ISO week = Monday).
 * @param {Exclude<CompletedWhenFilter, "all">} when
 * @param {number} nowMs
 * @returns {{ startMs: number, endMs: number }}
 */
export function completedWhenRangeBoundsMs(when, nowMs) {
  const weekStart = utcWeekBucketStartMs(nowMs);
  const monthStart = utcMonthBucketMs(nowMs);
  switch (when) {
    case "this_week":
      return { startMs: weekStart, endMs: weekStart + 7 * 86400000 };
    case "last_week":
      return { startMs: weekStart - 7 * 86400000, endMs: weekStart };
    case "this_month": {
      const d = new Date(monthStart);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const nextMonthStart =
        m === 11 ? Date.UTC(y + 1, 0, 1) : Date.UTC(y, m + 1, 1);
      return { startMs: monthStart, endMs: nextMonthStart };
    }
    case "last_month": {
      const prevStart = utcMonthBucketMs(monthStart - 1);
      return { startMs: prevStart, endMs: monthStart };
    }
    default:
      return { startMs: 0, endMs: Number.POSITIVE_INFINITY };
  }
}

/**
 * Whether a completed row's `closed` timestamp falls in the selected UTC period.
 * @param {string | undefined} closedIso
 * @param {CompletedWhenFilter} when
 * @param {number} [nowMs]
 */
export function completedClosedInWhenRange(closedIso, when, nowMs = Date.now()) {
  if (when === "all") return true;
  const closedMs = parseIsoMs(closedIso);
  if (closedMs == null) return false;
  const { startMs, endMs } = completedWhenRangeBoundsMs(when, nowMs);
  return closedMs >= startMs && closedMs < endMs;
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
 * Median and sample σ per close bucket from scatter points.
 * @param {{ bucket?: string, t?: string, d: number }[]} points
 * @returns {{ t: string, medianDays: number | null, stdevDays: number | null, count: number }[]}
 */
export function buildCycleTimePeriodStats(points) {
  /** @type {Map<string, number[]>} */
  const byBucket = new Map();
  for (const p of points) {
    const bucket =
      typeof p.bucket === "string" ? p.bucket : typeof p.t === "string" ? p.t : "";
    if (!bucket) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(p.d);
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([t, values]) => ({
      t,
      medianDays: medianSample(values),
      stdevDays: sampleStdDev(values),
      count: values.length,
    }));
}

/**
 * Per-card cycle length (closed − created) in days.
 * Scatter x uses actual `closed`; `periodStats` group by UTC close bucket.
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function buildCycleTimeScatter(slug, granularity) {
  const rows = await gatherCompletedAndArchiveRows(slug);
  /** @type {{ closed: string, bucket: string, d: number }[]} */
  const points = [];
  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    const createdMs = parseIsoMs(row.created);
    if (closedMs == null || createdMs == null) continue;
    const cycleMs = closedMs - createdMs;
    if (!Number.isFinite(cycleMs) || cycleMs < 0) continue;
    const bucketMs = bucketStartMsForGranularity(closedMs, granularity);
    const d = cycleMs / (24 * 60 * 60 * 1000);
    points.push({
      closed: new Date(closedMs).toISOString(),
      bucket: new Date(bucketMs).toISOString(),
      d,
    });
  }
  const values = points.map((p) => p.d);
  return {
    granularity,
    points,
    periodStats: buildCycleTimePeriodStats(points),
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {number} ms
 */
function utcDayStartMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Open cards on the board (no `closed` date): root `*.ini` plus legacy `columns.N/` folders.
 * @param {string} slug
 */
export async function gatherOpenBoardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateOpenBoardRows(model);
  }
  return gatherPhysicalOpenBoardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateOpenBoardRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalOpenBoardRows(sourceSlug);
    for (const row of rows) {
      merged.push({
        ...row,
        columnIndex: aggregateColumnIndexForSourceColumn(
          row.columnIndex,
          sourceColumns,
          aggregateColumns
        ),
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }
  return merged;
}

async function gatherPhysicalOpenBoardRows(slug) {
  const { columns: columnsDef } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const boardRoot = path.join(dataRoot(), "tasks", slug);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addOpenCard(fullPath, filename) {
    if (seen.has(filename)) return;
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
    if (parseIsoMs(parsed.closed) != null) return;
    seen.add(filename);
    rows.push({
      filename,
      columnIndex: resolveCardColumnIndex(parsed.column, columnsDef),
      swimlane: parsed.swimlane,
      created: parsed.created,
    });
  }

  try {
    const entries = await fs.readdir(boardRoot, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
      await addOpenCard(path.join(boardRoot, ent.name), ent.name);
    }
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code !== "ENOENT") {
      throw e;
    }
  }

  for (const col of columnsDef) {
    const legacyDir = path.join(boardRoot, `columns.${col.index}`);
    try {
      const legacy = await fs.readdir(legacyDir, { withFileTypes: true });
      for (const ent of legacy) {
        if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
        await addOpenCard(path.join(legacyDir, ent.name), ent.name);
      }
    } catch {
      /* no legacy folder */
    }
  }

  return rows;
}

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
