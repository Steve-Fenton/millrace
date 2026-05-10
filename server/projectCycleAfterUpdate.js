import fs from "fs/promises";
import path from "path";
import { spawn } from "node:child_process";
import { dataRoot } from "./dataRoot.js";
import {
  readLocalUserIniSections,
  writeLocalUserIniSections,
} from "./localUserIni.js";

/** @type {Map<string, Promise<{ ok: boolean, reason?: string, message?: string }>>} */
const inFlight = new Map();

/**
 * When set (tests only), replaces real `pnpm` spawn.
 * @type {null | ((args: string[], cwd: string) => Promise<void>)}
 */
let pnpmRunnerOverride = null;

/** @param {null | ((args: string[], cwd: string) => Promise<void>)} fn */
export function setProjectCyclePnpmRunnerForTesting(fn) {
  pnpmRunnerOverride = fn;
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
function runPnpmSpawn(args, cwd) {
  return new Promise((resolve, reject) => {
    const opts = {
      cwd,
      stdio: "inherit",
      ...(process.platform === "win32" ? { shell: true } : {}),
    };
    const child = spawn("pnpm", args, opts);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `pnpm ${args.join(" ")} exited ${code}${signal ? ` (${signal})` : ""}`
        )
      );
    });
  });
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
function runPnpm(args, cwd) {
  if (pnpmRunnerOverride) {
    return pnpmRunnerOverride(args, cwd);
  }
  return runPnpmSpawn(args, cwd);
}

/**
 * Whether `package.json` at the data root defines `scripts.cycle` (used by update-check JSON).
 * @returns {Promise<boolean>}
 */
export async function readProjectHasCycleScript() {
  const root = dataRoot();
  const pkgPath = path.join(root, "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    const c = pkg.scripts && pkg.scripts.cycle;
    return typeof c === "string" && c.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Run `pnpm update --latest` then `pnpm cycle` after the user chose “Update now” in the UI.
 *
 * @param {string} registryLatestVersion
 * @param {{ deferCycle?: boolean }} [opts]
 * When `deferCycle` is true (HTTP handler), `pnpm cycle` runs on the next event-loop turn after
 * returning success so the client receives JSON before the process restarts (e.g. PM2).
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string, restarting?: boolean }>}
 */
export async function runProjectCycleAfterUserConfirm(registryLatestVersion, opts = {}) {
  const key = String(registryLatestVersion ?? "").trim();
  if (!key) {
    return { ok: false, reason: "bad_request", message: "Missing latestVersion." };
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const run = executeProjectCycleSteps(key, opts);
  inFlight.set(key, run);

  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * @param {string} registryLatestVersion
 * @param {{ deferCycle?: boolean }} [opts]
 * @returns {Promise<ProjectCycleResult>}
 */
async function executeProjectCycleSteps(registryLatestVersion, opts = {}) {
  const deferCycle = Boolean(opts.deferCycle);
  const root = dataRoot();
  const pkgPath = path.join(root, "package.json");
  let pkgRaw;
  try {
    pkgRaw = await fs.readFile(pkgPath, "utf8");
  } catch {
    console.info(
      `[millrace] NPM update (user): no package.json in data root (${root})`
    );
    return {
      ok: false,
      reason: "no_package_json",
      message: "No package.json in the Millrace data root.",
    };
  }

  /** @type {{ scripts?: Record<string, string> }} */
  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    return {
      ok: false,
      reason: "invalid_package_json",
      message: "Could not parse package.json.",
    };
  }

  const cycleScript = pkg.scripts && pkg.scripts.cycle;
  const hasCycle =
    typeof cycleScript === "string" && cycleScript.trim().length > 0;

  if (!hasCycle) {
    return {
      ok: false,
      reason: "no_cycle_script",
      message: 'package.json has no "cycle" script.',
    };
  }

  console.info(
    `[millrace] NPM update (user): running \`pnpm update --latest\` then \`pnpm cycle\` in ${root}`
  );

  try {
    await runPnpm(["update", "--latest"], root);
    if (deferCycle) {
      await markAutoCycleEvaluated(registryLatestVersion);
      const rootRef = root;
      const verRef = registryLatestVersion;
      setImmediate(() => {
        void (async () => {
          try {
            await runPnpm(["cycle"], rootRef);
            console.info(
              `[millrace] NPM update (user): finished deferred pnpm cycle for registry v${verRef}`
            );
          } catch (e) {
            console.warn(
              "[millrace] NPM update (user): deferred pnpm cycle failed:",
              e
            );
          }
        })();
      });
      console.info(
        `[millrace] NPM update (user): update ok for registry v${registryLatestVersion}; cycle deferred until after HTTP response`
      );
      return { ok: true, restarting: true };
    }
    await runPnpm(["cycle"], root);
    await markAutoCycleEvaluated(registryLatestVersion);
    console.info(
      `[millrace] NPM update (user): finished pnpm for registry v${registryLatestVersion}`
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[millrace] NPM update (user): pnpm failed:", e);
    return {
      ok: false,
      reason: "pnpm_failed",
      message: msg,
    };
  }
}

/**
 * @param {string} registryLatestVersion
 */
async function markAutoCycleEvaluated(registryLatestVersion) {
  try {
    const sections = await readLocalUserIniSections();
    sections.flow = sections.flow ?? {};
    sections.flow.npm_auto_cycle_for = registryLatestVersion;
    delete sections.flow.npmAutoCycleFor;
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn(
      "[millrace] could not write npm_auto_cycle_for to localuser.ini:",
      e
    );
  }
}
