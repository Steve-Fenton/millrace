import { openBoardEditorDialog } from "../dialogs/editBoard.js";
import { openRenameBoardDialog } from "../dialogs/renameBoard.js";
import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import { setFlowDocumentTitle } from "../ui/documentTitle.js";
import {
  createBoardDefinition,
  fetchMillraceSettings,
  patchMillraceSettings,
} from "../client.js";
import {
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "../ui/boardSelector.js";
import { escapeHtml } from "../html/escape.js";
import { initFlowTheme } from "../ui/applyTheme.js";
import { showFlowAlert, showFlowToast } from "../ui/showMessage.js";

const ADMIN_BOARD_CREATED_FLASH_KEY = "flow:admin-board-created-flash";

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
    const titleDiv = document.createElement("div");
    titleDiv.className = "column-card-title complete-table__title-text";
    titleDiv.textContent = b.name;

    const fn = b.file && String(b.file).trim();
    const actions = document.createElement("div");
    actions.className = "admin-board-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "admin-board-action-btn";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", `Edit board ${b.name}`);
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void openBoardEditorDialog({
        boardSlug: b.slug,
        displayName: b.name,
        configFile: fn || `${b.slug}.ini`,
      });
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "admin-board-action-btn";
    renameBtn.textContent = "Rename";
    renameBtn.setAttribute("aria-label", `Rename board ${b.name}`);
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void openRenameBoardDialog({
        boardSlug: b.slug,
        displayName: b.name,
        configFile: fn || `${b.slug}.ini`,
      });
    });

    actions.append(editBtn, renameBtn);
    titleInner.append(titleDiv, actions);
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

  const aggregateLabel = document.createElement("label");
  aggregateLabel.className = "admin-add-board__aggregate";
  const aggregateCheckbox = document.createElement("input");
  aggregateCheckbox.type = "checkbox";
  aggregateCheckbox.id = "admin-new-board-aggregate";
  aggregateCheckbox.className = "admin-add-board__aggregate-input";
  aggregateLabel.htmlFor = "admin-new-board-aggregate";
  aggregateLabel.append(aggregateCheckbox, document.createTextNode(" Aggregate board"));

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
      const created = await createBoardDefinition(name, {
        kind: aggregateCheckbox.checked ? "aggregate" : undefined,
      });
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

  wrap.append(label, input, aggregateLabel, btn, status);
  return wrap;
}

/**
 * @param {{ admin: string }} initial
 */
function renderMillraceAdminForm(initial) {
  const panel = document.createElement("div");
  panel.className = "preferences-panel admin-millrace-panel";

  const secTitle = document.createElement("h2");
  secTitle.className = "charts-section-title preferences-panel__title";
  secTitle.textContent = "Millrace settings";

  const blurb = document.createElement("p");
  blurb.className = "flow-modal-context preferences-panel__intro";
  blurb.innerHTML = `Stored in <code class="flow-board-editor-file">${escapeHtml("tasks/.millrace.ini")}</code> under <code class="flow-board-editor-file">[millrace]</code>.`;

  const form = document.createElement("form");
  form.className = "preferences-form";

  const grid = document.createElement("div");
  grid.className = "preferences-grid";

  const adminLabel = document.createElement("label");
  adminLabel.className = "flow-field preferences-field";
  const adminSpan = document.createElement("span");
  adminSpan.className = "flow-field-label";
  adminSpan.textContent = "Millrace Admin";
  const adminInput = document.createElement("input");
  adminInput.type = "email";
  adminInput.className = "flow-input";
  adminInput.name = "admin";
  adminInput.autocomplete = "email";
  adminInput.placeholder = "admin@company.com";
  adminInput.setAttribute("aria-label", "Millrace admin email");
  adminInput.value = initial.admin;
  adminLabel.append(adminSpan, adminInput);

  grid.append(adminLabel);

  const actions = document.createElement("div");
  actions.className = "preferences-form-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "flow-btn flow-btn-primary";
  saveBtn.textContent = "Save";
  actions.append(saveBtn);

  form.append(grid, actions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      saveBtn.disabled = true;
      try {
        const saved = await patchMillraceSettings({
          admin: String(adminInput.value ?? ""),
        });
        adminInput.value = saved.admin;
        showFlowToast("Millrace settings saved.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save Millrace settings" });
      } finally {
        saveBtn.disabled = false;
      }
    })();
  });

  panel.append(secTitle, blurb, form);
  return panel;
}

/**
 * @param {HTMLElement} boardsSection
 * @param {HTMLElement} millracePanel
 */
function renderAdminShell(boardsSection, millracePanel) {
  setFlowDocumentTitle("Admin");
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
  body.append(secTitle, boardsSection, addRow, millracePanel);
  root.append(top, body);
  return root;
}

async function main() {
  void initFlowTheme();
  const mount = document.getElementById("app");
  if (!mount) return;
  setFlowDocumentTitle("Admin");
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;
  try {
    const [selection, millraceSettings] = await Promise.all([
      resolveActiveBoardSelection(),
      fetchMillraceSettings(),
    ]);
    mount.replaceChildren();
    mount.append(
      renderAdminShell(
        renderBoardsTable(selection),
        renderMillraceAdminForm(millraceSettings)
      )
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load boards: ${escapeHtml(msg)}</div>`;
  }
}

document.addEventListener("flow:admin-refresh", () => {
  void main();
});

void main();
