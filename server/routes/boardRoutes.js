import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  parseBoardIni,
  validateExactlyOneDoneColumn,
} from "../../assets/js/models/boardModel.js";
import {
  isAggregateBoard,
  validateAggregateBoard,
} from "../../assets/js/models/aggregateBoard.js";
import { summarizeBoardIniDiff } from "../../assets/js/git/boardDiff.js";
import { BOARD_CATALOG_SECTION } from "../constants.js";
import { boardCatalogIniPath, dataRoot, isBoardCatalogIniSection } from "../dataRoot.js";
import {
  allocateNewBoardSlugAndFile,
  appendBoardCatalogEntry,
  boardSlugFromMeta,
  defaultAggregateBoardIniText,
  defaultNewBoardIniText,
  loadBoardCatalog,
  resolveBoardIniPathForSlug,
  sanitizeSegment,
} from "../boardCatalog.js";
import {
  isPureColumnSwimlaneReorderForTasks,
  syncTaskFilesToNewBoardModel,
} from "../boardDefinitionSync.js";
import { ensureDir } from "../fsUtil.js";
import { markDataRootPendingSync } from "../localUserIni.js";
import {
  execFileAsync,
  gitChildEnv,
  formatGitExecError,
} from "../gitOps.js";
import { boardNameUniqueError, renameBoard } from "../boardRename.js";
import { getGitHistory } from "../gitHistory.js";

/** @param {import("express").Application} app */
export function registerBoardRoutes(app) {
app.get("/api/board", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const boardPath = await resolveBoardIniPathForSlug(slug);
    const text = await fs.readFile(boardPath, "utf8");
    const m = parseBoardIni(text);
    const declaredSlug = boardSlugFromMeta(m.board);
    const name = m.board.name?.trim() || declaredSlug || "Board";
    res.json({
      text,
      slug: declaredSlug,
      name,
      file: path.basename(boardPath),
    });
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
      res.status(404).json({
        message: `Board definition not found (looked under ${dataRoot()}/tasks/).`,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ message: "Failed to read board." });
  }
});

app.post("/api/board", async (req, res) => {
  try {
    const displayName = String(req.body?.name ?? "").trim();
    const catalog = await loadBoardCatalog();
    const nameErr = boardNameUniqueError(catalog, displayName);
    if (nameErr) {
      res.status(400).json({ message: nameErr });
      return;
    }

    const kindRaw = String(req.body?.kind ?? "").trim().toLowerCase();
    const isAggregate = kindRaw === "aggregate";
    /** @type {string[]} */
    const sourceSlugs = [];
    if (Array.isArray(req.body?.sources)) {
      for (const s of req.body.sources) {
        const slug = String(s ?? "").trim();
        if (slug) sourceSlugs.push(slug);
      }
    }

    const { slug, file } = await allocateNewBoardSlugAndFile(displayName);
    const iniText = isAggregate
      ? defaultAggregateBoardIniText(displayName, slug, sourceSlugs)
      : defaultNewBoardIniText(displayName, slug);
    let model;
    try {
      model = parseBoardIni(iniText.replace(/^\uFEFF/, ""));
    } catch (e) {
      res.status(500).json({
        message: e instanceof Error ? e.message : "Invalid generated board INI.",
      });
      return;
    }
    if (!model.columns?.length) {
      res.status(500).json({ message: "Generated board has no columns." });
      return;
    }

    if (isAggregate) {
      const aggErr = validateAggregateBoard(model, catalog, {
        requireSources: false,
      });
      if (aggErr) {
        res.status(400).json({ message: aggErr });
        return;
      }
    }

    const tasksDir = path.join(dataRoot(), "tasks");
    const boardIniPath = path.join(tasksDir, file);
    await fs.writeFile(boardIniPath, iniText, "utf8");
    try {
      await appendBoardCatalogEntry(file);
    } catch (e) {
      try {
        await fs.unlink(boardIniPath);
      } catch {
        /* best effort */
      }
      throw e;
    }

    if (!isAggregate) {
      const boardRoot = path.join(tasksDir, slug);
      await ensureDir(boardRoot);
    }

    await markDataRootPendingSync();
    res.json({
      ok: true,
      slug,
      name: model.board.name?.trim() || displayName,
      file,
      kind: isAggregate ? "aggregate" : undefined,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to create board.",
    });
  }
});

app.post("/api/board/rename", async (req, res) => {
  try {
    const boardSlug = sanitizeSegment(String(req.body?.boardSlug ?? "board"));
    const name = String(req.body?.name ?? "").trim();
    const result = await renameBoard(boardSlug, name);
    await markDataRootPendingSync();
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to rename board.";
    const status =
      msg.includes("not found") ||
      msg.includes("required") ||
      msg.includes("already exists") ||
      msg.includes("already used") ||
      msg.includes("must be at most") ||
      msg.includes("cannot contain")
        ? 400
        : 500;
    if (status >= 500) console.error(e);
    res.status(status).json({ message: msg });
  }
});

app.put("/api/board-definition", async (req, res) => {
  try {
    const { boardSlug, text } = req.body ?? {};
    const slug = sanitizeSegment(String(boardSlug ?? "board"));
    const t = String(text ?? "");
    if (!t.trim()) {
      res.status(400).json({ message: "Board INI text is required." });
      return;
    }

    let newModel;
    try {
      newModel = parseBoardIni(t.replace(/^\uFEFF/, ""));
    } catch (e) {
      res.status(400).json({
        message: e instanceof Error ? e.message : "Invalid board INI.",
      });
      return;
    }
    if (!newModel.columns || newModel.columns.length === 0) {
      res.status(400).json({ message: "Board must define at least one column." });
      return;
    }

    const doneColumnError = validateExactlyOneDoneColumn(newModel);
    if (doneColumnError) {
      res.status(400).json({ message: doneColumnError });
      return;
    }

    if (isAggregateBoard(newModel)) {
      const catalog = await loadBoardCatalog();
      const aggErr = validateAggregateBoard(newModel, catalog);
      if (aggErr) {
        res.status(400).json({ message: aggErr });
        return;
      }
    }

    const boardPath = await resolveBoardIniPathForSlug(slug);
    let oldText = "";
    try {
      oldText = await fs.readFile(boardPath, "utf8");
    } catch {
      res.status(404).json({ message: "Board definition not found." });
      return;
    }

    let oldModel;
    try {
      oldModel = parseBoardIni(oldText.replace(/^\uFEFF/, ""));
    } catch {
      oldModel = newModel;
    }

    const declared = boardSlugFromMeta(newModel.board);
    if (declared !== slug) {
      res.status(400).json({
        message: `Board [board] slug (${declared}) must match the board being edited (${slug}).`,
      });
      return;
    }

    if (!isAggregateBoard(newModel) && !isPureColumnSwimlaneReorderForTasks(oldModel, newModel)) {
      await syncTaskFilesToNewBoardModel(slug, oldModel, newModel);
    }

    await fs.writeFile(boardPath, t.replace(/^\uFEFF/, ""), "utf8");

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to save board.",
    });
  }
});

app.delete("/api/board-definition", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const catalog = await loadBoardCatalog();
    if (catalog.length <= 1) {
      res.status(400).json({
        message: "Cannot delete the only board in the catalog.",
      });
      return;
    }
    const hit = catalog.find((e) => e.slug === slug);
    if (!hit) {
      res.status(404).json({ message: "Board not found in catalog." });
      return;
    }

    const boardPath = path.join(dataRoot(), "tasks", hit.file);
    try {
      await fs.unlink(boardPath);
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
        res.status(404).json({ message: "Board file already removed." });
        return;
      }
      throw e;
    }

    const catalogPath = boardCatalogIniPath();
    try {
      const catalogText = await fs.readFile(catalogPath, "utf8");
      const lines = catalogText.split(/\r?\n/);
      /** @type {string[]} */
      const out = [];
      let inCatalogSection = false;
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
            .filter((p) => p !== hit.file);
          if (parts.length === 0) {
            res.status(400).json({
              message: "Refusing to leave the board catalog with an empty boards list.",
            });
            return;
          }
          const indent = line.match(/^\s*/)?.[0] ?? "";
          out.push(`${indent}boards = ${parts.join(", ")}`);
          continue;
        }
        out.push(line);
      }
      await fs.writeFile(catalogPath, out.join("\n"), "utf8");
    } catch {
      /* no catalog file — single-file setups already blocked by catalog length */
    }

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to delete board.",
    });
  }
});

/**
 * Git history for the board definition INI (`tasks/devrel.ini`, etc.).
 */
app.get("/api/board-definition/git-history", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const limitRaw = Number.parseInt(String(req.query.limit ?? "40"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, limitRaw))
      : 40;

    const boardPath = await resolveBoardIniPathForSlug(slug);
    const result = await getGitHistory({
      absolutePath: boardPath,
      useFollow: true,
      limit,
      summarizeDiff: summarizeBoardIniDiff,
      notFoundMessage: "Board definition not found.",
      invalidPathMessage: "Invalid board path for history.",
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read Git history." });
  }
});
}
