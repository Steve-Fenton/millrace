import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { dataRoot } from "./dataRoot.js";
import {
  gitChildEnv,
  gitPullWithOptionalAutostash,
  runGitSerialized,
} from "./gitOps.js";
import {
  readLocalUserIniSections,
  writeLocalUserIniSections,
} from "./localUserIni.js";
import { runProjectPnpm } from "./projectCycleAfterUpdate.js";

/** Minimum time between registry lookups (successful checks write `last_npm_update_check`). */
export const NPM_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} iso
 * @returns {number | null} epoch ms or null if invalid
 */
export function parseLastCheckMs(iso) {
  const s = String(iso ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/**
 * Pull latest project changes (throttled via `last_auto_git_pull` in `tasks/localuser.ini`).
 *
 * @param {{
 *   nowMs?: number,
 *   gitPull?: typeof gitPullWithOptionalAutostash,
 *   runGitSerialized?: typeof runGitSerialized,
 *   dataRootHasGit?: () => boolean,
 * }} [opts]
 */
export async function pullLatestProjectChanges(opts = {}) {
  const nowMs =
    typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
      ? opts.nowMs
      : Date.now();
  const pullFn = opts.gitPull ?? gitPullWithOptionalAutostash;
  const serializeFn = opts.runGitSerialized ?? runGitSerialized;
  const hasGitFn =
    opts.dataRootHasGit ?? (() => existsSync(path.join(dataRoot(), ".git")));

  const root = dataRoot();
  const gitOpts = {
    cwd: root,
    env: gitChildEnv(),
    maxBuffer: 10 * 1024 * 1024,
  };

  if (hasGitFn()) {
    await serializeFn(async () => {
      try {
        await pullFn(gitOpts);
        console.info("[millrace] git pull ok");
      } catch (e) {
        console.warn("[millrace] git pull failed:", e);
      }
    });
  }

  try {
    const sections = await readLocalUserIniSections();
    sections.flow = sections.flow ?? {};
    sections.flow.last_auto_git_pull = new Date(nowMs).toISOString();
    delete sections.flow.lastAutoGitPull;
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn(
      "[millrace] could not write last_auto_git_pull to localuser.ini:",
      e
    );
  }
}

/**
 * Pull latest project changes and run `pnpm install` before comparing installed Millrace
 * to the NPM registry — another host may have updated `package.json` / the lockfile.
 *
 * Throttled via `last_auto_git_pull` in `tasks/localuser.ini` (same interval as registry checks).
 *
 * @param {{
 *   nowMs?: number,
 *   gitPull?: typeof gitPullWithOptionalAutostash,
 *   runGitSerialized?: typeof runGitSerialized,
 *   runPnpm?: typeof runProjectPnpm,
 *   dataRootHasGit?: () => boolean,
 * }} [opts]
 */
export async function prepareBeforeNpmUpdateCheck(opts = {}) {
  const nowMs =
    typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
      ? opts.nowMs
      : Date.now();
  const pnpmFn = opts.runPnpm ?? runProjectPnpm;
  const root = dataRoot();

  await pullLatestProjectChanges({
    nowMs,
    gitPull: opts.gitPull,
    runGitSerialized: opts.runGitSerialized,
    dataRootHasGit: opts.dataRootHasGit,
  });

  let hasPackageJson = false;
  try {
    await fs.access(path.join(root, "package.json"));
    hasPackageJson = true;
  } catch {
    /* no package.json */
  }

  if (hasPackageJson) {
    try {
      await pnpmFn(["install"], root);
      console.info("[millrace] NPM update check: pnpm install ok");
    } catch (e) {
      console.warn("[millrace] NPM update check: pnpm install failed:", e);
    }
  }
}
