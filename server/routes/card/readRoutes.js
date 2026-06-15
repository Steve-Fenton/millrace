import fs from "fs/promises";
import { parseTaskCardIni } from "../../../assets/js/models/taskModel.js";
import { summarizeCardIniDiff } from "../../../assets/js/git/taskDiff.js";
import {
  resolveCardFilePath,
  safeCardIniFilename,
  sanitizeSegment,
} from "../../boardCatalog.js";
import { getGitHistory } from "../../gitHistory.js";

/** @param {import("express").Application} app */
export function registerCardReadRoutes(app) {
  app.get("/api/card", async (req, res) => {
    try {
      const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
      const col = Number(req.query.columnIndex);
      const filename = safeCardIniFilename(req.query.filename);
      if (!filename || !Number.isInteger(col) || col < 1) {
        res.status(400).json({ message: "Invalid card request." });
        return;
      }

      const fullPath = await resolveCardFilePath(slug, col, filename);
      if (!fullPath) {
        res.status(404).json({ message: "Card not found." });
        return;
      }

      const raw = await fs.readFile(fullPath, "utf8");
      const parsed = parseTaskCardIni(raw);
      res.json({ filename, ...parsed });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read card." });
    }
  });

  /**
   * Query: boardSlug, columnIndex, filename, optional limit (default 40, max 100).
   * Returns `git log` for the resolved task INI under `tasks/` (requires `.git` at data root).
   *
   * Intentionally does NOT pass `--follow`: card filenames are stable random IDs that the app
   * never renames, and `--follow` uses similarity heuristics that splice a source card's history
   * onto a freshly-duplicated card (the new file shares description/owner/links so it matches as
   * a copy of the original).
   */
  app.get("/api/card/git-history", async (req, res) => {
    try {
      const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
      const col = Number(req.query.columnIndex);
      const filename = safeCardIniFilename(req.query.filename);
      const limitRaw = Number.parseInt(String(req.query.limit ?? "40"), 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(100, Math.max(1, limitRaw))
        : 40;

      if (!filename || !Number.isInteger(col) || col < 1) {
        res.status(400).json({ message: "Invalid card request." });
        return;
      }

      const fullPath = await resolveCardFilePath(slug, col, filename);
      if (!fullPath) {
        res.status(404).json({ message: "Card not found." });
        return;
      }

      const result = await getGitHistory({
        absolutePath: fullPath,
        useFollow: false,
        limit,
        summarizeDiff: summarizeCardIniDiff,
        notFoundMessage: "Card not found.",
        invalidPathMessage: "Invalid card path for history.",
      });
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read Git history." });
    }
  });
}
