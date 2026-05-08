#!/usr/bin/env node
/**
 * Serves the Millrace UI and writes task INIs + tasks/localuser.ini under this repo
 * ([user] default owner, [flow] machine-local timestamps, etc.).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import express from "express";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  columnNameForIniItem,
  normalizeLinksForIni,
  serializeCardIni,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "./assets/js/ini/cardIni.js";
import { resolveCardColumnIndex } from "./assets/js/ini/columnResolve.js";
import {
  boardOwnerEmailsForFilter,
  canAssignCardOwner,
  parseBoardIni,
  validateExactlyOneDoneColumn,
} from "./assets/js/models/boardModel.js";
import {
  defaultSwimlaneIndex,
  resolveCardSwimlaneIndex,
} from "./assets/js/ini/swimlaneResolve.js";
import { parseIni } from "./assets/js/ini/parseIni.js";
import { summarizeCardIniDiff } from "./assets/js/git/taskDiff.js";
import { parseTaskCardIni, parseTaskCardIniFull } from "./assets/js/models/taskModel.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Catalog of board INIs under `tasks/` (dotfile, distinct from `*.ini` boards). */
const BOARD_CATALOG_INI_BASENAME = ".millrace.ini";
/** Section in that file listing board INI basenames. Legacy section name: `flow`. */
const BOARD_CATALOG_SECTION = "millrace";
const LEGACY_BOARD_CATALOG_SECTION = "flow";

/**
 * @param {string} name section name from `[name]`
 */
function isBoardCatalogIniSection(name) {
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
  for (const base of [SCRIPT_DIR, process.cwd()]) {
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
function dataRoot() {
  return millraceDataRoot;
}

/**
 * Point Millrace at a directory for integration tests (before handling requests).
 * @param {string} absPath
 */
export function setMillraceDataRootForTesting(absPath) {
  millraceDataRoot = path.resolve(absPath);
}

function boardCatalogIniPath() {
  return path.join(dataRoot(), "tasks", BOARD_CATALOG_INI_BASENAME);
}

/** Default when `tasks/.millrace.ini` omits `archive_closed_after_days` / `cold_storage_archive_after_months`. */
const DEFAULT_ARCHIVE_CLOSED_AFTER_DAYS = 14;
const DEFAULT_COLD_STORAGE_ARCHIVE_AFTER_MONTHS = 12;

/**
 * Keys from `[millrace]` merged over legacy `[flow]` (modern wins).
 * @param {Record<string, Record<string, string>>} sections
 */
function millraceCatalogKeyBag(sections) {
  const leg = sections[LEGACY_BOARD_CATALOG_SECTION] ?? {};
  const mod = sections[BOARD_CATALOG_SECTION] ?? {};
  return { ...leg, ...mod };
}

/**
 * Retention thresholds from `[millrace]` in `tasks/.millrace.ini` (same section as `boards`).
 * @returns {Promise<{ archiveClosedAfterDays: number, coldStorageArchiveAfterMonths: number }>}
 */
async function readMillraceCatalogRetentionSettings() {
  let archiveClosedAfterDays = DEFAULT_ARCHIVE_CLOSED_AFTER_DAYS;
  let coldStorageArchiveAfterMonths = DEFAULT_COLD_STORAGE_ARCHIVE_AFTER_MONTHS;
  try {
    const text = await fs.readFile(boardCatalogIniPath(), "utf8");
    const sections = parseIni(text.replace(/^\uFEFF/, ""));
    const bag = millraceCatalogKeyBag(sections);
    const ad =
      bag.archive_closed_after_days ?? bag.archiveClosedAfterDays;
    const cm =
      bag.cold_storage_archive_after_months ??
      bag.coldStorageArchiveAfterMonths;
    if (ad !== undefined && String(ad).trim() !== "") {
      const n = Number.parseInt(String(ad).trim(), 10);
      if (Number.isFinite(n) && n >= 0) archiveClosedAfterDays = n;
    }
    if (cm !== undefined && String(cm).trim() !== "") {
      const n = Number.parseFloat(String(cm).trim());
      if (Number.isFinite(n) && n >= 0) coldStorageArchiveAfterMonths = n;
    }
  } catch {
    /* missing or unreadable catalog — defaults */
  }
  return { archiveClosedAfterDays, coldStorageArchiveAfterMonths };
}

/** Average Gregorian month length for age cutoffs (archive → cold-storage). */
const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;

const LOCAL_USER_REL = path.join("tasks", "localuser.ini");

/** @returns {string} */
function localUserPath() {
  return path.join(dataRoot(), LOCAL_USER_REL);
}

const execFileAsync = promisify(execFile);

/**
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
async function readLocalUserIniSections() {
  try {
    const text = await fs.readFile(localUserPath(), "utf8");
    return parseIni(text.replace(/^\uFEFF/, ""));
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, string> | undefined} pref `[preferences]` section
 * @returns {"automatic" | "manual"}
 */
function syncModeFromPreferencesSection(pref) {
  const raw = String(pref?.sync_mode ?? pref?.syncMode ?? "")
    .trim()
    .toLowerCase();
  return raw === "manual" ? "manual" : "automatic";
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
function serializeLocalUserIniFile(sections) {
  const out = [];
  const allNames = Object.keys(sections).filter((n) => n !== "_root");
  /** @param {string} name */
  function emitSection(name) {
    const sec = sections[name];
    if (!sec || typeof sec !== "object") return;
    const keys = Object.keys(sec).filter((k) => {
      const v = sec[k];
      return v != null && String(v).trim() !== "";
    });
    if (keys.length === 0) return;
    keys.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    out.push(`[${name}]`);
    for (const k of keys) {
      const val = String(sec[k]).trim().replace(/\r?\n/g, " ");
      out.push(`${k} = ${val}`);
    }
    out.push("");
  }
  const preferred = ["user", "flow", "preferences"];
  const seen = new Set();
  for (const n of preferred) {
    if (!allNames.includes(n)) continue;
    emitSection(n);
    seen.add(n);
  }
  for (const n of [...allNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  )) {
    if (seen.has(n)) continue;
    emitSection(n);
  }
  if (out.length === 0) return "";
  return out.join("\n").replace(/\n+\z/, "\n");
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
async function writeLocalUserIniSections(sections) {
  const text = serializeLocalUserIniFile(sections);
  const tasksDir = path.join(dataRoot(), "tasks");
  await ensureDir(tasksDir);
  if (!text.trim()) {
    try {
      await fs.unlink(localUserPath());
    } catch {
      /* absent or unreadable */
    }
    return;
  }
  await fs.writeFile(localUserPath(), text, "utf8");
}

/** Non-interactive git (no editor / terminal prompt for pull merge messages / credentials). */
function gitChildEnv() {
  return {
    ...process.env,
    GIT_EDITOR: "true",
    GIT_TERMINAL_PROMPT: "0",
  };
}

/** One git mutation at a time at the Millrace data root (e.g. `/api/git/sync` vs log endpoints). */
let gitSerializedChain = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function runGitSerialized(fn) {
  const run = gitSerializedChain.then(() => fn());
  gitSerializedChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

/**
 * @param {string} step
 * @param {unknown} err
 */
function formatGitExecError(step, err) {
  const e = /** @type {Error & { stderr?: Buffer, stdout?: Buffer }} */ (err);
  const stderr = e.stderr ? e.stderr.toString().trim() : "";
  const stdout = e.stdout ? e.stdout.toString().trim() : "";
  const parts = [stderr, stdout, e.message].filter(
    (s) => String(s).trim().length > 0
  );
  const text = parts.join("\n").trim().slice(0, 2000);
  return text ? `${step}:\n${text}` : `${step} failed.`;
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
function pendingSyncFromSections(sections) {
  const v = sections.flow?.pending_sync ?? sections.flow?.pendingSync ?? "";
  return /^1|true|yes$/i.test(String(v).trim());
}

async function markDataRootPendingSync() {
  try {
    const sections = await readLocalUserIniSections();
    sections.flow = sections.flow ?? {};
    sections.flow.pending_sync = "1";
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn("[flow] could not set pending_sync:", e);
  }
}

async function clearDataRootPendingSync() {
  try {
    const sections = await readLocalUserIniSections();
    if (!sections.flow) return;
    delete sections.flow.pending_sync;
    delete sections.flow.pendingSync;
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn("[flow] could not clear pending_sync:", e);
  }
}

/**
 * Repo-relative path using `/`; rejects `..` and paths escaping the Millrace data root.
 * @param {string} rel
 * @returns {string | null}
 */
function safeRepoRelativePath(rel) {
  const raw = String(rel ?? "").trim().replace(/\\/g, "/");
  if (!raw || raw.includes("..")) return null;
  const top = raw.split("/").filter(Boolean)[0] ?? "";
  if (top === ".git") return null;
  const abs = path.resolve(dataRoot(), ...raw.split("/"));
  const root = path.resolve(dataRoot());
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  const out = path.relative(root, abs);
  if (out.startsWith("..") || path.isAbsolute(out)) return null;
  return out.split(path.sep).join("/");
}

/**
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 * @returns {Promise<string[]>} repo-relative paths with `/`
 */
async function gitUnmergedPaths(opts) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-only", "--diff-filter=U"],
      opts
    );
    return String(stdout ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {string[]} relPaths
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
async function readConflictFilePayloads(relPaths, opts) {
  const cwd = opts.cwd;
  /** @type {{ path: string, content: string }[]} */
  const files = [];
  for (const raw of relPaths) {
    const rel = String(raw).trim().replace(/\\/g, "/");
    const safe = safeRepoRelativePath(rel);
    if (!safe) continue;
    const abs = path.join(cwd, ...safe.split("/"));
    let content = "";
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      content = "";
    }
    files.push({ path: safe, content });
  }
  return files;
}

/**
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
async function gitIndexHasStagedChanges(opts) {
  try {
    await execFileAsync("git", ["diff", "--cached", "--quiet"], opts);
    return false;
  } catch {
    return true;
  }
}

/**
 * Stage everything under `tasks/` and create one commit if there are staged changes.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
async function commitOutstandingTasksDir(opts) {
  await execFileAsync("git", ["add", "--", "tasks"], opts);
  if (!(await gitIndexHasStagedChanges(opts))) return;
  await execFileAsync(
    "git",
    ["commit", "-m", "Millrace: save pending changes"],
    opts
  );
}

/**
 * `git pull --autostash` when available (Git 2.14+), else plain pull.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
async function gitPullWithOptionalAutostash(opts) {
  try {
    await execFileAsync(
      "git",
      ["pull", "--no-edit", "--autostash"],
      opts
    );
    return;
  } catch (e) {
    const err = /** @type {Error & { stderr?: Buffer }} */ (e);
    const msg = `${err.stderr ? err.stderr.toString() : ""} ${err.message ?? ""}`.toLowerCase();
    if (
      msg.includes("unknown option") ||
      msg.includes("invalid option") ||
      msg.includes("unrecognized option")
    ) {
      await execFileAsync("git", ["pull", "--no-edit"], opts);
      return;
    }
    throw e;
  }
}

function sanitizeSegment(s) {
  const t = String(s)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return t || "board";
}

/** Slug from `[board]` metadata (matches client `boardSlugFrom`). */
function boardSlugFromMeta(board) {
  const raw = String(board?.slug ?? board?.name ?? "board").trim();
  return sanitizeSegment(raw);
}

function newCardId() {
  return `FLOW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {unknown} name */
function safeCardIniFilename(name) {
  const base = path.basename(String(name ?? "").trim());
  if (!base.endsWith(".ini")) return null;
  if (!/^[\w.-]+\.ini$/i.test(base)) return null;
  return base;
}

/**
 * Cards live at tasks/{slug}/{filename}.ini (flat). Legacy: tasks/{slug}/columns.{n}/{filename}.
 * @param {string} slug
 * @param {number} col — hint for legacy layout search order
 * @param {string} filename
 * @returns {Promise<string | null>} absolute path or null
 */
async function resolveCardFilePath(slug, col, filename) {
  const flat = path.join(dataRoot(), "tasks", slug, filename);
  try {
    await fs.access(flat);
    return flat;
  } catch {
    /* legacy */
  }

  const primary = path.join(
    dataRoot(),
    "tasks",
    slug,
    `columns.${col}`,
    filename
  );
  try {
    await fs.access(primary);
    return primary;
  } catch {
    /* continue */
  }

  const boardRoot = path.join(dataRoot(), "tasks", slug);
  let dirents;
  try {
    dirents = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const ent of dirents) {
    if (!ent.isDirectory()) continue;
    if (!/^columns\.\d+$/.test(ent.name)) continue;
    const candidate = path.join(boardRoot, ent.name, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* continue */
    }
  }
  return null;
}

async function readBoardCatalogIniBasenames() {
  const catalogPath = boardCatalogIniPath();
  const defaultList = ["board.ini"];
  try {
    const text = await fs.readFile(catalogPath, "utf8");
    const sections = parseIni(text.replace(/^\uFEFF/, ""));
    const raw =
      sections[BOARD_CATALOG_SECTION]?.boards ??
      sections[LEGACY_BOARD_CATALOG_SECTION]?.boards ??
      "";
    const parts = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  } catch {
    /* missing or unreadable board catalog INI */
  }
  return defaultList;
}

/**
 * Boards from `tasks/.millrace.ini` (`[millrace]` / legacy `[flow]` `boards =`) with parsed slug and display name.
 * @returns {Promise<{ file: string, slug: string, name: string }[]>}
 */
async function loadBoardCatalog() {
  const files = await readBoardCatalogIniBasenames();
  /** @type {{ file: string, slug: string, name: string }[]} */
  const out = [];
  for (const file of files) {
    const base = path.basename(String(file ?? "").trim());
    if (!/^[\w.-]+\.ini$/i.test(base)) continue;
    const full = path.join(dataRoot(), "tasks", base);
    try {
      const iniText = await fs.readFile(full, "utf8");
      const m = parseBoardIni(iniText);
      const slug = boardSlugFromMeta(m.board);
      const name = m.board.name?.trim() || slug || "Board";
      out.push({ file: base, slug, name });
    } catch {
      console.warn(`[flow] board catalog lists ${base} but it could not be read`);
    }
  }
  if (out.length === 0) {
    try {
      const full = path.join(dataRoot(), "tasks", "board.ini");
      const iniText = await fs.readFile(full, "utf8");
      const m = parseBoardIni(iniText);
      const slug = boardSlugFromMeta(m.board);
      const name = m.board.name?.trim() || slug || "Board";
      out.push({ file: "board.ini", slug, name });
    } catch {
      /* no board definitions */
    }
  }
  return out;
}

/**
 * Default board definition INI for a new board (To Do / Doing / Done + Default swimlane).
 * @param {string} displayName
 * @param {string} slug
 */
function defaultNewBoardIniText(displayName, slug) {
  const nameLine = String(displayName ?? "").trim().replace(/\r?\n/g, " ");
  const safeName = nameLine || slug;
  return `[board]
name = ${safeName}
slug = ${slug}

[columns.1]
title = To Do

[columns.2]
title = Doing

[columns.3]
title = Done
is_done = true

[swimlanes.1]
title = Default
`;
}

/**
 * Append `newBoardIniBasename` to `tasks/.millrace.ini` (create if missing).
 * @param {string} newBoardIniBasename e.g. "acme.ini"
 */
async function appendBoardCatalogEntry(newBoardIniBasename) {
  const catalogPath = boardCatalogIniPath();
  const want = path.basename(String(newBoardIniBasename ?? "").trim());
  if (!/^[\w.-]+\.ini$/i.test(want)) {
    throw new Error("Invalid board INI filename.");
  }

  let catalogText = "";
  try {
    catalogText = await fs.readFile(catalogPath, "utf8");
  } catch {
    /* missing catalog */
  }

  if (!catalogText.trim()) {
    const catalog = await loadBoardCatalog();
    /** @type {string[]} */
    const files = catalog.map((c) => c.file).filter(Boolean);
    if (!files.includes(want)) files.push(want);
    const body = `; Boards listed here are INI files under tasks/ (comma-separated, in order).\n[${BOARD_CATALOG_SECTION}]\nboards = ${files.join(", ")}\n`;
    await fs.writeFile(catalogPath, body, "utf8");
    return;
  }

  const lines = catalogText.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let inCatalogSection = false;
  let updatedBoards = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const secMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (secMatch) {
      if (isBoardCatalogIniSection(secMatch[1])) {
        inCatalogSection = true;
        out.push(`[${BOARD_CATALOG_SECTION}]`);
        continue;
      }
      inCatalogSection = false;
      out.push(line);
      continue;
    }
    if (inCatalogSection && /^boards\s*=/i.test(trimmed)) {
      const eq = line.indexOf("=");
      const val = eq >= 0 ? line.slice(eq + 1).trim() : "";
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes(want)) parts.push(want);
      const indent = line.match(/^\s*/)?.[0] ?? "";
      out.push(`${indent}boards = ${parts.join(", ")}`);
      updatedBoards = true;
      continue;
    }
    out.push(line);
  }
  if (!updatedBoards) {
    const catalog = await loadBoardCatalog();
    const files = catalog.map((c) => c.file).filter(Boolean);
    if (!files.includes(want)) files.push(want);
    out.push("", `[${BOARD_CATALOG_SECTION}]`, `boards = ${files.join(", ")}`);
  }
  await fs.writeFile(catalogPath, out.join("\n"), "utf8");
}

/**
 * @param {string} boardDisplayName
 * @returns {Promise<{ slug: string, file: string }>}
 */
async function allocateNewBoardSlugAndFile(boardDisplayName) {
  const catalog = await loadBoardCatalog();
  const tasksDir = path.join(dataRoot(), "tasks");
  const base = sanitizeSegment(boardDisplayName);

  for (let i = 0; i < 1000; i++) {
    const slug = i === 0 ? base : `${base}-${i}`;
    const file = `${slug}.ini`;
    if (catalog.some((c) => c.slug === slug || c.file === file)) continue;
    const fullIni = path.join(tasksDir, file);
    if (existsSync(fullIni)) continue;
    return { slug, file };
  }
  throw new Error("Could not allocate a unique board slug.");
}

async function resolveBoardIniPathForSlug(slug) {
  const want = sanitizeSegment(slug);
  const catalog = await loadBoardCatalog();
  const hit = catalog.find((e) => e.slug === want);
  if (hit) return path.join(dataRoot(), "tasks", hit.file);
  const fallback = path.join(dataRoot(), "tasks", "board.ini");
  if (existsSync(fallback)) return fallback;
  if (catalog.length > 0) {
    return path.join(dataRoot(), "tasks", catalog[0].file);
  }
  return fallback;
}

async function loadBoardColumnAndSwimlaneDefsForSlug(slug) {
  try {
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text);
    return { columns: m.columns, swimlanes: m.swimlanes };
  } catch {
    return { columns: [], swimlanes: [] };
  }
}

/** `[users.N]` from the board INI (for owner policy). */
async function loadBoardUsersForOwnerPolicy(slug) {
  try {
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text.replace(/^\uFEFF/, ""));
    return m.users ?? [];
  } catch {
    return [];
  }
}

/**
 * Lane index for API body `swimlaneIndex` (0 = default lane when board has no swimlanes).
 * @param {number} laneNum
 * @param {Array<{ index: number, title: string }>} swimlanesDef
 */
function laneIndexFromBody(laneNum, swimlanesDef) {
  if (!swimlanesDef.length) return 0;
  if (Number.isInteger(laneNum) && laneNum >= 1) return laneNum;
  return defaultSwimlaneIndex(swimlanesDef);
}

/**
 * Flat `tasks/{slug}/*.ini` summaries for ordering.
 * @param {string} slug
 */
async function readFlatBoardIniSummaries(slug) {
  const boardRoot = path.join(dataRoot(), "tasks", slug);
  /** @type {{ filename: string, fullPath: string, parsed: object}[]} */
  const out = [];
  let dirents;
  try {
    dirents = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of dirents) {
    if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
    const fullPath = path.join(boardRoot, ent.name);
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      const parsed = parseTaskCardIni(raw);
      out.push({ filename: ent.name, fullPath, parsed });
    } catch (err) {
      console.warn("Skipping unreadable task file:", ent.name, err);
    }
  }
  return out;
}

/**
 * Move closed cards older than `maxAgeDays` from `tasks/{slug}/*.ini` to `tasks/{slug}/archive/*.ini`.
 * @returns {Promise<number>} files moved
 */
async function archiveStaleClosedTaskFiles(slug, maxAgeDays) {
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
async function runArchiveStaleClosedForSlug(slug) {
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
async function runStartupArchiveStaleForCatalogSlugs() {
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

/**
 * Max `sort_order` among cards in this column + swimlane (flat layout only).
 * @param {string | null} excludeFilename — omit when computing space for a moved card
 */
async function maxSortOrderForCell(
  slug,
  colIdx,
  laneIdx,
  columns,
  swimlanes,
  excludeFilename
) {
  const rows = await readFlatBoardIniSummaries(slug);
  let max = 0;
  for (const { filename, parsed } of rows) {
    if (excludeFilename && filename === excludeFilename) continue;
    if (resolveCardColumnIndex(parsed.column, columns) !== colIdx) continue;
    if (resolveCardSwimlaneIndex(parsed.swimlane, swimlanes) !== laneIdx) continue;
    const n = Number(parsed.sort_order);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function parseIniTruthy(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/**
 * Column index from …/tasks/{slug}/columns.{n}/… path (authoritative vs client hints).
 * @param {string} fullPath
 * @returns {number | null}
 */
function columnIndexFromTasksPath(fullPath) {
  const m = String(fullPath).match(/[/\\]columns\.(\d+)[/\\]/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Whether the board definition for `slug` marks columns.{n} with is_done (Kanban done column).
 * @param {string} slug
 * @param {number} columnIndex
 */
async function columnSectionIsDone(slug, columnIndex) {
  try {
    const boardPath = await resolveBoardIniPathForSlug(slug);
    let text = await fs.readFile(boardPath, "utf8");
    text = text.replace(/^\uFEFF/, "");
    const sections = parseIni(text);
    const sec = sections[`columns.${columnIndex}`];
    if (!sec) return false;
    let raw = sec.is_done;
    if (raw === undefined || raw === "") {
      const hit = Object.keys(sec).find((k) => k.toLowerCase() === "is_done");
      if (hit) raw = sec[hit];
    }
    return parseIniTruthy(raw);
  } catch {
    return false;
  }
}

async function writeLocalUserIni(owner) {
  const value = String(owner).trim();
  if (!value) return;
  const line = value.replace(/\r?\n/g, " ");
  const sections = await readLocalUserIniSections();
  sections.user = sections.user ?? {};
  sections.user.owner = line;
  await writeLocalUserIniSections(sections);
}

export const app = express();
app.use(express.json({ limit: "512kb" }));

app.get("/api/flow", async (_req, res) => {
  try {
    const boards = await loadBoardCatalog();
    res.json({ boards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read board catalog (.millrace.ini)." });
  }
});

app.get("/api/board", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text);
    const declaredSlug = boardSlugFromMeta(m.board);
    const name = m.board.name?.trim() || declaredSlug || "Board";
    res.json({
      text,
      slug: declaredSlug,
      name,
      file: path.basename(boardPath),
    });
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
      res.status(404).json({
        message: `Board definition not found (looked under ${dataRoot()}/tasks/).`,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ message: "Failed to read board." });
  }
});

app.post("/api/board", async (req, res) => {
  try {
    const displayName = String(req.body?.name ?? "").trim();
    if (!displayName) {
      res.status(400).json({ message: "Board name is required." });
      return;
    }

    const { slug, file } = await allocateNewBoardSlugAndFile(displayName);
    const iniText = defaultNewBoardIniText(displayName, slug);
    let model;
    try {
      model = parseBoardIni(iniText.replace(/^\uFEFF/, ""));
    } catch (e) {
      res.status(500).json({
        message: e instanceof Error ? e.message : "Invalid generated board INI.",
      });
      return;
    }
    if (!model.columns?.length) {
      res.status(500).json({ message: "Generated board has no columns." });
      return;
    }

    const tasksDir = path.join(dataRoot(), "tasks");
    const boardIniPath = path.join(tasksDir, file);
    await fs.writeFile(boardIniPath, iniText, "utf8");
    try {
      await appendBoardCatalogEntry(file);
    } catch (e) {
      try {
        await fs.unlink(boardIniPath);
      } catch {
        /* best effort */
      }
      throw e;
    }

    const boardRoot = path.join(tasksDir, slug);
    await ensureDir(boardRoot);

    await markDataRootPendingSync();
    res.json({
      ok: true,
      slug,
      name: model.board.name?.trim() || displayName,
      file,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to create board.",
    });
  }
});

const BOARD_TASK_INI_RE = /^FLOW-[\w.-]+\.ini$/i;

/**
 * @param {string} slug
 * @returns {Promise<string[]>} absolute paths
 */
async function walkBoardTaskIniPaths(slug) {
  const root = path.join(dataRoot(), "tasks", slug);
  /** @type {string[]} */
  const out = [];
  async function walk(dir) {
    let ents;
    try {
      ents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && BOARD_TASK_INI_RE.test(e.name)) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * @param {import("./assets/js/models/boardModel.js").BoardModel} model
 * @param {"columns" | "swimlanes"} kind
 */
function boardTitleMultiset(model, kind) {
  const list =
    kind === "columns"
      ? [...(model.columns ?? [])].sort((a, b) => a.index - b.index)
      : [...(model.swimlanes ?? [])].sort((a, b) => a.index - b.index);
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const entry of list) {
    const title = String(entry.title ?? "").trim().toLowerCase();
    m.set(title, (m.get(title) ?? 0) + 1);
  }
  return m;
}

/**
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 */
function multisetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/**
 * Same column & swimlane titles (incl. counts / duplicates) — only order or non-placement
 * fields (WIP, is_done, etc.) changed. Cards use titles, so no INI updates.
 * @param {import("./assets/js/models/boardModel.js").BoardModel} oldModel
 * @param {import("./assets/js/models/boardModel.js").BoardModel} newModel
 */
function isPureColumnSwimlaneReorderForTasks(oldModel, newModel) {
  const oc = boardTitleMultiset(oldModel, "columns");
  const nc = boardTitleMultiset(newModel, "columns");
  const os = boardTitleMultiset(oldModel, "swimlanes");
  const ns = boardTitleMultiset(newModel, "swimlanes");
  return multisetsEqual(oc, nc) && multisetsEqual(os, ns);
}

/**
 * After board definition change, rewrite each card's column/swimlane strings when titles
 * or lane/column counts change (renames, add/remove). Skipped for pure reorder — cards
 * stay keyed by name and still resolve.
 * Resolves each card's stored column/swimlane against the new board by title (or legacy
 * numeric id), not by old board slot index — so inserting or reordering columns does not
 * reassign cards to whatever title occupied the same index.
 * @param {string} slug
 * @param {import("./assets/js/models/boardModel.js").BoardModel} newModel
 */
async function syncTaskFilesToNewBoardModel(slug, newModel) {
  const paths = await walkBoardTaskIniPaths(slug);
  for (const fullPath of paths) {
    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }
    let item;
    let links;
    try {
      ({ item, links } = parseTaskCardIniFull(raw));
    } catch {
      continue;
    }
    const colIdx = resolveCardColumnIndex(item.column, newModel.columns);
    item.column = columnNameForIniItem(newModel.columns, colIdx);
    const laneIdx = resolveCardSwimlaneIndex(item.swimlane, newModel.swimlanes);
    const ln = swimlaneNameForIniItem(newModel.swimlanes, laneIdx);
    if (ln !== undefined) item.swimlane = ln;
    else delete item.swimlane;
    const next = serializeFullCardIni(item, links);
    if (next !== raw) {
      await fs.writeFile(fullPath, next, "utf8");
    }
  }
}

app.put("/api/board-definition", async (req, res) => {
  try {
    const { boardSlug, text } = req.body ?? {};
    const slug = sanitizeSegment(String(boardSlug ?? "board"));
    const t = String(text ?? "");
    if (!t.trim()) {
      res.status(400).json({ message: "Board INI text is required." });
      return;
    }

    let newModel;
    try {
      newModel = parseBoardIni(t.replace(/^\uFEFF/, ""));
    } catch (e) {
      res.status(400).json({
        message: e instanceof Error ? e.message : "Invalid board INI.",
      });
      return;
    }
    if (!newModel.columns || newModel.columns.length === 0) {
      res.status(400).json({ message: "Board must define at least one column." });
      return;
    }

    const doneColumnError = validateExactlyOneDoneColumn(newModel);
    if (doneColumnError) {
      res.status(400).json({ message: doneColumnError });
      return;
    }

    const boardPath = await resolveBoardIniPathForSlug(slug);
    let oldText = "";
    try {
      oldText = await fs.readFile(boardPath, "utf8");
    } catch {
      res.status(404).json({ message: "Board definition not found." });
      return;
    }

    let oldModel;
    try {
      oldModel = parseBoardIni(oldText.replace(/^\uFEFF/, ""));
    } catch {
      oldModel = newModel;
    }

    const declared = boardSlugFromMeta(newModel.board);
    if (declared !== slug) {
      res.status(400).json({
        message: `Board [board] slug (${declared}) must match the board being edited (${slug}).`,
      });
      return;
    }

    if (!isPureColumnSwimlaneReorderForTasks(oldModel, newModel)) {
      await syncTaskFilesToNewBoardModel(slug, newModel);
    }

    await fs.writeFile(boardPath, t.replace(/^\uFEFF/, ""), "utf8");

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to save board.",
    });
  }
});

app.delete("/api/board-definition", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const catalog = await loadBoardCatalog();
    if (catalog.length <= 1) {
      res.status(400).json({
        message: "Cannot delete the only board in the catalog.",
      });
      return;
    }
    const hit = catalog.find((e) => e.slug === slug);
    if (!hit) {
      res.status(404).json({ message: "Board not found in catalog." });
      return;
    }

    const boardPath = path.join(dataRoot(), "tasks", hit.file);
    try {
      await fs.unlink(boardPath);
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
        res.status(404).json({ message: "Board file already removed." });
        return;
      }
      throw e;
    }

    const catalogPath = boardCatalogIniPath();
    try {
      const catalogText = await fs.readFile(catalogPath, "utf8");
      const lines = catalogText.split(/\r?\n/);
      /** @type {string[]} */
      const out = [];
      let inCatalogSection = false;
      for (const line of lines) {
        const trimmed = line.trim();
        const secMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
        if (secMatch) {
          if (isBoardCatalogIniSection(secMatch[1])) {
            inCatalogSection = true;
            out.push(`[${BOARD_CATALOG_SECTION}]`);
            continue;
          }
          inCatalogSection = false;
          out.push(line);
          continue;
        }
        if (inCatalogSection && /^boards\s*=/i.test(trimmed)) {
          const eq = line.indexOf("=");
          const val = eq >= 0 ? line.slice(eq + 1).trim() : "";
          const parts = val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((p) => p !== hit.file);
          if (parts.length === 0) {
            res.status(400).json({
              message: "Refusing to leave the board catalog with an empty boards list.",
            });
            return;
          }
          const indent = line.match(/^\s*/)?.[0] ?? "";
          out.push(`${indent}boards = ${parts.join(", ")}`);
          continue;
        }
        out.push(line);
      }
      await fs.writeFile(catalogPath, out.join("\n"), "utf8");
    } catch {
      /* no catalog file — single-file setups already blocked by catalog length */
    }

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to delete board.",
    });
  }
});

/**
 * Git history for the board definition INI (`tasks/devrel.ini`, etc.).
 */
app.get("/api/board-definition/git-history", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const limitRaw = Number.parseInt(String(req.query.limit ?? "40"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, limitRaw))
      : 40;

    const boardPath = await resolveBoardIniPathForSlug(slug);
    if (!existsSync(boardPath)) {
      res.status(404).json({ message: "Board definition not found." });
      return;
    }

    if (!existsSync(path.join(dataRoot(), ".git"))) {
      res.json({
        gitAvailable: false,
        path: null,
        commits: [],
        message: "No Git repository at the Millrace data root.",
      });
      return;
    }

    let rel = path.relative(dataRoot(), boardPath);
    rel = rel.split(path.sep).join("/");
    const norm = path.posix.normalize(rel);
    const absNorm = path.resolve(dataRoot(), norm);
    const tasksRoot = path.resolve(dataRoot(), "tasks");
    if (
      norm.startsWith("../") ||
      norm === ".." ||
      norm.startsWith("/") ||
      !norm.startsWith("tasks/") ||
      (!absNorm.startsWith(tasksRoot + path.sep) && absNorm !== tasksRoot)
    ) {
      res.status(400).json({ message: "Invalid board path for history." });
      return;
    }

    const env = gitChildEnv();
    const opts = {
      cwd: dataRoot(),
      env,
      maxBuffer: 5 * 1024 * 1024,
    };

    /** @type {{ hash: string, shortHash: string, date: string, author: string, subject: string, changeSummary?: string[] }[]} */
    const commits = [];
    let gitMessage = "";

    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "log",
          "--follow",
          `-n${limit}`,
          "--format=%H%x1f%h%x1f%ai%x1f%an%x1f%s",
          "--",
          norm,
        ],
        opts
      );
      const out = String(stdout ?? "").trim();
      for (const line of out.split("\n")) {
        if (!line) continue;
        const p = line.split("\x1f");
        if (p.length >= 5) {
          commits.push({
            hash: p[0],
            shortHash: p[1],
            date: p[2],
            author: p[3],
            subject: p.slice(4).join("\x1f"),
          });
        }
      }
    } catch (e) {
      gitMessage = formatGitExecError("git log", e);
    }

    async function gitShowBlob(rev, posixPath) {
      const spec = `${rev}:${posixPath}`;
      try {
        const { stdout } = await execFileAsync("git", ["show", spec], opts);
        return String(stdout ?? "");
      } catch {
        return null;
      }
    }

    const enriched = [];
    const batchSize = 6;
    for (let i = 0; i < commits.length; i += batchSize) {
      const slice = commits.slice(i, i + batchSize);
      const part = await Promise.all(
        slice.map(async (c) => {
          const afterText = await gitShowBlob(c.hash, norm);
          const beforeText = await gitShowBlob(`${c.hash}^`, norm);
          const changeSummary = summarizeCardIniDiff(beforeText, afterText);
          return { ...c, changeSummary };
        })
      );
      enriched.push(...part);
    }

    res.json({
      gitAvailable: true,
      path: norm,
      commits: enriched,
      message:
        gitMessage ||
        (commits.length === 0
          ? "No commits found for this file (not tracked yet, or no history)."
          : ""),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read Git history." });
  }
});

/**
 * @param {import('express').Response} res
 * @param {string} slug
 * @param {number} col
 */
async function sendColumnCards(res, slug, col) {
  try {
    if (!Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid column index." });
      return;
    }

    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    const boardRoot = path.join(dataRoot(), "tasks", slug);

    /** @type {object[]} */
    const cards = [];
    const seen = new Set();

    try {
      const entries = await fs.readdir(boardRoot, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
        const full = path.join(boardRoot, ent.name);
        let raw;
        try {
          raw = await fs.readFile(full, "utf8");
        } catch {
          continue;
        }
        try {
          const parsed = parseTaskCardIni(raw);
          const cardCol = resolveCardColumnIndex(parsed.column, columnsDef);
          if (cardCol !== col) continue;
          cards.push({
            filename: ent.name,
            ...parsed,
          });
          seen.add(ent.name);
        } catch (err) {
          console.warn("Skipping unreadable task file:", ent.name, err);
        }
      }
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== "ENOENT") {
        throw e;
      }
    }

    const legacyDir = path.join(boardRoot, `columns.${col}`);
    try {
      const legacy = await fs.readdir(legacyDir, { withFileTypes: true });
      for (const ent of legacy) {
        if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
        if (seen.has(ent.name)) continue;
        const full = path.join(legacyDir, ent.name);
        const raw = await fs.readFile(full, "utf8");
        try {
          const parsed = parseTaskCardIni(raw);
          cards.push({
            filename: ent.name,
            ...parsed,
          });
          seen.add(ent.name);
        } catch (err) {
          console.warn("Skipping unreadable legacy task file:", ent.name, err);
        }
      }
    } catch {
      /* no legacy folder */
    }

    cards.sort((a, b) => {
      const la = resolveCardSwimlaneIndex(a.swimlane, swimlanesDef);
      const lb = resolveCardSwimlaneIndex(b.swimlane, swimlanesDef);
      if (la !== lb) return la - lb;
      const oa = Number(a.sort_order);
      const ob = Number(b.sort_order);
      const na = Number.isFinite(oa) ? oa : Number.POSITIVE_INFINITY;
      const nb = Number.isFinite(ob) ? ob : Number.POSITIVE_INFINITY;
      if (na !== nb) return na - nb;
      return String(a.filename).localeCompare(String(b.filename));
    });
    res.json({ cards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to list cards." });
  }
}

/**
 * Closed/completed timestamp for sorting (ISO in INI).
 * @param {string | undefined} raw
 * @returns {number | null}
 */
function parseIsoMs(raw) {
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
async function moveStaleArchiveFilesToColdStorage(slug, ageMonths) {
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
async function gatherCompletedAndArchiveRows(slug) {
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
async function gatherColdStorageCardRows(slug) {
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
async function gatherCompletedArchiveAndOptionalCold(slug, includeColdStorage) {
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
function completedRowMatchesSearch(row, qLower) {
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

function utcDayBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function utcMonthBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Monday 00:00 UTC of the calendar week containing `ms`. */
function utcWeekBucketStartMs(ms) {
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
function bucketStartMsForGranularity(ms, granularity) {
  if (granularity === "weekly") return utcWeekBucketStartMs(ms);
  if (granularity === "monthly") return utcMonthBucketMs(ms);
  return utcDayBucketMs(ms);
}

/**
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
async function aggregateCompletionBuckets(slug, granularity) {
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
async function aggregateCompletionSwimlaneStack(slug, granularity) {
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
function medianSample(values) {
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
function sampleStdDev(values) {
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
async function buildCycleTimeScatter(slug, granularity) {
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

/** Prefer this URL from the browser — avoids proxy/path issues with nested segments. */
app.get("/api/column-cards", async (req, res) => {
  const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
  const col = Number(req.query.columnIndex);
  await sendColumnCards(res, slug, col);
});

app.get(
  "/api/tasks/:boardSlug/columns/:columnIndex/cards",
  async (req, res) => {
    const slug = sanitizeSegment(req.params.boardSlug);
    const col = Number(req.params.columnIndex);
    await sendColumnCards(res, slug, col);
  }
);

/**
 * Query: boardSlug (default board), page (1-based), limit (default 50, max 100).
 * Optional owner filter: of=all|mine|owner; me=… (local owner, case-insensitive) when of=mine; pick=… (exact owner) when of=owner.
 * Response includes ownerNames (distinct owners across all completed rows, before filter).
 * Cards: on-board items with `closed` set, plus `archive/*.ini`. Optional `deep=1` also loads `cold-storage/**`.
 * Query `q` filters title, description, owner, filename, dates, links (substring, case-insensitive).
 * Newest `closed` first (archive / cold rows fall back to `created` / mtime).
 */
app.get("/api/completed-cards", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const pageRaw = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, limitRaw))
      : 50;

    const ofRaw = String(req.query.of ?? "all").toLowerCase();
    const of = ofRaw === "mine" || ofRaw === "owner" ? ofRaw : "all";
    const pick = String(req.query.pick ?? "").trim();
    const me = String(req.query.me ?? "").trim();

    const deepRaw = String(req.query.deep ?? "").trim().toLowerCase();
    const includeCold =
      deepRaw === "1" ||
      deepRaw === "true" ||
      deepRaw === "yes" ||
      String(req.query.includeCold ?? "")
        .trim()
        .toLowerCase() === "1";

    const searchLower = String(req.query.q ?? "").trim().toLowerCase();

    const all = await gatherCompletedArchiveAndOptionalCold(slug, includeCold);

    const ownerSet = new Set();
    for (const row of all) {
      const o = String(row.owner ?? "").trim();
      if (o) ownerSet.add(o);
    }
    const distinctRowOwners = [...ownerSet].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    let ownerNames = [];
    try {
      const boardPath = await resolveBoardIniPathForSlug(slug);
      const boardText = await fs.readFile(boardPath, "utf8");
      const boardModel = parseBoardIni(boardText);
      ownerNames = boardOwnerEmailsForFilter(boardModel.users ?? []);
    } catch {
      ownerNames = [];
    }
    if (ownerNames.length === 0) {
      ownerNames = distinctRowOwners;
    }

    let filtered = all;
    if (of === "mine" && me) {
      const low = me.toLowerCase();
      filtered = all.filter(
        (r) => String(r.owner ?? "").trim().toLowerCase() === low
      );
    } else if (of === "owner" && pick) {
      filtered = all.filter((r) => String(r.owner ?? "").trim() === pick);
    }

    if (searchLower) {
      filtered = filtered.filter((r) => completedRowMatchesSearch(r, searchLower));
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const slice = filtered
      .slice(start, start + limit)
      .map(({ sortMs: _s, ...rest }) => rest);

    res.json({
      cards: slice,
      page,
      pageSize: limit,
      total,
      ownerNames,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to list completed cards." });
  }
});

/**
 * Query: boardSlug, granularity=daily|weekly|monthly (default weekly).
 * Buckets use UTC (day start, ISO-week Monday, or calendar month).
 * One point per bucket with at least one completion (`closed` on board or archive INIs).
 */
app.get("/api/completion-buckets", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const buckets = await aggregateCompletionBuckets(slug, granularity);
    res.json({ boardSlug: slug, granularity, buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load completion buckets." });
  }
});

/**
 * Query: boardSlug, granularity=weekly|monthly (default weekly).
 * Stacked completion counts by swimlane per UTC bucket (same rules as `/api/completion-buckets`).
 */
app.get("/api/completion-swimlane-stack", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const { series, buckets } = await aggregateCompletionSwimlaneStack(
      slug,
      granularity
    );
    res.json({ boardSlug: slug, granularity, series, buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load swimlane completion stack.",
    });
  }
});

/**
 * Query: boardSlug, granularity=daily|weekly|monthly (default weekly).
 * Points: each card with parseable `created` and `closed`; x = UTC bucket of `closed`, y = (closed − created) in days.
 * `medianDays` / `stdevDays` are over those cycle lengths (sample σ, n ≥ 2).
 */
app.get("/api/cycle-time-scatter", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const payload = await buildCycleTimeScatter(slug, granularity);
    res.json({ boardSlug: slug, ...payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load cycle time data." });
  }
});

app.get("/api/card", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const col = Number(req.query.columnIndex);
    const filename = safeCardIniFilename(req.query.filename);
    if (!filename || !Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid card request." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, filename);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = parseTaskCardIni(raw);
    res.json({ filename, ...parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read card." });
  }
});

/**
 * Query: boardSlug, columnIndex, filename, optional limit (default 40, max 100).
 * Returns `git log --follow` for the resolved task INI under `tasks/` (requires `.git` at data root).
 */
app.get("/api/card/git-history", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const col = Number(req.query.columnIndex);
    const filename = safeCardIniFilename(req.query.filename);
    const limitRaw = Number.parseInt(String(req.query.limit ?? "40"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, limitRaw))
      : 40;

    if (!filename || !Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid card request." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, filename);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    if (!existsSync(path.join(dataRoot(), ".git"))) {
      res.json({
        gitAvailable: false,
        path: null,
        commits: [],
        message: "No Git repository at the Millrace data root.",
      });
      return;
    }

    let rel = path.relative(dataRoot(), fullPath);
    rel = rel.split(path.sep).join("/");
    const norm = path.posix.normalize(rel);
    const absNorm = path.resolve(dataRoot(), norm);
    const tasksRoot = path.resolve(dataRoot(), "tasks");
    if (
      norm.startsWith("../") ||
      norm === ".." ||
      norm.startsWith("/") ||
      !norm.startsWith("tasks/") ||
      (!absNorm.startsWith(tasksRoot + path.sep) && absNorm !== tasksRoot)
    ) {
      res.status(400).json({ message: "Invalid card path for history." });
      return;
    }

    const env = gitChildEnv();
    const opts = {
      cwd: dataRoot(),
      env,
      maxBuffer: 5 * 1024 * 1024,
    };

    /** @type {{ hash: string, shortHash: string, date: string, author: string, subject: string, changeSummary?: string[] }[]} */
    const commits = [];
    let gitMessage = "";

    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "log",
          "--follow",
          `-n${limit}`,
          "--format=%H%x1f%h%x1f%ai%x1f%an%x1f%s",
          "--",
          norm,
        ],
        opts
      );
      const out = String(stdout ?? "").trim();
      for (const line of out.split("\n")) {
        if (!line) continue;
        const p = line.split("\x1f");
        if (p.length >= 5) {
          commits.push({
            hash: p[0],
            shortHash: p[1],
            date: p[2],
            author: p[3],
            subject: p.slice(4).join("\x1f"),
          });
        }
      }
    } catch (e) {
      gitMessage = formatGitExecError("git log", e);
    }

    /**
     * @param {string} rev Commit hash or `hash^`
     * @param {string} posixPath
     */
    async function gitShowBlob(rev, posixPath) {
      const spec = `${rev}:${posixPath}`;
      try {
        const { stdout } = await execFileAsync("git", ["show", spec], opts);
        return String(stdout ?? "");
      } catch {
        return null;
      }
    }

    const enriched = [];
    const batchSize = 6;
    for (let i = 0; i < commits.length; i += batchSize) {
      const slice = commits.slice(i, i + batchSize);
      const part = await Promise.all(
        slice.map(async (c) => {
          const afterText = await gitShowBlob(c.hash, norm);
          const beforeText = await gitShowBlob(`${c.hash}^`, norm);
          const changeSummary = summarizeCardIniDiff(beforeText, afterText);
          return { ...c, changeSummary };
        })
      );
      enriched.push(...part);
    }

    res.json({
      gitAvailable: true,
      path: norm,
      commits: enriched,
      message: gitMessage || (commits.length === 0 ? "No commits found for this file (not tracked yet, or no history)." : ""),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read Git history." });
  }
});

app.put("/api/card", async (req, res) => {
  try {
    const {
      boardSlug,
      columnIndex,
      filename,
      title,
      description = "",
      owner = "",
    } = req.body ?? {};

    const t = String(title || "").trim();
    const fn = safeCardIniFilename(filename);
    const slug = sanitizeSegment(boardSlug || "board");
    const col = Number(columnIndex);

    if (!fn || !Number.isInteger(col) || col < 1 || !t) {
      res.status(400).json({ message: "Invalid card update." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, fn);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read card." });
      return;
    }

    const { item, links: parsedLinks } = parseTaskCardIniFull(raw);
    const prevOwner = String(item.owner ?? "").trim();
    const newOwner = String(owner ?? "").trim();
    const boardUsers = await loadBoardUsersForOwnerPolicy(slug);
    if (!canAssignCardOwner(newOwner, boardUsers, prevOwner)) {
      res.status(400).json({
        message:
          "That owner is an inactive board user. Pick an active user or leave the owner unchanged.",
      });
      return;
    }

    item.title = t;
    item.description = String(description ?? "");
    item.owner = newOwner;

    const nextLinks = Array.isArray(req.body.links)
      ? normalizeLinksForIni(req.body.links)
      : parsedLinks;

    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    item.column = columnNameForIniItem(columnsDef, col);
    const laneIdx = resolveCardSwimlaneIndex(item.swimlane, swimlanesDef);
    const laneName = swimlaneNameForIniItem(swimlanesDef, laneIdx);
    if (laneName !== undefined) item.swimlane = laneName;
    else delete item.swimlane;

    const flatPath = path.join(dataRoot(), "tasks", slug, fn);
    const out = serializeFullCardIni(item, nextLinks);
    await fs.writeFile(flatPath, out, "utf8");
    if (path.resolve(fullPath) !== path.resolve(flatPath)) {
      try {
        await fs.unlink(fullPath);
      } catch {
        /* ignore */
      }
    }

    if (newOwner) await writeLocalUserIni(newOwner);

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to save card.",
    });
  }
});

app.delete("/api/card", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const col = Number(req.query.columnIndex);
    const filename = safeCardIniFilename(req.query.filename);
    if (!filename || !Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid card delete request." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, filename);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    await fs.unlink(fullPath);

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to delete card.",
    });
  }
});

app.post("/api/cards", async (req, res) => {
  try {
    const {
      boardSlug,
      columnIndex,
      swimlaneIndex,
      title,
      description = "",
      owner = "",
      links: linksRaw,
    } = req.body ?? {};

    const t = String(title || "").trim();
    if (!t) {
      res.status(400).json({ message: "Title is required." });
      return;
    }

    const slug = sanitizeSegment(boardSlug || "board");
    const col = Number(columnIndex);
    if (!Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid column index." });
      return;
    }

    const newOwner = String(owner ?? "").trim();
    const boardUsers = await loadBoardUsersForOwnerPolicy(slug);
    if (!canAssignCardOwner(newOwner, boardUsers, "")) {
      res.status(400).json({
        message:
          "Cannot assign an inactive board user as card owner. Restore the user on the board or pick someone active.",
      });
      return;
    }

    const id = newCardId();
    const laneNum = Number(swimlaneIndex);
    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    const laneIdx = laneIndexFromBody(laneNum, swimlanesDef);
    const maxSo = await maxSortOrderForCell(
      slug,
      col,
      laneIdx,
      columnsDef,
      swimlanesDef,
      null
    );
    const ini = serializeCardIni({
      id,
      title: t,
      description: String(description ?? ""),
      owner: newOwner,
      columnIndex: col,
      swimlaneIndex:
        Number.isInteger(laneNum) && laneNum >= 1 ? laneNum : undefined,
      sortOrder: maxSo + 10,
      links: normalizeLinksForIni(linksRaw),
      columns: columnsDef,
      swimlanes: swimlanesDef,
    });

    const boardDir = path.join(dataRoot(), "tasks", slug);
    await ensureDir(boardDir);
    const filename = `${id}.ini`;
    await fs.writeFile(path.join(boardDir, filename), ini, "utf8");

    if (newOwner) await writeLocalUserIni(newOwner);

    await markDataRootPendingSync();
    res.json({ id, filename, path: path.join("tasks", slug, filename) });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to write card.",
    });
  }
});

/**
 * Move a card INI to another column and/or update swimlane.
 * Body: boardSlug, filename, fromColumnIndex, toColumnIndex, swimlaneIndex (lane index; 0 = omit swimlane in INI).
 */
app.post("/api/cards/move", async (req, res) => {
  try {
    const {
      boardSlug,
      filename,
      fromColumnIndex,
      toColumnIndex,
      swimlaneIndex,
    } = req.body ?? {};

    const slug = sanitizeSegment(boardSlug || "board");
    const fn = safeCardIniFilename(filename);
    const fromCol = Number(fromColumnIndex);
    const toCol = Number(toColumnIndex);
    const laneNum = Number(swimlaneIndex);

    if (
      !fn ||
      !Number.isInteger(fromCol) ||
      fromCol < 1 ||
      !Number.isInteger(toCol) ||
      toCol < 1
    ) {
      res.status(400).json({ message: "Invalid card move." });
      return;
    }

    const srcPath = await resolveCardFilePath(slug, fromCol, fn);
    if (!srcPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    const raw = await fs.readFile(srcPath, "utf8");
    const { item, links } = parseTaskCardIniFull(raw);

    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);

    const laneIdx = laneIndexFromBody(laneNum, swimlanesDef);
    const laneName = swimlaneNameForIniItem(swimlanesDef, laneIdx);
    if (laneName !== undefined) item.swimlane = laneName;
    else delete item.swimlane;

    let effectiveFromCol = columnIndexFromTasksPath(srcPath);
    if (effectiveFromCol == null) {
      const colRaw = String(item.column ?? "").trim();
      effectiveFromCol = colRaw
        ? resolveCardColumnIndex(item.column, columnsDef)
        : fromCol;
    }

    const destIsDone = await columnSectionIsDone(slug, toCol);
    if (effectiveFromCol !== toCol) {
      if (destIsDone) {
        item.closed = new Date().toISOString();
      } else {
        delete item.closed;
      }
    }

    item.column = columnNameForIniItem(columnsDef, toCol);

    const maxSo = await maxSortOrderForCell(
      slug,
      toCol,
      laneIdx,
      columnsDef,
      swimlanesDef,
      fn
    );
    item.sort_order = String(maxSo + 10);

    const destPath = path.join(dataRoot(), "tasks", slug, fn);
    const out = serializeFullCardIni(item, links);

    if (path.resolve(srcPath) !== path.resolve(destPath)) {
      try {
        await fs.access(destPath);
        res.status(409).json({
          message: "A card with this file name already exists.",
        });
        return;
      } catch {
        /* ok */
      }
    }

    await fs.writeFile(destPath, out, "utf8");
    if (path.resolve(srcPath) !== path.resolve(destPath)) {
      await fs.unlink(srcPath);
    }

    await markDataRootPendingSync();
    res.json({
      ok: true,
      moved: path.resolve(srcPath) !== path.resolve(destPath),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to move card.",
    });
  }
});

/**
 * Set card order within one column + swimlane (`sort_order` in each INI).
 * Body: boardSlug, columnIndex, swimlaneIndex, filenames (complete ordered list).
 */
app.post("/api/cards/reorder", async (req, res) => {
  try {
    const { boardSlug, columnIndex, swimlaneIndex, filenames } = req.body ?? {};

    const slug = sanitizeSegment(boardSlug || "board");
    const col = Number(columnIndex);
    const laneNum = Number(swimlaneIndex);

    if (!Array.isArray(filenames) || filenames.length === 0) {
      res.status(400).json({ message: "filenames must be a non-empty array." });
      return;
    }
    if (!Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid column index." });
      return;
    }

    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    const laneIdx = laneIndexFromBody(laneNum, swimlanesDef);

    const normalized = [];
    const seen = new Set();
    for (const raw of filenames) {
      const fn = safeCardIniFilename(
        typeof raw === "string" ? raw : String(raw ?? "")
      );
      if (!fn || seen.has(fn)) {
        res.status(400).json({ message: "Invalid filenames array." });
        return;
      }
      seen.add(fn);
      normalized.push(fn);
    }

    const inCell = new Set();
    const summaries = await readFlatBoardIniSummaries(slug);
    for (const { filename, parsed } of summaries) {
      if (resolveCardColumnIndex(parsed.column, columnsDef) !== col) continue;
      if (resolveCardSwimlaneIndex(parsed.swimlane, swimlanesDef) !== laneIdx)
        continue;
      inCell.add(filename);
    }

    if (inCell.size !== normalized.length) {
      res.status(400).json({
        message:
          "Order must include each card in this column and swimlane exactly once.",
      });
      return;
    }
    for (const fn of normalized) {
      if (!inCell.has(fn)) {
        res.status(400).json({
          message:
            "Order must include each card in this column and swimlane exactly once.",
        });
        return;
      }
    }

    for (let i = 0; i < normalized.length; i++) {
      const fn = normalized[i];
      const fullPath = await resolveCardFilePath(slug, col, fn);
      if (!fullPath) {
        res.status(404).json({ message: `Card not found: ${fn}` });
        return;
      }
      const rawIni = await fs.readFile(fullPath, "utf8");
      const { item, links } = parseTaskCardIniFull(rawIni);
      item.sort_order = String((i + 1) * 10);
      await fs.writeFile(fullPath, serializeFullCardIni(item, links), "utf8");
    }

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to reorder cards.",
    });
  }
});

app.get("/api/git/status", async (_req, res) => {
  try {
    const gitRepo = existsSync(path.join(dataRoot(), ".git"));
    res.json({ gitRepo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read git status." });
  }
});

/**
 * Sync: pull (with autostash when supported), optional conflict resolution payload,
 * commit outstanding `tasks/` changes, push. Body: `{ conflictResolutions?: { path, content }[] }`.
 */
app.post("/api/git/sync", async (req, res) => {
  const cwd = dataRoot();
  if (!existsSync(path.join(cwd, ".git"))) {
    res.status(400).json({
      message:
        "No Git repository at the Millrace data root — run the server from your clone (see FLOW_ROOT).",
    });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const rawResolutions = body.conflictResolutions;
  const resolutions = Array.isArray(rawResolutions) ? rawResolutions : null;

  const env = gitChildEnv();
  const opts = {
    cwd,
    env,
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const out = await runGitSerialized(async () => {
      if (resolutions && resolutions.length > 0) {
        const unmergedBefore = await gitUnmergedPaths(opts);
        if (unmergedBefore.length === 0) {
          return {
            kind: "badRequest",
            message:
              "No files are in a conflicted state anymore — try Sync again from the start, or finish resolving in another Git client.",
          };
        }
        for (const entry of resolutions) {
          const rel =
            typeof entry?.path === "string" ? entry.path.trim() : "";
          const content = entry?.content != null ? String(entry.content) : "";
          const safe = safeRepoRelativePath(rel);
          if (!safe) {
            return {
              kind: "badRequest",
              message: `Invalid or unsafe path: ${rel || "(empty)"}`,
            };
          }
          const abs = path.join(cwd, ...safe.split("/"));
          await fs.writeFile(abs, content, "utf8");
          const relForGit = path.relative(cwd, abs);
          if (!relForGit || relForGit.startsWith("..")) {
            return {
              kind: "badRequest",
              message: `Could not map path for git add: ${safe}`,
            };
          }
          await execFileAsync("git", ["add", "--", relForGit], opts);
        }
        const still = await gitUnmergedPaths(opts);
        if (still.length > 0) {
          return {
            kind: "conflicts",
            files: await readConflictFilePayloads(still, opts),
          };
        }
        try {
          await execFileAsync("git", ["commit", "--no-edit"], opts);
        } catch {
          try {
            await execFileAsync(
              "git",
              ["commit", "-m", "Merge: resolve conflicts (Millrace)"],
              opts
            );
          } catch {
            /* Nothing to commit (unusual); continue to tasks/ commit + push. */
          }
        }
        try {
          await commitOutstandingTasksDir(opts);
        } catch (e) {
          return { kind: "commitFail", err: e };
        }
        try {
          await execFileAsync("git", ["push"], opts);
        } catch (e) {
          return { kind: "pushFail", err: e };
        }
        return { kind: "done" };
      }

      try {
        await gitPullWithOptionalAutostash(opts);
      } catch (e) {
        const unmerged = await gitUnmergedPaths(opts);
        if (unmerged.length > 0) {
          return {
            kind: "conflicts",
            files: await readConflictFilePayloads(unmerged, opts),
          };
        }
        return { kind: "pullFail", err: e };
      }

      const unmergedAfter = await gitUnmergedPaths(opts);
      if (unmergedAfter.length > 0) {
        return {
          kind: "conflicts",
          files: await readConflictFilePayloads(unmergedAfter, opts),
        };
      }

      try {
        await commitOutstandingTasksDir(opts);
      } catch (e) {
        return { kind: "commitFail", err: e };
      }
      try {
        await execFileAsync("git", ["push"], opts);
      } catch (e) {
        return { kind: "pushFail", err: e };
      }
      return { kind: "done" };
    });

    if (out.kind === "conflicts") {
      res.json({
        ok: false,
        needConflictResolution: true,
        files: out.files,
      });
      return;
    }
    if (out.kind === "badRequest") {
      res.status(400).json({ message: out.message });
      return;
    }
    if (out.kind === "pullFail") {
      console.error("[flow] git sync: pull failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git pull", out.err),
      });
      return;
    }
    if (out.kind === "commitFail") {
      console.error("[flow] git sync: commit failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git commit", out.err),
      });
      return;
    }
    if (out.kind === "pushFail") {
      console.error("[flow] git sync: push failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git push", out.err),
      });
      return;
    }

    await clearDataRootPendingSync();
    console.error("[flow] git sync: pull, commits, push ok");
    res.json({ ok: true });
  } catch (e) {
    console.error("[flow] git sync: failed", e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Git sync failed.",
    });
  }
});

app.get("/api/local-user", async (_req, res) => {
  try {
    const sections = await readLocalUserIniSections();
    const raw = sections.user?.owner ?? sections.local?.owner ?? "";
    const cg = String(
      sections.flow?.charts_granularity ??
        sections.flow?.chartsGranularity ??
        ""
    )
      .trim()
      .toLowerCase();
    const chartsGranularity =
      cg === "monthly" || cg === "weekly" ? cg : "";
    const mineRaw = sections.user?.mine ?? sections.user?.Mine ?? "";
    res.json({
      owner: String(raw).trim(),
      mine: String(mineRaw).trim(),
      chartsGranularity,
      pendingSync: pendingSyncFromSections(sections),
      syncMode: syncModeFromPreferencesSection(sections.preferences ?? {}),
    });
  } catch {
    res.json({
      owner: "",
      mine: "",
      chartsGranularity: "",
      pendingSync: false,
      syncMode: "automatic",
    });
  }
});

app.get("/api/local-user/preferences", async (_req, res) => {
  try {
    const sections = await readLocalUserIniSections();
    const ownerRaw = sections.user?.owner ?? sections.local?.owner ?? "";
    const mineRaw = sections.user?.mine ?? sections.user?.Mine ?? "";
    res.json({
      syncMode: syncModeFromPreferencesSection(sections.preferences ?? {}),
      mine: String(mineRaw).trim(),
      owner: String(ownerRaw).trim(),
    });
  } catch {
    res.json({ syncMode: "automatic", mine: "", owner: "" });
  }
});

/**
 * Merge into `tasks/localuser.ini`: optional `chartsGranularity` ([flow]),
 * optional `mine` ([user] mine, empty string clears),
 * optional `syncMode` ([preferences] sync_mode).
 */
app.patch("/api/local-user", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const chartsRaw =
      body.chartsGranularity ?? body.charts_granularity ?? undefined;
    const mineRaw = body.mine !== undefined ? body.mine : undefined;
    const syncRaw =
      body.syncMode !== undefined
        ? body.syncMode
        : body.sync_mode !== undefined
          ? body.sync_mode
          : undefined;

    if (
      chartsRaw === undefined &&
      mineRaw === undefined &&
      syncRaw === undefined
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with chartsGranularity (weekly or monthly), mine (email), and/or syncMode (automatic or manual).",
      });
      return;
    }

    const sections = await readLocalUserIniSections();
    sections.user = sections.user ?? {};
    sections.flow = sections.flow ?? {};

    if (syncRaw !== undefined) {
      const sm = String(syncRaw).trim().toLowerCase();
      if (sm !== "automatic" && sm !== "manual") {
        res.status(400).json({
          message: "syncMode must be automatic or manual.",
        });
        return;
      }
      sections.preferences = sections.preferences ?? {};
      sections.preferences.sync_mode = sm;
      delete sections.preferences.syncMode;
    }

    if (chartsRaw !== undefined) {
      const v = String(chartsRaw).trim().toLowerCase();
      if (v !== "weekly" && v !== "monthly") {
        res.status(400).json({
          message: "chartsGranularity must be weekly or monthly.",
        });
        return;
      }
      delete sections.flow.chartsGranularity;
      sections.flow.charts_granularity = v;
    }

    if (mineRaw !== undefined) {
      const mine = String(mineRaw).trim();
      if (mine && !mine.includes("@")) {
        res.status(400).json({
          message: "mine must look like an email address.",
        });
        return;
      }
      const line = mine.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.mine;
        delete sections.user.Mine;
      } else {
        sections.user.mine = line;
        delete sections.user.Mine;
      }
    }

    await writeLocalUserIniSections(sections);

    const out = await readLocalUserIniSections();
    const owner = String(out.user?.owner ?? out.local?.owner ?? "").trim();
    const mine = String(out.user?.mine ?? out.user?.Mine ?? "").trim();
    const cg = String(
      out.flow?.charts_granularity ?? out.flow?.chartsGranularity ?? ""
    )
      .trim()
      .toLowerCase();
    const chartsGranularity =
      cg === "monthly" || cg === "weekly" ? cg : "";

    res.json({
      ok: true,
      owner,
      mine,
      chartsGranularity,
      pendingSync: pendingSyncFromSections(out),
      syncMode: syncModeFromPreferencesSection(out.preferences ?? {}),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update localuser.ini." });
  }
});

app.patch("/api/local-user/preferences", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const syncRaw =
      body.syncMode !== undefined
        ? body.syncMode
        : body.sync_mode !== undefined
          ? body.sync_mode
          : undefined;
    const mineRaw = body.mine !== undefined ? body.mine : undefined;
    const ownerRaw = body.owner !== undefined ? body.owner : undefined;

    if (
      syncRaw === undefined &&
      mineRaw === undefined &&
      ownerRaw === undefined
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with syncMode (automatic or manual), mine (email), and/or owner (email).",
      });
      return;
    }

    const sections = await readLocalUserIniSections();
    sections.user = sections.user ?? {};

    if (syncRaw !== undefined) {
      const sm = String(syncRaw).trim().toLowerCase();
      if (sm !== "automatic" && sm !== "manual") {
        res.status(400).json({
          message: "syncMode must be automatic or manual.",
        });
        return;
      }
      sections.preferences = sections.preferences ?? {};
      sections.preferences.sync_mode = sm;
      delete sections.preferences.syncMode;
    }

    if (mineRaw !== undefined) {
      const mine = String(mineRaw).trim();
      if (mine && !mine.includes("@")) {
        res.status(400).json({
          message: "mine must look like an email address.",
        });
        return;
      }
      const line = mine.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.mine;
        delete sections.user.Mine;
      } else {
        sections.user.mine = line;
        delete sections.user.Mine;
      }
    }

    if (ownerRaw !== undefined) {
      const owner = String(ownerRaw).trim();
      if (owner && !owner.includes("@")) {
        res.status(400).json({
          message: "owner must look like an email address.",
        });
        return;
      }
      const line = owner.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.owner;
      } else {
        sections.user.owner = line;
      }
    }

    await writeLocalUserIniSections(sections);

    const out = await readLocalUserIniSections();
    const ownerOut = String(out.user?.owner ?? out.local?.owner ?? "").trim();
    const mineOut = String(out.user?.mine ?? out.user?.Mine ?? "").trim();

    res.json({
      ok: true,
      syncMode: syncModeFromPreferencesSection(out.preferences ?? {}),
      mine: mineOut,
      owner: ownerOut,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update localuser.ini." });
  }
});

/** User project (tasks/, optional files); then packaged UI if not present there. */
app.use((req, res, next) => express.static(dataRoot())(req, res, next));
app.use(express.static(SCRIPT_DIR));

function portFromArgv(argv) {
  return cliOptionsFromArgv(argv).port;
}

/**
 * Parse startup args from `node server.js ...`.
 * Supports a positional port and a data-root override:
 * - node server.js 9999
 * - node server.js --data-root /tmp/millrace-test
 * - node server.js --data-root=/tmp/millrace-test 9999
 *
 * @param {string[]} argv
 * @returns {{ port: number | null, dataRoot: string | null }}
 */
function cliOptionsFromArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let port = null;
  let cliDataRootOverride = null;
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    if (!raw) continue;
    if (raw === "--data-root") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        cliDataRootOverride = path.resolve(next);
        i += 1;
      }
      continue;
    }
    if (raw.startsWith("--data-root=")) {
      const value = raw.slice("--data-root=".length).trim();
      if (value) cliDataRootOverride = path.resolve(value);
      continue;
    }
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      if (n >= 1 && n <= 65535) {
        port = n;
      }
    }
  }
  return { port, dataRoot: cliDataRootOverride };
}
const PORT = portFromArgv(process.argv) ?? (Number(process.env.PORT) || 8888);
const HOST = process.env.HOST;

async function onListen() {
  const boardPath = path.join(dataRoot(), "tasks", "board.ini");
  const catalogPath = boardCatalogIniPath();
  const boardOk = existsSync(boardPath) || existsSync(catalogPath);
  const where =
    HOST != null && HOST !== ""
      ? `http://${HOST}:${PORT}/`
      : `http://localhost:${PORT}/`;
  console.error(
    `Millrace ${where} (data root ${dataRoot()}${boardOk ? "" : ` — warning: missing ${boardPath} and ${catalogPath}`})`
  );
  await runStartupArchiveStaleForCatalogSlugs();
}

/** Cold-storage / archive sweep — same as after HTTP listen in production. */
export async function millraceIntegrationStartup() {
  await runStartupArchiveStaleForCatalogSlugs();
}

function isMillracePrimaryServerEntry() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return path.resolve(argv1) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMillracePrimaryServerEntry()) {
  if (HOST != null && HOST !== "") {
    app.listen(PORT, HOST, () => {
      void onListen();
    });
  } else {
    app.listen(PORT, () => {
      void onListen();
    });
  }
}
