import fs from "fs/promises";
import path from "path";
import {
  columnNameForIniItem,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../assets/js/ini/cardIni.js";
import { resolveCardColumnIndex } from "../assets/js/ini/columnResolve.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import { parseTaskCardIniFull } from "../assets/js/models/taskModel.js";
import { dataRoot } from "./dataRoot.js";

const BOARD_TASK_INI_RE = /^FLOW-[\w.-]+\.ini$/i;

/**
 * @param {string} slug
 * @returns {Promise<string[]>} absolute paths
 */
export async function walkBoardTaskIniPaths(slug) {
  const root = path.join(dataRoot(), "tasks", slug);
  /** @type {string[]} */
  const out = [];
  async function walk(dir) {
    let ents;
    try {
      ents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && BOARD_TASK_INI_RE.test(e.name)) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * @param {import("../assets/js/models/boardModel.js").BoardModel} model
 * @param {"columns" | "swimlanes"} kind
 */
export function boardTitleMultiset(model, kind) {
  const list =
    kind === "columns"
      ? [...(model.columns ?? [])].sort((a, b) => a.index - b.index)
      : [...(model.swimlanes ?? [])].sort((a, b) => a.index - b.index);
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const entry of list) {
    const title = String(entry.title ?? "").trim().toLowerCase();
    m.set(title, (m.get(title) ?? 0) + 1);
  }
  return m;
}

/**
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 */
export function multisetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/**
 * Same column & swimlane titles (incl. counts / duplicates) — only order or non-placement
 * fields (WIP, is_done, etc.) changed. Cards use titles, so no INI updates.
 * @param {import("../assets/js/models/boardModel.js").BoardModel} oldModel
 * @param {import("../assets/js/models/boardModel.js").BoardModel} newModel
 */
export function isPureColumnSwimlaneReorderForTasks(oldModel, newModel) {
  const oc = boardTitleMultiset(oldModel, "columns");
  const nc = boardTitleMultiset(newModel, "columns");
  const os = boardTitleMultiset(oldModel, "swimlanes");
  const ns = boardTitleMultiset(newModel, "swimlanes");
  return multisetsEqual(oc, nc) && multisetsEqual(os, ns);
}

/**
 * After board definition change, rewrite each card's column/swimlane strings when titles
 * or lane/column counts change (renames, add/remove). Skipped for pure reorder — cards
 * stay keyed by name and still resolve.
 * Resolves each card's stored column/swimlane against the new board by title (or legacy
 * numeric id), not by old board slot index — so inserting or reordering columns does not
 * reassign cards to whatever title occupied the same index.
 * @param {string} slug
 * @param {import("../assets/js/models/boardModel.js").BoardModel} newModel
 */
export async function syncTaskFilesToNewBoardModel(slug, newModel) {
  const paths = await walkBoardTaskIniPaths(slug);
  for (const fullPath of paths) {
    let raw;
    try {
      raw = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }
    let item;
    let links;
    try {
      ({ item, links } = parseTaskCardIniFull(raw));
    } catch {
      continue;
    }
    const colIdx = resolveCardColumnIndex(item.column, newModel.columns);
    item.column = columnNameForIniItem(newModel.columns, colIdx);
    const laneIdx = resolveCardSwimlaneIndex(item.swimlane, newModel.swimlanes);
    const ln = swimlaneNameForIniItem(newModel.swimlanes, laneIdx);
    if (ln !== undefined) item.swimlane = ln;
    else delete item.swimlane;
    const next = serializeFullCardIni(item, links);
    if (next !== raw) {
      await fs.writeFile(fullPath, next, "utf8");
    }
  }
}
