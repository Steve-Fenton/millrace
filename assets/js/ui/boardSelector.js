import { AGGREGATE_BOARD_KIND } from "../models/aggregateBoard.js";

export const FLOW_ACTIVE_BOARD_SLUG_KEY = "flow:active-board-slug";

/** @typedef {{ slug: string, name: string, file?: string, kind?: string }} BoardCatalogEntry */

/**
 * @returns {string}
 */
export function readStoredActiveBoardSlug() {
  try {
    const s = localStorage.getItem(FLOW_ACTIVE_BOARD_SLUG_KEY);
    return s && s.trim() ? s.trim() : "";
  } catch {
    return "";
  }
}

/**
 * @param {string} slug
 */
export function writeStoredActiveBoardSlug(slug) {
  try {
    localStorage.setItem(FLOW_ACTIVE_BOARD_SLUG_KEY, slug);
  } catch {
    /* private mode / quota */
  }
}

function defaultBoards() {
  return /** @type {BoardCatalogEntry[]} */ ([
    { slug: "board", name: "Board", file: "board.ini" },
  ]);
}

/**
 * Board list from `GET /api/flow` (catalog in `tasks/.millrace.ini`, section `[millrace]`).
 * @returns {Promise<BoardCatalogEntry[]>}
 */
async function fetchBoardCatalog() {
  const res = await fetch("/api/flow", { cache: "no-store" });
  if (!res.ok) return defaultBoards();
  /** @type {Record<string, unknown>} */
  let data = {};
  try {
    data = await res.json();
  } catch {
    return defaultBoards();
  }
  const raw = data.boards;
  if (!Array.isArray(raw) || raw.length === 0) return defaultBoards();
  /** @type {BoardCatalogEntry[]} */
  const boards = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const slug =
      typeof row.slug === "string" && row.slug.trim()
        ? row.slug.trim()
        : "";
    const name =
      typeof row.name === "string" && row.name.trim()
        ? row.name.trim()
        : slug || "Board";
    const file =
      typeof row.file === "string" && row.file.trim()
        ? row.file.trim()
        : "";
    const kind =
      typeof row.kind === "string" && row.kind.trim()
        ? row.kind.trim()
        : undefined;
    if (!slug) continue;
    boards.push({ slug, name, file, kind });
  }
  return boards.length > 0 ? boards : defaultBoards();
}

/**
 * @param {BoardCatalogEntry[]} boards
 * @param {string} stored
 */
export function pickActiveSlug(boards, stored) {
  if (!boards.length) return "board";
  const clean = String(stored || "").trim();
  if (clean && boards.some((b) => b.slug === clean)) return clean;
  return boards[0].slug;
}

/**
 * @returns {Promise<{ boards: BoardCatalogEntry[], activeSlug: string }>}
 */
export async function resolveActiveBoardSelection() {
  const boards = await fetchBoardCatalog();
  const stored = readStoredActiveBoardSlug();
  const activeSlug = pickActiveSlug(boards, stored);
  if (activeSlug !== stored) writeStoredActiveBoardSlug(activeSlug);
  return { boards, activeSlug };
}

/**
 * @param {BoardCatalogEntry} a
 * @param {BoardCatalogEntry} b
 */
function compareBoardCatalogEntries(a, b) {
  const na = String(a.name ?? a.slug ?? "").trim();
  const nb = String(b.name ?? b.slug ?? "").trim();
  const byName = na.localeCompare(nb, undefined, { sensitivity: "base" });
  if (byName !== 0) return byName;
  return String(a.slug ?? "").localeCompare(String(b.slug ?? ""), undefined, {
    sensitivity: "base",
  });
}

/**
 * @param {BoardCatalogEntry} board
 * @param {string} query
 */
export function boardMatchesPickerFilter(board, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  const name = String(board.name ?? "").toLowerCase();
  const slug = String(board.slug ?? "").toLowerCase();
  return name.includes(q) || slug.includes(q);
}

/**
 * Aggregate boards first (A–Z), then normal boards (A–Z).
 * @param {BoardCatalogEntry[]} boards
 */
export function boardsForTitlePicker(boards) {
  /** @type {BoardCatalogEntry[]} */
  const aggregates = [];
  /** @type {BoardCatalogEntry[]} */
  const normal = [];
  for (const b of boards) {
    if (String(b.kind ?? "").trim().toLowerCase() === AGGREGATE_BOARD_KIND) {
      aggregates.push(b);
    } else {
      normal.push(b);
    }
  }
  aggregates.sort(compareBoardCatalogEntries);
  normal.sort(compareBoardCatalogEntries);
  return { aggregates, normal };
}

/**
 * Title-styled board switcher (single board → plain `h1`).
 * @param {{ boards: BoardCatalogEntry[], activeSlug: string }} opts
 * @param {(slug: string) => void} onSelect
 * @returns {HTMLElement}
 */
export function createBoardTitlePicker(opts, onSelect) {
  const { boards, activeSlug } = opts;
  const cur = boards.find((b) => b.slug === activeSlug) ?? boards[0];
  const name = cur?.name ?? "Board";

  if (boards.length <= 1) {
    const h1 = document.createElement("h1");
    h1.className = "board-title";
    h1.textContent = name;
    h1.title = name;
    return h1;
  }

  const wrap = document.createElement("div");
  wrap.className = "board-title-picker";

  const panelId = `flow-board-picker-${Math.random().toString(36).slice(2, 9)}`;
  const listId = `${panelId}-list`;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "board-title board-title-picker__trigger";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", listId);
  btn.setAttribute("aria-label", `Board: ${name}. Change board`);
  btn.title = "Change board";

  const labelSpan = document.createElement("span");
  labelSpan.className = "board-title-picker__label";
  labelSpan.textContent = name;

  const chev = document.createElement("span");
  chev.className = "board-title-picker__chevron";
  chev.setAttribute("aria-hidden", "true");
  chev.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  btn.append(labelSpan, chev);

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "board-title-picker__panel";
  panel.hidden = true;

  const filterWrap = document.createElement("div");
  filterWrap.className = "board-title-picker__filter";

  const filterInput = document.createElement("input");
  filterInput.type = "search";
  filterInput.className = "flow-input board-title-picker__filter-input";
  filterInput.placeholder = "Filter boards…";
  filterInput.setAttribute("aria-label", "Filter boards");
  filterInput.autocomplete = "off";
  filterInput.addEventListener("click", (e) => e.stopPropagation());
  filterInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      btn.focus();
    }
  });

  filterWrap.append(filterInput);

  const list = document.createElement("div");
  list.id = listId;
  list.className = "board-title-picker__list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Boards");

  const empty = document.createElement("p");
  empty.className = "board-title-picker__empty";
  empty.textContent = "No matching boards";
  empty.hidden = true;

  /** @type {(() => void) | null} */
  let closeOnDoc = null;

  function close() {
    panel.hidden = true;
    filterInput.value = "";
    applyFilter();
    btn.setAttribute("aria-expanded", "false");
    if (closeOnDoc) {
      document.removeEventListener("mousedown", closeOnDoc);
      closeOnDoc = null;
    }
  }

  function open() {
    panel.hidden = false;
    filterInput.value = "";
    applyFilter();
    btn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => filterInput.focus());
    if (!closeOnDoc) {
      closeOnDoc = (e) => {
        if (!wrap.contains(/** @type {Node} */ (e.target))) close();
      };
      document.addEventListener("mousedown", closeOnDoc);
    }
  }

  function toggle() {
    if (panel.hidden) open();
    else close();
  }

  const { aggregates, normal } = boardsForTitlePicker(boards);

  /** @type {{ el: HTMLButtonElement, board: BoardCatalogEntry, group: "aggregate" | "normal" }[]} */
  const optionEntries = [];

  /** @param {BoardCatalogEntry} b @param {"aggregate" | "normal"} group */
  function appendBoardOption(b, group) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "board-title-picker__option";
    opt.setAttribute("role", "option");
    opt.setAttribute("aria-selected", b.slug === activeSlug ? "true" : "false");
    if (b.slug === activeSlug) opt.classList.add("board-title-picker__option--current");
    opt.textContent = b.name;
    opt.addEventListener("click", () => {
      close();
      if (b.slug !== activeSlug) onSelect(b.slug);
    });
    list.append(opt);
    optionEntries.push({ el: opt, board: b, group });
  }

  for (const b of aggregates) appendBoardOption(b, "aggregate");

  const separator = document.createElement("div");
  separator.className = "board-title-picker__separator";
  separator.setAttribute("role", "separator");
  separator.setAttribute("aria-hidden", "true");
  list.append(separator);

  for (const b of normal) appendBoardOption(b, "normal");

  function applyFilter() {
    const q = filterInput.value.trim();
    let visibleAggregates = 0;
    let visibleNormal = 0;
    for (const entry of optionEntries) {
      const match = boardMatchesPickerFilter(entry.board, q);
      entry.el.hidden = !match;
      entry.el.classList.toggle("board-title-picker__option--filtered-out", !match);
      if (match) {
        if (entry.group === "aggregate") visibleAggregates++;
        else visibleNormal++;
      }
    }
    separator.hidden = visibleAggregates === 0 || visibleNormal === 0;
    empty.hidden = visibleAggregates + visibleNormal > 0;
    list.hidden = !empty.hidden;
  }

  filterInput.addEventListener("input", applyFilter);

  panel.append(filterWrap, list, empty);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden && document.activeElement !== filterInput) {
      e.preventDefault();
      close();
      btn.focus();
    }
  });

  applyFilter();

  wrap.append(btn, panel);
  return wrap;
}
