import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  BOARD_CATALOG_SECTION,
  LEGACY_BOARD_CATALOG_SECTION,
} from "./constants.js";
import {
  boardCatalogIniPath,
  dataRoot,
  isBoardCatalogIniSection,
} from "./dataRoot.js";
import { parseBoardIni } from "../assets/js/models/boardModel.js";
import { parseIni } from "../assets/js/ini/parseIni.js";
import { parseTaskCardIni } from "../assets/js/models/taskModel.js";
import {
  defaultSwimlaneIndex,
  resolveCardSwimlaneIndex,
} from "../assets/js/ini/swimlaneResolve.js";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";

export function sanitizeSegment(s) {
  const t = String(s)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return t || "board";
}

/** Slug from `[board]` metadata (matches client `boardSlugFrom`). */
export function boardSlugFromMeta(board) {
  const raw = String(board?.slug ?? board?.name ?? "board").trim();
  return sanitizeSegment(raw);
}

export function newCardId() {
  return `FLOW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {unknown} name */
export function safeCardIniFilename(name) {
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
export async function resolveCardFilePath(slug, col, filename) {
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

export async function readBoardCatalogIniBasenames() {
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
export async function loadBoardCatalog() {
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
      console.warn(`[millrace] board catalog lists ${base} but it could not be read`);
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
export function defaultNewBoardIniText(displayName, slug) {
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
export async function appendBoardCatalogEntry(newBoardIniBasename) {
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
export async function allocateNewBoardSlugAndFile(boardDisplayName) {
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

export async function resolveBoardIniPathForSlug(slug) {
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

export async function loadBoardColumnAndSwimlaneDefsForSlug(slug) {
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
export async function loadBoardUsersForOwnerPolicy(slug) {
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
export function laneIndexFromBody(laneNum, swimlanesDef) {
  if (!swimlanesDef.length) return 0;
  if (Number.isInteger(laneNum) && laneNum >= 1) return laneNum;
  return defaultSwimlaneIndex(swimlanesDef);
}

/**
 * Flat `tasks/{slug}/*.ini` summaries for ordering.
 * @param {string} slug
 */
export async function readFlatBoardIniSummaries(slug) {
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

export async function maxSortOrderForCell(
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
    if (resolveCardSwimlaneIndex(parsed.swimlane, swimlanes) !== laneIdx)
      continue;
    const n = Number(parsed.sort_order);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function parseIniTruthy(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/**
 * Column index from …/tasks/{slug}/columns.{n}/… path (authoritative vs client hints).
 * @param {string} fullPath
 * @returns {number | null}
 */
export function columnIndexFromTasksPath(fullPath) {
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
export async function columnSectionIsDone(slug, columnIndex) {
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
