import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import {
  columnNameForIniItem,
  normalizeLinksForIni,
  normalizeNextActionDate,
  serializeCardIni,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../../assets/js/ini/cardIni.js";
import { resolveCardColumnIndex } from "../../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../../assets/js/ini/swimlaneResolve.js";
import { canAssignCardOwner } from "../../assets/js/models/boardModel.js";
import { parseTaskCardIni, parseTaskCardIniFull } from "../../assets/js/models/taskModel.js";
import { summarizeCardIniDiff } from "../../assets/js/git/taskDiff.js";
import { dataRoot } from "../dataRoot.js";
import { ensureDir } from "../fsUtil.js";
import {
  columnIndexFromTasksPath,
  columnSectionIsDone,
  laneIndexFromBody,
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardUsersForOwnerPolicy,
  maxSortOrderForCell,
  newCardId,
  readFlatBoardIniSummaries,
  resolveCardFilePath,
  safeCardIniFilename,
  sanitizeSegment,
} from "../boardCatalog.js";
import { markDataRootPendingSync, writeLocalUserIni } from "../localUserIni.js";
import {
  execFileAsync,
  gitChildEnv,
  formatGitExecError,
} from "../gitOps.js";

/** Single-line card note for INI (first line, trimmed, bounded). */
function singleLineNote(raw) {
  const s = String(raw ?? "")
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, 300);
  return s;
}

/** @param {import("express").Application} app */
export function registerCardRoutes(app) {
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

    if (!existsSync(path.join(dataRoot(), ".git"))) {
      res.json({
        gitAvailable: false,
        path: null,
        commits: [],
        message: "No Git repository at the Millrace data root.",
      });
      return;
    }

    let rel = path.relative(dataRoot(), fullPath);
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
      res.status(400).json({ message: "Invalid card path for history." });
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

    /**
     * @param {string} rev Commit hash or `hash^`
     * @param {string} posixPath
     */
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
      message: gitMessage || (commits.length === 0 ? "No commits found for this file (not tracked yet, or no history)." : ""),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to read Git history." });
  }
});

app.put("/api/card", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const {
      boardSlug,
      columnIndex,
      filename,
      title,
      description = "",
      owner = "",
    } = body;
    const noteInBody = "note" in body;
    const note = noteInBody ? body.note : undefined;

    const t = String(title || "").trim();
    const fn = safeCardIniFilename(filename);
    const slug = sanitizeSegment(boardSlug || "board");
    const col = Number(columnIndex);

    if (!fn || !Number.isInteger(col) || col < 1 || !t) {
      res.status(400).json({ message: "Invalid card update." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, fn);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read card." });
      return;
    }

    const { item, links: parsedLinks } = parseTaskCardIniFull(raw);
    const prevOwner = String(item.owner ?? "").trim();
    const newOwner = String(owner ?? "").trim();
    const boardUsers = await loadBoardUsersForOwnerPolicy(slug);
    if (!canAssignCardOwner(newOwner, boardUsers, prevOwner)) {
      res.status(400).json({
        message:
          "That owner is an inactive board user. Pick an active user or leave the owner unchanged.",
      });
      return;
    }

    item.title = t;
    item.description = String(description ?? "");
    item.owner = newOwner;

    if (noteInBody) {
      const noteStr = singleLineNote(note);
      if (noteStr) item.note = noteStr;
      else delete item.note;
    }

    if (req.body && typeof req.body === "object" && "strategic" in req.body) {
      if (Boolean(req.body.strategic)) item.strategic = "yes";
      else delete item.strategic;
    }

    if (
      req.body &&
      typeof req.body === "object" &&
      "nextActionDate" in req.body
    ) {
      const nad = normalizeNextActionDate(req.body.nextActionDate);
      if (nad) item.next_action_date = nad;
      else delete item.next_action_date;
    }

    const nextLinks = Array.isArray(req.body.links)
      ? normalizeLinksForIni(req.body.links)
      : parsedLinks;

    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    item.column = columnNameForIniItem(columnsDef, col);
    const laneIdx = resolveCardSwimlaneIndex(item.swimlane, swimlanesDef);
    const laneName = swimlaneNameForIniItem(swimlanesDef, laneIdx);
    if (laneName !== undefined) item.swimlane = laneName;
    else delete item.swimlane;

    const flatPath = path.join(dataRoot(), "tasks", slug, fn);
    const out = serializeFullCardIni(item, nextLinks);
    await fs.writeFile(flatPath, out, "utf8");
    if (path.resolve(fullPath) !== path.resolve(flatPath)) {
      try {
        await fs.unlink(fullPath);
      } catch {
        /* ignore */
      }
    }

    if (newOwner) await writeLocalUserIni(newOwner);

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to save card.",
    });
  }
});

app.delete("/api/card", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const col = Number(req.query.columnIndex);
    const filename = safeCardIniFilename(req.query.filename);
    if (!filename || !Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid card delete request." });
      return;
    }

    const fullPath = await resolveCardFilePath(slug, col, filename);
    if (!fullPath) {
      res.status(404).json({ message: "Card not found." });
      return;
    }

    await fs.unlink(fullPath);

    await markDataRootPendingSync();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to delete card.",
    });
  }
});

app.post("/api/cards", async (req, res) => {
  try {
    const {
      boardSlug,
      columnIndex,
      swimlaneIndex,
      title,
      description = "",
      note = "",
      owner = "",
      strategic,
      nextActionDate,
      links: linksRaw,
    } = req.body ?? {};

    const t = String(title || "").trim();
    if (!t) {
      res.status(400).json({ message: "Title is required." });
      return;
    }

    const slug = sanitizeSegment(boardSlug || "board");
    const col = Number(columnIndex);
    if (!Number.isInteger(col) || col < 1) {
      res.status(400).json({ message: "Invalid column index." });
      return;
    }

    const newOwner = String(owner ?? "").trim();
    const boardUsers = await loadBoardUsersForOwnerPolicy(slug);
    if (!canAssignCardOwner(newOwner, boardUsers, "")) {
      res.status(400).json({
        message:
          "Cannot assign an inactive board user as card owner. Restore the user on the board or pick someone active.",
      });
      return;
    }

    const id = newCardId();
    const laneNum = Number(swimlaneIndex);
    const { columns: columnsDef, swimlanes: swimlanesDef } =
      await loadBoardColumnAndSwimlaneDefsForSlug(slug);
    const laneIdx = laneIndexFromBody(laneNum, swimlanesDef);
    const maxSo = await maxSortOrderForCell(
      slug,
      col,
      laneIdx,
      columnsDef,
      swimlanesDef,
      null
    );
    const ini = serializeCardIni({
      id,
      title: t,
      description: String(description ?? ""),
      note: singleLineNote(note),
      owner: newOwner,
      columnIndex: col,
      swimlaneIndex:
        Number.isInteger(laneNum) && laneNum >= 1 ? laneNum : undefined,
      sortOrder: maxSo + 10,
      strategic: Boolean(strategic),
      nextActionDate: normalizeNextActionDate(nextActionDate),
      links: normalizeLinksForIni(linksRaw),
      columns: columnsDef,
      swimlanes: swimlanesDef,
    });

    const boardDir = path.join(dataRoot(), "tasks", slug);
    await ensureDir(boardDir);
    const filename = `${id}.ini`;
    await fs.writeFile(path.join(boardDir, filename), ini, "utf8");

    if (newOwner) await writeLocalUserIni(newOwner);

    await markDataRootPendingSync();
    res.json({ id, filename, path: path.join("tasks", slug, filename) });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to write card.",
    });
  }
});

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
