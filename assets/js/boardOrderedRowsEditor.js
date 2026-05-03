/** Up chevron (^) — stroke so it stays visible on dark UI. */
const ARROW_UP = `<svg class="flow-board-sort-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" d="M7 14l5-5 5 5"/></svg>`;
/** Down chevron (v) */
const ARROW_DOWN = `<svg class="flow-board-sort-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" d="M7 10l5 5 5-5"/></svg>`;
const REMOVE_ICON = `<svg class="flow-link-remove-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 4l6 6M10 4l-6 6"/></svg>`;

/**
 * @param {HTMLDivElement} list
 * @param {HTMLElement} rowEl
 */
function rowIndexInList(list, rowEl) {
  return [...list.children].indexOf(rowEl);
}

/**
 * @param {{ title: string, wipLimit?: string, isDone?: boolean }[]} initial
 */
export function createSortableColumnList(initial) {
  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-board-sortable-field";

  const label = document.createElement("span");
  label.className = "flow-field-label";
  label.textContent = "Columns (use arrows to reorder)";

  const list = document.createElement("div");
  list.className = "flow-board-sortable-list";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "flow-btn flow-btn-ghost flow-board-sortable-add";
  addBtn.textContent = "Add column";

  wrap.append(label, list, addBtn);

  /** @type {{ title: string, wipLimit: string, isDone: boolean }[]} */
  let rows = (Array.isArray(initial) ? initial : []).map((r) => ({
    title: String(r?.title ?? "").trim(),
    wipLimit:
      r?.wipLimit != null && String(r.wipLimit).trim() !== ""
        ? String(r.wipLimit).trim()
        : "",
    isDone: Boolean(r?.isDone),
  }));

  function moveRow(from, to) {
    if (from === to || from < 0 || from >= rows.length) return;
    if (to < 0) to = 0;
    if (to >= rows.length) to = rows.length - 1;
    const [item] = rows.splice(from, 1);
    rows.splice(to, 0, item);
  }

  function buildRow(row, index) {
    const rowEl = document.createElement("div");
    rowEl.className = "flow-board-sortable-row";

    const reorder = document.createElement("div");
    reorder.className = "flow-board-sortable-reorder";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "flow-board-sort-dir flow-board-sort-dir--up";
    upBtn.setAttribute("aria-label", "Move column up");
    upBtn.title = "Move up";
    upBtn.innerHTML = ARROW_UP;
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i - 1);
      render();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "flow-board-sort-dir flow-board-sort-dir--down";
    downBtn.setAttribute("aria-label", "Move column down");
    downBtn.title = "Move down";
    downBtn.innerHTML = ARROW_DOWN;
    downBtn.disabled = index >= rows.length - 1;
    downBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i + 1);
      render();
    });

    reorder.append(upBtn, downBtn);

    const titleIn = document.createElement("input");
    titleIn.type = "text";
    titleIn.className = "flow-input flow-board-sortable-title";
    titleIn.placeholder = "Column title";
    titleIn.value = row.title;
    titleIn.autocomplete = "off";

    const wipIn = document.createElement("input");
    wipIn.type = "text";
    wipIn.className = "flow-input flow-board-sortable-wip";
    wipIn.placeholder = "WIP";
    wipIn.title = "WIP limit (optional, non‑negative integer)";
    wipIn.value = row.wipLimit;
    wipIn.autocomplete = "off";

    const doneLbl = document.createElement("label");
    doneLbl.className = "flow-board-sortable-done";
    const doneCb = document.createElement("input");
    doneCb.type = "checkbox";
    doneCb.checked = row.isDone;
    doneLbl.append(doneCb, document.createTextNode(" Done"));

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "flow-link-remove flow-board-sortable-remove";
    rm.setAttribute("aria-label", "Remove column");
    rm.innerHTML = REMOVE_ICON;
    rm.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      syncRowInputsToState();
      const i = rowIndexInList(list, rowEl);
      if (rows.length <= 1 || i < 0) return;
      rows.splice(i, 1);
      render();
    });

    rowEl.append(reorder, titleIn, wipIn, doneLbl, rm);
    return rowEl;
  }

  function syncRowInputsToState() {
    const els = list.querySelectorAll(".flow-board-sortable-row");
    let i = 0;
    for (const rowEl of els) {
      const t = rowEl.querySelector(".flow-board-sortable-title");
      const w = rowEl.querySelector(".flow-board-sortable-wip");
      const c = rowEl.querySelector('input[type="checkbox"]');
      if (!rows[i]) break;
      rows[i] = {
        title: String(t?.value ?? "").trim(),
        wipLimit: String(w?.value ?? "").trim(),
        isDone: Boolean(c?.checked),
      };
      i++;
    }
  }

  /** Rebuild list from `rows`. Do not sync from DOM first — DOM order may still be stale after moveRow. */
  function render() {
    list.replaceChildren();
    rows.forEach((row, i) => {
      list.append(buildRow(row, i));
    });
  }

  addBtn.addEventListener("click", () => {
    syncRowInputsToState();
    rows.push({ title: "", wipLimit: "", isDone: false });
    render();
    const last = list.querySelector(".flow-board-sortable-row:last-child .flow-board-sortable-title");
    if (last instanceof HTMLInputElement) last.focus();
  });

  render();

  return {
    root: wrap,
    /** @returns {{ title: string, wipLimit: string, isDone: boolean }[]} */
    getRows() {
      syncRowInputsToState();
      return rows.map((r) => ({ ...r }));
    },
  };
}

/**
 * @param {{ title: string }[]} initial
 */
export function createSortableSwimlaneList(initial) {
  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-board-sortable-field";

  const label = document.createElement("span");
  label.className = "flow-field-label";
  label.textContent = "Swimlanes (use arrows to reorder)";

  const list = document.createElement("div");
  list.className = "flow-board-sortable-list";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "flow-btn flow-btn-ghost flow-board-sortable-add";
  addBtn.textContent = "Add swimlane";

  wrap.append(label, list, addBtn);

  /** @type {{ title: string }[]} */
  let rows = (Array.isArray(initial) ? initial : []).map((r) => ({
    title: String(r?.title ?? "").trim(),
  }));

  function moveRow(from, to) {
    if (from === to || from < 0 || from >= rows.length) return;
    if (to < 0) to = 0;
    if (to >= rows.length) to = rows.length - 1;
    const [item] = rows.splice(from, 1);
    rows.splice(to, 0, item);
  }

  function buildRow(row, index) {
    const rowEl = document.createElement("div");
    rowEl.className = "flow-board-sortable-row flow-board-sortable-row--swimlane";

    const reorder = document.createElement("div");
    reorder.className = "flow-board-sortable-reorder";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "flow-board-sort-dir flow-board-sort-dir--up";
    upBtn.setAttribute("aria-label", "Move swimlane up");
    upBtn.title = "Move up";
    upBtn.innerHTML = ARROW_UP;
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i - 1);
      render();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "flow-board-sort-dir flow-board-sort-dir--down";
    downBtn.setAttribute("aria-label", "Move swimlane down");
    downBtn.title = "Move down";
    downBtn.innerHTML = ARROW_DOWN;
    downBtn.disabled = index >= rows.length - 1;
    downBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i + 1);
      render();
    });

    reorder.append(upBtn, downBtn);

    const titleIn = document.createElement("input");
    titleIn.type = "text";
    titleIn.className = "flow-input flow-board-sortable-title flow-board-sortable-title--wide";
    titleIn.placeholder = "Swimlane title";
    titleIn.value = row.title;
    titleIn.autocomplete = "off";

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "flow-link-remove flow-board-sortable-remove";
    rm.setAttribute("aria-label", "Remove swimlane");
    rm.innerHTML = REMOVE_ICON;
    rm.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      syncRowInputsToState();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      rows.splice(i, 1);
      render();
    });

    rowEl.append(reorder, titleIn, rm);
    return rowEl;
  }

  function syncRowInputsToState() {
    const els = list.querySelectorAll(".flow-board-sortable-row");
    let i = 0;
    for (const rowEl of els) {
      const t = rowEl.querySelector(".flow-board-sortable-title");
      if (!rows[i]) break;
      rows[i] = { title: String(t?.value ?? "").trim() };
      i++;
    }
  }

  /** Rebuild list from `rows`. Do not sync from DOM first — DOM order may still be stale after moveRow. */
  function render() {
    list.replaceChildren();
    rows.forEach((row, i) => {
      list.append(buildRow(row, i));
    });
  }

  addBtn.addEventListener("click", () => {
    syncRowInputsToState();
    rows.push({ title: "" });
    render();
    const last = list.querySelector(".flow-board-sortable-row:last-child .flow-board-sortable-title");
    if (last instanceof HTMLInputElement) last.focus();
  });

  render();

  return {
    root: wrap,
    /** @returns {{ title: string }[]} */
    getRows() {
      syncRowInputsToState();
      return rows.map((r) => ({ ...r }));
    },
  };
}

/**
 * Board `[users.N]` entries: email (owner field on cards), display name, and active flag.
 * @param {{ email: string, name: string, active?: boolean }[]} initial
 */
export function createSortableBoardUserList(initial) {
  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-board-sortable-field";

  const label = document.createElement("span");
  label.className = "flow-field-label";
  label.textContent = "Board users (use arrows to reorder)";

  const hint = document.createElement("p");
  hint.className = "flow-board-user-hint";
  hint.textContent =
    "Deactivate removes someone from the owner picker and filters, but keeps their name for cards already assigned. New cards cannot use inactive owners.";

  const list = document.createElement("div");
  list.className = "flow-board-sortable-list";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "flow-btn flow-btn-ghost flow-board-sortable-add";
  addBtn.textContent = "Add board user";

  wrap.append(label, hint, list, addBtn);

  /** @type {{ email: string, name: string, active: boolean }[]} */
  let rows = (Array.isArray(initial) ? initial : []).map((r) => ({
    email: String(r?.email ?? "").trim(),
    name: String(r?.name ?? "").trim(),
    active: r?.active !== false,
  }));

  function moveRow(from, to) {
    if (from === to || from < 0 || from >= rows.length) return;
    if (to < 0) to = 0;
    if (to >= rows.length) to = rows.length - 1;
    const [item] = rows.splice(from, 1);
    rows.splice(to, 0, item);
  }

  function buildRow(row, index) {
    const rowEl = document.createElement("div");
    rowEl.className = "flow-board-sortable-row flow-board-sortable-row--user";
    if (!row.active) {
      rowEl.classList.add("flow-board-sortable-row--user-inactive");
    }

    const reorder = document.createElement("div");
    reorder.className = "flow-board-sortable-reorder";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "flow-board-sort-dir flow-board-sort-dir--up";
    upBtn.setAttribute("aria-label", "Move user up");
    upBtn.title = "Move up";
    upBtn.innerHTML = ARROW_UP;
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i - 1);
      render();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "flow-board-sort-dir flow-board-sort-dir--down";
    downBtn.setAttribute("aria-label", "Move user down");
    downBtn.title = "Move down";
    downBtn.innerHTML = ARROW_DOWN;
    downBtn.disabled = index >= rows.length - 1;
    downBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = rowIndexInList(list, rowEl);
      if (i < 0) return;
      syncRowInputsToState();
      moveRow(i, i + 1);
      render();
    });

    reorder.append(upBtn, downBtn);

    const emailIn = document.createElement("input");
    emailIn.type = "text";
    emailIn.inputMode = "email";
    emailIn.className = "flow-input flow-board-sortable-user-email";
    emailIn.placeholder = "Email";
    emailIn.autocomplete = "off";
    emailIn.spellcheck = false;
    emailIn.value = row.email;
    emailIn.readOnly = !row.active;
    emailIn.title = row.active
      ? "Card owner field uses this email"
      : "Reactivate to change email";

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.className = "flow-input flow-board-sortable-user-name";
    nameIn.placeholder = "Display name";
    nameIn.autocomplete = "name";
    nameIn.value = row.name;
    nameIn.title = row.active
      ? "Shown on cards instead of raw email"
      : "Still shown for cards assigned to this person";

    const toggleAct = document.createElement("button");
    toggleAct.type = "button";
    toggleAct.className =
      "flow-btn flow-btn-ghost flow-board-user-active-toggle";
    if (row.active) {
      toggleAct.textContent = "Deactivate";
      toggleAct.title =
        "Hide from owner picker; cards already owned keep this display name.";
      toggleAct.setAttribute("aria-label", "Deactivate user");
    } else {
      toggleAct.textContent = "Restore";
      toggleAct.title = "Show in owner picker and filters again";
      toggleAct.setAttribute("aria-label", "Restore user");
    }
    toggleAct.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      syncRowInputsToState();
      const i = rowIndexInList(list, rowEl);
      if (i < 0 || !rows[i]) return;
      rows[i].active = !rows[i].active;
      render();
    });

    rowEl.append(reorder, emailIn, nameIn, toggleAct);
    return rowEl;
  }

  function syncRowInputsToState() {
    const els = list.querySelectorAll(".flow-board-sortable-row");
    let i = 0;
    for (const rowEl of els) {
      const em = rowEl.querySelector(".flow-board-sortable-user-email");
      const nm = rowEl.querySelector(".flow-board-sortable-user-name");
      if (!rows[i]) break;
      rows[i] = {
        email: String(em?.value ?? "").trim(),
        name: String(nm?.value ?? "").trim(),
        active: rows[i].active,
      };
      i++;
    }
  }

  function render() {
    list.replaceChildren();
    rows.forEach((row, i) => {
      list.append(buildRow(row, i));
    });
  }

  addBtn.addEventListener("click", () => {
    syncRowInputsToState();
    rows.push({ email: "", name: "", active: true });
    render();
    const last = list.querySelector(
      ".flow-board-sortable-row:last-child .flow-board-sortable-user-email"
    );
    if (last instanceof HTMLInputElement) last.focus();
  });

  render();

  return {
    root: wrap,
    /** @returns {{ email: string, name: string, active: boolean }[]} */
    getRows() {
      syncRowInputsToState();
      return rows.map((r) => ({ ...r }));
    },
  };
}
