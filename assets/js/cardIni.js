import { defaultColumnIndex } from "./columnResolve.js";
import { defaultSwimlaneIndex } from "./swimlaneResolve.js";

/**
 * @param {unknown} links
 * @returns {{ text: string, url: string }[]}
 */
export function normalizeLinksForIni(links) {
  if (!Array.isArray(links)) return [];
  /** @type {{ text: string, url: string }[]} */
  const out = [];
  for (const l of links) {
    const url = String(
      l && typeof l === "object" && "url" in l ? l.url : ""
    ).trim();
    if (!url) continue;
    const text = String(
      l && typeof l === "object" && "text" in l ? l.text : ""
    ).trim();
    out.push({ text, url });
  }
  return out;
}

/**
 * Column title to store in `[item] column = …` (stable across board.ini re-indexing when titles match).
 * If `columnIndex` is missing from the board, uses the first column’s title.
 * @param {Array<{ index: number, title: string }>} columns
 * @param {number} columnIndex
 */
export function columnNameForIniItem(columns, columnIndex) {
  const list = Array.isArray(columns) ? columns : [];
  const primary = list.find((x) => x.index === columnIndex);
  if (primary) {
    const t = String(primary.title ?? "").trim();
    return t || `Column ${primary.index}`;
  }
  const defIdx = defaultColumnIndex(list);
  const fallback = list.find((x) => x.index === defIdx) ?? list[0];
  if (!fallback) return String(columnIndex);
  const t = String(fallback.title ?? "").trim();
  return t || `Column ${fallback.index}`;
}

/**
 * Swimlane title for `[item] swimlane = …`, or `undefined` when the board has no swimlanes.
 * Unknown lane index falls back to the default (first) swimlane title.
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @param {number} swimlaneIndex — `swimlanes.N` index, or `0` / invalid to mean default lane
 */
export function swimlaneNameForIniItem(swimlanes, swimlaneIndex) {
  const list = Array.isArray(swimlanes) ? swimlanes : [];
  if (!list.length) return undefined;
  const defIdx = defaultSwimlaneIndex(list);
  const want =
    Number.isInteger(swimlaneIndex) && swimlaneIndex >= 1
      ? swimlaneIndex
      : defIdx;
  const primary = list.find((x) => x.index === want);
  if (primary) {
    const t = String(primary.title ?? "").trim();
    return t || `Lane ${primary.index}`;
  }
  const fallback = list.find((x) => x.index === defIdx) ?? list[0];
  if (!fallback) return undefined;
  const t = String(fallback.title ?? "").trim();
  return t || `Lane ${fallback.index}`;
}

/**
 * Serialize a new task card as INI (matches README work-item shape).
 * @param {{ id: string, title: string, description?: string, owner?: string, columnIndex: number, swimlaneIndex?: number, sortOrder?: number, links?: unknown, columns?: Array<{ index: number, title: string }>, swimlanes?: Array<{ index: number, title: string }> }} fields
 */
export function serializeCardIni({
  id,
  title,
  description = "",
  owner = "",
  columnIndex,
  swimlaneIndex,
  sortOrder,
  links,
  columns = [],
  swimlanes = [],
}) {
  /** @type {Record<string, string>} */
  const item = {
    id,
    title,
    description: String(description ?? ""),
    owner: String(owner ?? "").trim(),
    created: new Date().toISOString(),
  };
  const colNum = Number(columnIndex);
  if (Number.isInteger(colNum) && colNum >= 1) {
    item.column = columnNameForIniItem(columns, colNum);
  }
  const laneIdx =
    swimlaneIndex !== undefined &&
    Number.isInteger(swimlaneIndex) &&
    swimlaneIndex >= 1
      ? swimlaneIndex
      : defaultSwimlaneIndex(swimlanes);
  const laneName = swimlaneNameForIniItem(swimlanes, laneIdx);
  if (laneName !== undefined) {
    item.swimlane = laneName;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    item.sort_order = String(Math.round(Number(sortOrder)));
  }
  return serializeFullCardIni(item, normalizeLinksForIni(links));
}

/**
 * Serialize a full work item including optional extra [item] keys and [link.N] sections.
 * @param {Record<string, string>} item
 * @param {Array<{ text: string, url: string }>} links
 */
/** Single-line [item] values — strip stray newlines from legacy parses. */
function scalarLine(val) {
  const s = String(val ?? "");
  const line = s.split(/\r?\n/)[0];
  return line.trimEnd();
}

export function serializeFullCardIni(item, links) {
  const lines = ["[item]"];
  const orderFirst = [
    "id",
    "title",
    "description",
    "owner",
    "swimlane",
    "column",
    "sort_order",
    "created",
    "closed",
  ];
  const scalarKeys = new Set([
    "id",
    "title",
    "owner",
    "swimlane",
    "column",
    "sort_order",
    "created",
    "closed",
  ]);
  const used = new Set();

  function appendDescription(val) {
    const desc = String(val ?? "");
    if (desc.includes("\n")) {
      const parts = desc.split("\n");
      lines.push(`description = ${parts[0]}`);
      for (let i = 1; i < parts.length; i++) {
        lines.push(`    ${parts[i].trimStart()}`);
      }
    } else {
      lines.push(`description = ${desc}`);
    }
  }

  for (const k of orderFirst) {
    if (!(k in item)) continue;
    const v = item[k];
    if (v === undefined) continue;
    if (k === "swimlane" && String(v).trim() === "") continue;
    if (k === "column" && String(v).trim() === "") continue;
    if (k === "sort_order" && String(v).trim() === "") continue;
    used.add(k);
    if (k === "description") {
      appendDescription(v);
    } else {
      const out = scalarKeys.has(k) ? scalarLine(v) : String(v);
      lines.push(`${k} = ${out}`);
    }
  }

  const rest = Object.keys(item)
    .filter((k) => !used.has(k))
    .sort();
  for (const k of rest) {
    const v = item[k];
    if (v === undefined) continue;
    if (k === "description") {
      appendDescription(v);
    } else {
      const out = scalarKeys.has(k) ? scalarLine(v) : String(v);
      lines.push(`${k} = ${out}`);
    }
  }

  links.forEach((link, idx) => {
    const n = idx + 1;
    lines.push("");
    lines.push(`[link.${n}]`);
    lines.push(`text = ${link.text}`);
    lines.push(`url = ${link.url}`);
  });
  lines.push("");
  return lines.join("\n");
}
