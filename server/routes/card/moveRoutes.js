import fs from "fs/promises";
import path from "path";
import {
  columnNameForIniItem,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../../../assets/js/ini/cardIni.js";
import { resolveCardColumnIndex } from "../../../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../../../assets/js/ini/swimlaneResolve.js";
import { parseTaskCardIniFull } from "../../../assets/js/models/taskModel.js";
import { dataRoot } from "../../dataRoot.js";
import {
  resolveCardFilePath,
  safeCardIniFilename,
  sanitizeSegment,
} from "../../board/cardPaths.js";
import {
  columnIndexFromTasksPath,
  columnSectionIsDone,
  laneIndexFromBody,
  loadBoardColumnAndSwimlaneDefsForSlug,
  maxSortOrderForCell,
  readFlatBoardIniSummaries,
} from "../../board/model.js";
import { markDataRootPendingSync } from "../../localUserIni.js";

/** @param {import("express").Application} app */
export function registerCardMoveRoutes(app) {
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
}
