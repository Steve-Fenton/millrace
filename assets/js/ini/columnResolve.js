/**
 * Map optional [item] column text to a concrete columns.N index from the board.
 */

/**
 * @param {Array<{ index: number, title: string }>} columns
 * @returns {number}
 */
export function defaultColumnIndex(columns) {
  if (!columns.length) return 1;
  const sorted = [...columns].sort((a, b) => a.index - b.index);
  return sorted[0].index;
}

/**
 * @param {string | undefined} raw — from INI item.column
 * @param {Array<{ index: number, title: string }>} columns
 * @returns {number} columns.N index for this card
 */
export function resolveCardColumnIndex(raw, columns) {
  const def = defaultColumnIndex(columns);
  const s = String(raw ?? "").trim();
  if (!s) return def;

  let n = null;
  const key = s.match(/^columns\.(\d+)$/i);
  if (key) n = Number(key[1]);
  else if (/^\d+$/.test(s)) n = Number(s);

  if (n != null && Number.isInteger(n) && columns.some((c) => c.index === n)) {
    return n;
  }

  const lower = s.toLowerCase();
  const byTitle = columns.find(
    (c) => c.title.trim().toLowerCase() === lower
  );
  if (byTitle) return byTitle.index;

  return def;
}
