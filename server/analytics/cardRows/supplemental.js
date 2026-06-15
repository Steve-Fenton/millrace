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
import { gatherCompletedAndArchiveRows } from "./completedArchive.js";

/**
 * Completed cards under `tasks/{slug}/cold-storage/**` (same row shape as archive; `source: "cold"`).
 * @param {string} slug
 */
export async function gatherColdStorageCardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateColdStorageCardRows(model);
  }
  return gatherPhysicalColdStorageCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateColdStorageCardRows(model) {
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
    const rows = await gatherPhysicalColdStorageCardRows(sourceSlug);
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

async function gatherPhysicalColdStorageCardRows(slug) {
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
 * Abandoned cards under `tasks/{slug}/abandoned/**` (same row shape as archive; `source: "abandoned"`).
 * @param {string} slug
 */
export async function gatherAbandonedCardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateAbandonedCardRows(model);
  }
  return gatherPhysicalAbandonedCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateAbandonedCardRows(model) {
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
    const rows = await gatherPhysicalAbandonedCardRows(sourceSlug);
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

async function gatherPhysicalAbandonedCardRows(slug) {
  const boardRoot = path.join(dataRoot(), "tasks", slug);
  const abandonedRoot = path.join(boardRoot, "abandoned");
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addAbandonedCard(fullPath, filename) {
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
      source: "abandoned",
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
        await addAbandonedCard(p, ent.name);
      }
    }
  }

  await walk(abandonedRoot);
  return rows;
}

/**
 * Open (not closed) board cards for completed-view search-all (`source: "in-flight"`).
 * @param {string} slug
 */
export async function gatherInFlightCardRows(slug) {
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    model = null;
  }
  if (model && isAggregateBoard(model)) {
    return gatherAggregateInFlightCardRows(model);
  }
  return gatherPhysicalInFlightCardRows(slug);
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 */
async function gatherAggregateInFlightCardRows(model) {
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
    const rows = await gatherPhysicalInFlightCardRows(sourceSlug);
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

async function gatherPhysicalInFlightCardRows(slug) {
  const { columns: columnsDef } = await loadBoardColumnAndSwimlaneDefsForSlug(
    slug
  );
  const boardRoot = path.join(dataRoot(), "tasks", slug);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {object[]} */
  const rows = [];

  /**
   * @param {string} fullPath
   * @param {string} filename
   */
  async function addInFlightCard(fullPath, filename) {
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
    let sortMs = parseIsoMs(parsed.created);
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
      source: "in-flight",
      filename,
      columnIndex: resolveCardColumnIndex(parsed.column, columnsDef),
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
      await addInFlightCard(path.join(boardRoot, ent.name), ent.name);
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
        await addInFlightCard(path.join(colDir, f.name), f.name);
      }
    }
  }

  rows.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return String(a.filename).localeCompare(String(b.filename));
  });

  return rows;
}

/**
 * @param {string} slug
 * @param {boolean} searchAll — include cold storage, abandoned, and in-flight cards
 */
export async function gatherCompletedArchiveAndOptionalCold(slug, searchAll) {
  const base = await gatherCompletedAndArchiveRows(slug);
  if (!searchAll) return base;
  const [cold, abandoned, inFlight] = await Promise.all([
    gatherColdStorageCardRows(slug),
    gatherAbandonedCardRows(slug),
    gatherInFlightCardRows(slug),
  ]);
  const merged = [...base, ...cold, ...abandoned, ...inFlight];
  merged.sort((a, b) => {
    if (b.sortMs !== a.sortMs) return b.sortMs - a.sortMs;
    return String(a.filename).localeCompare(String(b.filename));
  });
  return merged;
}
