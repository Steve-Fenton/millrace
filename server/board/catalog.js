import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  BOARD_CATALOG_SECTION,
  LEGACY_BOARD_CATALOG_SECTION,
} from "../constants.js";
import {
  boardCatalogIniPath,
  dataRoot,
  isBoardCatalogIniSection,
} from "../dataRoot.js";
import { parseBoardIni } from "../../assets/js/models/boardModel.js";
import { parseIni } from "../../assets/js/ini/parseIni.js";
import { boardSlugFromMeta, sanitizeSegment } from "./cardPaths.js";

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
 * @param {{ slug: string, name?: string }[]} entries
 * @returns {{ slug: string, name?: string, file?: string, kind?: string }[]}
 */
export function sortBoardCatalogEntries(entries) {
  return [...entries].sort((a, b) => {
    const na = String(a.name ?? a.slug ?? "").trim();
    const nb = String(b.name ?? b.slug ?? "").trim();
    const byName = na.localeCompare(nb, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.slug ?? "").localeCompare(String(b.slug ?? ""), undefined, {
      sensitivity: "base",
    });
  });
}

/**
 * Boards from `tasks/.millrace.ini` (`[millrace]` / legacy `[flow]` `boards =`) with parsed slug and display name.
 * @returns {Promise<{ file: string, slug: string, name: string, kind?: string }[]>}
 */
export async function loadBoardCatalog() {
  const files = await readBoardCatalogIniBasenames();
  /** @type {{ file: string, slug: string, name: string, kind?: string }[]} */
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
      const kind = String(m.board.kind ?? "").trim() || undefined;
      out.push({ file: base, slug, name, kind });
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
  return sortBoardCatalogEntries(out);
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
type = to_do

[columns.2]
title = Doing
type = in_progress

[columns.3]
title = Done
type = done

[swimlanes.1]
title = Default
`;
}

/**
 * Default aggregate board INI (standard columns, optional source slugs).
 * @param {string} displayName
 * @param {string} slug
 * @param {string[]} [sourceSlugs]
 */
export function defaultAggregateBoardIniText(displayName, slug, sourceSlugs = []) {
  const nameLine = String(displayName ?? "").trim().replace(/\r?\n/g, " ");
  const safeName = nameLine || slug;
  const lines = [
    "[board]",
    `name = ${safeName}`,
    `slug = ${slug}`,
    "kind = aggregate",
    "",
  ];
  const sources = (sourceSlugs ?? [])
    .map((s) => sanitizeSegment(s))
    .filter(Boolean);
  if (sources.length > 0) {
    lines.push(
      "; Source boards whose open and completed tasks appear on this aggregate view."
    );
    for (let i = 0; i < sources.length; i++) {
      lines.push(`[sources.${i + 1}]`, `slug = ${sources[i]}`, "");
    }
  }
  lines.push(
    "; Aggregate columns are fixed by workflow type (cards map from each source board)."
  );
  lines.push("[columns.1]", "title = Options", "type = options", "");
  lines.push("[columns.2]", "title = To do", "type = to_do", "");
  lines.push("[columns.3]", "title = In progress", "type = in_progress", "");
  lines.push("[columns.4]", "title = Waiting", "type = waiting", "");
  lines.push(
    "[columns.5]",
    "title = Done",
    "type = done",
    ""
  );
  return lines.join("\n");
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
