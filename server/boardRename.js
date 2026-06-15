import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { serializeBoardIniFromModel } from "../assets/js/ini/boardIni.js";
import {
  isAggregateBoard,
  validateAggregateBoard,
} from "../assets/js/models/aggregateBoard.js";
import { parseBoardIni } from "../assets/js/models/boardModel.js";
import { BOARD_CATALOG_SECTION } from "./constants.js";
import {
  boardCatalogIniPath,
  dataRoot,
  isBoardCatalogIniSection,
} from "./dataRoot.js";
import { loadBoardCatalog } from "./board/catalog.js";
import { boardSlugFromMeta, sanitizeSegment } from "./board/cardPaths.js";
import {
  readLocalUserIniSections,
  writeLocalUserIniSections,
} from "./localUserIni.js";

export const BOARD_NAME_MAX_LENGTH = 120;

/**
 * @param {string} name
 * @param {string} [excludeSlug]
 * @returns {string | null} error message
 */
export function boardNameValidationError(name, excludeSlug) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Board name is required.";
  if (trimmed.length > BOARD_NAME_MAX_LENGTH) {
    return `Board name must be at most ${BOARD_NAME_MAX_LENGTH} characters.`;
  }
  if (/[\r\n]/.test(trimmed)) return "Board name cannot contain line breaks.";
  return null;
}

/**
 * @param {{ slug: string, name: string }[]} catalog
 * @param {string} name
 * @param {string} [excludeSlug]
 * @returns {string | null} error message
 */
export function boardNameUniqueError(catalog, name, excludeSlug) {
  const formatErr = boardNameValidationError(name, excludeSlug);
  if (formatErr) return formatErr;
  const want = String(name).trim().toLowerCase();
  for (const b of catalog) {
    if (excludeSlug && b.slug === excludeSlug) continue;
    const existing = String(b.name ?? "").trim();
    if (existing && existing.toLowerCase() === want) {
      return `A board named “${existing}” already exists.`;
    }
  }
  return null;
}

/**
 * @param {string} oldBasename e.g. "demo.ini"
 * @param {string} newBasename e.g. "roadmap.ini"
 */
async function replaceBoardCatalogBasename(oldBasename, newBasename) {
  const catalogPath = boardCatalogIniPath();
  const oldFile = path.basename(String(oldBasename ?? "").trim());
  const newFile = path.basename(String(newBasename ?? "").trim());
  if (!/^[\w.-]+\.ini$/i.test(oldFile) || !/^[\w.-]+\.ini$/i.test(newFile)) {
    throw new Error("Invalid board INI filename.");
  }

  let catalogText = "";
  try {
    catalogText = await fs.readFile(catalogPath, "utf8");
  } catch {
    throw new Error("Board catalog not found.");
  }

  const lines = catalogText.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let inCatalogSection = false;
  let updated = false;
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
        .map((p) => (p === oldFile ? newFile : p));
      if (!parts.includes(newFile)) {
        throw new Error("Board catalog entry missing for rename.");
      }
      const indent = line.match(/^\s*/)?.[0] ?? "";
      out.push(`${indent}boards = ${parts.join(", ")}`);
      updated = true;
      continue;
    }
    out.push(line);
  }
  if (!updated) {
    throw new Error("Board catalog entry missing for rename.");
  }
  await fs.writeFile(catalogPath, out.join("\n"), "utf8");
}

/**
 * @param {string} oldSlug
 * @param {string} newSlug
 * @param {{ file: string, slug: string }[]} catalog
 */
async function updateAggregateSourceSlugs(oldSlug, newSlug, catalog) {
  const tasksDir = path.join(dataRoot(), "tasks");
  for (const entry of catalog) {
    if (entry.slug === oldSlug) continue;
    const iniPath = path.join(tasksDir, entry.file);
    let text;
    try {
      text = await fs.readFile(iniPath, "utf8");
    } catch {
      continue;
    }
    let model;
    try {
      model = parseBoardIni(text.replace(/^\uFEFF/, ""));
    } catch {
      continue;
    }
    if (!isAggregateBoard(model)) continue;
    let changed = false;
    for (const src of model.sources ?? []) {
      if (String(src.slug ?? "").trim() === oldSlug) {
        src.slug = newSlug;
        changed = true;
      }
    }
    if (!changed) continue;
    const aggErr = validateAggregateBoard(model, catalog);
    if (aggErr) {
      throw new Error(aggErr);
    }
    await fs.writeFile(iniPath, serializeBoardIniFromModel(model), "utf8");
  }
}

/**
 * @param {string} oldSlug
 * @param {string} newSlug
 */
async function migrateLocalUserBoardSlug(oldSlug, newSlug) {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;
  const sections = await readLocalUserIniSections();
  const oldSection = `swimlanes.${oldSlug}`;
  const newSection = `swimlanes.${newSlug}`;
  if (!sections[oldSection]) return;
  sections[newSection] = { ...(sections[newSection] ?? {}), ...sections[oldSection] };
  delete sections[oldSection];
  await writeLocalUserIniSections(sections);
}

/**
 * Rename a board display name and keep slug, folder, and INI basename aligned.
 * @param {string} boardSlug current slug
 * @param {string} newName new display name
 * @returns {Promise<{ ok: true, oldSlug: string, slug: string, name: string, file: string }>}
 */
export async function renameBoard(boardSlug, newName) {
  const oldSlug = sanitizeSegment(String(boardSlug ?? "board"));
  const catalog = await loadBoardCatalog();
  const hit = catalog.find((e) => e.slug === oldSlug);
  if (!hit) {
    throw new Error("Board not found in catalog.");
  }

  const uniqueErr = boardNameUniqueError(catalog, newName, oldSlug);
  if (uniqueErr) {
    throw new Error(uniqueErr);
  }

  const displayName = String(newName).trim();
  const newSlug = sanitizeSegment(displayName);
  const newFile = `${newSlug}.ini`;
  const tasksDir = path.join(dataRoot(), "tasks");
  const oldIniPath = path.join(tasksDir, hit.file);
  const newIniPath = path.join(tasksDir, newFile);
  const oldFolder = path.join(tasksDir, oldSlug);
  const newFolder = path.join(tasksDir, newSlug);

  if (newSlug !== oldSlug) {
    for (const b of catalog) {
      if (b.slug === oldSlug) continue;
      if (b.slug === newSlug) {
        throw new Error(
          `The name “${displayName}” maps to slug “${newSlug}”, which is already used by another board.`
        );
      }
      if (b.file === newFile) {
        throw new Error(`Board file ${newFile} already exists.`);
      }
    }
    if (existsSync(newIniPath) && path.resolve(newIniPath) !== path.resolve(oldIniPath)) {
      throw new Error(`Board file ${newFile} already exists.`);
    }
    if (
      existsSync(newFolder) &&
      path.resolve(newFolder) !== path.resolve(oldFolder)
    ) {
      throw new Error(`Board folder tasks/${newSlug}/ already exists.`);
    }
  }

  let text;
  try {
    text = await fs.readFile(oldIniPath, "utf8");
  } catch {
    throw new Error("Board definition not found.");
  }

  let model;
  try {
    model = parseBoardIni(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid board INI.");
  }

  const currentName = String(model.board?.name ?? "").trim();
  const currentSlug = boardSlugFromMeta(model.board);
  if (currentName === displayName && currentSlug === newSlug && hit.file === newFile) {
    return {
      ok: true,
      oldSlug,
      slug: newSlug,
      name: displayName,
      file: hit.file,
    };
  }

  model.board = {
    ...(model.board ?? {}),
    name: displayName,
    slug: newSlug,
  };
  const serialized = serializeBoardIniFromModel(model);

  if (newSlug !== oldSlug) {
    if (existsSync(oldFolder)) {
      await fs.rename(oldFolder, newFolder);
    }
    await fs.writeFile(newIniPath, serialized, "utf8");
    if (path.resolve(newIniPath) !== path.resolve(oldIniPath)) {
      await fs.unlink(oldIniPath);
    }
    if (hit.file !== newFile) {
      await replaceBoardCatalogBasename(hit.file, newFile);
    }
    const updatedCatalog = await loadBoardCatalog();
    await updateAggregateSourceSlugs(oldSlug, newSlug, updatedCatalog);
    await migrateLocalUserBoardSlug(oldSlug, newSlug);
  } else {
    await fs.writeFile(oldIniPath, serialized, "utf8");
  }

  return {
    ok: true,
    oldSlug,
    slug: newSlug,
    name: displayName,
    file: newFile,
  };
}
