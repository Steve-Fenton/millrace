import {
  readLocalUserIniSections,
  writeLocalUserIniSections,
} from "./localUserIni.js";
import {
  localUserIsNonOwnerMillraceFollower,
  localUserMatchesMillraceAdmin,
} from "./millraceCatalogSettings.js";
import {
  readDataRootInstalledMillraceVersion,
  readMillraceLockfileDrift,
} from "./millraceLockDrift.js";
import {
  NPM_UPDATE_CHECK_INTERVAL_MS,
  parseLastCheckMs,
} from "./npmUpdatePrepare.js";
import { pullLatestProjectChanges } from "./npmUpdatePrepare.js";
import {
  readProjectHasCycleScript,
  runProjectInstallThenCycle,
} from "./projectCycleAfterUpdate.js";

/**
 * @param {{
 *   lockfileOutOfSync: boolean,
 *   packageMillraceSpec: string | null,
 *   lockSpecifier: string | null,
 *   lockResolvedVersion: string | null,
 * }} drift
 * @param {string | null} installedVersion
 */
export function followerInstallSyncNeeded(drift, installedVersion) {
  if (drift.lockfileOutOfSync) return true;
  const lockVer = String(drift.lockResolvedVersion ?? "").trim();
  if (!lockVer) return false;
  const installed = String(installedVersion ?? "").trim();
  if (!installed) return true;
  return installed !== lockVer;
}

/**
 * @param {{
 *   lockfileOutOfSync: boolean,
 *   packageMillraceSpec: string | null,
 *   lockSpecifier: string | null,
 *   lockResolvedVersion: string | null,
 * }} drift
 */
export function followerSyncKeyForDrift(drift) {
  if (drift.lockfileOutOfSync) {
    return [
      "drift",
      drift.packageMillraceSpec ?? "",
      drift.lockSpecifier ?? "",
      drift.lockResolvedVersion ?? "",
    ].join("|");
  }
  const lockVer = String(drift.lockResolvedVersion ?? "").trim();
  return lockVer ? `lock:${lockVer}` : "";
}

/**
 * @param {string} syncKey
 */
async function markFollowerSyncCompleted(syncKey) {
  if (!syncKey) return;
  try {
    const sections = await readLocalUserIniSections();
    sections.flow = sections.flow ?? {};
    sections.flow.npm_follower_sync_for = syncKey;
    delete sections.flow.npmFollowerSyncFor;
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn(
      "[millrace] could not write npm_follower_sync_for to localuser.ini:",
      e
    );
  }
}

/**
 * Pull owner changes and run `pnpm install` + `pnpm cycle` when this machine is not Millrace admin.
 *
 * @param {{
 *   nowMs?: number,
 *   intervalMs?: number,
 *   skipPull?: boolean,
 *   gitPull?: typeof import("./gitOps.js").gitPullWithOptionalAutostash,
 *   runGitSerialized?: typeof import("./gitOps.js").runGitSerialized,
 *   dataRootHasGit?: () => boolean,
 *   localUserMatchesMillraceAdmin?: typeof localUserMatchesMillraceAdmin,
 *   localUserIsNonOwnerMillraceFollower?: typeof localUserIsNonOwnerMillraceFollower,
 *   runInstallThenCycle?: typeof runProjectInstallThenCycle,
 * }} [opts]
 * @returns {Promise<{
 *   role: "owner" | "follower" | "skipped",
 *   ran: boolean,
 *   ok?: boolean,
 *   restarting?: boolean,
 *   reason?: string,
 * }>}
 */
export async function runNonOwnerMillraceFollowerSync(opts = {}) {
  const ownerCheckFn =
    opts.localUserMatchesMillraceAdmin ?? localUserMatchesMillraceAdmin;
  if (await ownerCheckFn()) {
    return { role: "owner", ran: false };
  }

  const followerCheckFn =
    opts.localUserIsNonOwnerMillraceFollower ?? localUserIsNonOwnerMillraceFollower;
  if (!(await followerCheckFn())) {
    return { role: "skipped", ran: false, reason: "not_follower" };
  }

  const projectHasCycleScript = await readProjectHasCycleScript();
  if (!projectHasCycleScript) {
    console.info(
      "[millrace] NPM follower sync: skipped (no cycle script in package.json)"
    );
    return { role: "follower", ran: false, reason: "no_cycle_script" };
  }

  const nowMs =
    typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
      ? opts.nowMs
      : Date.now();
  const intervalMs =
    typeof opts.intervalMs === "number" && opts.intervalMs >= 0
      ? opts.intervalMs
      : NPM_UPDATE_CHECK_INTERVAL_MS;

  if (!opts.skipPull) {
    let sections = await readLocalUserIniSections();
    const flow = sections.flow ?? {};
    const lastGitPullRaw =
      flow.last_auto_git_pull ?? flow.lastAutoGitPull ?? "";
    const lastGitPullMs = parseLastCheckMs(String(lastGitPullRaw));
    const withinPullCooldown =
      lastGitPullMs != null && nowMs - lastGitPullMs < intervalMs;

    if (!withinPullCooldown) {
      await pullLatestProjectChanges({
        nowMs,
        gitPull: opts.gitPull,
        runGitSerialized: opts.runGitSerialized,
        dataRootHasGit: opts.dataRootHasGit,
      });
    }
  }

  const drift = await readMillraceLockfileDrift();
  const installedVersion = await readDataRootInstalledMillraceVersion();
  if (!followerInstallSyncNeeded(drift, installedVersion)) {
    return { role: "follower", ran: false, reason: "already_synced" };
  }

  const syncKey = followerSyncKeyForDrift(drift);
  const sections = await readLocalUserIniSections();
  const flow = sections.flow ?? {};
  const lastSynced = String(
    flow.npm_follower_sync_for ?? flow.npmFollowerSyncFor ?? ""
  ).trim();
  if (syncKey && lastSynced === syncKey) {
    return { role: "follower", ran: false, reason: "already_synced" };
  }

  console.info(
    "[millrace] NPM follower sync: running pnpm install and cycle to apply owner update"
  );

  const installFn = opts.runInstallThenCycle ?? runProjectInstallThenCycle;
  const result = await installFn({ deferCycle: true });
  if (result.ok) {
    await markFollowerSyncCompleted(syncKey);
    return {
      role: "follower",
      ran: true,
      ok: true,
      restarting: Boolean(result.restarting),
    };
  }

  console.warn("[millrace] NPM follower sync: install/cycle failed:", result);
  return {
    role: "follower",
    ran: true,
    ok: false,
    reason: result.reason ?? "pnpm_failed",
  };
}
