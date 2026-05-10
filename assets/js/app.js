import { openAddCardDialog } from "./dialogs/addCard.js";
import { openCardEditorDialog } from "./dialogs/editCard.js";
import {
  boardOwnerEmailsForFilter,
  ownerDisplayLabel,
  parseBoardIni,
  userPreferenceSyncModeIsAutomatic,
} from "./models/boardModel.js";
import {
  fetchBoardIni,
  fetchColumnCards,
  fetchGitRepoAvailable,
  fetchLocalUserProfile,
  fetchNpmUpdateCheck,
  postNpmUpdateRunCycle,
  moveCard,
  reorderCards,
} from "./client.js";
import { runGitSyncWithConflictFlow } from "./git/gitSyncFlow.js";
import { showFlowAlert, showFlowConfirm, showFlowToast } from "./ui/showMessage.js";
import { ensureMineEmailConfigured } from "./ui/setupMineOwner.js";
import { createFlowNavMenu } from "./ui/menu.js";
import { createMillraceBrandMark } from "./ui/brandMark.js";
import { setFlowDocumentTitle } from "./ui/documentTitle.js";
import {
  normalizeOwnerFilter,
  ownerFilterToSelectValue,
  persistOwnerFilter as persistOwnerFilterStorage,
  readStoredOwnerFilter,
  filterCardsByOwner as filterCardsByOwnerWithFilter,
} from "./ui/filterByOwner.js";
import { resolveCardSwimlaneIndex } from "./ini/swimlaneResolve.js";
import { boardSlugFrom } from "./html/slug.js";
import {
  createBoardTitlePicker,
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "./ui/boardSelector.js";
import {
  filterCardsBySearch,
  normalizeSearchQuery,
} from "./ui/taskSearch.js";
import {
  FLOW_SEARCH_SUBMIT_ICON,
  wrapSearchInputWithClear,
} from "./ui/clearFilter.js";
import { fillCardLinkWithNewTabIcon } from "./ui/cardLinkOpenNewTab.js";
import { escapeHtml } from "./html/escape.js";
import { displayTaskTitle } from "./models/taskModel.js";

const ADD_ICON = `<svg class="column-add-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M7 3v8M3 7h8"/></svg>`;

const EDIT_CARD_ICON = `<svg class="flow-card-edit-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

/** Small chevrons for in-card move compass (up / right / down / left). */
const CARD_NUDGE_SVG = {
  up: `<svg class="column-card-nudge-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>`,
  right: `<svg class="column-card-nudge-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>`,
  down: `<svg class="column-card-nudge-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>`,
  left: `<svg class="column-card-nudge-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg>`,
};

/** Done columns (`is_done` in board.ini) show at most this many cards (newest `closed` first). */
const DONE_COLUMN_DISPLAY_MAX = 5;

/** Wait this long after the last task change before auto-sync (Preferences → automatic sync). */
const AUTO_SYNC_DEBOUNCE_MS = 5000;

/** @type {{ mode: 'all' | 'mine' | 'owner', owner: string }} */
let ownerFilter = { mode: "all", owner: "" };

/** Case-insensitive substring filter across title, description, owner, filename, links (board view). */
let boardCardSearch = "";

/**
 * @param {{ closed?: string }} card
 * @returns {number | null}
 */
function closedSortMs(card) {
  const t = card.closed && String(card.closed).trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Done columns only: when there are more than {@link DONE_COLUMN_DISPLAY_MAX} cards in a lane,
 * show the most recently closed. Other columns pass through in API order.
 * @param {object[]} laneCards — already filtered to one swimlane + owner filter
 * @param {{ isDone?: boolean }} col
 * @returns {{ display: object[], truncated: boolean }}
 */
function cardsForDoneColumnDisplay(laneCards, col) {
  if (!col.isDone || laneCards.length <= DONE_COLUMN_DISPLAY_MAX) {
    return { display: laneCards, truncated: false };
  }
  const sorted = [...laneCards].sort((a, b) => {
    const ma = closedSortMs(a);
    const mb = closedSortMs(b);
    if (ma != null && mb != null && mb !== ma) return mb - ma;
    if (ma != null && mb == null) return -1;
    if (ma == null && mb != null) return 1;
    const oa = Number(a.sort_order);
    const ob = Number(b.sort_order);
    const na = Number.isFinite(oa) ? oa : 0;
    const nb = Number.isFinite(ob) ? ob : 0;
    if (nb !== na) return nb - na;
    return String(a.filename ?? "").localeCompare(String(b.filename ?? ""));
  });
  return {
    display: sorted.slice(0, DONE_COLUMN_DISPLAY_MAX),
    truncated: true,
  };
}

function applyStoredOwnerFilter() {
  const s = readStoredOwnerFilter();
  if (s) {
    ownerFilter = { mode: s.mode, owner: s.owner };
  }
}

/** @type {{ boards: { slug: string, name: string }[], activeSlug: string }} */
const emptyFlowCtx = () => ({
  boards: [],
  activeSlug: "board",
});

/** @type {{ model: object | null, cardsByColumn: Map<number, object[]> | null, mineEmail: string, defaultCardOwner: string, flowCtx: ReturnType<typeof emptyFlowCtx> | null, pendingSync: boolean, syncMode: "automatic" | "manual" }} */
let boardCache = {
  model: null,
  cardsByColumn: null,
  mineEmail: "",
  defaultCardOwner: "",
  flowCtx: null,
  pendingSync: false,
  syncMode: "automatic",
};

/** Set on full board load; used when re-rendering after owner filter only. */
let gitRepoAvailable = false;

/**
 * After a compass arrow move + board refresh, reopen arrows on this card until the user dismisses.
 * @type {{ boardSlug: string, filename: string } | null}
 */
let compassPersistCard = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let autoSyncDebounceTimer = null;
let boardGitSyncInFlight = false;

function clearPendingAutoSyncDebounce() {
  if (autoSyncDebounceTimer != null) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
  }
}

/**
 * Pull/commit/push via the same flow as the Sync button (conflict UI when needed).
 */
async function performBoardGitSync() {
  if (!gitRepoAvailable) return;
  if (boardGitSyncInFlight) return;
  const syncBtn = document.querySelector(".board-sync-btn");
  if (syncBtn?.disabled) return;

  clearPendingAutoSyncDebounce();
  boardGitSyncInFlight = true;
  const prevText = syncBtn?.textContent ?? "Sync";
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing…";
    syncBtn.classList.remove("board-sync-btn--pulse");
  }
  try {
    await runGitSyncWithConflictFlow();
    boardCache.pendingSync = false;
    document.dispatchEvent(new CustomEvent("flow:refresh-board"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await showFlowAlert(msg, { title: "Sync failed" });
  } finally {
    boardGitSyncInFlight = false;
    if (syncBtn) {
      syncBtn.disabled = !gitRepoAvailable;
      syncBtn.textContent = prevText;
    }
    applyPendingSyncPulseToBoardShell();
  }
}

function applyPendingSyncPulseToBoardShell() {
  const btn = document.querySelector(".board-sync-btn");
  if (!btn) return;
  const show = Boolean(gitRepoAvailable && boardCache.pendingSync);
  btn.classList.toggle("board-sync-btn--pulse", show);
}

/**
 * @param {Map<number, object[]>} cardsByColumn
 * @returns {string[]}
 */
function collectDistinctOwners(cardsByColumn) {
  const set = new Set();
  for (const cards of cardsByColumn.values()) {
    for (const c of cards) {
      const o = c.owner && String(c.owner).trim();
      if (o) set.add(o);
    }
  }
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Filter dropdown keys: board `[users.N]` emails when configured, else distinct owners on cards.
 * @param {import("./models/boardModel.js").BoardModel} model
 * @param {Map<number, object[]>} cardsByColumn
 */
function ownerFilterKeys(model, cardsByColumn) {
  const fromBoard = boardOwnerEmailsForFilter(model.users ?? []);
  if (fromBoard.length > 0) return fromBoard;
  return collectDistinctOwners(cardsByColumn);
}

/**
 * Ordered filenames for cards in one column + swimlane (full column list from API).
 * @param {Map<number, object[]>} cardsByColumn
 * @param {number} colIdx
 * @param {number} laneIdx
 * @param {Array<{ index: number, title: string }>} swimlanes
 */
function filenamesInCell(cardsByColumn, colIdx, laneIdx, swimlanes) {
  const cards = cardsByColumn.get(colIdx) ?? [];
  /** @type {string[]} */
  const out = [];
  for (const c of cards) {
    if (resolveCardSwimlaneIndex(c.swimlane, swimlanes) !== laneIdx) continue;
    const fn = c.filename && String(c.filename).trim();
    if (fn) out.push(fn);
  }
  return out;
}

/**
 * Move or reorder a card from arrow controls (same semantics as drag: column move + lane reorder).
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @param {{ boardSlug: string, filename: string, columnIndex: number, swimlaneIndex: number }} cardCtx
 */
async function performCardNudge(direction, cardCtx) {
  const cache = boardCache.cardsByColumn;
  const model = boardCache.model;
  if (!cache || !model) return;

  const { boardSlug, filename, columnIndex, swimlaneIndex } = cardCtx;
  const fn = String(filename).trim();
  const colIdx = Number(columnIndex);
  const laneIdx = Number(swimlaneIndex);
  const swimlanesDef = model.swimlanes ?? [];

  const sortedCols = [...model.columns].sort((a, b) => a.index - b.index);
  const laneDefs =
    swimlanesDef.length > 0
      ? [...swimlanesDef].sort((a, b) => a.index - b.index)
      : [{ index: 0, title: "" }];

  if (direction === "left") {
    const ix = sortedCols.findIndex((c) => Number(c.index) === colIdx);
    if (ix <= 0) return;
    const toCol = Number(sortedCols[ix - 1].index);
    await moveCard({
      boardSlug,
      filename: fn,
      fromColumnIndex: colIdx,
      toColumnIndex: toCol,
      swimlaneIndex: laneIdx,
    });
    return;
  }

  if (direction === "right") {
    const ix = sortedCols.findIndex((c) => Number(c.index) === colIdx);
    if (ix < 0 || ix >= sortedCols.length - 1) return;
    const toCol = Number(sortedCols[ix + 1].index);
    await moveCard({
      boardSlug,
      filename: fn,
      fromColumnIndex: colIdx,
      toColumnIndex: toCol,
      swimlaneIndex: laneIdx,
    });
    return;
  }

  if (direction === "up") {
    const peers = filenamesInCell(cache, colIdx, laneIdx, swimlanesDef);
    const pos = peers.indexOf(fn);
    if (pos < 0) return;
    if (pos > 0) {
      const newOrder = [...peers];
      [newOrder[pos - 1], newOrder[pos]] = [newOrder[pos], newOrder[pos - 1]];
      await reorderCards({
        boardSlug,
        columnIndex: colIdx,
        swimlaneIndex: laneIdx,
        filenames: newOrder,
      });
      return;
    }
    const lix = laneDefs.findIndex((l) => Number(l.index) === laneIdx);
    if (lix <= 0) return;
    const prevLane = Number(laneDefs[lix - 1].index);
    await moveCard({
      boardSlug,
      filename: fn,
      fromColumnIndex: colIdx,
      toColumnIndex: colIdx,
      swimlaneIndex: prevLane,
    });
    const destPeers = filenamesInCell(cache, colIdx, prevLane, swimlanesDef).filter(
      (f) => f !== fn
    );
    await reorderCards({
      boardSlug,
      columnIndex: colIdx,
      swimlaneIndex: prevLane,
      filenames: [...destPeers, fn],
    });
    return;
  }

  if (direction === "down") {
    const peers = filenamesInCell(cache, colIdx, laneIdx, swimlanesDef);
    const pos = peers.indexOf(fn);
    if (pos < 0) return;
    if (pos < peers.length - 1) {
      const newOrder = [...peers];
      [newOrder[pos], newOrder[pos + 1]] = [newOrder[pos + 1], newOrder[pos]];
      await reorderCards({
        boardSlug,
        columnIndex: colIdx,
        swimlaneIndex: laneIdx,
        filenames: newOrder,
      });
      return;
    }
    const lix = laneDefs.findIndex((l) => Number(l.index) === laneIdx);
    if (lix < 0 || lix >= laneDefs.length - 1) return;
    const nextLane = Number(laneDefs[lix + 1].index);
    await moveCard({
      boardSlug,
      filename: fn,
      fromColumnIndex: colIdx,
      toColumnIndex: colIdx,
      swimlaneIndex: nextLane,
    });
    const destPeers = filenamesInCell(cache, colIdx, nextLane, swimlanesDef).filter(
      (f) => f !== fn
    );
    await reorderCards({
      boardSlug,
      columnIndex: colIdx,
      swimlaneIndex: nextLane,
      filenames: [fn, ...destPeers],
    });
  }
}

/**
 * Close move compasses on pointerdown outside the active card (see board shell listener).
 * @param {HTMLElement} boardShell
 */
function attachBoardCompassDismiss(boardShell) {
  boardShell.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest(".column-card-nudge")) return;
      const hit = e.target.closest(".column-card");
      let closed = false;
      boardShell.querySelectorAll(".column-card--compass-open").forEach((el) => {
        if (hit === el) return;
        el.classList.remove("column-card--compass-open");
        if (el instanceof HTMLElement) el.draggable = true;
        closed = true;
      });
      if (closed) compassPersistCard = null;
    },
    true
  );
}

/**
 * Filenames in this cell in API order that match owner + card search (subset of {@link filenamesInCell}).
 * @param {Map<number, object[]>} cardsByColumn
 * @param {number} colIdx
 * @param {number} laneIdx
 * @param {Array<{ index: number, title: string }>} swimlanes
 * @param {string} mineEmail
 * @param {{ mode: string, owner: string }} ownerFilter
 * @param {string} cardSearch
 * @param {import("./models/boardModel.js").BoardModel} model
 */
function filenamesInCellMatchingUiFilters(
  cardsByColumn,
  colIdx,
  laneIdx,
  swimlanes,
  mineEmail,
  ownerFilter,
  cardSearch,
  model
) {
  const peers = filenamesInCell(
    cardsByColumn,
    colIdx,
    laneIdx,
    swimlanes
  );
  const cards = cardsByColumn.get(colIdx) ?? [];
  /** @type {Map<string, object>} */
  const byFn = new Map();
  for (const c of cards) {
    if (resolveCardSwimlaneIndex(c.swimlane, swimlanes) !== laneIdx) continue;
    const fn = c.filename && String(c.filename).trim();
    if (fn) byFn.set(fn, c);
  }
  /** @type {string[]} */
  const out = [];
  for (const fn of peers) {
    const card = byFn.get(fn);
    if (!card) continue;
    if (
      filterCardsByOwnerWithFilter([card], mineEmail, ownerFilter).length ===
      0
    ) {
      continue;
    }
    if (
      filterCardsBySearch([card], cardSearch, model.users).length === 0
    ) {
      continue;
    }
    out.push(fn);
  }
  return out;
}

/**
 * After reordering only filter-visible cards, rebuild the full cell list for the API
 * (non-visible filenames stay at the same indices; visible slots get `newVisibleOrder`).
 * @param {string[]} fullPeers
 * @param {Set<string>} visibleSet
 * @param {string[]} newVisibleOrder
 */
function mergeOwnerFilteredReorder(fullPeers, visibleSet, newVisibleOrder) {
  let vi = 0;
  /** @type {string[]} */
  const merged = [];
  for (const f of fullPeers) {
    if (visibleSet.has(f)) {
      merged.push(newVisibleOrder[vi++]);
    } else {
      merged.push(f);
    }
  }
  return merged;
}

/**
 * @param {HTMLElement} container
 * @param {number} y
 * @returns {Element | null}
 */
function getDragAfterElement(container, y) {
  const draggable = [
    ...container.querySelectorAll(".column-card:not(.column-card--dragging)"),
  ];
  return draggable.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: /** @type {Element | null} */ (null) }
  ).element;
}

let flowDropMarkerEl = /** @type {HTMLLIElement | null} */ (null);

function getDropMarkerLi() {
  if (!flowDropMarkerEl) {
    flowDropMarkerEl = document.createElement("li");
    flowDropMarkerEl.className = "column-card-drop-marker";
    flowDropMarkerEl.setAttribute("aria-hidden", "true");
  }
  return flowDropMarkerEl;
}

function removeFlowDropMarker() {
  if (flowDropMarkerEl?.parentNode) {
    flowDropMarkerEl.remove();
  }
}

/**
 * Show where the card will insert in this list (caller ensures list belongs to hovered cell).
 * @param {HTMLUListElement} list
 * @param {number} clientY
 * @param {"precise" | "append-only"} mode
 */
function positionDropMarker(list, clientY, mode) {
  const marker = getDropMarkerLi();
  if (mode === "append-only") {
    list.append(marker);
    return;
  }
  const afterEl = getDragAfterElement(list, clientY);
  if (afterEl) {
    list.insertBefore(marker, afterEl);
  } else {
    list.append(marker);
  }
}

/**
 * Fixed clone of the Kanban grid header row; shown when the in-flow header scrolls above the viewport.
 * @param {HTMLElement} root
 * @param {HTMLElement} kanbanScroll
 * @param {HTMLElement} kanban
 * @param {HTMLElement} corner
 */
function attachKanbanHeaderDock(root, kanbanScroll, kanban, corner) {
  const headerDockRow = document.createElement("div");
  headerDockRow.className = `${kanban.className} kanban-header-dock-row`.trim();
  headerDockRow.style.gridTemplateColumns = kanban.style.gridTemplateColumns;
  headerDockRow.style.gridTemplateRows = "auto";
  headerDockRow.appendChild(corner.cloneNode(true));
  kanban.querySelectorAll(".column-head").forEach((h) => {
    headerDockRow.appendChild(h.cloneNode(true));
  });

  const headerDock = document.createElement("div");
  headerDock.className = "kanban-header-dock";
  headerDock.setAttribute("aria-hidden", "true");

  const clip = document.createElement("div");
  clip.className = "kanban-header-dock-clip";

  const inner = document.createElement("div");
  inner.className = "kanban-header-dock-inner";
  inner.append(headerDockRow);
  clip.append(inner);
  headerDock.append(clip);
  root.append(headerDock);

  function syncLayout() {
    if (!kanbanScroll.isConnected) return;
    const sr = kanbanScroll.getBoundingClientRect();
    clip.style.left = `${sr.left}px`;
    clip.style.width = `${sr.width}px`;
    inner.style.width = `${Math.max(kanban.scrollWidth, sr.width)}px`;
    inner.style.transform = `translate3d(${-kanbanScroll.scrollLeft}px, 0, 0)`;
  }

  let dockVisible = false;

  kanbanScroll.addEventListener(
    "scroll",
    () => {
      if (dockVisible) syncLayout();
    },
    { passive: true }
  );

  function onWindowMove() {
    if (dockVisible) syncLayout();
  }
  window.addEventListener("resize", onWindowMove);
  window.addEventListener("scroll", onWindowMove, { passive: true });

  const ro = new ResizeObserver(() => {
    if (dockVisible) syncLayout();
  });
  ro.observe(kanbanScroll);
  ro.observe(kanban);

  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      const rect = e.boundingClientRect;
      const show = !e.isIntersecting && rect.top < 0;
      if (show === dockVisible) return;
      dockVisible = show;
      headerDock.classList.toggle("kanban-header-dock--visible", show);
      if (show) requestAnimationFrame(syncLayout);
    },
    { threshold: [0, 1] }
  );
  io.observe(corner);
}

/**
 * @param {Map<number, Array<{ filename?: string, title?: string, owner?: string, swimlane?: string, links?: { text?: string, url?: string }[] }>>} cardsByColumn
 * @param {{ boards: { slug: string, name: string }[], activeSlug: string }} flowCtx
 */
function renderBoard(
  model,
  cardsByColumn,
  mineEmail,
  gitSyncOk,
  flowCtx,
  pendingSync
) {
  const { board, columns, swimlanes } = model;
  const name = board.name?.trim() || "Board";
  setFlowDocumentTitle("Board", name);
  const boardSlug = boardSlugFrom(board);

  let compassPersistMatched = false;

  const lanes =
    swimlanes.length > 0
      ? swimlanes
      : [{ index: 0, title: "" }];

  const sortedColsForNudge = [...columns].sort((a, b) => a.index - b.index);
  const sortedLanesForNudge = [...lanes].sort((a, b) => a.index - b.index);

  const ownerNames = ownerFilterKeys(model, cardsByColumn);
  ownerFilter = normalizeOwnerFilter(ownerNames, mineEmail, ownerFilter);

  const root = document.createElement("div");
  root.className = "board-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";

  const brand = createMillraceBrandMark();

  const titleOrPicker = createBoardTitlePicker(
    { boards: flowCtx.boards, activeSlug: flowCtx.activeSlug },
    (slug) => {
      writeStoredActiveBoardSlug(slug);
      document.dispatchEvent(new CustomEvent("flow:active-board-changed"));
    }
  );
  if (titleOrPicker instanceof HTMLHeadingElement) {
    titleOrPicker.textContent = name;
    titleOrPicker.title = name;
  }

  const filterWrap = document.createElement("div");
  filterWrap.className = "board-owner-filter";

  const filterLabel = document.createElement("label");
  filterLabel.className = "board-owner-filter-label";
  filterLabel.htmlFor = "flow-owner-filter";
  filterLabel.textContent = "Cards";

  const ownerSelect = document.createElement("select");
  ownerSelect.id = "flow-owner-filter";
  ownerSelect.className = "board-owner-filter-select";
  ownerSelect.setAttribute("aria-label", "Filter cards by owner");

  function opt(value, text, disabled = false, title) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    o.disabled = disabled;
    if (title) o.title = title;
    ownerSelect.append(o);
  }

  opt("all", "All");
  opt("mine", "Mine");
  ownerSelect.querySelector('option[value="mine"]')?.setAttribute(
    "title",
    "Uses [user] mine in tasks/localuser.ini (you will be asked to set it if missing)"
  );
  if (ownerNames.length > 0) {
    opt("", "—", true);
    for (const n of ownerNames) {
      const label = ownerDisplayLabel(n, model.users);
      const tip = label !== n ? n : "";
      opt(`owner:${encodeURIComponent(n)}`, label, false, tip || undefined);
    }
  }

  const wantSel = ownerFilterToSelectValue(ownerFilter);
  ownerSelect.value = wantSel;
  if (ownerSelect.value !== wantSel) {
    ownerSelect.value = "all";
    ownerFilter = { mode: "all", owner: "" };
  }

  persistOwnerFilterStorage(ownerFilter);

  ownerSelect.addEventListener("change", () => {
    const v = ownerSelect.value;
    const prevFilter = { ...ownerFilter };
    if (v === "all") {
      ownerFilter = { mode: "all", owner: "" };
      persistOwnerFilterStorage(ownerFilter);
      void loadApp(false);
      return;
    }
    if (v === "mine") {
      void (async () => {
        let mine = String(boardCache.mineEmail ?? "").trim();
        if (!mine) {
          const hint = String(boardCache.defaultCardOwner ?? "").trim();
          try {
            const entered = await ensureMineEmailConfigured(hint);
            if (entered == null) {
              ownerSelect.value = ownerFilterToSelectValue(prevFilter);
              return;
            }
            mine = entered;
            boardCache.mineEmail = mine;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await showFlowAlert(msg, { title: "Could not save Mine email" });
            ownerSelect.value = ownerFilterToSelectValue(prevFilter);
            return;
          }
        }
        ownerFilter = { mode: "mine", owner: "" };
        persistOwnerFilterStorage(ownerFilter);
        void loadApp(false);
      })();
      return;
    }
    if (v.startsWith("owner:")) {
      ownerFilter = {
        mode: "owner",
        owner: decodeURIComponent(v.slice(6)),
      };
    }
    persistOwnerFilterStorage(ownerFilter);
    void loadApp(false);
  });

  filterWrap.append(filterLabel, ownerSelect);

  const searchWrap = document.createElement("div");
  searchWrap.className = "board-card-search";
  const searchLabel = document.createElement("label");
  searchLabel.className = "board-owner-filter-label";
  searchLabel.htmlFor = "flow-board-card-search";
  searchLabel.textContent = "Search";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "flow-board-card-search";
  searchInput.className = "flow-input board-card-search-input";
  searchInput.placeholder = "Filter cards…";
  searchInput.setAttribute("aria-label", "Search cards on the board");
  searchInput.autocomplete = "off";
  searchInput.value = boardCardSearch;
  function runBoardSearch() {
    boardCardSearch = searchInput.value;
    void loadApp(false);
  }
  const searchFieldWrap = wrapSearchInputWithClear(searchInput, () => {
    boardCardSearch = "";
    void loadApp(false);
  });
  const searchBtn = document.createElement("button");
  searchBtn.type = "button";
  searchBtn.className =
    "flow-btn flow-btn-primary flow-btn-icon board-card-search-btn board-card-search-btn--icon";
  searchBtn.setAttribute("aria-label", "Search");
  searchBtn.title = "Search";
  searchBtn.innerHTML = FLOW_SEARCH_SUBMIT_ICON;
  searchBtn.addEventListener("click", () => runBoardSearch());
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runBoardSearch();
    }
  });
  searchWrap.append(searchLabel, searchFieldWrap, searchBtn);

  topLeft.append(brand, titleOrPicker);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";

  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "Kanban";

  const navMenu = createFlowNavMenu({ current: "board" });

  const syncBtn = document.createElement("button");
  syncBtn.type = "button";
  syncBtn.className = "board-sync-btn board-sync-btn--git";
  syncBtn.textContent = "Sync";
  const syncTitleBase =
    "Pull from origin, resolve merge conflicts if needed, commit pending task changes, then push (runs on the machine hosting Millrace)";
  syncBtn.title = syncTitleBase;
  syncBtn.disabled = !gitSyncOk;
  if (!gitSyncOk) {
    syncBtn.title =
      "Git sync unavailable — server data root has no .git (run Millrace from your repo clone).";
  }
  if (gitSyncOk && pendingSync) {
    syncBtn.classList.add("board-sync-btn--pulse");
    syncBtn.title = `${syncTitleBase} Unsaved task changes are not on the remote yet — sync when ready.`;
  }

  syncBtn.addEventListener("click", () => {
    if (syncBtn.disabled) return;
    void performBoardGitSync();
  });

  topActions.append(filterWrap, searchWrap, syncBtn, badge, navMenu);
  top.append(topLeft, topActions);

  const kanban = document.createElement("div");
  kanban.className = "kanban";
  if (lanes.length === 1 && !lanes[0].title) {
    kanban.classList.add("kanban--single-lane");
  }
  const colCount = columns.length;
  kanban.style.gridTemplateColumns = `minmax(100px, 140px) repeat(${colCount}, minmax(140px, 1fr))`;
  kanban.style.gridTemplateRows = `auto repeat(${lanes.length}, minmax(7rem, auto))`;
  kanban.setAttribute("role", "grid");
  kanban.setAttribute("aria-label", `${name}, kanban`);

  const corner = document.createElement("div");
  corner.className = "kanban-corner";
  corner.setAttribute("aria-hidden", "true");

  const headerRow = document.createElement("div");
  headerRow.className = "kanban-row";
  headerRow.setAttribute("role", "row");
  headerRow.append(corner);

  function clearDragFeedback() {
    removeFlowDropMarker();
    kanban.querySelectorAll(".column-cell--drop-target").forEach((el) =>
      el.classList.remove("column-cell--drop-target")
    );
  }

  for (const col of columns) {
    const colIdx = Number(col.index);
    const totalInColumn = (cardsByColumn.get(colIdx) ?? []).length;
    const limit =
      typeof col.wipLimit === "number" && Number.isFinite(col.wipLimit)
        ? col.wipLimit
        : null;
    const wipExceeded = limit != null && totalInColumn > limit;

    const head = document.createElement("div");
    head.className = "column-head";
    if (wipExceeded) {
      head.classList.add("column-head--wip-over");
      head.setAttribute(
        "title",
        `WIP limit exceeded (${totalInColumn} cards, limit ${limit})`
      );
    }
    head.textContent =
      limit != null
        ? `${col.title} (${totalInColumn}/${limit})`
        : col.title;
    head.setAttribute("role", "columnheader");
    headerRow.append(head);
  }
  kanban.append(headerRow);

  for (const lane of lanes) {
    const laneRow = document.createElement("div");
    laneRow.className = "kanban-row";
    laneRow.setAttribute("role", "row");

    const label = document.createElement("div");
    label.className = "swimlane-label";
    label.setAttribute("role", "rowheader");
    if (lane.title) {
      label.innerHTML = `<span>${escapeHtml(lane.title)}</span>`;
    }
    label.setAttribute(
      "aria-label",
      lane.title ? `Swimlane ${lane.title}` : "Swimlane"
    );
    laneRow.append(label);

    for (const col of columns) {
      const colIdx = Number(col.index);
      const totalInColumn = (cardsByColumn.get(colIdx) ?? []).length;
      const limit =
        typeof col.wipLimit === "number" && Number.isFinite(col.wipLimit)
          ? col.wipLimit
          : null;
      const wipExceeded = limit != null && totalInColumn > limit;

      const cell = document.createElement("div");
      cell.className = "column-cell";
      if (wipExceeded) cell.classList.add("column-cell--wip-over");
      cell.setAttribute("role", "gridcell");

      const body = document.createElement("div");
      body.className = "column-cell-body";

      const list = document.createElement("ul");
      list.className = "column-card-list";

      const laneIdx = Number(lane.index);
      const columnCards = cardsByColumn.get(colIdx) ?? [];
      let cards = columnCards.filter(
        (c) =>
          resolveCardSwimlaneIndex(c.swimlane, swimlanes) === laneIdx
      );
      cards = filterCardsByOwnerWithFilter(cards, mineEmail, ownerFilter);
      cards = filterCardsBySearch(cards, boardCardSearch, model.users);
      const { display: displayCards, truncated: doneLaneTruncated } =
        cardsForDoneColumnDisplay(cards, col);

      for (const card of displayCards) {
        const li = document.createElement("li");
        li.className = "column-card";
        if (card.strategic) li.classList.add("column-card--strategic");
        const titleText = displayTaskTitle(card);
        const titleEl = document.createElement("div");
        titleEl.className = "column-card-title";
        titleEl.textContent = titleText;

        const fn = card.filename && String(card.filename).trim();
        if (fn) {
          const head = document.createElement("div");
          head.className = "column-card-head";
          head.append(titleEl);
          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "flow-card-edit-btn";
          editBtn.setAttribute("aria-label", "Edit card");
          editBtn.title = "Edit card";
          editBtn.innerHTML = EDIT_CARD_ICON;
          editBtn.draggable = false;
          editBtn.addEventListener("mousedown", (e) => e.stopPropagation());
          editBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void openCardEditorDialog({
              boardSlug,
              columnIndex: col.index,
              filename: fn,
              columnTitle: col.title,
              swimlaneIndex: Number(lane.index),
              swimlaneTitle: lane.title || undefined,
              boardUsers: model.users,
            });
          });
          head.append(editBtn);
          li.append(head);
        } else {
          li.append(titleEl);
        }
        if (card.owner && String(card.owner).trim()) {
          const own = document.createElement("div");
          own.className = "column-card-owner";
          own.textContent = ownerDisplayLabel(
            String(card.owner).trim(),
            model.users
          );
          li.append(own);
        }

        if (Array.isArray(card.links) && card.links.length > 0) {
          const linkWrap = document.createElement("div");
          linkWrap.className = "column-card-links";
          for (const link of card.links) {
            const href = String(link.url ?? "").trim();
            if (!href) continue;
            const label =
              String(link.text ?? "").trim() || href;
            const a = document.createElement("a");
            a.className = "column-card-link";
            a.href = href;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            fillCardLinkWithNewTabIcon(a, label);
            a.draggable = false;
            a.addEventListener("click", (e) => e.stopPropagation());
            linkWrap.append(a);
          }
          if (linkWrap.childElementCount > 0) {
            li.append(linkWrap);
          }
        }

        if (fn) {
          const peersFull = filenamesInCell(
            cardsByColumn,
            colIdx,
            laneIdx,
            swimlanes
          );
          const posInLane = peersFull.indexOf(fn);
          const colPos = sortedColsForNudge.findIndex(
            (c) => Number(c.index) === colIdx
          );
          const lanePos = sortedLanesForNudge.findIndex(
            (l) => Number(l.index) === laneIdx
          );
          const canLeft = colPos > 0;
          const canRight =
            colPos >= 0 && colPos < sortedColsForNudge.length - 1;
          const canUp = posInLane > 0 || lanePos > 0;
          const canDown =
            (posInLane >= 0 && posInLane < peersFull.length - 1) ||
            (lanePos >= 0 && lanePos < sortedLanesForNudge.length - 1);

          const compass = document.createElement("div");
          compass.className = "column-card-compass";

          /**
           * @param {'up' | 'down' | 'left' | 'right'} dir
           */
          function mkNudge(dir, label, enabled) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `column-card-nudge column-card-nudge--${dir}`;
            b.setAttribute("aria-label", label);
            b.disabled = !enabled;
            b.innerHTML = CARD_NUDGE_SVG[dir] ?? "";
            b.addEventListener("pointerdown", (e) => e.stopPropagation());
            b.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!enabled) return;
              void (async () => {
                try {
                  await performCardNudge(dir, {
                    boardSlug,
                    filename: fn,
                    columnIndex: colIdx,
                    swimlaneIndex: laneIdx,
                  });
                  compassPersistCard = { boardSlug, filename: fn };
                  document.dispatchEvent(new CustomEvent("flow:refresh-board"));
                } catch (err) {
                  const msg =
                    err instanceof Error ? err.message : String(err);
                  await showFlowAlert(msg, { title: "Could not move card" });
                }
              })();
            });
            return b;
          }

          compass.append(
            mkNudge(
              "up",
              "Move up in column or to previous swimlane",
              canUp
            ),
            mkNudge("left", "Move to previous column", canLeft),
            mkNudge("right", "Move to next column", canRight),
            mkNudge(
              "down",
              "Move down in column or to next swimlane",
              canDown
            )
          );

          li.append(compass);

          li.addEventListener("click", (e) => {
            if (e.target.closest("a.column-card-link")) return;
            if (e.target.closest(".flow-card-edit-btn")) return;
            if (e.target.closest(".column-card-nudge")) return;
            e.stopPropagation();
            root.querySelectorAll(".column-card--compass-open").forEach((el) => {
              if (el !== li) {
                el.classList.remove("column-card--compass-open");
                el.draggable = true;
              }
            });
            li.classList.toggle("column-card--compass-open");
            const compassOpen = li.classList.contains("column-card--compass-open");
            li.draggable = !compassOpen;
            compassPersistCard = compassOpen
              ? { boardSlug, filename: fn }
              : null;
          });

          li.draggable = true;
          li.dataset.filename = fn;
          if (
            compassPersistCard &&
            compassPersistCard.boardSlug === boardSlug &&
            compassPersistCard.filename === fn
          ) {
            li.classList.add("column-card--compass-open");
            li.draggable = false;
            compassPersistMatched = true;
          }
          li.title =
            ownerFilter.mode === "all"
              ? "Click for move arrows, or drag to reorder / move columns"
              : "Click for move arrows, or drag among visible cards";
          li.addEventListener("dragstart", (e) => {
            if (li.classList.contains("column-card--compass-open")) {
              e.preventDefault();
              return;
            }
            const payload = JSON.stringify({
              boardSlug,
              filename: fn,
              fromColumnIndex: Number(col.index),
              fromSwimlaneIndex: Number(lane.index),
            });
            e.dataTransfer.setData("application/json", payload);
            e.dataTransfer.setData("text/plain", payload);
            e.dataTransfer.effectAllowed = "move";
            li.classList.add("column-card--dragging");
          });
          li.addEventListener("dragend", () => {
            li.classList.remove("column-card--dragging");
            clearDragFeedback();
          });
        }

        list.append(li);
      }

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "column-add";
      addBtn.setAttribute(
        "aria-label",
        `Add card to ${col.title}`
      );
      addBtn.title = "Add card";
      addBtn.innerHTML = ADD_ICON;

      addBtn.addEventListener("click", () => {
        openAddCardDialog({
          boardSlug,
          columnIndex: col.index,
          columnTitle: col.title,
          swimlaneIndex: lane.index,
          swimlaneTitle: lane.title || undefined,
          boardUsers: model.users,
        });
      });

      body.append(list);
      if (doneLaneTruncated) {
        const note = document.createElement("p");
        note.className = "column-done-truncation-note";
        note.append(
          document.createTextNode(
            `Showing ${DONE_COLUMN_DISPLAY_MAX} most recent · `
          )
        );
        const completedLink = document.createElement("a");
        completedLink.className = "column-done-truncation-link";
        completedLink.href = "complete/";
        completedLink.textContent = "view completed";
        note.append(completedLink);
        body.append(note);
      }
      body.append(addBtn);
      cell.append(body);

      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        kanban.querySelectorAll(".column-cell--drop-target").forEach((c) => {
          if (c !== cell) c.classList.remove("column-cell--drop-target");
        });
        cell.classList.add("column-cell--drop-target");
        const listEl = cell.querySelector(".column-card-list");
        if (
          listEl instanceof HTMLUListElement &&
          kanban.querySelector(".column-card--dragging")
        ) {
          positionDropMarker(listEl, e.clientY, "precise");
        }
      });

      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        clearDragFeedback();
        /** @type {{ boardSlug?: string, filename?: string, fromColumnIndex?: number, fromSwimlaneIndex?: number }} */
        let data = {};
        try {
          const raw =
            e.dataTransfer.getData("application/json") ||
            e.dataTransfer.getData("text/plain");
          data = JSON.parse(raw || "{}");
        } catch {
          return;
        }
        if (
          data.boardSlug !== boardSlug ||
          typeof data.filename !== "string" ||
          data.fromColumnIndex == null
        ) {
          return;
        }
        const toCol = Number(col.index);
        const toLane = Number(lane.index);
        const fromCol = Number(data.fromColumnIndex);
        const fromLane = Number(data.fromSwimlaneIndex);
        const sameCell = fromCol === toCol && fromLane === toLane;

        if (sameCell) {
          if (doneLaneTruncated) return;
          if (normalizeSearchQuery(boardCardSearch)) return;
          const listEl = cell.querySelector(".column-card-list");
          if (!listEl || !boardCache.cardsByColumn || !boardCache.model) return;
          const afterEl = getDragAfterElement(listEl, e.clientY);
          const displayed = [
            ...listEl.querySelectorAll(".column-card:not(.column-card--dragging)"),
          ];
          const insertBeforeIdx = afterEl
            ? displayed.indexOf(afterEl)
            : displayed.length;
          const peers = filenamesInCell(
            boardCache.cardsByColumn,
            toCol,
            toLane,
            swimlanes
          );
          /** @type {string[]} */
          let newOrder;
          const needsMerge =
            ownerFilter.mode !== "all" ||
            Boolean(normalizeSearchQuery(boardCardSearch));
          if (!needsMerge) {
            const rest = peers.filter((f) => f !== data.filename);
            newOrder = [
              ...rest.slice(0, insertBeforeIdx),
              data.filename,
              ...rest.slice(insertBeforeIdx),
            ];
          } else {
            const visiblePeers = filenamesInCellMatchingUiFilters(
              boardCache.cardsByColumn,
              toCol,
              toLane,
              swimlanes,
              mineEmail,
              ownerFilter,
              boardCardSearch,
              boardCache.model
            );
            const visibleSet = new Set(visiblePeers);
            if (!visibleSet.has(data.filename)) return;
            const rest = visiblePeers.filter((f) => f !== data.filename);
            const newVisible = [
              ...rest.slice(0, insertBeforeIdx),
              data.filename,
              ...rest.slice(insertBeforeIdx),
            ];
            newOrder = mergeOwnerFilteredReorder(peers, visibleSet, newVisible);
          }
          void (async () => {
            try {
              await reorderCards({
                boardSlug,
                columnIndex: toCol,
                swimlaneIndex: toLane,
                filenames: newOrder,
              });
              document.dispatchEvent(new CustomEvent("flow:refresh-board"));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await showFlowAlert(msg, { title: "Could not reorder" });
            }
          })();
          return;
        }

        void (async () => {
          try {
            await moveCard({
              boardSlug,
              filename: data.filename,
              fromColumnIndex: fromCol,
              toColumnIndex: toCol,
              swimlaneIndex: toLane,
            });
            if (
              ownerFilter.mode === "all" &&
              !normalizeSearchQuery(boardCardSearch) &&
              boardCache.cardsByColumn &&
              (!col.isDone || !doneLaneTruncated)
            ) {
              const listEl = cell.querySelector(".column-card-list");
              if (listEl) {
                const afterEl = getDragAfterElement(listEl, e.clientY);
                const displayed = [
                  ...listEl.querySelectorAll(
                    ".column-card:not(.column-card--dragging)"
                  ),
                ];
                const insertBeforeIdx = afterEl
                  ? displayed.indexOf(afterEl)
                  : displayed.length;
                const destPeers = filenamesInCell(
                  boardCache.cardsByColumn,
                  toCol,
                  toLane,
                  swimlanes
                ).filter((f) => f !== data.filename);
                const newOrder = [
                  ...destPeers.slice(0, insertBeforeIdx),
                  data.filename,
                  ...destPeers.slice(insertBeforeIdx),
                ];
                await reorderCards({
                  boardSlug,
                  columnIndex: toCol,
                  swimlaneIndex: toLane,
                  filenames: newOrder,
                });
              }
            }
            document.dispatchEvent(new CustomEvent("flow:refresh-board"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await showFlowAlert(msg, { title: "Could not move card" });
          }
        })();
      });

      laneRow.append(cell);
    }
    kanban.append(laneRow);
  }

  const kanbanScroll = document.createElement("div");
  kanbanScroll.className = "board-kanban-scroll";
  kanbanScroll.append(kanban);
  root.append(top, kanbanScroll);
  if (
    compassPersistCard &&
    compassPersistCard.boardSlug === boardSlug &&
    !compassPersistMatched
  ) {
    compassPersistCard = null;
  }
  attachBoardCompassDismiss(root);
  attachKanbanHeaderDock(root, kanbanScroll, kanban, corner);
  return root;
}

/**
 * Remember window and horizontal kanban scroll so replacing the board DOM does not jump the viewport.
 * @param {HTMLElement} mount
 * @returns {{ winX: number, winY: number, kanbanLeft: number }}
 */
function captureBoardViewScroll(mount) {
  const kanban = mount.querySelector(".board-kanban-scroll");
  return {
    winX: window.scrollX,
    winY: window.scrollY,
    kanbanLeft: kanban ? kanban.scrollLeft : 0,
  };
}

/**
 * @param {{ winX: number, winY: number, kanbanLeft: number }} saved
 * @param {HTMLElement} mount
 */
function restoreBoardViewScroll(saved, mount) {
  window.scrollTo(saved.winX, saved.winY);
  const kanban = mount.querySelector(".board-kanban-scroll");
  if (kanban) kanban.scrollLeft = saved.kanbanLeft;
}

/**
 * Restore after layout so scroll positions apply to the new board shell.
 * @param {{ winX: number, winY: number, kanbanLeft: number }} saved
 * @param {HTMLElement} mount
 */
function scheduleRestoreBoardViewScroll(saved, mount) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      restoreBoardViewScroll(saved, mount);
    });
  });
}

/**
 * @param {boolean} fullReload Fetch board and cards; false = re-render from cache (owner filter).
 */
async function loadApp(fullReload = true) {
  const mount = document.getElementById("app");
  if (!mount) return;

  if (!fullReload) {
    if (!boardCache.model || !boardCache.cardsByColumn) return;
    const ownerNames = ownerFilterKeys(
      boardCache.model,
      boardCache.cardsByColumn
    );
    ownerFilter = normalizeOwnerFilter(
      ownerNames,
      boardCache.mineEmail,
      ownerFilter
    );
    const scrollSnapshot = captureBoardViewScroll(mount);
    const shell = mount.querySelector(".board-shell");
    const next = renderBoard(
      boardCache.model,
      boardCache.cardsByColumn,
      boardCache.mineEmail,
      gitRepoAvailable,
      boardCache.flowCtx ?? emptyFlowCtx(),
      boardCache.pendingSync
    );
    if (shell) shell.replaceWith(next);
    scheduleRestoreBoardViewScroll(scrollSnapshot, mount);
    return;
  }

  const scrollSnapshot = captureBoardViewScroll(mount);
  setFlowDocumentTitle("Board");
  mount.innerHTML = `<div class="app-loading">Loading board…</div>`;

  try {
    const { boards, activeSlug } = await resolveActiveBoardSelection();
    const flowCtx = { boards, activeSlug };
    const text = await fetchBoardIni(activeSlug);
    const model = parseBoardIni(text);

    if (model.columns.length === 0) {
      mount.innerHTML = `<div class="app-error">No columns found in board.ini.</div>`;
      scheduleRestoreBoardViewScroll(scrollSnapshot, mount);
      return;
    }

    const boardSlug = boardSlugFrom(model.board);
    /** @type {Map<number, object[]>} */
    const cardsByColumn = new Map();

    const [profile] = await Promise.all([
      fetchLocalUserProfile(),
      fetchGitRepoAvailable().then((ok) => {
        gitRepoAvailable = ok;
      }),
      Promise.all(
        model.columns.map(async (col) => {
          const idx = Number(col.index);
          const cards = await fetchColumnCards(boardSlug, idx);
          cardsByColumn.set(idx, cards);
        })
      ),
    ]);

    const mineEmail = String(profile.mine ?? "").trim();
    const defaultCardOwner = String(profile.owner ?? "").trim();
    const pendingSync = Boolean(profile.pendingSync);
    const syncMode = profile.syncMode === "manual" ? "manual" : "automatic";

    boardCache = {
      model,
      cardsByColumn,
      mineEmail,
      defaultCardOwner,
      flowCtx,
      pendingSync,
      syncMode,
    };

    applyStoredOwnerFilter();

    mount.replaceChildren();
    mount.append(
      renderBoard(
        model,
        cardsByColumn,
        mineEmail,
        gitRepoAvailable,
        flowCtx,
        pendingSync
      )
    );
    scheduleRestoreBoardViewScroll(scrollSnapshot, mount);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load board: ${escapeHtml(msg)}</div>`;
    scheduleRestoreBoardViewScroll(scrollSnapshot, mount);
  }
}

async function maybeNotifyNpmUpdate() {
  try {
    if (typeof sessionStorage === "undefined") return;

    const info = await fetchNpmUpdateCheck();
    if (!info.updateAvailable || !info.latestVersion) return;

    const cur = info.currentVersion || "?";
    const lat = info.latestVersion;

    const dismissed = sessionStorage.getItem(
      "millrace.npmUpdateDismissedFor"
    );
    if (dismissed === lat) return;

    if (info.projectHasCycleScript) {
      const updateNow = await showFlowConfirm(
        `You are running Millrace v${cur} and a new version is available: v${lat}. Run pnpm update --latest and pnpm cycle now?`,
        {
          title: "Update available",
          confirmLabel: "Update now",
          cancelLabel: "Later",
          allowEscapeDismiss: false,
          allowBackdropDismiss: false,
        }
      );
      if (!updateNow) {
        sessionStorage.setItem("millrace.npmUpdateDismissedFor", lat);
        return;
      }
      try {
        const result = await postNpmUpdateRunCycle(lat);
        if (result.ok) {
          showFlowToast(
            "pnpm update finished. Restart Millrace if it did not reload automatically.",
            { durationMs: 8000 }
          );
        } else {
          const detail =
            typeof result.message === "string" && result.message.trim()
              ? result.message.trim()
              : npmUpdateFailureReasonLabel(result.reason);
          await showFlowAlert(detail, { title: "Could not update" });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await showFlowAlert(msg, { title: "Could not update" });
      }
      return;
    }

    if (sessionStorage.getItem("millrace.npmUpdateToast")) return;
    sessionStorage.setItem("millrace.npmUpdateToast", "1");
    showFlowToast(
      `You are running Millrace v${cur} and a new version is available: v${lat}.`,
      { durationMs: 9000 }
    );
  } catch {
    /* ignore */
  }
}

/** @param {string | undefined} reason */
function npmUpdateFailureReasonLabel(reason) {
  const r = String(reason ?? "").trim();
  if (r === "no_package_json") {
    return "No package.json in the Millrace data root.";
  }
  if (r === "no_cycle_script") {
    return 'package.json has no "cycle" script.';
  }
  if (r === "invalid_package_json") {
    return "Could not parse package.json.";
  }
  return "pnpm reported an error.";
}

async function main() {
  await loadApp(true);
  void maybeNotifyNpmUpdate();

  document.addEventListener("flow:refresh-board", () => {
    void loadApp(true);
  });

  document.addEventListener("flow:active-board-changed", () => {
    boardCardSearch = "";
    clearPendingAutoSyncDebounce();
    void loadApp(true);
  });

  document.addEventListener("flow:pending-sync", () => {
    boardCache.pendingSync = true;
    applyPendingSyncPulseToBoardShell();
    const btn = document.querySelector(".board-sync-btn");
    if (btn && gitRepoAvailable) {
      const syncTitleBase =
        "Pull from origin, resolve merge conflicts if needed, commit pending task changes, then push (runs on the machine hosting Millrace)";
      btn.title = `${syncTitleBase} Unsaved task changes are not on the remote yet — sync when ready.`;
    }
    if (
      gitRepoAvailable &&
      userPreferenceSyncModeIsAutomatic(boardCache.syncMode)
    ) {
      clearPendingAutoSyncDebounce();
      autoSyncDebounceTimer = setTimeout(() => {
        autoSyncDebounceTimer = null;
        void performBoardGitSync();
      }, AUTO_SYNC_DEBOUNCE_MS);
    }
  });
}

main();
