/**
 * @param {string} laneRaw
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @returns {Set<number> | null} indices to keep, or null if param should be ignored
 */
export function resolveCompletedLaneFilterIndices(laneRaw, swimlanes) {
  const s = String(laneRaw ?? "").trim();
  if (!s) return null;
  if (!swimlanes.length) return null;

  const list = [...swimlanes].sort((a, b) => a.index - b.index);
  const lower = s.toLowerCase();

  const byTitle = list.filter(
    (l) => String(l.title ?? "").trim().toLowerCase() === lower
  );
  if (byTitle.length > 0) {
    return new Set(byTitle.map((l) => l.index));
  }

  const key = s.match(/^swimlanes\.(\d+)$/i);
  if (key) {
    const n = Number(key[1]);
    if (list.some((l) => l.index === n)) return new Set([n]);
  }

  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    if (list.some((l) => l.index === n)) return new Set([n]);
  }

  return null;
}

/**
 * @param {object} row
 * @param {string} qLower
 */
export function completedRowMatchesSearch(row, qLower) {
  if (!qLower) return true;
  /** @type {(string | undefined)[]} */
  const parts = [
    row.title,
    row.description,
    row.note,
    row.filename,
    row.owner,
    row.id,
    row.created,
    row.closed,
  ];
  if (Array.isArray(row.links)) {
    for (const l of row.links) {
      if (l && typeof l === "object") {
        parts.push(
          /** @type {{ text?: string, url?: string }} */ (l).text,
          /** @type {{ text?: string, url?: string }} */ (l).url
        );
      }
    }
  }
  return parts.join("\n").toLowerCase().includes(qLower);
}

/**
 * Distinct non-empty swimlane strings stored on completed rows (`item.swimlane`).
 * @param {Array<{ swimlane?: string }>} rows
 * @returns {string[]}
 */
export function distinctSwimlaneRawStrings(rows) {
  const set = new Set();
  for (const row of rows) {
    const s = String(row.swimlane ?? "").trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Swimlane raw strings on cards that cannot be selected via current board swimlane tokens
 * (renamed/removed lanes on archived cards). Filtering uses case-insensitive equality on the stored raw string.
 * @param {Array<{ swimlane?: string }>} rows
 * @param {Array<{ index: number, title: string }>} swimlanes
 */
export function legacySwimlaneFilterCandidates(rows, swimlanes) {
  const distinct = distinctSwimlaneRawStrings(rows);
  if (!swimlanes.length) return distinct;
  return distinct.filter(
    (s) => resolveCompletedLaneFilterIndices(s, swimlanes) == null
  );
}