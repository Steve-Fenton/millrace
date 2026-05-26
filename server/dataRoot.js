import { existsSync } from "fs";
import path from "path";
import { cliOptionsFromArgv } from "./cliArgs.js";
import {
  BOARD_CATALOG_INI_BASENAME,
  BOARD_CATALOG_SECTION,
  SNAPSHOTS_JSON_BASENAME,
  LEGACY_BOARD_CATALOG_SECTION,
  MILLRACE_DATA_DIRNAME,
} from "./constants.js";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * @param {string} name section name from `[name]`
 */
export function isBoardCatalogIniSection(name) {
  const n = String(name ?? "").toLowerCase();
  return n === BOARD_CATALOG_SECTION || n === LEGACY_BOARD_CATALOG_SECTION;
}

/**
 * Repo root for tasks/ — prefers `--data-root` CLI arg, then FLOW_ROOT, else a directory that
 * contains tasks/board.ini or tasks/.millrace.ini (script dir then cwd). If neither exists, uses
 * cwd so installs under node_modules never become the data root by default.
 */
function findDataRoot() {
  const cliDataRoot = cliOptionsFromArgv(process.argv).dataRoot;
  if (cliDataRoot) {
    return cliDataRoot;
  }
  if (process.env.FLOW_ROOT) {
    return path.resolve(process.env.FLOW_ROOT);
  }
  for (const base of [REPO_ROOT, process.cwd()]) {
    const tasks = path.join(base, "tasks");
    if (
      existsSync(path.join(tasks, "board.ini")) ||
      existsSync(path.join(tasks, BOARD_CATALOG_INI_BASENAME))
    ) {
      return base;
    }
  }
  return process.cwd();
}

let millraceDataRoot = findDataRoot();

/** @returns {string} */
export function dataRoot() {
  return millraceDataRoot;
}

/**
 * Point Millrace at a directory for integration tests (before handling requests).
 * @param {string} absPath
 */
export function setMillraceDataRootForTesting(absPath) {
  millraceDataRoot = path.resolve(absPath);
}

export function boardCatalogIniPath() {
  return path.join(dataRoot(), "tasks", BOARD_CATALOG_INI_BASENAME);
}

export function millraceDataDirPath() {
  return path.join(dataRoot(), "tasks", MILLRACE_DATA_DIRNAME);
}

/** @param {string} slug board folder under `tasks/` */
export function boardSnapshotsJsonPath(slug) {
  return path.join(dataRoot(), "tasks", slug, SNAPSHOTS_JSON_BASENAME);
}

/** Legacy monolithic snapshot store (`tasks/.millrace/snapshots.json`). */
export function legacySnapshotsJsonPath() {
  return path.join(millraceDataDirPath(), SNAPSHOTS_JSON_BASENAME);
}


/**
 * Keys from `[millrace]` merged over legacy `[flow]` (modern wins).
 * @param {Record<string, Record<string, string>>} sections
 */
export function millraceCatalogKeyBag(sections) {
  const leg = sections[LEGACY_BOARD_CATALOG_SECTION] ?? {};
  const mod = sections[BOARD_CATALOG_SECTION] ?? {};
  return { ...leg, ...mod };
}
