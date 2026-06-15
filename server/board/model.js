import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  parseBoardIni,
  parseColumnTypeRaw,
  enrichBoardUsersWithMillraceCatalog,
} from "../../assets/js/models/boardModel.js";
import {
  enrichAggregateBoardModel,
  isAggregateBoard,
  mergeUsersFromSourceBoards,
} from "../../assets/js/models/aggregateBoard.js";
import { readMillraceCatalogUsers } from "../millraceUsers.js";
import { parseIni } from "../../assets/js/ini/parseIni.js";
import { parseTaskCardIni } from "../../assets/js/models/taskModel.js";
import {
  defaultSwimlaneIndex,
  resolveCardSwimlaneIndex,
} from "../../assets/js/ini/swimlaneResolve.js";
import { resolveCardColumnIndex } from "../../assets/js/ini/columnResolve.js";
import { dataRoot } from "../dataRoot.js";
import { loadBoardCatalog } from "./catalog.js";
import { sanitizeSegment } from "./cardPaths.js";

export async function loadBoardModelForSlug(slug) {
  const boardPath = await resolveBoardIniPathForSlug(slug);
  const text = await fs.readFile(boardPath, "utf8");
  return parseBoardIni(text.replace(/^\uFEFF/, ""));
}

export async function boardIsAggregate(slug) {
  try {
    const model = await loadBoardModelForSlug(slug);
    return isAggregateBoard(model);
  } catch {
    return false;
  }
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
    if (isAggregateBoard(m)) {
      const catalog = await loadBoardCatalog();
      const enriched = enrichAggregateBoardModel(m, catalog);
      return { columns: enriched.columns, swimlanes: enriched.swimlanes };
    }
    return { columns: m.columns, swimlanes: m.swimlanes };
  } catch {
    return { columns: [], swimlanes: [] };
  }
}

/** Board user access from the board INI (for owner policy), with names from Millrace catalog. */
export async function loadBoardUsersForOwnerPolicy(slug) {
  try {
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text.replace(/^\uFEFF/, ""));
    const access = (m.users ?? []).map((u) => ({
      email: u.email,
      active: u.active,
    }));
    const catalogUsers = await readMillraceCatalogUsers();
    return enrichBoardUsersWithMillraceCatalog(access, catalogUsers);
  } catch {
    return [];
  }
}

/** Board users for owner filter dropdowns (aggregate boards merge source board users). */
export async function loadBoardUsersForFilter(slug) {
  try {
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text.replace(/^\uFEFF/, ""));
    const catalogUsers = await readMillraceCatalogUsers();
    if (!isAggregateBoard(m)) {
      const access = (m.users ?? []).map((u) => ({
        email: u.email,
        active: u.active,
      }));
      return enrichBoardUsersWithMillraceCatalog(access, catalogUsers);
    }
    /** @type {import("../../assets/js/models/boardModel.js").BoardModel[]} */
    const sourceModels = [];
    for (const src of m.sources ?? []) {
      const srcSlug = String(src.slug ?? "").trim();
      if (!srcSlug) continue;
      try {
        const srcPath = await resolveBoardIniPathForSlug(srcSlug);
        const srcText = await fs.readFile(srcPath, "utf8");
        sourceModels.push(parseBoardIni(srcText.replace(/^\uFEFF/, "")));
      } catch {
        /* skip missing source */
      }
    }
    const merged = mergeUsersFromSourceBoards(sourceModels);
    return enrichBoardUsersWithMillraceCatalog(
      merged.map((u) => ({ email: u.email, active: u.active })),
      catalogUsers
    );
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
 * Whether the board definition for `slug` marks columns.{n} as Done (type or legacy is_done).
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
    const typeKey = Object.keys(sec).find((k) => k.toLowerCase() === "type");
    const type = parseColumnTypeRaw(typeKey ? sec[typeKey] : undefined);
    if (type === "done") return true;
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
