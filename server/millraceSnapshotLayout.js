import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  captureTodayColumnSnapshots,
  migrateLegacySnapshotsJson,
  removeObsoleteSnapshotSettings,
} from "./columnSnapshots.js";
import { dataRoot, millraceDataDirPath } from "./dataRoot.js";
import { loadBoardCatalog } from "./boardCatalog.js";
import {
  execFileAsync,
  gitChildEnv,
  gitIndexHasStagedChanges,
  gitPullWithOptionalAutostash,
  runGitSerialized,
} from "./gitOps.js";

const SNAPSHOT_COMMIT_MESSAGE = "Millrace: column snapshots";

/**
 * Repo-relative paths for per-board snapshot git commits.
 * @param {{ file: string, slug: string, kind?: string }[]} catalog
 */
export function snapshotGitRelPaths(catalog) {
  /** @type {string[]} */
  const paths = [];
  for (const entry of catalog) {
    if (entry.kind === "aggregate") continue;
    paths.push(
      path.join("tasks", entry.slug, "snapshots.json").split(path.sep).join("/")
    );
  }
  return paths;
}

/**
 * Ensure `tasks/.millrace/` exists; migrate legacy layout; drop obsolete settings file.
 * Safe to run on every server start.
 */
export async function ensureMillraceSnapshotLayout() {
  const millraceDir = millraceDataDirPath();

  if (!existsSync(millraceDir)) {
    await fs.mkdir(millraceDir, { recursive: true });
  }
  await migrateLegacySnapshotsJson();
  await removeObsoleteSnapshotSettings();
}

/**
 * Stage per-board snapshot files, then commit when changed.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 * @param {string} message
 * @param {{ file: string, slug: string, kind?: string }[]} catalog
 * @returns {Promise<boolean>}
 */
export async function commitSnapshotPathsIfChanged(opts, message, catalog) {
  for (const rel of snapshotGitRelPaths(catalog)) {
    const abs = path.join(opts.cwd, rel);
    if (!existsSync(abs)) continue;
    await execFileAsync("git", ["add", "--", rel], opts);
  }
  if (!(await gitIndexHasStagedChanges(opts))) return false;
  await execFileAsync("git", ["commit", "-m", message], opts);
  return true;
}

/**
 * Pull latest changes, ensure snapshot files exist, capture today's column counts,
 * then commit and push when snapshot files changed. Skips git work when the data
 * root has no `.git` directory. Errors are logged and do not block server startup.
 * @param {{
 *   ensureMillraceSnapshotLayout?: typeof ensureMillraceSnapshotLayout;
 *   captureTodayColumnSnapshots?: typeof captureTodayColumnSnapshots;
 *   loadBoardCatalog?: typeof loadBoardCatalog;
 *   gitPullWithOptionalAutostash?: typeof gitPullWithOptionalAutostash;
 *   commitSnapshotPathsIfChanged?: typeof commitSnapshotPathsIfChanged;
 *   gitPush?: (opts: { cwd: string, env: Record<string, string | undefined>, maxBuffer: number }) => Promise<void>;
 *   dataRootHasGit?: () => boolean;
 *   runGitSerialized?: typeof runGitSerialized;
 * }} [deps]
 */
export async function runMillraceSnapshotLayoutStartup(deps = {}) {
  const layoutFn = deps.ensureMillraceSnapshotLayout ?? ensureMillraceSnapshotLayout;
  const captureFn = deps.captureTodayColumnSnapshots ?? captureTodayColumnSnapshots;
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;
  const pullFn =
    deps.gitPullWithOptionalAutostash ?? gitPullWithOptionalAutostash;
  const commitFn =
    deps.commitSnapshotPathsIfChanged ?? commitSnapshotPathsIfChanged;
  const pushFn =
    deps.gitPush ??
    (async (opts) => {
      await execFileAsync("git", ["push"], opts);
    });
  const hasGitFn =
    deps.dataRootHasGit ?? (() => existsSync(path.join(dataRoot(), ".git")));
  const serializeFn = deps.runGitSerialized ?? runGitSerialized;

  const runSnapshotWork = async () => {
    await layoutFn();
    await captureFn();
  };

  if (!hasGitFn()) {
    await runSnapshotWork();
    return;
  }

  const cwd = dataRoot();
  const opts = {
    cwd,
    env: gitChildEnv(),
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    await serializeFn(async () => {
      let pullOk = true;
      try {
        await pullFn(opts);
      } catch (e) {
        pullOk = false;
        console.error("[millrace] column snapshots: git pull failed", e);
      }

      await runSnapshotWork();

      if (!pullOk) return;

      try {
        const catalog = await loadCatalog();
        const committed = await commitFn(
          opts,
          SNAPSHOT_COMMIT_MESSAGE,
          catalog
        );
        if (!committed) return;
        await pushFn(opts);
      } catch (e) {
        console.error("[millrace] column snapshots: git commit/push failed", e);
      }
    });
  } catch (e) {
    console.error("[millrace] column snapshots: git safety failed", e);
  }
}
