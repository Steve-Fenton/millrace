import {
  columnTypeOf,
  parseBoardIni,
  validateExactlyOneDoneColumn,
} from "../models/boardModel.js";
import {
  AGGREGATE_BOARD_KIND,
  isAggregateBoard,
  standardAggregateColumns,
  validateAggregateBoard,
} from "../models/aggregateBoard.js";
import { serializeBoardIniFromModel } from "../ini/boardIni.js";
import {
  createSortableBoardUserList,
  createSortableColumnList,
  createSortableSwimlaneList,
} from "../ui/boardOrderedRowsEditor.js";
import { showFlowAlert, showFlowConfirm } from "../ui/showMessage.js";
import {
  deleteBoardDefinition,
  fetchBoardDefinition,
  fetchBoardDefinitionGitHistory,
  updateBoardDefinition,
} from "../client.js";
import { el } from "../html/element.js";
import { escapeHtml } from "../html/escape.js";

/** @param {string | undefined} raw */
function formatTs(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return s;
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

/**
 * @param {{ boardSlug: string }} ctx
 */
async function openBoardGitHistoryNested(ctx) {
  const histDialog = el(`
    <dialog class="flow-modal flow-modal--git-history flow-dialog--nested" aria-labelledby="flow-board-git-history-title">
      <h3 id="flow-board-git-history-title" class="flow-modal-title">Git history</h3>
      <p class="flow-git-history-meta flow-git-history-path">Loading…</p>
      <div class="flow-git-history-list" role="list"></div>
      <div class="flow-modal-actions flow-modal-actions--history">
        <button type="button" class="flow-btn flow-btn-primary flow-git-history-close">Close</button>
      </div>
    </dialog>
  `);
  document.body.append(histDialog);

  const pathEl = histDialog.querySelector(".flow-git-history-path");
  const listEl = histDialog.querySelector(".flow-git-history-list");

  function destroyNested() {
    if (!histDialog.isConnected) return;
    histDialog.close();
    histDialog.remove();
  }

  histDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    destroyNested();
  });

  histDialog.addEventListener("click", (e) => {
    if (e.target === histDialog) destroyNested();
  });

  histDialog.querySelector(".flow-git-history-close")?.addEventListener("click", destroyNested);

  histDialog.showModal();
  histDialog.querySelector(".flow-git-history-close")?.focus();

  try {
    const data = await fetchBoardDefinitionGitHistory({
      boardSlug: ctx.boardSlug,
      limit: 50,
    });
    const commits = Array.isArray(data.commits) ? data.commits : [];
    const msg = typeof data.message === "string" ? data.message.trim() : "";

    if (!data.gitAvailable) {
      pathEl.textContent = msg || "Git is not available for this server.";
      listEl.replaceChildren();
      return;
    }

    const relPath =
      typeof data.path === "string" && data.path.trim()
        ? data.path.trim()
        : "";
    pathEl.textContent = relPath ? `File: ${relPath}` : "";

    listEl.replaceChildren();
    if (commits.length === 0) {
      const empty = document.createElement("p");
      empty.className = "flow-git-history-empty";
      empty.textContent =
        msg ||
        "No commits yet for this file in Git (commit changes in the repo manually).";
      listEl.append(empty);
      return;
    }

    if (msg) {
      const note = document.createElement("p");
      note.className = "flow-git-history-note";
      note.textContent = msg;
      listEl.append(note);
    }

    for (const c of commits) {
      const row = document.createElement("div");
      row.className = "flow-git-history-item";
      row.setAttribute("role", "listitem");
      const top = document.createElement("div");
      top.className = "flow-git-history-item-top";
      const hash = document.createElement("code");
      hash.className = "flow-git-history-hash";
      hash.textContent = String(c.shortHash ?? "").slice(0, 12);
      const when = document.createElement("time");
      when.className = "flow-git-history-date";
      const rawD = String(c.date ?? "").trim();
      when.dateTime = rawD;
      when.textContent = formatTs(rawD) || rawD;
      top.append(hash, when);
      const who = document.createElement("div");
      who.className = "flow-git-history-author";
      who.textContent = String(c.author ?? "").trim() || "—";
      const subj = document.createElement("div");
      subj.className = "flow-git-history-subject";
      subj.textContent = String(c.subject ?? "").trim() || "—";
      row.append(top, who, subj);
      const changes = Array.isArray(c.changeSummary) ? c.changeSummary : [];
      if (changes.length > 0) {
        const chWrap = document.createElement("div");
        chWrap.className = "flow-git-history-changes";
        for (const line of changes) {
          const lineEl = document.createElement("div");
          lineEl.className = "flow-git-history-change-line";
          lineEl.textContent = line;
          chWrap.append(lineEl);
        }
        row.append(chWrap);
      }
      listEl.append(row);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    pathEl.textContent = "";
    listEl.replaceChildren();
    const errP = document.createElement("p");
    errP.className = "flow-modal-error";
    errP.textContent = m;
    listEl.append(errP);
  }
}

/**
 * @param {import("../models/boardModel.js").BoardModel} initialModel
 * @param {{ title: string, wipLimit: string, type: import("../models/boardModel.js").ColumnType }[]} colRows
 * @param {{ title: string }[]} swimRows
 * @param {{ email: string, name: string, active?: boolean }[]} userRows
 * @param {string[]} [sourceSlugs]
 */
function buildModel(initialModel, colRows, swimRows, userRows, sourceSlugs) {
  const aggregate = isAggregateBoard(initialModel);
  const columns = aggregate
    ? standardAggregateColumns()
    : colRows.map((r, i) => {
        const wip = r.wipLimit.trim();
        let wipLimit = undefined;
        if (wip !== "") {
          const n = Number(wip);
          if (Number.isFinite(n) && n >= 0) wipLimit = n;
        }
        const type = columnTypeOf({ type: r.type });
        /** @type {import("../models/boardModel.js").ColumnDef} */
        const c = {
          index: i + 1,
          title: r.title.trim() || `Column ${i + 1}`,
          type,
        };
        if (wipLimit !== undefined) c.wipLimit = wipLimit;
        if (type === "done") c.isDone = true;
        return c;
      });
  const swimlanes = aggregate
    ? []
    : swimRows.map((r, i) => ({
        index: i + 1,
        title: r.title.trim() || `Lane ${i + 1}`,
      }));
  /** @type {import("../models/boardModel.js").BoardUserDef[]} */
  const users = [];
  if (!aggregate) {
    let userIdx = 1;
    for (const r of userRows) {
      const email = String(r.email ?? "").trim();
      if (!email) continue;
      const display = String(r.name ?? "").trim() || email;
      const active = r.active !== false;
      users.push({ index: userIdx++, email, name: display, active });
    }
  }
  const ib = initialModel.board ?? {};
  const rest = { ...ib };
  delete rest.pull_frequency;
  delete rest.pullFrequency;
  delete rest.update_frequency;
  delete rest.updateFrequency;
  delete rest.sync_mode;
  delete rest.syncMode;
  /** @type {import("../models/boardModel.js").AggregateSourceDef[]} */
  const sources = [];
  if (aggregate) {
    (sourceSlugs ?? []).forEach((slug, i) => {
      const s = String(slug ?? "").trim();
      if (s) sources.push({ index: i + 1, slug: s });
    });
  }
  return {
    board: {
      ...rest,
      name: String(ib.name ?? "").trim(),
      slug: String(ib.slug ?? "").trim(),
      kind: aggregate ? AGGREGATE_BOARD_KIND : rest.kind,
    },
    columns,
    swimlanes,
    users,
    sources,
  };
}

/**
 * @param {{ boardSlug: string, displayName: string, configFile: string }} ctx
 * @returns {Promise<boolean>}
 */
export async function openBoardEditorDialog(ctx) {
  let def;
  try {
    def = await fetchBoardDefinition(ctx.boardSlug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await showFlowAlert(`Could not load board:\n${msg}`, {
      title: "Could not open board",
    });
    return false;
  }

  let initialModel;
  try {
    initialModel = parseBoardIni(def.text.replace(/^\uFEFF/, ""));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await showFlowAlert(`Invalid board file:\n${msg}`, { title: "Parse error" });
    return false;
  }

  const aggregate = isAggregateBoard(initialModel);
  const initialSourceSlugs = [...(initialModel.sources ?? [])]
    .sort((a, b) => a.index - b.index)
    .map((s) => s.slug);

  const colSeeds = aggregate
    ? standardAggregateColumns().map((c) => ({
        title: c.title,
        wipLimit: "",
        type: columnTypeOf(c),
      }))
    : [...(initialModel.columns ?? [])]
        .sort((a, b) => a.index - b.index)
        .map((c) => ({
          title: c.title,
          wipLimit:
            c.wipLimit != null && Number.isFinite(Number(c.wipLimit))
              ? String(Math.round(Number(c.wipLimit)))
              : "",
          type: columnTypeOf(c),
        }));
  const swimSeeds = aggregate
    ? []
    : [...(initialModel.swimlanes ?? [])]
        .sort((a, b) => a.index - b.index)
        .map((l) => ({ title: l.title }));
  const userSeeds = [...(initialModel.users ?? [])]
    .sort((a, b) => a.index - b.index)
    .map((u) => ({
      email: u.email,
      name: String(u.name ?? "").trim(),
      active: u.active !== false,
    }));

  const modal = el(`
    <dialog class="flow-modal flow-modal--edit-board" aria-labelledby="flow-edit-board-title" aria-describedby="flow-edit-board-context">
      <div class="flow-modal-header flow-modal-header--edit-card">
        <h2 id="flow-edit-board-title" class="flow-modal-title">Edit board</h2>
        <button
          type="button"
          class="flow-btn flow-btn-icon flow-btn-history-icon"
          aria-label="Git commit history for this board file"
          title="Git history"
        >
          <svg class="flow-history-icon-svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
        </button>
      </div>
      <p id="flow-edit-board-context" class="flow-modal-context flow-modal-context--board">${escapeHtml(ctx.displayName)} · <code class="flow-board-editor-file">${escapeHtml(ctx.configFile)}</code></p>
      <form class="flow-modal-form flow-modal-form--edit-board">
        <label class="flow-field">
          <span class="flow-field-label">Board name</span>
          <input class="flow-input flow-input--readonly" name="boardName" type="text" readonly autocomplete="off" title="Rename the board from Admin" />
        </label>
        <label class="flow-field">
          <span class="flow-field-label">Slug</span>
          <input class="flow-input flow-input--readonly" name="boardSlug" type="text" readonly autocomplete="off" title="Renamed together with the board name from Admin" />
        </label>
        <div class="flow-board-editor-sortables"></div>
        <div class="flow-modal-actions flow-modal-actions--split">
          <button
            type="button"
            class="flow-btn flow-btn-delete-icon"
            aria-label="Delete board from catalog"
            title="Delete board"
          >
            <svg class="flow-delete-icon-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4h8v2m-9 4v10m10-10v10M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
          <div class="flow-modal-actions-main">
            <button type="button" class="flow-btn flow-btn-ghost flow-cancel">Cancel</button>
            <button type="submit" class="flow-btn flow-btn-primary">Save</button>
          </div>
        </div>
      </form>
    </dialog>
  `);

  document.body.append(modal);

  const form = modal.querySelector("form");
  const nameInput = modal.querySelector('input[name="boardName"]');
  const slugInput = modal.querySelector('input[name="boardSlug"]');
  nameInput.value = String(initialModel.board?.name ?? def.name ?? "").trim();
  slugInput.value = ctx.boardSlug;

  const sortWrap = modal.querySelector(".flow-board-editor-sortables");
  const colEditor = aggregate
    ? null
    : createSortableColumnList(
        colSeeds.length
          ? colSeeds
          : [{ title: "Backlog", wipLimit: "", type: "in_progress" }]
      );
  const swimEditor = aggregate ? null : createSortableSwimlaneList(swimSeeds);
  const userEditor = aggregate
    ? null
    : createSortableBoardUserList(userSeeds);

  /** @type {HTMLFieldSetElement | null} */
  let sourceFieldset = null;
  /** @type {Map<string, HTMLInputElement>} */
  const sourceCheckboxes = new Map();

  if (aggregate) {
    const intro = document.createElement("p");
    intro.className = "flow-modal-context flow-aggregate-board-intro";
    intro.textContent =
      "Aggregate board — shows tasks from selected boards using standard columns (Options, To do, In progress, Waiting, Done). Cards are grouped by source board. No task folder is used.";
    sortWrap.append(intro);

    sourceFieldset = document.createElement("fieldset");
    sourceFieldset.className = "flow-aggregate-sources";
    const legend = document.createElement("legend");
    legend.className = "flow-field-label";
    legend.textContent = "Source boards";
    sourceFieldset.append(legend);

    const loading = document.createElement("p");
    loading.className = "flow-aggregate-sources-loading";
    loading.textContent = "Loading boards…";
    sourceFieldset.append(loading);
    sortWrap.append(sourceFieldset);

    void (async () => {
      /** @type {{ slug: string, name: string, kind?: string }[]} */
      let catalog = [];
      try {
        const res = await fetch("/api/flow", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.boards)) catalog = data.boards;
      } catch {
        /* ignore */
      }
      loading.remove();
      const choices = catalog.filter(
        (b) =>
          b.slug &&
          b.slug !== ctx.boardSlug &&
          String(b.kind ?? "").trim().toLowerCase() !== AGGREGATE_BOARD_KIND
      );
      if (choices.length === 0) {
        const empty = document.createElement("p");
        empty.className = "flow-aggregate-sources-empty";
        empty.textContent = "No other boards available to include.";
        sourceFieldset.append(empty);
        return;
      }
      for (const b of choices) {
        const label = document.createElement("label");
        label.className = "flow-aggregate-source-option";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = b.slug;
        cb.checked = initialSourceSlugs.includes(b.slug);
        sourceCheckboxes.set(b.slug, cb);
        label.append(cb, document.createTextNode(` ${b.name} (${b.slug})`));
        sourceFieldset.append(label);
      }
    })();
  }

  if (colEditor) sortWrap.append(colEditor.root);
  if (swimEditor) sortWrap.append(swimEditor.root);
  if (userEditor) sortWrap.append(userEditor.root);

  function getSelectedSourceSlugs() {
    /** @type {string[]} */
    const out = [];
    for (const [slug, cb] of sourceCheckboxes) {
      if (cb.checked) out.push(slug);
    }
    return out;
  }

  function snapshotDraft() {
    return JSON.stringify({
      columns: colEditor
        ? colEditor.getRows().map((r) => ({
            title: String(r.title ?? "").trim(),
            wipLimit: String(r.wipLimit ?? "").trim(),
            type: columnTypeOf({ type: r.type }),
          }))
        : [],
      swimlanes: swimEditor
        ? swimEditor.getRows().map((r) => ({
            title: String(r.title ?? "").trim(),
          }))
        : [],
      sources: aggregate ? getSelectedSourceSlugs() : [],
      users: userEditor
        ? userEditor.getRows().map((r) => ({
            email: String(r.email ?? "").trim(),
            name: String(r.name ?? "").trim(),
            active: r.active !== false,
          }))
        : [],
    });
  }

  const initialDraftSnapshot = snapshotDraft();

  modal.querySelector(".flow-btn-history-icon")?.addEventListener("click", () => {
    void openBoardGitHistoryNested({ boardSlug: ctx.boardSlug });
  });

  let settled = false;

  return new Promise((resolve) => {
    function finish(ok) {
      if (settled) return;
      settled = true;
      modal.close();
      modal.remove();
      resolve(ok);
    }

    function hasUnsavedChanges() {
      return snapshotDraft() !== initialDraftSnapshot;
    }

    async function saveDraft() {
      const colRows = colEditor ? colEditor.getRows() : [];
      if (!aggregate && colRows.length === 0) {
        await showFlowAlert("Add at least one column.", { title: "Edit board" });
        return false;
      }
      if (!aggregate) {
        for (const r of colRows) {
          if (!String(r.title ?? "").trim()) {
            await showFlowAlert("Each column must have a title.", {
              title: "Edit board",
            });
            return false;
          }
        }
      }

      const swimRows = swimEditor ? swimEditor.getRows() : [];
      const sourceSlugs = aggregate ? getSelectedSourceSlugs() : [];
      if (aggregate && sourceSlugs.length === 0) {
        await showFlowAlert("Select at least one source board.", {
          title: "Edit board",
        });
        return false;
      }
      const rawUserRows = userEditor ? userEditor.getRows() : [];
      if (userEditor) {
        const seenEmails = new Set();
        for (const r of rawUserRows) {
        const em = String(r.email ?? "").trim();
        const nm = String(r.name ?? "").trim();
        if (!em && !nm) continue;
        if (!em) {
          await showFlowAlert(
            "Each board user row needs an email (or clear the display name on that row).",
            { title: "Edit board" }
          );
          return false;
        }
        if (!em.includes("@")) {
          await showFlowAlert(
            `Invalid email for board user: ${em}`,
            { title: "Edit board" }
          );
          return false;
        }
        const low = em.toLowerCase();
        if (seenEmails.has(low)) {
          await showFlowAlert(
            `Duplicate board user email: ${em}`,
            { title: "Edit board" }
          );
          return false;
        }
        seenEmails.add(low);
        }
      }

      const model = buildModel(
        initialModel,
        colRows,
        swimRows,
        rawUserRows,
        sourceSlugs
      );
      const doneErr = validateExactlyOneDoneColumn(model);
      if (doneErr) {
        await showFlowAlert(doneErr, { title: "Edit board" });
        return false;
      }
      if (aggregate) {
        /** @type {{ slug: string, name: string, kind?: string }[]} */
        let catalog = [];
        try {
          const res = await fetch("/api/flow", { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          if (Array.isArray(data.boards)) catalog = data.boards;
        } catch {
          /* ignore */
        }
        const aggErr = validateAggregateBoard(model, catalog);
        if (aggErr) {
          await showFlowAlert(aggErr, { title: "Edit board" });
          return false;
        }
      }
      const text = serializeBoardIniFromModel(model);

      try {
        await updateBoardDefinition({
          boardSlug: ctx.boardSlug,
          text,
        });
        document.dispatchEvent(new CustomEvent("flow:admin-refresh"));
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        finish(true);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save board" });
        return false;
      }
    }

    let closeInProgress = false;
    async function requestClose() {
      if (settled || closeInProgress) return;
      if (!hasUnsavedChanges()) {
        finish(false);
        return;
      }
      closeInProgress = true;
      const shouldSave = await showFlowConfirm(
        "You have unsaved changes. Save before closing?",
        {
          title: "Unsaved changes",
          confirmLabel: "Save",
          cancelLabel: "Discard",
          allowEscapeDismiss: false,
          allowBackdropDismiss: false,
        }
      );
      closeInProgress = false;
      if (settled) return;
      if (shouldSave) {
        await saveDraft();
        return;
      }
      finish(false);
    }

    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      void requestClose();
    });

    let backdropPointerDown = false;
    modal.addEventListener("pointerdown", (e) => {
      backdropPointerDown = e.target === modal;
    });
    modal.addEventListener("click", (e) => {
      const isFullBackdropClick = backdropPointerDown && e.target === modal;
      backdropPointerDown = false;
      if (isFullBackdropClick) void requestClose();
    });

    modal.querySelector(".flow-cancel").addEventListener("click", () => {
      void requestClose();
    });

    modal.querySelector(".flow-btn-delete-icon")?.addEventListener("click", () => {
      void (async () => {
        const ok = await showFlowConfirm(
          `Remove “${ctx.displayName}” from the catalog and delete ${ctx.configFile}? Task cards under tasks/${ctx.boardSlug}/ stay on disk; remove them manually if needed.`,
          {
            title: "Delete board",
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
            destructive: true,
          }
        );
        if (!ok) return;
        try {
          await deleteBoardDefinition(ctx.boardSlug);
          document.dispatchEvent(new CustomEvent("flow:admin-refresh"));
          finish(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showFlowAlert(msg, { title: "Could not delete board" });
        }
      })();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveDraft();
    });

    modal.showModal();
    const firstFocus =
      colEditor?.root.querySelector("input, button, select, textarea") ??
      swimEditor?.root.querySelector("input, button, select, textarea") ??
      userEditor.root.querySelector("input, button, select, textarea") ??
      modal.querySelector(".flow-cancel");
    if (firstFocus instanceof HTMLElement) firstFocus.focus();
  });
}
