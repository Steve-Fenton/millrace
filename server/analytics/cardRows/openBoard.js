import fs from "fs/promises";
import path from "path";
import { resolveCardColumnIndex } from "../../../assets/js/ini/columnResolve.js";
import { parseTaskCardIni } from "../../../assets/js/models/taskModel.js";
import {
  aggregateColumnIndexForSourceColumn,
  isAggregateBoard,
  standardAggregateColumns,
} from "../../../assets/js/models/aggregateBoard.js";
import {
  loadBoardCatalog,
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardModelForSlug,
} from "../../boardCatalog.js";
import { dataRoot } from "../../dataRoot.js";
import { parseIsoMs } from "../time.js";

/**
 * Open cards on the board (no `closed` date): root `*.ini` plus legacy `columns.N/` folders.
 * @param {string} slug
 */
export async function gatherOpenBoardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateOpenBoardRows(model);
  }
  return gatherPhysicalOpenBoardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateOpenBoardRows(model) {
  const catalog = await loadBoardCatalog();
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const merged = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const rows = await gatherPhysicalOpenBoardRows(sourceSlug);
    for (const row of rows) {
      merged.push({
        ...row,
        columnIndex: aggregateColumnIndexForSourceColumn(
          row.columnIndex,
          sourceColumns,
          aggregateColumns
        ),
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }
  return merged;
}

async function gatherPhysicalOpenBoardRows(slug) {
  const { columns: columnsDef } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const boardRoot = path.join(dataRoot(), "tasks", slug);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addOpenCard(fullPath, filename) {
    if (seen.has(filename)) return;
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
    if (parseIsoMs(parsed.closed) != null) return;
    seen.add(filename);
    rows.push({
      filename,
      columnIndex: resolveCardColumnIndex(parsed.column, columnsDef),
      swimlane: parsed.swimlane,
      created: parsed.created,
    });
  }

  try {
    const entries = await fs.readdir(boardRoot, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
      await addOpenCard(path.join(boardRoot, ent.name), ent.name);
    }
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code !== "ENOENT") {
      throw e;
    }
  }

  for (const col of columnsDef) {
    const legacyDir = path.join(boardRoot, `columns.${col.index}`);
    try {
      const legacy = await fs.readdir(legacyDir, { withFileTypes: true });
      for (const ent of legacy) {
        if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
        await addOpenCard(path.join(legacyDir, ent.name), ent.name);
      }
    } catch {
      /* no legacy folder */
    }
  }

  return rows;
}
