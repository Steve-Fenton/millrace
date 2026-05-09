import { parseTaskCardIniFull } from "../models/taskModel.js";

const DISPLAY_MAX = 64;

/** @param {string} s */
export function truncOneLine(s, max = DISPLAY_MAX) {
  const t = String(s ?? "").replace(/\r?\n/g, " ↵ ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** @param {string} s */
export function dispChange(s) {
  const t = String(s ?? "").trim();
  if (!t) return "∅";
  return truncOneLine(t, 56);
}

const FIELD_LABEL = {
  id: "ID",
  title: "Title",
  description: "Description",
  owner: "Owner",
  swimlane: "Swimlane",
  column: "Column",
  sort_order: "Sort order",
  created: "Created",
  closed: "Closed",
};

const ITEM_COMPARE_KEYS = [
  "title",
  "description",
  "owner",
  "swimlane",
  "column",
  "sort_order",
  "id",
  "created",
  "closed",
];

/**
 * @param {{ text: string, url: string }[]} links
 */
export function linksFingerprint(links) {
  return links
    .map((l) => `${String(l.text ?? "").trim()}\t${String(l.url ?? "").trim()}`)
    .join("\n");
}

/**
 * @param {string | null | undefined} beforeRaw
 * @param {string | null | undefined} afterRaw
 * @param {(raw: string) => { item: Record<string, string>, links: { text: string, url: string }[] }} [parseFull]
 * @returns {string[]}
 */
export function summarizeCardIniDiff(beforeRaw, afterRaw, parseFull = parseTaskCardIniFull) {
  const beforeEmpty = !String(beforeRaw ?? "").trim();
  const afterEmpty = !String(afterRaw ?? "").trim();

  if (beforeEmpty && afterEmpty) return [];

  let before;
  let after;
  try {
    before = beforeEmpty
      ? { item: {}, links: [] }
      : parseFull(String(beforeRaw));
  } catch {
    return ["(Could not parse earlier version)"];
  }
  try {
    after = afterEmpty
      ? { item: {}, links: [] }
      : parseFull(String(afterRaw));
  } catch {
    return ["(Could not parse this version)"];
  }

  /** @type {string[]} */
  const lines = [];

  if (beforeEmpty && !afterEmpty) {
    return ["New file in this commit."];
  }
  if (!beforeEmpty && afterEmpty) {
    return ["File removed in this commit."];
  }

  const beforeItem = before.item ?? {};
  const afterItem = after.item ?? {};

  for (const k of ITEM_COMPARE_KEYS) {
    const a = String(beforeItem[k] ?? "").trim();
    const b = String(afterItem[k] ?? "").trim();
    if (a === b) continue;
    const label = FIELD_LABEL[k] || k;
    lines.push(`${label}: ${dispChange(a)} → ${dispChange(b)}`);
  }

  const allKeys = new Set([
    ...Object.keys(beforeItem),
    ...Object.keys(afterItem),
  ]);
  for (const k of allKeys) {
    if (ITEM_COMPARE_KEYS.includes(k)) continue;
    const a = String(beforeItem[k] ?? "").trim();
    const b = String(afterItem[k] ?? "").trim();
    if (a === b) continue;
    const label = FIELD_LABEL[k] || k;
    lines.push(`${label}: ${dispChange(a)} → ${dispChange(b)}`);
  }

  const bf = linksFingerprint(before.links);
  const af = linksFingerprint(after.links);
  if (bf !== af) {
    const bn = before.links.length;
    const an = after.links.length;
    const bLabel = bn === 0 ? "none" : bn === 1 ? "1 entry" : `${bn} entries`;
    const aLabel = an === 0 ? "none" : an === 1 ? "1 entry" : `${an} entries`;
    lines.push(`Links: ${bLabel} → ${aLabel}`);
  }

  if (lines.length === 0 && !beforeEmpty && !afterEmpty) {
    lines.push("(No tracked field changes — whitespace or non-item sections only.)");
  }

  return lines.slice(0, 14);
}
