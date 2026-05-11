/**
 * Per-board swimlane collapse state shared by the kanban view and `tasks/localuser.ini`.
 *
 * Each lane is in one of three modes (default `open` is never written):
 *   - `open`      — full height; cards render at their natural size.
 *   - `scroll`    — fixed height; the lane scrolls vertically when content overflows.
 *   - `collapsed` — single-line strip; cards hidden, only per-column counts show.
 *
 * Storage: `[swimlanes.<boardSlug>]` section in `tasks/localuser.ini`, keyed by
 * the swimlane **title** (e.g. `Bugs / UX = scroll`) so the file stays readable
 * across lane reorders. Legacy entries keyed by lane index are still recognised
 * (and cleaned up the next time the user toggles that lane).
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

/** Hard upper bound for a swimlane title in `tasks/localuser.ini`. */
export const SWIMLANE_TITLE_MAX_LENGTH = 200;

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
 * Whether a swimlane title is safe to use as an INI key in `tasks/localuser.ini`.
 * INI keys can't contain `=` (parser breaks), `[` / `]` (section delimiters),
 * or newlines. Empty or comment-prefixed titles are also rejected.
 * @param {string | undefined} title
 */
export function isSwimlaneTitleStorable(title) {
  const t = String(title ?? "").trim();
  if (!t) return false;
  if (t.length > SWIMLANE_TITLE_MAX_LENGTH) return false;
  if (/[=\r\n\[\]]/.test(t)) return false;
  if (t.startsWith(";")) return false;
  return true;
}

/**
 * Parse all `[swimlanes.<slug>]` sections into a nested record.
 *
 * Keys are preserved as written so callers can match by title (preferred) or
 * by a legacy numeric index. Open lanes are not represented (default).
 *
 * @param {Record<string, Record<string, string>> | null | undefined} sections
 * @returns {Record<string, Record<string, SwimlaneCollapseMode>>}
 */
export function readSwimlaneCollapseStates(sections) {
  /** @type {Record<string, Record<string, SwimlaneCollapseMode>>} */
  const out = {};
  if (!sections || typeof sections !== "object") return out;

  for (const name of Object.keys(sections)) {
    const match = name.match(/^swimlanes\.(.+)$/);
    if (!match) continue;
    const slug = String(match[1]).trim();
    if (!slug) continue;
    const sec = sections[name];
    if (!sec || typeof sec !== "object") continue;

    /** @type {Record<string, SwimlaneCollapseMode>} */
    const laneMap = {};
    for (const key of Object.keys(sec)) {
      const trimmedKey = String(key).trim();
      if (!trimmedKey) continue;
      const mode = normalizeSwimlaneCollapseMode(sec[key]);
      if (mode === "open") continue;
      laneMap[trimmedKey] = mode;
    }
    if (Object.keys(laneMap).length > 0) out[slug] = laneMap;
  }
  return out;
}

/**
 * Look up the stored mode for a lane.
 *
 * Match order: exact title, case-insensitive title, then a legacy numeric
 * index key (e.g. `1 = scroll` written by an older Millrace).
 *
 * @param {Record<string, SwimlaneCollapseMode> | undefined} laneMap
 * @param {{ title?: string, index?: number }} lane
 * @returns {SwimlaneCollapseMode}
 */
export function swimlaneCollapseModeForLane(laneMap, lane) {
  if (!laneMap) return "open";

  const title = String(lane?.title ?? "").trim();
  if (title) {
    if (laneMap[title]) return normalizeSwimlaneCollapseMode(laneMap[title]);
    const lower = title.toLowerCase();
    for (const key of Object.keys(laneMap)) {
      if (String(key).trim().toLowerCase() === lower) {
        return normalizeSwimlaneCollapseMode(laneMap[key]);
      }
    }
  }

  const idx = Number(lane?.index);
  if (Number.isInteger(idx)) {
    const k = String(idx);
    if (laneMap[k]) return normalizeSwimlaneCollapseMode(laneMap[k]);
    const legacy = laneMap[`lane_${idx}`];
    if (legacy) return normalizeSwimlaneCollapseMode(legacy);
  }
  return "open";
}

/**
 * Remove any keys that refer to this lane, whether by title (case-insensitive)
 * or by a legacy index form (`<n>` or `lane_<n>`).
 *
 * @param {Record<string, string>} section
 * @param {string} laneTitle
 * @param {number | undefined} laneIndex
 */
function removeLaneEntries(section, laneTitle, laneIndex) {
  if (!section || typeof section !== "object") return;
  const lower = String(laneTitle ?? "").trim().toLowerCase();
  for (const key of Object.keys(section)) {
    if (
      lower &&
      String(key).trim().toLowerCase() === lower
    ) {
      delete section[key];
    }
  }
  if (laneIndex != null && Number.isInteger(Number(laneIndex))) {
    delete section[String(laneIndex)];
    delete section[`lane_${laneIndex}`];
  }
}

/**
 * Apply a single lane mode change to the parsed sections record (mutates and returns it).
 * Setting `open` clears any title or legacy-index entry for the lane (and removes
 * the section when empty).
 *
 * @param {Record<string, Record<string, string>>} sections
 * @param {{ boardSlug: string, laneTitle: string, laneIndex?: number, mode: SwimlaneCollapseMode }} update
 */
export function applySwimlaneCollapseUpdate(sections, update) {
  const slug = String(update.boardSlug ?? "").trim();
  if (!slug) return sections;
  const title = String(update.laneTitle ?? "").trim();
  if (!title) return sections;
  if (!isSwimlaneTitleStorable(title)) return sections;
  const mode = normalizeSwimlaneCollapseMode(update.mode);
  const sectionName = swimlaneSectionNameForBoard(slug);

  const existing = sections[sectionName];
  if (mode === "open") {
    if (!existing) return sections;
    removeLaneEntries(existing, title, update.laneIndex);
    const remaining = Object.keys(existing).filter((k) => {
      const v = existing[k];
      return v != null && String(v).trim() !== "";
    });
    if (remaining.length === 0) delete sections[sectionName];
    return sections;
  }

  sections[sectionName] = existing ?? {};
  removeLaneEntries(sections[sectionName], title, update.laneIndex);
  sections[sectionName][title] = mode;
  return sections;
}
