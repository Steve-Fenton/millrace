import { openCardEditorDialog } from "../dialogs/editCard.js";
import { takePendingCardEditorOpen } from "../ui/openCardEditorAfterRefresh.js";
import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import { setFlowDocumentTitle } from "../ui/documentTitle.js";
import {
  boardOwnerEmailsForFilter,
  ownerDisplayLabel,
  parseBoardIni,
} from "../models/boardModel.js";
import { enrichAggregateBoardModel } from "../models/aggregateBoard.js";
import {
  normalizeOwnerFilter,
  ownerFilterToSelectValue,
  persistOwnerFilter,
  readStoredOwnerFilter,
} from "../ui/filterByOwner.js";
import { showFlowAlert } from "../ui/showMessage.js";
import { ensureMineEmailConfigured } from "../ui/setupMineOwner.js";
import { fetchBoardIni, fetchLocalUserProfile } from "../client.js";
import { boardSlugFrom } from "../html/slug.js";
import {
  createBoardTitlePicker,
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "../ui/boardSelector.js";
import {
  FLOW_SEARCH_SUBMIT_ICON,
  wrapSearchInputWithClear,
} from "../ui/clearFilter.js";
import { fillCardLinkWithNewTabIcon } from "../ui/cardLinkOpenNewTab.js";
import { swimlaneNameForIniItem } from "../ini/cardIni.js";
import { resolveCardSwimlaneIndex } from "../ini/swimlaneResolve.js";
import { escapeHtml } from "../html/escape.js";
import { initFlowTheme } from "../ui/applyTheme.js";
import { displayTaskTitle } from "../models/taskModel.js";

const NO_STORE = /** @type {const} */ ({ cache: "no-store" });
const PAGE_SIZE = 50;

const EDIT_CARD_ICON = `<svg class="flow-card-edit-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

/** @type {{ mode: "all" | "mine" | "owner"; owner: string }} */
let ownerFilter = { mode: "all", owner: "" };

/**
 * Plain-text date for table cells (use with textContent).
 * @param {string | undefined} iso
 */
function formatWhenPlain(iso) {
  const t = iso && String(iso).trim();
  if (!t) return "—";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t;
  return new Date(ms).toLocaleString();
}

/**
 * URL/API token for a swimlane: title when unique; otherwise `swimlanes.N` (unnamed or duplicate titles).
 * @param {{ index: number, title?: string }} l
 * @param {Array<{ index: number, title?: string }>} swimlanesSorted
 */
function swimlaneFilterToken(l, swimlanesSorted) {
  const t = String(l.title ?? "").trim();
  if (!t) return `swimlanes.${l.index}`;
  const lower = t.toLowerCase();
  const sameTitle = swimlanesSorted.filter(
    (x) => String(x.title ?? "").trim().toLowerCase() === lower
  );
  if (sameTitle.length > 1) return `swimlanes.${l.index}`;
  return t;
}

/**
 * Normalize `lane` query to the canonical token for this board, or null if invalid / no filter.
 * @param {string | null} raw
 * @param {Array<{ index: number, title?: string }>} swimlanesSorted
 * @returns {string | null}
 */
/** @param {string | null | undefined} raw */
function parseWhenParamFromUrl(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (
    v === "this_week" ||
    v === "this_month" ||
    v === "last_week" ||
    v === "last_month"
  ) {
    return v;
  }
  return "all";
}

function canonicalLaneParamFromUrl(raw, swimlanesSorted) {
  if (raw == null || String(raw).trim() === "") return null;
  const decoded = String(raw).trim();
  if (swimlanesSorted.length === 0) return null;

  for (const l of swimlanesSorted) {
    const tok = swimlaneFilterToken(l, swimlanesSorted);
    if (tok === decoded) return tok;
  }

  const lower = decoded.toLowerCase();
  for (const l of swimlanesSorted) {
    const t = String(l.title ?? "").trim();
    if (t && t.toLowerCase() === lower) {
      return swimlaneFilterToken(l, swimlanesSorted);
    }
  }

  const key = decoded.match(/^swimlanes\.(\d+)$/i);
  if (key) {
    const n = Number(key[1]);
    const hit = swimlanesSorted.find((x) => x.index === n);
    if (hit) return swimlaneFilterToken(hit, swimlanesSorted);
  }

  if (/^\d+$/.test(decoded)) {
    const n = Number.parseInt(decoded, 10);
    const hit = swimlanesSorted.find((x) => x.index === n);
    if (hit) return swimlaneFilterToken(hit, swimlanesSorted);
  }

  return null;
}

/**
 * @param {string} boardSlug
 * @param {number} page
 * @param {{ mode: "all" | "mine" | "owner"; owner: string }} filter
 * @param {string} mineEmail `[user] mine` for API `me` when filter is Mine
 * @param {{ q?: string, deep?: boolean, lane?: string | null, when?: string }} [searchOpts]
 */
async function fetchCompletedPage(boardSlug, page, filter, mineEmail, searchOpts = {}) {
  const q = new URLSearchParams({
    boardSlug,
    page: String(page),
    limit: String(PAGE_SIZE),
    of:
      filter.mode === "all"
        ? "all"
        : filter.mode === "mine"
          ? "mine"
          : "owner",
  });
  if (filter.mode === "owner" && filter.owner) {
    q.set("pick", filter.owner);
  }
  if (filter.mode === "mine") {
    q.set("me", mineEmail);
  }
  const sq = String(searchOpts.q ?? "").trim();
  if (sq) q.set("q", sq);
  if (searchOpts.deep) q.set("deep", "1");
  const laneStr = String(searchOpts.lane ?? "").trim();
  if (laneStr) q.set("lane", laneStr);
  const whenStr = String(searchOpts.when ?? "").trim();
  if (whenStr && whenStr !== "all") q.set("when", whenStr);
  const res = await fetch(`/api/completed-cards?${q}`, NO_STORE);
  const ct = res.headers.get("content-type") ?? "";
  /** @type {Record<string, unknown>} */
  let data = {};
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    await res.text().catch(() => {});
  }
  if (!res.ok) {
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/**
 * @param {object} model
 * @param {string} boardSlug
 * @param {number} page
 * @param {{ cards: object[], total: number, pageSize: number, ownerNames?: string[], legacySwimlaneFilters?: string[] }} data — ownerNames are filter keys (emails when the board lists users)
 * @param {string} mineEmail `[user] mine`
 * @param {{ boards: { slug: string, name: string }[], activeSlug: string }} flowCtx
 * @param {string} searchQuery
 * @param {boolean} deepSearch
 * @param {string | null} swimlaneFilterParam — canonical lane token from URL, or null for all
 * @param {string} whenFilterParam — `all` | `this_week` | `this_month` | `last_week` | `last_month`
 */
function renderCompleteShell(
  model,
  boardSlug,
  page,
  data,
  mineEmail,
  flowCtx,
  searchQuery,
  deepSearch,
  swimlaneFilterParam,
  whenFilterParam
) {
  const name = model.board.name?.trim() || "Board";
  setFlowDocumentTitle("Completed", name);
  const { cards, total, pageSize } = data;
  const ownerNames = Array.isArray(data.ownerNames) ? data.ownerNames : [];
  const legacySwimlaneFilters = Array.isArray(data.legacySwimlaneFilters)
    ? data.legacySwimlaneFilters
    : [];
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  const root = document.createElement("div");
  root.className = "board-shell complete-shell";

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

  persistOwnerFilter(ownerFilter);

  ownerSelect.addEventListener("change", () => {
    const v = ownerSelect.value;
    const prevFilter = { ...ownerFilter };
    if (v === "all") {
      ownerFilter = { mode: "all", owner: "" };
      persistOwnerFilter(ownerFilter);
      const u = new URL(window.location.href);
      u.searchParams.set("page", "1");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      void main();
      return;
    }
    if (v === "mine") {
      void (async () => {
        const profile = await fetchLocalUserProfile();
        let mine = String(profile.mine ?? "").trim();
        if (!mine) {
          const hint = String(profile.owner ?? "").trim();
          try {
            const entered = await ensureMineEmailConfigured(hint);
            if (entered == null) {
              ownerSelect.value = ownerFilterToSelectValue(prevFilter);
              return;
            }
            mine = entered;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await showFlowAlert(msg, { title: "Could not save Mine email" });
            ownerSelect.value = ownerFilterToSelectValue(prevFilter);
            return;
          }
        }
        ownerFilter = { mode: "mine", owner: "" };
        persistOwnerFilter(ownerFilter);
        const u = new URL(window.location.href);
        u.searchParams.set("page", "1");
        window.history.replaceState({}, "", u.pathname + u.search + u.hash);
        void main();
      })();
      return;
    }
    if (v.startsWith("owner:")) {
      ownerFilter = {
        mode: "owner",
        owner: decodeURIComponent(v.slice(6)),
      };
    }
    persistOwnerFilter(ownerFilter);
    const u = new URL(window.location.href);
    u.searchParams.set("page", "1");
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    void main();
  });

  filterWrap.append(filterLabel, ownerSelect);

  const whenWrap = document.createElement("div");
  whenWrap.className = "board-owner-filter";
  const whenLabel = document.createElement("label");
  whenLabel.className = "board-owner-filter-label";
  whenLabel.htmlFor = "flow-complete-when-filter";
  whenLabel.textContent = "Closed";
  const whenSelect = document.createElement("select");
  whenSelect.id = "flow-complete-when-filter";
  whenSelect.className = "board-owner-filter-select";
  whenSelect.setAttribute("aria-label", "Filter completed cards by close date");
  /** @type {Array<{ value: string, label: string }>} */
  const whenOptions = [
    { value: "all", label: "All" },
    { value: "this_week", label: "This week" },
    { value: "this_month", label: "This month" },
    { value: "last_week", label: "Last week" },
    { value: "last_month", label: "Last month" },
  ];
  for (const { value, label } of whenOptions) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    whenSelect.append(o);
  }
  const validWhen = new Set(whenOptions.map((x) => x.value));
  whenSelect.value = validWhen.has(whenFilterParam) ? whenFilterParam : "all";
  whenSelect.addEventListener("change", () => {
    const u = new URL(window.location.href);
    const v = whenSelect.value;
    if (v === "all") u.searchParams.delete("when");
    else u.searchParams.set("when", v);
    u.searchParams.set("page", "1");
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    void main();
  });
  whenWrap.append(whenLabel, whenSelect);

  const swimlanesSorted = [...(model.swimlanes ?? [])].sort(
    (a, b) => a.index - b.index
  );

  const searchWrap = document.createElement("div");
  searchWrap.className = "complete-search-toolbar";
  const searchLabel = document.createElement("label");
  searchLabel.className = "board-owner-filter-label";
  searchLabel.htmlFor = "flow-complete-search";
  searchLabel.textContent = "Search";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "flow-complete-search";
  searchInput.className = "flow-input complete-search-input";
  searchInput.placeholder = "Title, owner, links…";
  searchInput.setAttribute("aria-label", "Search completed cards");
  searchInput.autocomplete = "off";
  searchInput.value = searchQuery;
  const deepLabel = document.createElement("label");
  deepLabel.className = "complete-deep-label";
  const deepCb = document.createElement("input");
  deepCb.type = "checkbox";
  deepCb.id = "flow-complete-deep";
  deepCb.checked = deepSearch;
  deepCb.setAttribute("aria-label", "Search all");
  const deepText = document.createElement("span");
  deepText.className = "complete-deep-text";
  deepText.textContent = "Search all";
  deepLabel.title =
    "Also search cold storage, abandoned cards, and in-flight cards. Applied when you click Search.";
  deepLabel.append(deepCb, deepText);

  function applyCompletedSearch() {
    const u = new URL(window.location.href);
    const v = searchInput.value.trim();
    if (v) u.searchParams.set("q", v);
    else u.searchParams.delete("q");
    if (deepCb.checked) u.searchParams.set("deep", "1");
    else u.searchParams.delete("deep");
    u.searchParams.set("page", "1");
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    void main();
  }
  const searchFieldWrap = wrapSearchInputWithClear(searchInput, () => {
    const u = new URL(window.location.href);
    u.searchParams.delete("q");
    u.searchParams.set("page", "1");
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    void main();
  });
  const searchBtn = document.createElement("button");
  searchBtn.type = "button";
  searchBtn.className =
    "flow-btn flow-btn-primary flow-btn-icon complete-search-btn complete-search-btn--icon";
  searchBtn.setAttribute("aria-label", "Search");
  searchBtn.title = "Search";
  searchBtn.innerHTML = FLOW_SEARCH_SUBMIT_ICON;
  searchBtn.addEventListener("click", () => applyCompletedSearch());
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCompletedSearch();
    }
  });
  searchWrap.append(searchLabel, searchFieldWrap, deepLabel, searchBtn);
  topLeft.append(brand, titleOrPicker);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";

  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "Completed";

  const navMenu = createFlowNavMenu({ current: "completed" });

  topActions.append(badge, navMenu);
  top.append(topLeft, topActions);

  const filterPanel = document.createElement("div");
  filterPanel.className = "complete-filters-panel";
  filterPanel.append(filterWrap, whenWrap);
  const showLaneFilter =
    swimlanesSorted.length > 0 || legacySwimlaneFilters.length > 0;
  if (showLaneFilter) {
    const laneWrap = document.createElement("div");
    laneWrap.className = "board-owner-filter";
    const laneLabel = document.createElement("label");
    laneLabel.className = "board-owner-filter-label";
    laneLabel.htmlFor = "flow-complete-swimlane-filter";
    laneLabel.textContent = "Swimlane";
    const laneSelect = document.createElement("select");
    laneSelect.id = "flow-complete-swimlane-filter";
    laneSelect.className = "board-owner-filter-select";
    laneSelect.setAttribute("aria-label", "Filter completed cards by swimlane");
    const oAll = document.createElement("option");
    oAll.value = "all";
    oAll.textContent = "All";
    laneSelect.append(oAll);
    for (const l of swimlanesSorted) {
      const o = document.createElement("option");
      o.value = swimlaneFilterToken(l, swimlanesSorted);
      const t = String(l.title ?? "").trim() || `Lane ${l.index}`;
      o.textContent = t;
      laneSelect.append(o);
    }
    if (legacySwimlaneFilters.length > 0 && swimlanesSorted.length > 0) {
      const og = document.createElement("optgroup");
      og.label = "From card files (archive / cold)";
      for (const s of legacySwimlaneFilters) {
        const o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        og.append(o);
      }
      laneSelect.append(og);
    } else if (legacySwimlaneFilters.length > 0) {
      for (const s of legacySwimlaneFilters) {
        const o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        laneSelect.append(o);
      }
    }
    /** @param {string | null} param */
    function legacyMatchingParam(param) {
      if (param == null) return null;
      const low = param.toLowerCase();
      return (
        legacySwimlaneFilters.find((s) => s.toLowerCase() === low) ?? null
      );
    }
    const matchedLegacy = legacyMatchingParam(swimlaneFilterParam);
    let wantLane = "all";
    if (swimlaneFilterParam != null) {
      const boardHit = swimlanesSorted.some(
        (x) => swimlaneFilterToken(x, swimlanesSorted) === swimlaneFilterParam
      );
      if (boardHit) wantLane = swimlaneFilterParam;
      else if (matchedLegacy != null) wantLane = matchedLegacy;
    }
    laneSelect.value = wantLane;
    laneSelect.addEventListener("change", () => {
      const u = new URL(window.location.href);
      const v = laneSelect.value;
      if (v === "all") u.searchParams.delete("lane");
      else u.searchParams.set("lane", v);
      u.searchParams.set("page", "1");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      void main();
    });
    laneWrap.append(laneLabel, laneSelect);
    filterPanel.append(laneWrap);
  }
  filterPanel.append(searchWrap);

  const scroll = document.createElement("div");
  scroll.className = "complete-list-wrap";

  const table = document.createElement("table");
  table.className = "complete-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const { label, align } of [
    { label: "Title", align: "left" },
    { label: "Owner", align: "left" },
    { label: "Swimlane", align: "left" },
    { label: "Links", align: "left" },
    { label: "Created", align: "right" },
    { label: "Closed", align: "right" },
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className =
      align === "right" ? "complete-table__th complete-table__th--num" : "complete-table__th";
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  table.append(tbody);

  for (const card of cards) {
    const source = String(card.source ?? "");
    const tr = document.createElement("tr");
    tr.className = "complete-table__row";
    if (card.strategic) tr.classList.add("complete-table__row--strategic");

    const titleText = displayTaskTitle(card);

    const fn = card.filename && String(card.filename).trim();
    const colIdx = card.columnIndex;
    const canEdit =
      (source === "board" || source === "in-flight") &&
      fn &&
      colIdx != null &&
      Number.isFinite(Number(colIdx)) &&
      Number(colIdx) >= 1;

    const tdTitle = document.createElement("td");
    tdTitle.className = "complete-table__td complete-table__td--title";
    const titleInner = document.createElement("div");
    titleInner.className = "complete-table__title-inner";
    const titleMain = document.createElement("div");
    titleMain.className = "complete-table__title-main";
    const titleDiv = document.createElement("div");
    titleDiv.className = "column-card-title complete-table__title-text";
    titleDiv.textContent = titleText;
    const titleStack = document.createElement("div");
    titleStack.className = "complete-table__title-stack";
    titleStack.append(titleDiv);
    const noteTxt = card.note && String(card.note).trim();
    if (noteTxt) {
      const noteEl = document.createElement("div");
      noteEl.className = "complete-table__card-note";
      noteEl.textContent = noteTxt;
      titleStack.append(noteEl);
    }
    titleMain.append(titleStack);
    if (canEdit) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "flow-card-edit-btn";
      editBtn.setAttribute("aria-label", "Edit card");
      editBtn.title = "Edit card";
      editBtn.innerHTML = EDIT_CARD_ICON;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const col = model.columns.find((c) => Number(c.index) === Number(colIdx));
        void openCardEditorDialog({
          boardSlug: String(card.sourceBoardSlug ?? boardSlug).trim() || boardSlug,
          columnIndex: Number(card.sourceColumnIndex ?? colIdx),
          filename: fn,
          columnTitle: col?.title ?? `Column ${colIdx}`,
          swimlaneIndex: resolveCardSwimlaneIndex(
            /** @type {string | undefined} */ (card.swimlane),
            model.swimlanes ?? []
          ),
          boardUsers: model.users,
        });
      });
      titleMain.append(editBtn);
    }
    const srcBadge = document.createElement("span");
    const srcCls =
      source === "archive"
        ? " complete-source-badge--archive"
        : source === "cold"
          ? " complete-source-badge--cold"
          : source === "abandoned"
            ? " complete-source-badge--abandoned"
            : source === "in-flight"
              ? " complete-source-badge--in-flight"
              : "";
    srcBadge.className = "complete-source-badge" + srcCls;
    srcBadge.textContent =
      source === "archive"
        ? "Archive"
        : source === "cold"
          ? "Cold"
          : source === "abandoned"
            ? "Abandoned"
            : source === "in-flight"
              ? "In-flight"
              : "Board";
    titleInner.append(titleMain, srcBadge);
    tdTitle.append(titleInner);

    const tdOwner = document.createElement("td");
    tdOwner.className = "complete-table__td";
    const ownerStr = card.owner && String(card.owner).trim();
    tdOwner.textContent = ownerStr
      ? ownerDisplayLabel(ownerStr, model.users)
      : "—";

    const tdSwimlane = document.createElement("td");
    tdSwimlane.className = "complete-table__td";
    const lanes = model.swimlanes ?? [];
    if (lanes.length === 0) {
      tdSwimlane.textContent = "—";
    } else {
      const laneIdx = resolveCardSwimlaneIndex(
        /** @type {string | undefined} */ (card.swimlane),
        lanes
      );
      tdSwimlane.textContent = swimlaneNameForIniItem(lanes, laneIdx) ?? "—";
    }

    const tdLinks = document.createElement("td");
    tdLinks.className = "complete-table__td complete-table__td--links";
    if (Array.isArray(card.links) && card.links.length > 0) {
      const linkWrap = document.createElement("div");
      linkWrap.className = "complete-table__links";
      for (const link of card.links) {
        const href = String(link.url ?? "").trim();
        if (!href) continue;
        const label = String(link.text ?? "").trim() || href;
        const a = document.createElement("a");
        a.className = "column-card-link";
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        fillCardLinkWithNewTabIcon(a, label);
        a.addEventListener("click", (e) => e.stopPropagation());
        linkWrap.append(a);
      }
      if (linkWrap.childElementCount > 0) {
        tdLinks.append(linkWrap);
      } else {
        tdLinks.textContent = "—";
      }
    } else {
      tdLinks.textContent = "—";
    }

    const tdCreated = document.createElement("td");
    tdCreated.className =
      "complete-table__td complete-table__td--num complete-table__td--date";
    tdCreated.textContent = formatWhenPlain(
      /** @type {string | undefined} */ (card.created)
    );

    const tdClosed = document.createElement("td");
    tdClosed.className =
      "complete-table__td complete-table__td--num complete-table__td--date";
    tdClosed.textContent = formatWhenPlain(
      /** @type {string | undefined} */ (card.closed)
    );

    tr.append(tdTitle, tdOwner, tdSwimlane, tdLinks, tdCreated, tdClosed);

    if (canEdit) {
      tr.classList.add("complete-table__row--editable");
    } else if (source === "archive") {
      tr.title = "Archived — open the file in the repo to edit";
    }

    tbody.append(tr);
  }

  if (cards.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "complete-empty";
    const hasListFilters =
      ownerFilter.mode !== "all" ||
      whenFilterParam !== "all" ||
      Boolean(String(searchQuery ?? "").trim()) ||
      swimlaneFilterParam != null;
    td.textContent =
      total === 0
        ? hasListFilters
          ? "No cards match this filter."
          : "No completed cards yet."
        : "No cards on this page.";
    tr.append(td);
    tbody.append(tr);
  }

  scroll.append(table);

  const pager = document.createElement("div");
  pager.className = "complete-pagination";

  const rangeLabel = document.createElement("span");
  rangeLabel.className = "complete-pagination-range";
  rangeLabel.textContent =
    total === 0 ? "0 items" : `${from}–${to} of ${total}`;

  const btnRow = document.createElement("div");
  btnRow.className = "complete-pagination-buttons";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "board-sync-btn";
  prevBtn.textContent = "Previous";
  prevBtn.disabled = safePage <= 1;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "board-sync-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = safePage >= pageCount;

  function goTo(p) {
    const u = new URL(window.location.href);
    u.searchParams.set("page", String(p));
    window.location.href = u.pathname + u.search;
  }

  prevBtn.addEventListener("click", () => {
    if (safePage > 1) goTo(safePage - 1);
  });
  nextBtn.addEventListener("click", () => {
    if (safePage < pageCount) goTo(safePage + 1);
  });

  btnRow.append(prevBtn, nextBtn);
  pager.append(rangeLabel, btnRow);

  root.append(top, filterPanel, scroll, pager);
  return root;
}

async function main() {
  void initFlowTheme();
  const mount = document.getElementById("app");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const pageRaw = Number.parseInt(params.get("page") ?? "1", 10);
  let page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const searchQuery = params.get("q") ?? "";
  const deepSearch =
    params.get("deep") === "1" || params.get("deep") === "true";
  const whenFilterParam = parseWhenParamFromUrl(params.get("when"));

  setFlowDocumentTitle("Completed");
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;

  try {
    const { boards, activeSlug } = await resolveActiveBoardSelection();
    const flowCtx = { boards, activeSlug };
    const text = await fetchBoardIni(activeSlug);
    let model = parseBoardIni(text);
    model = enrichAggregateBoardModel(model, boards);
    if (model.columns.length === 0) {
      mount.innerHTML = `<div class="app-error">No columns found in board.ini.</div>`;
      return;
    }
    const boardSlug = boardSlugFrom(model.board);
    const boardOwnerKeys = boardOwnerEmailsForFilter(model.users);

    const laneParamRaw = params.get("lane");
    /** @type {string | null} */
    let swimlaneFilterParam = null;
    const swimlanesSorted = [...(model.swimlanes ?? [])].sort(
      (a, b) => a.index - b.index
    );
    if (laneParamRaw != null && String(laneParamRaw).trim() !== "") {
      const rawTrim = String(laneParamRaw).trim();
      if (swimlanesSorted.length > 0) {
        const canonical = canonicalLaneParamFromUrl(laneParamRaw, swimlanesSorted);
        if (canonical != null) {
          swimlaneFilterParam = canonical;
          if (rawTrim !== canonical) {
            const uNorm = new URL(window.location.href);
            uNorm.searchParams.set("lane", canonical);
            window.history.replaceState({}, "", uNorm.pathname + uNorm.search + uNorm.hash);
          }
        } else {
          swimlaneFilterParam = rawTrim;
        }
      } else {
        swimlaneFilterParam = rawTrim;
      }
    }

    const stored = readStoredOwnerFilter();
    if (stored) ownerFilter = { mode: stored.mode, owner: stored.owner };

    const profile = await fetchLocalUserProfile();
    const mineEmail = String(profile.mine ?? "").trim();

    const preNorm = normalizeOwnerFilter(boardOwnerKeys, mineEmail, ownerFilter);
    if (
      preNorm.mode !== ownerFilter.mode ||
      preNorm.owner !== ownerFilter.owner
    ) {
      ownerFilter = preNorm;
      persistOwnerFilter(ownerFilter);
      page = 1;
      const u0 = new URL(window.location.href);
      u0.searchParams.set("page", "1");
      window.history.replaceState({}, "", u0.pathname + u0.search + u0.hash);
    }

    let data = await fetchCompletedPage(boardSlug, page, ownerFilter, mineEmail, {
      q: searchQuery,
      deep: deepSearch,
      lane: swimlaneFilterParam,
      when: whenFilterParam,
    });
    let ownerNames =
      boardOwnerKeys.length > 0
        ? boardOwnerKeys
        : Array.isArray(data.ownerNames)
          ? data.ownerNames
          : [];
    const normalized = normalizeOwnerFilter(ownerNames, mineEmail, ownerFilter);
    if (
      normalized.mode !== ownerFilter.mode ||
      normalized.owner !== ownerFilter.owner
    ) {
      ownerFilter = normalized;
      persistOwnerFilter(ownerFilter);
      const u = new URL(window.location.href);
      u.searchParams.set("page", "1");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      page = 1;
      data = await fetchCompletedPage(boardSlug, 1, ownerFilter, mineEmail, {
        q: searchQuery,
        deep: deepSearch,
        lane: swimlaneFilterParam,
        when: whenFilterParam,
      });
    }

    const cards = Array.isArray(data.cards) ? data.cards : [];
    const total = Number(data.total) || 0;
    const pageSize = Number(data.pageSize) || PAGE_SIZE;
    const ownerNamesOut =
      boardOwnerKeys.length > 0 ? boardOwnerKeys : ownerNames;

    mount.replaceChildren();
    mount.append(
      renderCompleteShell(
        model,
        boardSlug,
        page,
        {
          cards,
          total,
          pageSize,
          ownerNames: ownerNamesOut,
          legacySwimlaneFilters: Array.isArray(data.legacySwimlaneFilters)
            ? data.legacySwimlaneFilters
            : [],
        },
        mineEmail,
        flowCtx,
        searchQuery,
        deepSearch,
        swimlaneFilterParam,
        whenFilterParam
      )
    );
    const pendingOpen = takePendingCardEditorOpen();
    if (pendingOpen) {
      void openCardEditorDialog(pendingOpen);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load list: ${escapeHtml(msg)}</div>`;
  }
}

document.addEventListener("flow:refresh-board", () => {
  void main();
});

document.addEventListener("flow:active-board-changed", () => {
  void main();
});

void main();
