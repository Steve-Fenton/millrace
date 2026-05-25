import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { MILLRACE_DATA_DIRNAME } from "./constants.js";
import { captureTodayColumnSnapshots } from "./columnSnapshots.js";
import { dataRoot, millraceDataDirPath, snapshotsJsonPath } from "./dataRoot.js";
import {
  commitPathIfChanged,
  execFileAsync,
  gitChildEnv,
  gitPullWithOptionalAutostash,
  runGitSerialized,
} from "./gitOps.js";

const SNAPSHOT_DATA_REL = path
  .join("tasks", MILLRACE_DATA_DIRNAME)
  .split(path.sep)
  .join("/");
const SNAPSHOT_COMMIT_MESSAGE = "Millrace: column snapshots";

function defaultSnapshotsJsonText() {
  return `{
  "settings": {
    "boards": []
  }
}
`;
}

/**
 * Ensure `tasks/.millrace/` exists with a default `snapshots.json`.
 * Safe to run on every server start; never overwrites existing files.
 */
export async function ensureMillraceSnapshotLayout() {
  const millraceDir = millraceDataDirPath();
  const snapshotsPath = snapshotsJsonPath();

  if (!existsSync(millraceDir)) {
    await fs.mkdir(millraceDir, { recursive: true });
  }
  if (!existsSync(snapshotsPath)) {
    await fs.writeFile(snapshotsPath, defaultSnapshotsJsonText(), "utf8");
  }
}

/**
 * Pull latest changes, ensure snapshot files exist, capture today's column counts,
 * then commit and push when `tasks/.millrace` changed. Skips git work when the data
 * root has no `.git` directory. Errors are logged and do not block server startup.
 * @param {{
 *   ensureMillraceSnapshotLayout?: typeof ensureMillraceSnapshotLayout;
 *   captureTodayColumnSnapshots?: typeof captureTodayColumnSnapshots;
 *   gitPullWithOptionalAutostash?: typeof gitPullWithOptionalAutostash;
 *   commitPathIfChanged?: typeof commitPathIfChanged;
 *   gitPush?: (opts: { cwd: string, env: Record<string, string | undefined>, maxBuffer: number }) => Promise<void>;
 *   dataRootHasGit?: () => boolean;
 *   runGitSerialized?: typeof runGitSerialized;
 * }} [deps]
 */
export async function runMillraceSnapshotLayoutStartup(deps = {}) {
  const layoutFn = deps.ensureMillraceSnapshotLayout ?? ensureMillraceSnapshotLayout;
  const captureFn = deps.captureTodayColumnSnapshots ?? captureTodayColumnSnapshots;
  const pullFn =
    deps.gitPullWithOptionalAutostash ?? gitPullWithOptionalAutostash;
  const commitFn = deps.commitPathIfChanged ?? commitPathIfChanged;
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
        const committed = await commitFn(
          opts,
          SNAPSHOT_DATA_REL,
          SNAPSHOT_COMMIT_MESSAGE
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
