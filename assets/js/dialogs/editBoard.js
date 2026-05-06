import { parseBoardIni, validateExactlyOneDoneColumn } from "../models/boardModel.js";
import { serializeBoardIniFromModel } from "../ini/boardIni.js";
import {
  createSortableBoardUserList,
  createSortableColumnList,
  createSortableSwimlaneList,
} from "../boardOrderedRowsEditor.js";
import { showFlowAlert, showFlowConfirm } from "../flowDialogs.js";
import {
  deleteBoardDefinition,
  fetchBoardDefinition,
  fetchBoardDefinitionGitHistory,
  updateBoardDefinition,
} from "../repoAccess.js";
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
  const nestedBackdrop = el(`
    <div class="flow-modal-backdrop flow-modal-backdrop--nested" tabindex="-1"></div>
  `);
  const histModal = el(`
    <div class="flow-modal flow-modal--git-history" role="dialog" aria-modal="true" aria-labelledby="flow-board-git-history-title">
      <h3 id="flow-board-git-history-title" class="flow-modal-title">Git history</h3>
      <p class="flow-git-history-meta flow-git-history-path">Loading…</p>
      <div class="flow-git-history-list" role="list"></div>
      <div class="flow-modal-actions flow-modal-actions--history">
        <button type="button" class="flow-btn flow-btn-primary flow-git-history-close">Close</button>
      </div>
    </div>
  `);
  nestedBackdrop.append(histModal);
  document.body.append(nestedBackdrop);

  const pathEl = histModal.querySelector(".flow-git-history-path");
  const listEl = histModal.querySelector(".flow-git-history-list");

  function closeNested() {
    document.removeEventListener("keydown", onEscCapture, true);
    nestedBackdrop.remove();
  }

  function onEscCapture(ev) {
    if (ev.key !== "Escape") return;
    if (!document.body.contains(nestedBackdrop)) {
      document.removeEventListener("keydown", onEscCapture, true);
      return;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    closeNested();
  }

  document.addEventListener("keydown", onEscCapture, true);
  nestedBackdrop.addEventListener("click", (e) => {
    if (e.target === nestedBackdrop) closeNested();
  });
  histModal.querySelector(".flow-git-history-close")?.addEventListener("click", closeNested);
  void nestedBackdrop.focus();

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
 * @param {string} boardName
 * @param {{ title: string, wipLimit: string, isDone: boolean }[]} colRows
 * @param {{ title: string }[]} swimRows
 * @param {{ email: string, name: string, active?: boolean }[]} userRows
 */
function buildModel(initialModel, boardName, colRows, swimRows, userRows) {
  const columns = colRows.map((r, i) => {
    const wip = r.wipLimit.trim();
    let wipLimit = undefined;
    if (wip !== "") {
      const n = Number(wip);
      if (Number.isFinite(n) && n >= 0) wipLimit = n;
    }
    /** @type {import("../models/boardModel.js").ColumnDef} */
    const c = {
      index: i + 1,
      title: r.title.trim() || `Column ${i + 1}`,
    };
    if (wipLimit !== undefined) c.wipLimit = wipLimit;
    if (r.isDone) c.isDone = true;
    return c;
  });
  const swimlanes = swimRows.map((r, i) => ({
    index: i + 1,
    title: r.title.trim() || `Lane ${i + 1}`,
  }));
  /** @type {import("../models/boardModel.js").BoardUserDef[]} */
  const users = [];
  let userIdx = 1;
  for (const r of userRows) {
    const email = String(r.email ?? "").trim();
    if (!email) continue;
    const display = String(r.name ?? "").trim() || email;
    const active = r.active !== false;
    users.push({ index: userIdx++, email, name: display, active });
  }
  const ib = initialModel.board ?? {};
  const rest = { ...ib };
  delete rest.pull_frequency;
  delete rest.pullFrequency;
  delete rest.update_frequency;
  delete rest.updateFrequency;
  delete rest.sync_mode;
  delete rest.syncMode;
  return {
    board: {
      ...rest,
      name: boardName.trim(),
      slug: String(ib.slug ?? "").trim(),
    },
    columns,
    swimlanes,
    users,
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

  const colSeeds = [...(initialModel.columns ?? [])]
    .sort((a, b) => a.index - b.index)
    .map((c) => ({
      title: c.title,
      wipLimit:
        c.wipLimit != null && Number.isFinite(Number(c.wipLimit))
          ? String(Math.round(Number(c.wipLimit)))
          : "",
      isDone: Boolean(c.isDone),
    }));
  const swimSeeds = [...(initialModel.swimlanes ?? [])]
    .sort((a, b) => a.index - b.index)
    .map((l) => ({ title: l.title }));
  const userSeeds = [...(initialModel.users ?? [])]
    .sort((a, b) => a.index - b.index)
    .map((u) => ({
      email: u.email,
      name: String(u.name ?? "").trim(),
      active: u.active !== false,
    }));

  const backdrop = el(`
    <div class="flow-modal-backdrop" role="presentation"></div>
  `);
  const modal = el(`
    <div class="flow-modal flow-modal--edit-board" role="dialog" aria-modal="true" aria-labelledby="flow-edit-board-title">
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
      <p class="flow-modal-context flow-modal-context--board">${escapeHtml(ctx.displayName)} · <code class="flow-board-editor-file">${escapeHtml(ctx.configFile)}</code></p>
      <form class="flow-modal-form flow-modal-form--edit-board">
        <label class="flow-field">
          <span class="flow-field-label">Board name</span>
          <input class="flow-input" name="boardName" type="text" required autocomplete="off" />
        </label>
        <label class="flow-field">
          <span class="flow-field-label">Slug</span>
          <input class="flow-input flow-input--readonly" name="boardSlug" type="text" readonly autocomplete="off" title="Change slug by renaming the board file and tasks folder in the repo" />
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
    </div>
  `);

  backdrop.append(modal);
  document.body.append(backdrop);

  const form = modal.querySelector("form");
  const nameInput = modal.querySelector('input[name="boardName"]');
  const slugInput = modal.querySelector('input[name="boardSlug"]');
  nameInput.value = String(initialModel.board?.name ?? def.name ?? "").trim();
  slugInput.value = ctx.boardSlug;

  const sortWrap = modal.querySelector(".flow-board-editor-sortables");
  const colEditor = createSortableColumnList(colSeeds.length ? colSeeds : [{ title: "Backlog", wipLimit: "", isDone: false }]);
  const swimEditor = createSortableSwimlaneList(swimSeeds);
  const userEditor = createSortableBoardUserList(userSeeds);
  sortWrap.append(colEditor.root, swimEditor.root, userEditor.root);

  nameInput.focus();
  nameInput.select();

  modal.querySelector(".flow-btn-history-icon")?.addEventListener("click", () => {
    void openBoardGitHistoryNested({ boardSlug: ctx.boardSlug });
  });

  let settled = false;

  return new Promise((resolve) => {
    function finish(ok) {
      if (settled) return;
      settled = true;
      backdrop.remove();
      resolve(ok);
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(false);
    });

    modal.querySelector(".flow-cancel").addEventListener("click", () => finish(false));

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

    document.addEventListener(
      "keydown",
      function onEsc(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", onEsc);
          finish(false);
        }
      },
      { once: true }
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const boardName = String(nameInput.value || "").trim();
      if (!boardName) {
        await showFlowAlert("Board name is required.", { title: "Edit board" });
        return;
      }

      const colRows = colEditor.getRows();
      if (colRows.length === 0) {
        await showFlowAlert("Add at least one column.", { title: "Edit board" });
        return;
      }
      for (const r of colRows) {
        if (!String(r.title ?? "").trim()) {
          await showFlowAlert("Each column must have a title.", {
            title: "Edit board",
          });
          return;
        }
      }

      const swimRows = swimEditor.getRows();
      const rawUserRows = userEditor.getRows();
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
          return;
        }
        if (!em.includes("@")) {
          await showFlowAlert(
            `Invalid email for board user: ${em}`,
            { title: "Edit board" }
          );
          return;
        }
        const low = em.toLowerCase();
        if (seenEmails.has(low)) {
          await showFlowAlert(
            `Duplicate board user email: ${em}`,
            { title: "Edit board" }
          );
          return;
        }
        seenEmails.add(low);
      }

      const model = buildModel(
        initialModel,
        boardName,
        colRows,
        swimRows,
        rawUserRows
      );
      const doneErr = validateExactlyOneDoneColumn(model);
      if (doneErr) {
        await showFlowAlert(doneErr, { title: "Edit board" });
        return;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save board" });
      }
    });
  });
}
