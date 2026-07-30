import {
  FLOW_SEARCH_SUBMIT_ICON,
  wrapSearchInputWithClear,
} from "./clearFilter.js";

/** Funnel icon for the board filter toggle. */
export const BOARD_FILTER_ICON = `<svg class="board-filter-toggle-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 5h16l-6.5 7.5V19l-3 1.5v-8L4 5z"/></svg>`;

export const BOARD_FILTERS_PANEL_ID = "flow-board-filters-panel";
export const COMPLETE_FILTERS_PANEL_ID = "flow-complete-filters-panel";
export const CHARTS_FILTERS_PANEL_ID = "flow-charts-filters-panel";

/**
 * Collapsible filter chrome: header toggle + expandable row (right-aligned).
 *
 * @param {{
 *   open?: boolean,
 *   onOpenChange?: (open: boolean) => void,
 *   panelId: string,
 *   children: HTMLElement[],
 * }} opts
 * @returns {{
 *   toggle: HTMLButtonElement,
 *   panel: HTMLDivElement,
 *   isOpen: () => boolean,
 * }}
 */
export function createCollapsibleFiltersPanel(opts) {
  let open = Boolean(opts.open);
  const onOpenChange = opts.onOpenChange;
  const panelId = opts.panelId;

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "board-filters-panel";
  if (open) {
    panel.classList.add("board-filters-panel--open");
  } else {
    panel.inert = true;
  }
  const panelInner = document.createElement("div");
  panelInner.className = "board-filters-panel__inner";
  for (const el of opts.children) {
    panelInner.append(el);
  }
  panel.append(panelInner);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "flow-btn flow-btn-icon board-filter-toggle";
  toggle.setAttribute("aria-label", "Filters");
  toggle.title = "Filters";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-controls", panelId);
  toggle.innerHTML = BOARD_FILTER_ICON;

  function applyOpen() {
    panel.classList.toggle("board-filters-panel--open", open);
    panel.inert = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    onOpenChange?.(open);
  }

  toggle.addEventListener("click", () => {
    open = !open;
    applyOpen();
  });

  return {
    toggle,
    panel,
    isOpen: () => open,
  };
}

/**
 * Collapsible board filter chrome: header toggle + expandable row with search
 * (and optional leading controls such as the owner dropdown).
 *
 * @param {{
 *   open?: boolean,
 *   onOpenChange?: (open: boolean) => void,
 *   searchValue?: string,
 *   onSearch: (query: string) => void,
 *   onSearchClear: () => void,
 *   leadingControls?: HTMLElement[],
 * }} opts
 * @returns {{
 *   toggle: HTMLButtonElement,
 *   panel: HTMLDivElement,
 *   searchInput: HTMLInputElement,
 *   searchBtn: HTMLButtonElement,
 *   isOpen: () => boolean,
 * }}
 */
export function createBoardFiltersPanel(opts) {
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
  searchInput.value = String(opts.searchValue ?? "");

  function runSearch() {
    opts.onSearch(searchInput.value);
  }

  const searchFieldWrap = wrapSearchInputWithClear(searchInput, () => {
    opts.onSearchClear();
  });
  const searchBtn = document.createElement("button");
  searchBtn.type = "button";
  searchBtn.className =
    "flow-btn flow-btn-primary flow-btn-icon board-card-search-btn board-card-search-btn--icon";
  searchBtn.setAttribute("aria-label", "Search");
  searchBtn.title = "Search";
  searchBtn.innerHTML = FLOW_SEARCH_SUBMIT_ICON;
  searchBtn.addEventListener("click", () => runSearch());
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });
  searchWrap.append(searchLabel, searchFieldWrap, searchBtn);

  const { toggle, panel, isOpen } = createCollapsibleFiltersPanel({
    open: opts.open,
    onOpenChange: opts.onOpenChange,
    panelId: BOARD_FILTERS_PANEL_ID,
    children: [...(opts.leadingControls ?? []), searchWrap],
  });

  return {
    toggle,
    panel,
    searchInput,
    searchBtn,
    isOpen,
  };
}
