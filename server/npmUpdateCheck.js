import fs from "fs/promises";
import path from "path";
import {
  readLocalUserIniSections,
  writeLocalUserIniSections,
} from "./localUserIni.js";
import { readMillraceLockfileDrift } from "./millraceLockDrift.js";
import { localUserMatchesMillraceAdmin } from "./millraceCatalogSettings.js";
import { runNonOwnerMillraceFollowerSync } from "./npmFollowerSync.js";
import {
  NPM_UPDATE_CHECK_INTERVAL_MS,
  parseLastCheckMs,
  prepareBeforeNpmUpdateCheck,
} from "./npmUpdatePrepare.js";
import { readProjectHasCycleScript } from "./projectCycleAfterUpdate.js";
import { REPO_ROOT } from "./repoRoot.js";

export { NPM_UPDATE_CHECK_INTERVAL_MS, parseLastCheckMs } from "./npmUpdatePrepare.js";

const NPM_REGISTRY_LATEST = "https://registry.npmjs.org";

/** @returns {Promise<{ version: string, packageName: string }>} */
export async function readInstalledMillracePackageMeta() {
  try {
    const raw = await fs.readFile(
      path.join(REPO_ROOT, "package.json"),
      "utf8"
    );
    const pkg = JSON.parse(raw);
    const version = String(pkg.version ?? "").trim() || "0.0.0";
    const packageName = String(pkg.name ?? "millrace").trim() || "millrace";
    return { version, packageName };
  } catch {
    return { version: "0.0.0", packageName: "millrace" };
  }
}

/**
 * @param {string} v
 * @returns {number[]}
 */
function semverCoreParts(v) {
  const core = String(v)
    .trim()
    .split("-")[0]
    .split("+")[0];
  return core.split(".").map((x) => {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/**
 * @param {string} latest
 * @param {string} current
 * @returns {boolean}
 */
export function semverIsNewer(latest, current) {
  const pa = semverCoreParts(latest);
  const pb = semverCoreParts(current);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const a = pa[i] ?? 0;
    const b = pb[i] ?? 0;
    if (a !== b) return a > b;
  }
  return String(latest).trim() !== String(current).trim();
}

/**
 * @param {string} packageName
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<string | null>}
 *
 * When `process.env.MILLRACE_TESTS_DISABLE_REGISTRY_FETCH` is `1` (set by `npm test`),
 * calling this with the default global `fetch` throws so the suite cannot hit registry.npmjs.org
 * by accident — inject `fetchFn` or pass `opts.fetchLatest` into {@link runNpmUpdateCheck}.
 */
export async function fetchLatestNpmVersion(packageName, fetchFn = fetch) {
  if (
    process.env.MILLRACE_TESTS_DISABLE_REGISTRY_FETCH === "1" &&
    fetchFn === fetch
  ) {
    throw new Error(
      "fetchLatestNpmVersion: registry fetch blocked under tests (pass fetchFn or opts.fetchLatest)."
    );
  }
  const url = `${NPM_REGISTRY_LATEST}/${encodeURIComponent(packageName)}/latest`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetchFn(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const v = data && typeof data.version === "string" ? data.version.trim() : "";
    return v || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{
 *   fetchLatest?: typeof fetchLatestNpmVersion,
 *   nowMs?: number,
 *   intervalMs?: number,
 *   skipPrepare?: boolean,
 *   prepareBeforeCheck?: typeof prepareBeforeNpmUpdateCheck,
 *   localUserMatchesMillraceAdmin?: typeof localUserMatchesMillraceAdmin,
 *   localUserIsNonOwnerMillraceFollower?: typeof import("./millraceCatalogSettings.js").localUserIsNonOwnerMillraceFollower,
 *   runInstallThenCycle?: typeof import("./projectCycleAfterUpdate.js").runProjectInstallThenCycle,
 * }} [opts]
 * @returns {Promise<{
 *   currentVersion: string,
 *   latestVersion: string | null,
 *   updateAvailable: boolean,
 *   checkedRegistry: boolean,
 *   projectHasCycleScript: boolean,
 *   lockfileOutOfSync: boolean,
 *   packageMillraceSpec: string | null,
 *   lockSpecifier: string | null,
 *   lockResolvedVersion: string | null,
 * }>}
 */
export async function runNpmUpdateCheck(opts = {}) {
  const ownerCheckFn =
    opts.localUserMatchesMillraceAdmin ?? localUserMatchesMillraceAdmin;
  if (!(await ownerCheckFn())) {
    const followerResult = await runNonOwnerMillraceFollowerSync({
      nowMs:
        typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
          ? opts.nowMs
          : Date.now(),
      intervalMs:
        typeof opts.intervalMs === "number" && opts.intervalMs >= 0
          ? opts.intervalMs
          : NPM_UPDATE_CHECK_INTERVAL_MS,
      gitPull: opts.gitPull,
      runGitSerialized: opts.runGitSerialized,
      dataRootHasGit: opts.dataRootHasGit,
      localUserMatchesMillraceAdmin: ownerCheckFn,
      localUserIsNonOwnerMillraceFollower: opts.localUserIsNonOwnerMillraceFollower,
      runInstallThenCycle: opts.runInstallThenCycle,
    });
    const { version: currentVersion } = await readInstalledMillracePackageMeta();
    const [projectHasCycleScript, drift] = await Promise.all([
      readProjectHasCycleScript(),
      readMillraceLockfileDrift(),
    ]);
    const driftPayload = {
      lockfileOutOfSync: followerResult.ok
        ? false
        : drift.lockfileOutOfSync,
      packageMillraceSpec: drift.packageMillraceSpec,
      lockSpecifier: drift.lockSpecifier,
      lockResolvedVersion: drift.lockResolvedVersion,
    };
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      checkedRegistry: false,
      projectHasCycleScript,
      ...driftPayload,
      followerSyncRan: followerResult.ran,
      followerSyncOk: followerResult.ok ?? false,
      restarting: Boolean(followerResult.restarting),
    };
  }

  const fetchLatest =
    opts.fetchLatest ??
    ((/** @type {string} */ pkg) => fetchLatestNpmVersion(pkg));
  const nowMs =
    typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
      ? opts.nowMs
      : Date.now();
  const intervalMs =
    typeof opts.intervalMs === "number" && opts.intervalMs >= 0
      ? opts.intervalMs
      : NPM_UPDATE_CHECK_INTERVAL_MS;
  const prepare =
    opts.prepareBeforeCheck ?? prepareBeforeNpmUpdateCheck;

  let sections = await readLocalUserIniSections();
  let flow = sections.flow ?? {};
  const lastGitPullRaw =
    flow.last_auto_git_pull ?? flow.lastAutoGitPull ?? "";
  const lastGitPullMs = parseLastCheckMs(String(lastGitPullRaw));
  const withinPrepareCooldown =
    lastGitPullMs != null && nowMs - lastGitPullMs < intervalMs;

  if (!opts.skipPrepare && !withinPrepareCooldown) {
    await prepare({
      nowMs,
      gitPull: opts.gitPull,
      runGitSerialized: opts.runGitSerialized,
      runPnpm: opts.runPnpm,
      dataRootHasGit: opts.dataRootHasGit,
    });
    sections = await readLocalUserIniSections();
    flow = sections.flow ?? {};
  }

  const { version: currentVersion, packageName } =
    await readInstalledMillracePackageMeta();

  const [projectHasCycleScript, drift] = await Promise.all([
    readProjectHasCycleScript(),
    readMillraceLockfileDrift(),
  ]);
  const lastRaw =
    flow.last_npm_update_check ?? flow.lastNpmUpdateCheck ?? "";
  const lastMs = parseLastCheckMs(String(lastRaw));

  const withinCooldown =
    lastMs != null && nowMs - lastMs < intervalMs;

  const driftPayload = {
    lockfileOutOfSync: drift.lockfileOutOfSync,
    packageMillraceSpec: drift.packageMillraceSpec,
    lockSpecifier: drift.lockSpecifier,
    lockResolvedVersion: drift.lockResolvedVersion,
  };

  if (withinCooldown) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      checkedRegistry: false,
      projectHasCycleScript,
      ...driftPayload,
    };
  }

  const latestVersion = await fetchLatest(packageName);

  sections = await readLocalUserIniSections();
  sections.flow = sections.flow ?? {};
  sections.flow.last_npm_update_check = new Date(nowMs).toISOString();
  delete sections.flow.lastNpmUpdateCheck;
  await writeLocalUserIniSections(sections);

  if (!latestVersion) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      checkedRegistry: false,
      projectHasCycleScript,
      ...driftPayload,
    };
  }

  console.info(
    `[millrace] NPM update check: installed ${currentVersion}, npm latest ${latestVersion}`
  );

  const updateAvailable = semverIsNewer(latestVersion, currentVersion);

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    checkedRegistry: true,
    projectHasCycleScript,
    ...driftPayload,
  };
}
