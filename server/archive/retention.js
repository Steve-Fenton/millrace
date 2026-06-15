import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { MS_PER_MONTH } from "../constants.js";
import { readMillraceCatalogRetentionSettings } from "../catalogRetention.js";
import { localUserMatchesMillraceAdmin } from "../millraceCatalogSettings.js";
import { dataRoot } from "../dataRoot.js";
import { ensureDir } from "../fsUtil.js";
import {
  commitOutstandingTasksDir,
  execFileAsync,
  gitChildEnv,
  gitPullWithOptionalAutostash,
  runGitSerialized,
} from "../gitOps.js";
import {
  clearDataRootPendingSync,
  markDataRootPendingSync,
} from "../localUserIni.js";
import { parseTaskCardIni } from "../../assets/js/models/taskModel.js";
import { loadBoardCatalog } from "../boardCatalog.js";
import { parseIsoMs } from "../analytics/time.js";

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
