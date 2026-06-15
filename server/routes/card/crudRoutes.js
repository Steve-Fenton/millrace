import fs from "fs/promises";
import path from "path";
import {
  columnNameForIniItem,
  normalizeLinksForIni,
  normalizeNextActionDate,
  serializeCardIni,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../../../assets/js/ini/cardIni.js";
import { resolveCardSwimlaneIndex } from "../../../assets/js/ini/swimlaneResolve.js";
import { canAssignCardOwner } from "../../../assets/js/models/boardModel.js";
import { parseTaskCardIniFull } from "../../../assets/js/models/taskModel.js";
import { dataRoot } from "../../dataRoot.js";
import { ensureDir } from "../../fsUtil.js";
import {
  abandonCardFile,
  boardIsAggregate,
  laneIndexFromBody,
  loadBoardColumnAndSwimlaneDefsForSlug,
  loadBoardUsersForOwnerPolicy,
  maxSortOrderForCell,
  newCardId,
  resolveCardFilePath,
  safeCardIniFilename,
  sanitizeSegment,
} from "../../boardCatalog.js";
import { markDataRootPendingSync, writeLocalUserIni } from "../../localUserIni.js";

/** Single-line card note for INI (first line, trimmed, bounded). */
function singleLineNote(raw) {
  const s = String(raw ?? "")
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, 300);
  return s;
}

/** @param {import("express").Application} app */
export function registerCardCrudRoutes(app) {
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
        res.status(400).json({ message: "Invalid card abandon request." });
        return;
      }

      const fullPath = await resolveCardFilePath(slug, col, filename);
      if (!fullPath) {
        res.status(404).json({ message: "Card not found." });
        return;
      }

      await abandonCardFile(slug, fullPath, filename);

      await markDataRootPendingSync();
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        message: e instanceof Error ? e.message : "Failed to abandon card.",
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
      if (await boardIsAggregate(slug)) {
        res.status(400).json({
          message: "Cannot add cards on an aggregate board. Add cards on a source board.",
        });
        return;
      }
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
}
