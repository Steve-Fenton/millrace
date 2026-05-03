/**
 * @param {{ slug?: string, name?: string }} meta
 * @returns {string}
 */
export function boardSlugFrom(meta) {
  const raw = String(meta.slug || meta.name || "board").trim();
  const s = raw
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "board";
}
