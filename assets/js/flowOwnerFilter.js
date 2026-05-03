export const OWNER_FILTER_STORAGE_KEY = "flow:owner-filter";

/**
 * @typedef {{ mode: "all" | "mine" | "owner"; owner: string }} OwnerFilter
 */

/**
 * @param {OwnerFilter} f
 * @returns {string} select option value
 */
export function ownerFilterToSelectValue(f) {
  if (f.mode === "all") return "all";
  if (f.mode === "mine") return "mine";
  if (f.mode === "owner" && f.owner) {
    return `owner:${encodeURIComponent(f.owner)}`;
  }
  return "all";
}

/** @returns {OwnerFilter | null} */
export function readStoredOwnerFilter() {
  try {
    const raw = localStorage.getItem(OWNER_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      typeof p === "object" &&
      (p.mode === "all" || p.mode === "mine" || p.mode === "owner")
    ) {
      return {
        mode: p.mode,
        owner: typeof p.owner === "string" ? p.owner : "",
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {OwnerFilter} filter */
export function persistOwnerFilter(filter) {
  try {
    localStorage.setItem(
      OWNER_FILTER_STORAGE_KEY,
      JSON.stringify(filter)
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {object[]} cards
 * @param {string} mineEmail `[user] mine` — not the last card owner field
 * @param {OwnerFilter} ownerFilter
 */
export function filterCardsByOwner(cards, mineEmail, ownerFilter) {
  if (ownerFilter.mode === "all") return cards;
  if (ownerFilter.mode === "mine") {
    const me = String(mineEmail ?? "").trim().toLowerCase();
    if (!me) return [];
    return cards.filter(
      (c) => String(c.owner ?? "").trim().toLowerCase() === me
    );
  }
  const target = ownerFilter.owner;
  if (!target) return cards;
  return cards.filter((c) => String(c.owner ?? "").trim() === target);
}

/**
 * @param {string[]} ownerNames
 * @param {string} mineEmail `[user] mine`
 * @param {OwnerFilter} filter
 * @returns {OwnerFilter}
 */
export function normalizeOwnerFilter(ownerNames, mineEmail, filter) {
  let mode = filter.mode;
  let owner = filter.owner;
  if (mode === "mine" && !String(mineEmail ?? "").trim()) {
    mode = "all";
    owner = "";
  }
  if (mode === "owner" && owner && !ownerNames.includes(owner)) {
    mode = "all";
    owner = "";
  }
  return { mode, owner };
}
