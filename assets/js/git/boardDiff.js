import { parseBoardIni } from "../models/boardModel.js";
import { dispChange } from "./taskDiff.js";

const EMPTY_MODEL = Object.freeze({
  board: {},
  columns: [],
  swimlanes: [],
  users: [],
});

/** Lower-cased trimmed title for ordered-title comparisons. */
function titleKey(s) {
  return String(s ?? "").trim();
}

/**
 * @param {Array<{ index: number, title: string }>} list
 * @returns {string[]} ordered, trimmed titles
 */
function orderedTitles(list) {
  return [...list]
    .sort((a, b) => a.index - b.index)
    .map((e) => titleKey(e.title));
}

/**
 * @param {string[]} titles
 * @returns {Map<string, number>}
 */
function toMultiset(titles) {
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const t of titles) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function sameOrderedArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Order- and multiset-aware diff over a list of named rows (columns / swimlanes).
 * @param {string[]} out
 * @param {{ singular: string, plural: string }} label
 * @param {Array<{ index: number, title: string }>} before
 * @param {Array<{ index: number, title: string }>} after
 */
function pushOrderedTitleDiff(out, label, before, after) {
  const b = orderedTitles(before);
  const a = orderedTitles(after);
  if (sameOrderedArray(b, a)) return;

  const bMul = toMultiset(b);
  const aMul = toMultiset(a);

  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  for (const [t, n] of aMul) {
    const diff = n - (bMul.get(t) ?? 0);
    for (let i = 0; i < diff; i++) added.push(t);
  }
  for (const [t, n] of bMul) {
    const diff = n - (aMul.get(t) ?? 0);
    for (let i = 0; i < diff; i++) removed.push(t);
  }

  if (added.length === 0 && removed.length === 0) {
    out.push(`${label.plural} reordered: ${a.map(dispChange).join(", ")}`);
    return;
  }
  for (const t of added) out.push(`${label.singular} added: ${dispChange(t)}`);
  for (const t of removed) out.push(`${label.singular} removed: ${dispChange(t)}`);
}

/**
 * Compare per-title column attributes (WIP limit, is-done flag) when both sides have a
 * column with the same trimmed lower-case title — only one entry per title (matches the
 * first occurrence the same way card column resolution does).
 * @param {string[]} out
 * @param {Array<{ index: number, title: string, wipLimit?: number, isDone?: boolean }>} before
 * @param {Array<{ index: number, title: string, wipLimit?: number, isDone?: boolean }>} after
 */
function collectColumnAttributeChanges(out, before, after) {
  /** @type {Map<string, { title: string, wipLimit?: number, isDone?: boolean }>} */
  const bMap = new Map();
  for (const c of before) {
    const key = titleKey(c.title).toLowerCase();
    if (!key || bMap.has(key)) continue;
    bMap.set(key, c);
  }
  /** @type {Set<string>} */
  const seenAfter = new Set();
  for (const c of after) {
    const key = titleKey(c.title).toLowerCase();
    if (!key || seenAfter.has(key)) continue;
    seenAfter.add(key);
    const b = bMap.get(key);
    if (!b) continue;
    const title = titleKey(c.title);
    const bw = b.wipLimit;
    const aw = c.wipLimit;
    if ((bw ?? null) !== (aw ?? null)) {
      const bl = bw === undefined ? "—" : String(bw);
      const al = aw === undefined ? "—" : String(aw);
      out.push(`WIP limit (${dispChange(title)}): ${bl} → ${al}`);
    }
    const bd = Boolean(b.isDone);
    const ad = Boolean(c.isDone);
    if (bd !== ad) {
      out.push(
        `Done marker (${dispChange(title)}): ${bd ? "yes" : "no"} → ${ad ? "yes" : "no"}`
      );
    }
  }
}

/**
 * Diff board users by email (case-insensitive): adds, removes, name renames, active flips.
 * @param {string[]} out
 * @param {Array<{ email: string, name: string, active?: boolean }>} before
 * @param {Array<{ email: string, name: string, active?: boolean }>} after
 */
function collectUserChanges(out, before, after) {
  /** @type {Map<string, { email: string, name: string, active?: boolean }>} */
  const bMap = new Map();
  for (const u of before) {
    const k = String(u.email ?? "").trim().toLowerCase();
    if (!k || bMap.has(k)) continue;
    bMap.set(k, u);
  }
  /** @type {Map<string, { email: string, name: string, active?: boolean }>} */
  const aMap = new Map();
  for (const u of after) {
    const k = String(u.email ?? "").trim().toLowerCase();
    if (!k || aMap.has(k)) continue;
    aMap.set(k, u);
  }
  for (const [k, u] of aMap) {
    if (bMap.has(k)) continue;
    out.push(`User added: ${dispChange(u.email)}`);
  }
  for (const [k, u] of bMap) {
    if (aMap.has(k)) continue;
    out.push(`User removed: ${dispChange(u.email)}`);
  }
  for (const [k, b] of bMap) {
    const a = aMap.get(k);
    if (!a) continue;
    const bn = String(b.name ?? "").trim();
    const an = String(a.name ?? "").trim();
    if (bn !== an) {
      out.push(
        `User name (${dispChange(b.email)}): ${dispChange(bn)} → ${dispChange(an)}`
      );
    }
    const bActive = b.active !== false;
    const aActive = a.active !== false;
    if (bActive !== aActive) {
      out.push(
        `User ${aActive ? "activated" : "deactivated"}: ${dispChange(b.email)}`
      );
    }
  }
}

/**
 * Produce short readable lines describing what changed between two board INI texts:
 * board name, columns (add/remove/reorder + WIP and done-marker tweaks), swimlanes
 * (add/remove/reorder), and users (add/remove/rename/activate). Matches the output
 * shape of {@link import("./taskDiff.js").summarizeCardIniDiff}.
 *
 * @param {string | null | undefined} beforeRaw
 * @param {string | null | undefined} afterRaw
 * @param {(raw: string) => import("../models/boardModel.js").BoardModel} [parseBoard]
 * @returns {string[]}
 */
export function summarizeBoardIniDiff(
  beforeRaw,
  afterRaw,
  parseBoard = parseBoardIni
) {
  const beforeEmpty = !String(beforeRaw ?? "").trim();
  const afterEmpty = !String(afterRaw ?? "").trim();

  if (beforeEmpty && afterEmpty) return [];

  let before;
  let after;
  try {
    before = beforeEmpty
      ? EMPTY_MODEL
      : parseBoard(String(beforeRaw).replace(/^\uFEFF/, ""));
  } catch {
    return ["(Could not parse earlier version)"];
  }
  try {
    after = afterEmpty
      ? EMPTY_MODEL
      : parseBoard(String(afterRaw).replace(/^\uFEFF/, ""));
  } catch {
    return ["(Could not parse this version)"];
  }

  if (beforeEmpty && !afterEmpty) return ["New file in this commit."];
  if (!beforeEmpty && afterEmpty) return ["File removed in this commit."];

  /** @type {string[]} */
  const lines = [];

  const beforeName = String(before.board?.name ?? "").trim();
  const afterName = String(after.board?.name ?? "").trim();
  if (beforeName !== afterName) {
    lines.push(
      `Board name: ${dispChange(beforeName)} → ${dispChange(afterName)}`
    );
  }

  pushOrderedTitleDiff(
    lines,
    { singular: "Column", plural: "Columns" },
    before.columns ?? [],
    after.columns ?? []
  );
  collectColumnAttributeChanges(
    lines,
    before.columns ?? [],
    after.columns ?? []
  );

  pushOrderedTitleDiff(
    lines,
    { singular: "Swimlane", plural: "Swimlanes" },
    before.swimlanes ?? [],
    after.swimlanes ?? []
  );

  collectUserChanges(lines, before.users ?? [], after.users ?? []);

  if (lines.length === 0) {
    lines.push("(No tracked board changes — whitespace or comments only.)");
  }

  return lines.slice(0, 14);
}
