import fs from "fs/promises";
import path from "path";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import {
  aggregateColumnIndexForSourceColumn,
  enrichAggregateBoardModel,
  isAggregateBoard,
  standardAggregateColumns,
} from "../assets/js/models/aggregateBoard.js";
import { parseTaskCardIni } from "../assets/js/models/taskModel.js";
import { dataRoot } from "./dataRoot.js";
import { loadBoardCatalog } from "./board/catalog.js";
import {
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardModelForSlug,
} from "./board/model.js";

/**
 * @param {string} slug
 * @param {import("../assets/js/models/boardModel.js").ColumnDef[]} columnsDef
 * @param {import("../assets/js/models/boardModel.js").SwimlaneDef[]} swimlanesDef
 * @returns {Promise<object[]>}
 */
async function readBoardCardsForSource(slug, columnsDef, swimlanesDef) {
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
        cards.push({
          filename: ent.name,
          ...parsed,
        });
        seen.add(ent.name);
      } catch (err) {
        console.warn("Skipping unreadable task file:", ent.name, err);
      }
    }

    for (const ent of entries) {
      if (!ent.isDirectory() || !/^columns\.\d+$/.test(ent.name)) continue;
      let legacy;
      try {
        legacy = await fs.readdir(path.join(boardRoot, ent.name), {
          withFileTypes: true,
        });
      } catch {
        continue;
      }
      for (const leg of legacy) {
        if (!leg.isFile() || !leg.name.endsWith(".ini")) continue;
        if (seen.has(leg.name)) continue;
        const full = path.join(boardRoot, ent.name, leg.name);
        let raw;
        try {
          raw = await fs.readFile(full, "utf8");
        } catch {
          continue;
        }
        try {
          const parsed = parseTaskCardIni(raw);
          cards.push({
            filename: leg.name,
            ...parsed,
          });
          seen.add(leg.name);
        } catch (err) {
          console.warn("Skipping unreadable legacy task file:", leg.name, err);
        }
      }
    }
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code !== "ENOENT") {
      throw e;
    }
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

  return cards;
}

/**
 * @param {string} aggregateSlug
 * @param {number} col
 * @returns {Promise<object[]>}
 */
async function loadAggregateColumnCards(aggregateSlug, col) {
  const catalog = await loadBoardCatalog();
  const rawModel = await loadBoardModelForSlug(aggregateSlug);
  const model = enrichAggregateBoardModel(rawModel, catalog);
  const aggregateColumns = standardAggregateColumns();
  /** @type {object[]} */
  const cards = [];

  for (const src of model.sources ?? []) {
    const sourceSlug = String(src.slug ?? "").trim();
    if (!sourceSlug) continue;
    const hit = catalog.find((b) => b.slug === sourceSlug);
    const sourceName = hit?.name?.trim() || sourceSlug;
    const { columns: sourceColumns, swimlanes: sourceSwimlanes } =
      await loadBoardColumnAndSwimlaneDefsForSlug(sourceSlug);
    const sourceCards = await readBoardCardsForSource(
      sourceSlug,
      sourceColumns,
      sourceSwimlanes
    );
    for (const card of sourceCards) {
      const sourceCol = resolveCardColumnIndex(card.column, sourceColumns);
      const aggCol = aggregateColumnIndexForSourceColumn(
        sourceCol,
        sourceColumns,
        aggregateColumns
      );
      if (aggCol !== col) continue;
      cards.push({
        ...card,
        swimlane: sourceName,
        sourceSwimlane: card.swimlane,
        sourceBoardSlug: sourceSlug,
        sourceBoardName: sourceName,
        sourceColumnIndex: sourceCol,
      });
    }
  }

  const swimlanesDef = model.swimlanes ?? [];
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

  return cards;
}

export async function sendColumnCards(res, slug, col) {
  try {
    if (!Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid column index." });
      return;
    }

    let model;
    try {
      model = await loadBoardModelForSlug(slug);
    } catch {
      res.status(404).json({ message: "Board definition not found." });
      return;
    }

    if (isAggregateBoard(model)) {
      const cards = await loadAggregateColumnCards(slug, col);
      res.json({ cards });
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
