/**
 * Map optional [item] swimlane text to a concrete swimlanes.N index from the board.
 */

/**
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @returns {number}
 */
export function defaultSwimlaneIndex(swimlanes) {
  if (!swimlanes.length) return 0;
  const sorted = [...swimlanes].sort((a, b) => a.index - b.index);
  return sorted[0].index;
}

/**
 * @param {string | undefined} raw — from INI item.swimlane
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @returns {number} swimlanes.N index for this card
 */
export function resolveCardSwimlaneIndex(raw, swimlanes) {
  const def = defaultSwimlaneIndex(swimlanes);
  const s = String(raw ?? "").trim();
  if (!s) return def;

  let n = null;
  const key = s.match(/^swimlanes\.(\d+)$/i);
  if (key) n = Number(key[1]);
  else if (/^\d+$/.test(s)) n = Number(s);

  if (n != null && Number.isInteger(n) && swimlanes.some((l) => l.index === n)) {
    return n;
  }

  const lower = s.toLowerCase();
  const byTitle = swimlanes.find(
    (l) => l.title.trim().toLowerCase() === lower
  );
  if (byTitle) return byTitle.index;

  return def;
}
