import { openBoardEditorDialog } from "./boardEditorDialog.js";
import { createFlowNavMenu } from "./flowNavMenu.js";
import { createMillraceBrandMark } from "./millraceBrandMark.js";
import { createBoardDefinition } from "./repoAccess.js";
import {
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "./flowBoardPicker.js";
import { escapeHtml } from "./html/escape.js";

const ADMIN_BOARD_CREATED_FLASH_KEY = "flow:admin-board-created-flash";

const EDIT_BOARD_ICON = `<svg class="flow-card-edit-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

/**
 * @param {{ boards: { slug: string, name: string, file?: string }[], activeSlug: string }} selection
 */
function renderBoardsTable(selection) {
  const { boards, activeSlug } = selection;

  const scroll = document.createElement("div");
  scroll.className = "complete-list-wrap";

  const table = document.createElement("table");
  table.className = "complete-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const { label, align } of [
    { label: "Name", align: "left" },
    { label: "Slug", align: "left" },
    { label: "Config file", align: "left" },
    { label: "Current", align: "right" },
    { label: "Open", align: "left" },
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className =
      align === "right"
        ? "complete-table__th complete-table__th--num"
        : "complete-table__th";
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  table.append(tbody);

  for (const b of boards) {
    const tr = document.createElement("tr");
    tr.className = "complete-table__row complete-table__row--editable";

    const tdName = document.createElement("td");
    tdName.className = "complete-table__td complete-table__td--title";
    const titleInner = document.createElement("div");
    titleInner.className = "complete-table__title-inner";
    const titleMain = document.createElement("div");
    titleMain.className = "complete-table__title-main";
    const titleDiv = document.createElement("div");
    titleDiv.className = "column-card-title complete-table__title-text";
    titleDiv.textContent = b.name;
    titleMain.append(titleDiv);

    const fn = b.file && String(b.file).trim();
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "flow-card-edit-btn";
    editBtn.setAttribute("aria-label", `Edit board ${b.name}`);
    editBtn.title = "Edit board";
    editBtn.innerHTML = EDIT_BOARD_ICON;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void openBoardEditorDialog({
        boardSlug: b.slug,
        displayName: b.name,
        configFile: fn || `${b.slug}.ini`,
      });
    });
    titleMain.append(editBtn);

    titleInner.append(titleMain);
    tdName.append(titleInner);

    const tdSlug = document.createElement("td");
    tdSlug.className = "complete-table__td";
    tdSlug.textContent = b.slug;

    const tdFile = document.createElement("td");
    tdFile.className = "complete-table__td";
    tdFile.textContent = fn || "—";

    const tdCurrent = document.createElement("td");
    tdCurrent.className =
      "complete-table__td complete-table__td--num complete-table__td--date";
    tdCurrent.textContent = b.slug === activeSlug ? "Current" : "—";

    const tdOpen = document.createElement("td");
    tdOpen.className = "complete-table__td complete-table__td--links";
    const linkWrap = document.createElement("div");
    linkWrap.className = "complete-table__links";
    const a = document.createElement("a");
    a.className = "column-card-link";
    a.href = "../index.html";
    a.textContent = "Board";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      writeStoredActiveBoardSlug(b.slug);
      window.location.assign("../index.html");
    });
    linkWrap.append(a);
    tdOpen.append(linkWrap);

    tr.append(tdName, tdSlug, tdFile, tdCurrent, tdOpen);
    tbody.append(tr);
  }

  if (boards.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "complete-empty";
    td.textContent = "No boards configured.";
    tr.append(td);
    tbody.append(tr);
  }

  scroll.append(table);
  return scroll;
}

/**
 * @param {(slug: string) => void} onCreated
 * @returns {HTMLElement}
 */
function renderAddBoardRow(onCreated) {
  const wrap = document.createElement("div");
  wrap.className = "admin-add-board";

  const label = document.createElement("label");
  label.className = "admin-add-board__label";
  label.htmlFor = "admin-new-board-name";
  label.textContent = "New board";

  const input = document.createElement("input");
  input.id = "admin-new-board-name";
  input.type = "text";
  input.className = "admin-add-board__input";
  input.placeholder = "Board name";
  input.autocomplete = "off";
  input.maxLength = 120;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-add-board__btn";
  btn.textContent = "Add board";

  const status = document.createElement("p");
  status.className = "admin-add-board__status";
  status.setAttribute("role", "status");
  status.hidden = true;

  try {
    const raw = sessionStorage.getItem(ADMIN_BOARD_CREATED_FLASH_KEY);
    if (raw) {
      sessionStorage.removeItem(ADMIN_BOARD_CREATED_FLASH_KEY);
      const data = JSON.parse(raw);
      const n = typeof data?.name === "string" ? data.name : "";
      const s = typeof data?.slug === "string" ? data.slug : "";
      if (n && s) {
        status.hidden = false;
        status.textContent = `Created “${n}” (${s}.ini). It is now the active board.`;
      }
    }
  } catch {
    /* ignore */
  }

  function setBusy(busy) {
    btn.disabled = busy;
    input.disabled = busy;
  }

  async function submit() {
    const name = input.value.trim();
    if (!name) {
      status.hidden = false;
      status.textContent = "Enter a board name.";
      return;
    }
    status.hidden = true;
    setBusy(true);
    try {
      const created = await createBoardDefinition(name);
      input.value = "";
      try {
        sessionStorage.setItem(
          ADMIN_BOARD_CREATED_FLASH_KEY,
          JSON.stringify({ name: created.name, slug: created.slug })
        );
      } catch {
        /* private mode */
      }
      onCreated(created.slug);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      status.hidden = false;
      status.textContent = msg;
    } finally {
      setBusy(false);
    }
  }

  btn.addEventListener("click", () => {
    void submit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  });

  wrap.append(label, input, btn, status);
  return wrap;
}

/**
 * @param {HTMLElement} boardsSection
 */
function renderAdminShell(boardsSection) {
  const root = document.createElement("div");
  root.className = "board-shell admin-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";
  const brand = createMillraceBrandMark();
  const title = document.createElement("h1");
  title.className = "board-title";
  title.textContent = "Admin";
  topLeft.append(brand, title);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";
  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "Admin";
  const navMenu = createFlowNavMenu({ current: "admin" });
  topActions.append(badge, navMenu);
  top.append(topLeft, topActions);

  const body = document.createElement("div");
  body.className = "admin-body";
  const secTitle = document.createElement("h2");
  secTitle.className = "charts-section-title";
  secTitle.textContent = "Boards";
  const addRow = renderAddBoardRow((slug) => {
    writeStoredActiveBoardSlug(slug);
    document.dispatchEvent(new CustomEvent("flow:admin-refresh"));
  });
  body.append(secTitle, boardsSection, addRow);
  root.append(top, body);
  return root;
}

async function main() {
  const mount = document.getElementById("app");
  if (!mount) return;
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;
  try {
    const selection = await resolveActiveBoardSelection();
    mount.replaceChildren();
    mount.append(renderAdminShell(renderBoardsTable(selection)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load boards: ${escapeHtml(msg)}</div>`;
  }
}

document.addEventListener("flow:admin-refresh", () => {
  void main();
});

void main();
