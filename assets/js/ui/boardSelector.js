export const FLOW_ACTIVE_BOARD_SLUG_KEY = "flow:active-board-slug";

/** @typedef {{ slug: string, name: string, file?: string }} BoardCatalogEntry */

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
    if (!slug) continue;
    boards.push({ slug, name, file });
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

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "board-title board-title-picker__trigger";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", panelId);
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
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "Boards");

  /** @type {(() => void) | null} */
  let closeOnDoc = null;

  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (closeOnDoc) {
      document.removeEventListener("mousedown", closeOnDoc);
      closeOnDoc = null;
    }
  }

  function open() {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
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

  for (const b of boards) {
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
    panel.append(opt);
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close();
      btn.focus();
    }
  });

  wrap.append(btn, panel);
  return wrap;
}
