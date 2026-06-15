import fs from "fs/promises";
import path from "path";
import { resolveCardColumnIndex } from "../../../assets/js/ini/columnResolve.js";
import { parseTaskCardIni } from "../../../assets/js/models/taskModel.js";
import {
  aggregateColumnIndexForSourceColumn,
  isAggregateBoard,
  standardAggregateColumns,
} from "../../../assets/js/models/aggregateBoard.js";
import { loadBoardCatalog } from "../../board/catalog.js";
import {
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardModelForSlug,
} from "../../board/model.js";
import { dataRoot } from "../../dataRoot.js";
import { parseIsoMs } from "../time.js";

/**
 * Board cards with `closed` plus `archive/*.ini` (not `cold-storage/**`), merged and sorted by completion time (newest first).
 * @param {string} slug
 */
export async function gatherCompletedAndArchiveRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateCompletedAndArchiveRows(model);
  }
  return gatherPhysicalBoardCompletedAndArchiveRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateCompletedAndArchiveRows(model) {
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
    const rows = await gatherPhysicalBoardCompletedAndArchiveRows(sourceSlug);
    for (const row of rows) {
      const sourceColumnIndex = row.columnIndex;
      let columnIndex = row.columnIndex;
      if (columnIndex != null) {
        columnIndex = aggregateColumnIndexForSourceColumn(
          columnIndex,
          sourceColumns,
          aggregateColumns
        );
      }
      merged.push({
        ...row,
        columnIndex,
        sourceColumnIndex,
        swimlane: sourceName,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
      });
    }
  }

  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    const af = `${a.sourceBoardSlug ?? ""}/${a.filename}`;
    const bf = `${b.sourceBoardSlug ?? ""}/${b.filename}`;
    return af.localeCompare(bf);
  });
  return merged;
}

/**
 * @param {string} slug physical board slug (task folder)
 */
async function gatherPhysicalBoardCompletedAndArchiveRows(slug) {
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
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
      note: parsed.note,
      owner: parsed.owner,
      swimlane: parsed.swimlane,
      strategic: parsed.strategic,
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
