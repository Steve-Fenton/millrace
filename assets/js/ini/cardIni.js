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
 * If `columnIndex` is missing from the board, uses the first column's title.
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
  const fallback = list.find((x) => x.index === defIdx);
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
  const fallback = list.find((x) => x.index === defIdx);
  const t = String(fallback.title ?? "").trim();
  return t || `Lane ${fallback.index}`;
}

/**
 * Trim a YYYY-MM-DD date string (or any near-equivalent value the user typed).
 * Returns the YYYY-MM-DD slice when it looks valid, otherwise an empty string.
 * @param {unknown} raw
 */
export function normalizeNextActionDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return "";
  const ymd = m[1];
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return ymd;
}

/**
 * Whole calendar days from `todayMs` (local time) to the parsed YYYY-MM-DD, or
 * `null` when `raw` does not parse. Negative values mean the date is overdue,
 * `0` is today, `1` tomorrow, and so on.
 * @param {unknown} raw
 * @param {number} [todayMs] — defaults to `Date.now()` so callers can keep this pure for tests
 * @returns {number | null}
 */
export function daysUntilNextActionDate(raw, todayMs = Date.now()) {
  const ymd = normalizeNextActionDate(raw);
  if (!ymd) return null;
  const [y, mo, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  const targetMs = new Date(y, mo - 1, d).getTime();
  const now = new Date(todayMs);
  const todayStartMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((targetMs - todayStartMs) / dayMs);
}

/**
 * True when `raw` parses to a YYYY-MM-DD that is at most two days from `todayMs`
 * (in the local time zone), including the day itself and any past dates.
 * Used by the board to flag cards whose next action is due soon or overdue.
 * @param {unknown} raw
 * @param {number} [todayMs] — defaults to `Date.now()` so callers can keep this pure for tests
 */
export function isNextActionDateImminent(raw, todayMs = Date.now()) {
  const days = daysUntilNextActionDate(raw, todayMs);
  return days !== null && days <= 2;
}

/**
 * True when an open card's next action date is today (local time).
 * @param {{ closed?: string, next_action_date?: string }} card
 * @param {number} [todayMs]
 */
export function shouldFloatNextActionTodayCard(card, todayMs = Date.now()) {
  if (String(card?.closed ?? "").trim()) return false;
  const nad = normalizeNextActionDate(card?.next_action_date);
  if (!nad) return false;
  return daysUntilNextActionDate(nad, todayMs) === 0;
}

/**
 * Stable display order: open cards with next action today float to the top.
 * @param {object[]} cards
 * @param {number} [todayMs]
 */
export function sortCardsWithNextActionTodayFirst(cards, todayMs = Date.now()) {
  if (!Array.isArray(cards) || cards.length < 2) return cards;
  const tagged = cards.map((c, i) => ({
    c,
    i,
    float: shouldFloatNextActionTodayCard(c, todayMs),
  }));
  tagged.sort((a, b) => {
    if (a.float !== b.float) return a.float ? -1 : 1;
    return a.i - b.i;
  });
  return tagged.map((t) => t.c);
}

/**
 * Serialize a new task card as INI (matches README work-item shape).
 * @param {{ id: string, title: string, description?: string, note?: string, owner?: string, columnIndex: number, swimlaneIndex?: number, sortOrder?: number, strategic?: boolean, nextActionDate?: string, links?: unknown, columns?: Array<{ index: number, title: string }>, swimlanes?: Array<{ index: number, title: string }> }} fields
 */
export function serializeCardIni({
  id,
  title,
  description = "",
  note = "",
  owner = "",
  columnIndex,
  swimlaneIndex,
  sortOrder,
  strategic,
  nextActionDate,
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
  const noteOne = scalarLine(note);
  if (noteOne) item.note = noteOne;
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
  if (strategic) {
    item.strategic = "yes";
  }
  const nad = normalizeNextActionDate(nextActionDate);
  if (nad) {
    item.next_action_date = nad;
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
    "note",
    "next_action_date",
    "swimlane",
    "column",
    "sort_order",
    "created",
    "closed",
    "strategic",
  ];
  const scalarKeys = new Set([
    "id",
    "title",
    "note",
    "next_action_date",
    "owner",
    "swimlane",
    "column",
    "sort_order",
    "created",
    "closed",
    "strategic",
  ]);
  const used = new Set();

  function appendDescription(val) {
    const desc = String(val ?? "");
    if (desc.includes("\n")) {
      const parts = desc.split("\n");
      lines.push(`description = ${parts[0]}`);
      for (let i = 1; i < parts.length; i++) {
        lines.push(`    ${parts[i]}`);
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
    if (k === "strategic" && String(v).trim() === "") continue;
    if (k === "note" && String(v).trim() === "") continue;
    if (k === "next_action_date" && String(v).trim() === "") continue;
    used.add(k);
    if (k === "description") {
      appendDescription(v);
    } else {
      lines.push(`${k} = ${scalarLine(v)}`);
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
