import fs from "fs/promises";
import path from "path";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import { parseTaskCardIni } from "../assets/js/models/taskModel.js";
import { dataRoot } from "./dataRoot.js";
import { loadBoardColumnAndSwimlaneDefsForSlug } from "./boardCatalog.js";

export async function sendColumnCards(res, slug, col) {
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
