import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  parseBoardIni,
  validateExactlyOneDoneColumn,
} from "../../assets/js/models/boardModel.js";
import { summarizeCardIniDiff } from "../../assets/js/git/taskDiff.js";
import { BOARD_CATALOG_SECTION } from "../constants.js";
import { boardCatalogIniPath, dataRoot, isBoardCatalogIniSection } from "../dataRoot.js";
import {
  allocateNewBoardSlugAndFile,
  appendBoardCatalogEntry,
  boardSlugFromMeta,
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
    if (!displayName) {
      res.status(400).json({ message: "Board name is required." });
      return;
    }

    const { slug, file } = await allocateNewBoardSlugAndFile(displayName);
    const iniText = defaultNewBoardIniText(displayName, slug);
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

    const boardRoot = path.join(tasksDir, slug);
    await ensureDir(boardRoot);

    await markDataRootPendingSync();
    res.json({
      ok: true,
      slug,
      name: model.board.name?.trim() || displayName,
      file,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to create board.",
    });
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

    if (!isPureColumnSwimlaneReorderForTasks(oldModel, newModel)) {
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
    if (!existsSync(boardPath)) {
      res.status(404).json({ message: "Board definition not found." });
      return;
    }

    if (!existsSync(path.join(dataRoot(), ".git"))) {
      res.json({
        gitAvailable: false,
        path: null,
        commits: [],
        message: "No Git repository at the Millrace data root.",
      });
      return;
    }

    let rel = path.relative(dataRoot(), boardPath);
    rel = rel.split(path.sep).join("/");
    const norm = path.posix.normalize(rel);
    const absNorm = path.resolve(dataRoot(), norm);
    const tasksRoot = path.resolve(dataRoot(), "tasks");
    if (
      norm.startsWith("../") ||
      norm === ".." ||
      norm.startsWith("/") ||
      !norm.startsWith("tasks/") ||
      (!absNorm.startsWith(tasksRoot + path.sep) && absNorm !== tasksRoot)
    ) {
      res.status(400).json({ message: "Invalid board path for history." });
      return;
    }

    const env = gitChildEnv();
    const opts = {
      cwd: dataRoot(),
      env,
      maxBuffer: 5 * 1024 * 1024,
    };

    /** @type {{ hash: string, shortHash: string, date: string, author: string, subject: string, changeSummary?: string[] }[]} */
    const commits = [];
    let gitMessage = "";

    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "log",
          "--follow",
          `-n${limit}`,
          "--format=%H%x1f%h%x1f%ai%x1f%an%x1f%s",
          "--",
          norm,
        ],
        opts
      );
      const out = String(stdout ?? "").trim();
      for (const line of out.split("\n")) {
        if (!line) continue;
        const p = line.split("\x1f");
        if (p.length >= 5) {
          commits.push({
            hash: p[0],
            shortHash: p[1],
            date: p[2],
            author: p[3],
            subject: p.slice(4).join("\x1f"),
          });
        }
      }
    } catch (e) {
      gitMessage = formatGitExecError("git log", e);
    }

    async function gitShowBlob(rev, posixPath) {
      const spec = `${rev}:${posixPath}`;
      try {
        const { stdout } = await execFileAsync("git", ["show", spec], opts);
        return String(stdout ?? "");
      } catch {
        return null;
      }
    }

    const enriched = [];
    const batchSize = 6;
    for (let i = 0; i < commits.length; i += batchSize) {
      const slice = commits.slice(i, i + batchSize);
      const part = await Promise.all(
        slice.map(async (c) => {
          const afterText = await gitShowBlob(c.hash, norm);
          const beforeText = await gitShowBlob(`${c.hash}^`, norm);
          const changeSummary = summarizeCardIniDiff(beforeText, afterText);
          return { ...c, changeSummary };
        })
      );
      enriched.push(...part);
    }

    res.json({
      gitAvailable: true,
      path: norm,
      commits: enriched,
      message:
        gitMessage ||
        (commits.length === 0
          ? "No commits found for this file (not tracked yet, or no history)."
          : ""),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read Git history." });
  }
});
}
