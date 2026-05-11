/**
 * Per-board swimlane collapse state shared by the kanban view and `tasks/localuser.ini`.
 *
 * Each lane is in one of three modes (default `open` is never written):
 *   - `open`      — full height; cards render at their natural size.
 *   - `scroll`    — fixed height; the lane scrolls vertically when content overflows.
 *   - `collapsed` — single-line strip; cards hidden, only per-column counts show.
 *
 * Storage: `[swimlanes.<boardSlug>]` section in `tasks/localuser.ini`, with keys
 * matching the lane index (`0`, `1`, …) and values `scroll` or `collapsed`.
 */

/** @typedef {"open" | "scroll" | "collapsed"} SwimlaneCollapseMode */

export const SWIMLANE_COLLAPSE_MODES = /** @type {const} */ ([
  "open",
  "scroll",
  "collapsed",
]);

export const SWIMLANE_COLLAPSE_DEFAULT_MODE = "open";

/** Max body height for `scroll` mode (in CSS viewport-height units). */
export const SWIMLANE_SCROLL_MAX_VH = 50;

/**
 * @param {unknown} raw
 * @returns {SwimlaneCollapseMode}
 */
export function normalizeSwimlaneCollapseMode(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "scroll") return "scroll";
  if (s === "collapsed" || s === "closed") return "collapsed";
  return "open";
}

/**
 * Cycle order when the user clicks the swimlane toggle button.
 * @param {SwimlaneCollapseMode} current
 * @returns {SwimlaneCollapseMode}
 */
export function nextSwimlaneCollapseMode(current) {
  if (current === "open") return "scroll";
  if (current === "scroll") return "collapsed";
  return "open";
}

/**
 * Label shown in the toggle tooltip — describes the mode the next click switches to.
 * @param {SwimlaneCollapseMode} current
 */
export function swimlaneCollapseNextActionLabel(current) {
  const next = nextSwimlaneCollapseMode(current);
  if (next === "open") return "Expand swimlane";
  if (next === "scroll") return "Limit swimlane height (scrollable)";
  return "Collapse swimlane to a single row";
}

/**
 * Section name for one board in `tasks/localuser.ini`.
 * @param {string} boardSlug
 */
export function swimlaneSectionNameForBoard(boardSlug) {
  const slug = String(boardSlug ?? "").trim();
  return slug ? `swimlanes.${slug}` : "swimlanes";
}

/**
 * Parse all `[swimlanes.<slug>]` sections into a nested record.
 *
 * Keys may be bare (`0 = scroll`) or prefixed (`lane_0 = scroll`).
 * Open lanes are not represented (default).
 *
 * @param {Record<string, Record<string, string>> | null | undefined} sections
 * @returns {Record<string, Record<number, SwimlaneCollapseMode>>}
 */
export function readSwimlaneCollapseStates(sections) {
  /** @type {Record<string, Record<number, SwimlaneCollapseMode>>} */
  const out = {};
  if (!sections || typeof sections !== "object") return out;

  for (const name of Object.keys(sections)) {
    const match = name.match(/^swimlanes\.(.+)$/);
    if (!match) continue;
    const slug = String(match[1]).trim();
    if (!slug) continue;
    const sec = sections[name];
    if (!sec || typeof sec !== "object") continue;

    /** @type {Record<number, SwimlaneCollapseMode>} */
    const laneMap = {};
    for (const key of Object.keys(sec)) {
      const idxMatch = String(key).trim().match(/^(?:lane_)?(-?\d+)$/);
      if (!idxMatch) continue;
      const idx = Number(idxMatch[1]);
      if (!Number.isInteger(idx)) continue;
      const mode = normalizeSwimlaneCollapseMode(sec[key]);
      if (mode === "open") continue;
      laneMap[idx] = mode;
    }
    if (Object.keys(laneMap).length > 0) out[slug] = laneMap;
  }
  return out;
}

/**
 * Apply a single lane mode change to the parsed sections record (mutates and returns it).
 * Setting `open` clears the entry (and removes the section when empty).
 *
 * @param {Record<string, Record<string, string>>} sections
 * @param {{ boardSlug: string, laneIndex: number, mode: SwimlaneCollapseMode }} update
 */
export function applySwimlaneCollapseUpdate(sections, update) {
  const slug = String(update.boardSlug ?? "").trim();
  if (!slug) return sections;
  const idx = Number(update.laneIndex);
  if (!Number.isInteger(idx)) return sections;
  const mode = normalizeSwimlaneCollapseMode(update.mode);
  const sectionName = swimlaneSectionNameForBoard(slug);

  const existing = sections[sectionName];
  if (mode === "open") {
    if (!existing) return sections;
    delete existing[String(idx)];
    delete existing[`lane_${idx}`];
    const remaining = Object.keys(existing).filter((k) => {
      const v = existing[k];
      return v != null && String(v).trim() !== "";
    });
    if (remaining.length === 0) delete sections[sectionName];
    return sections;
  }

  sections[sectionName] = existing ?? {};
  delete sections[sectionName][`lane_${idx}`];
  sections[sectionName][String(idx)] = mode;
  return sections;
}

/**
 * @param {Record<number, SwimlaneCollapseMode> | undefined} laneMap
 * @param {number} laneIndex
 * @returns {SwimlaneCollapseMode}
 */
export function swimlaneCollapseModeForLane(laneMap, laneIndex) {
  if (!laneMap) return "open";
  const m = laneMap[Number(laneIndex)];
  return m ? normalizeSwimlaneCollapseMode(m) : "open";
}
