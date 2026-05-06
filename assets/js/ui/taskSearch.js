import { ownerDisplayLabel } from "../models/boardModel.js";

/**
 * @param {string | undefined} q
 */
export function normalizeSearchQuery(q) {
  return String(q ?? "").trim().toLowerCase();
}

/**
 * @param {object} card
 * @param {string} queryLower normalized lowercase query; empty matches all
 * @param {import("../models/boardModel.js").BoardUserDef[] | undefined} users
 */
export function cardMatchesSearch(card, queryLower, users) {
  if (!queryLower) return true;
  /** @type {string[]} */
  const parts = [];
  parts.push(String(card.title ?? ""));
  parts.push(String(card.description ?? ""));
  parts.push(String(card.filename ?? "").replace(/\.ini$/i, ""));
  parts.push(String(card.owner ?? ""));
  const ownerRaw = String(card.owner ?? "").trim();
  if (ownerRaw && Array.isArray(users) && users.length > 0) {
    parts.push(ownerDisplayLabel(ownerRaw, users));
  }
  if (Array.isArray(card.links)) {
    for (const l of card.links) {
      parts.push(String(l.text ?? ""));
      parts.push(String(l.url ?? ""));
    }
  }
  return parts.join("\n").toLowerCase().includes(queryLower);
}

/**
 * @param {object[]} cards
 * @param {string} query raw search string
 * @param {import("../models/boardModel.js").BoardUserDef[] | undefined} users
 */
export function filterCardsBySearch(cards, query, users) {
  const q = normalizeSearchQuery(query);
  if (!q) return cards;
  return cards.filter((c) => cardMatchesSearch(c, q, users));
}
