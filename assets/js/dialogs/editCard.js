import { createCardDescriptionEditor } from "../ui/cardDescriptionEditor.js";
import { createLinksEditor } from "../ui/cardLinks.js";
import {
  CARD_LINK_ICON_SVG,
  copyCardDeepLinkToClipboard,
  linksWithSourceCardLink,
  showCopyLinkButtonCopied,
} from "../ui/cardDeepLink.js";
import { queueCardEditorOpenAfterRefresh } from "../ui/openCardEditorAfterRefresh.js";
import { showFlowAlert, showFlowConfirm } from "../ui/showMessage.js";
import { createNextActionDateField } from "../ui/nextActionDateField.js";
import { createOwnerField } from "../ui/selectOwner.js";
import {
  abandonCard,
  createCard,
  fetchCard,
  fetchCardGitHistory,
  readLocalUserIni,
  updateCard,
} from "../client.js";
import { el } from "../html/element.js";
import { escapeHtml } from "../html/escape.js";
/**
 * @param {{ boardSlug: string, columnIndex: number, filename: string }} ctx
 */
async function openCardGitHistoryNested(ctx) {
  const histDialog = el(`
    <dialog class="flow-modal flow-modal--git-history flow-dialog--nested" aria-labelledby="flow-git-history-title">
      <h3 id="flow-git-history-title" class="flow-modal-title">Git history</h3>
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
    const data = await fetchCardGitHistory({
      boardSlug: ctx.boardSlug,
      columnIndex: ctx.columnIndex,
      filename: ctx.filename,
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
      when.textContent = formatCardTimestampDisplay(rawD) || rawD;
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

/** @param {string | undefined} raw — ISO-8601 from INI */
function formatCardTimestampDisplay(raw) {
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
 * @param {{ boardSlug: string, columnIndex: number, filename: string, columnTitle: string, swimlaneIndex: number, swimlaneTitle?: string, boardUsers?: import("../models/boardModel.js").BoardUserDef[] }} ctx
 * @returns {Promise<boolean>} true if saved, deleted, or duplicated (board refresh)
 */
export async function openCardEditorDialog(ctx) {
  /** @type {{ title?: string, description?: string, note?: string, owner?: string, created?: string, closed?: string, strategic?: boolean, links?: { text?: string, url?: string }[] }} */
  let initial = {};
  try {
    initial = await fetchCard(ctx.boardSlug, ctx.columnIndex, ctx.filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await showFlowAlert(`Could not open card:\n${msg}`, {
      title: "Could not open card",
    });
    return false;
  }

  const modal = el(`
    <dialog class="flow-modal flow-modal--edit-card" aria-labelledby="flow-edit-card-title" aria-describedby="flow-edit-card-context">
      <div class="flow-modal-header flow-modal-header--edit-card">
        <h2 id="flow-edit-card-title" class="flow-modal-title">Edit card</h2>
        <div class="flow-edit-card-header-actions">
          <button
            type="button"
            class="flow-btn flow-btn-icon flow-btn-duplicate-card-icon"
            aria-label="Duplicate card in this column and swimlane"
            title="Duplicate card"
          >
            <svg class="flow-duplicate-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="8" r="3"/><path d="M10 9.5 13 12"/><circle cx="16" cy="15" r="5.25"/><path d="M16 12.25v5.5M13.25 15h5.5" stroke-width="1.5"/></svg>
          </button>
          <button
            type="button"
            class="flow-btn flow-btn-icon flow-btn-history-icon"
            aria-label="Git commit history for this card"
            title="Git history"
          >
            <svg class="flow-history-icon-svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
          </button>
          <button
            type="button"
            class="flow-btn flow-btn-icon flow-btn-copy-card-link-icon"
            aria-label="Copy link to this card"
            title="Copy link"
          >
            ${CARD_LINK_ICON_SVG}
          </button>
        </div>
      </div>
      <p id="flow-edit-card-context" class="flow-modal-context">${escapeHtml(ctx.columnTitle)}${ctx.swimlaneTitle ? ` · ${escapeHtml(ctx.swimlaneTitle)}` : ""}</p>
      <form class="flow-modal-form">
        <label class="flow-field">
          <span class="flow-field-label">Title</span>
          <input class="flow-input" name="title" type="text" required autocomplete="off" placeholder="What needs doing?" />
        </label>
        <label class="flow-field flow-field--checkbox">
          <input type="checkbox" name="strategic" />
          <span class="flow-field-label">Strategic / critical priority</span>
        </label>
        <label class="flow-field">
          <span class="flow-field-label">Description</span>
          <textarea class="flow-input flow-textarea flow-textarea--edit-description" name="description" rows="12" placeholder="Optional"></textarea>
        </label>
        <div class="flow-modal-actions flow-modal-actions--split">
          <button
            type="button"
            class="flow-btn flow-btn-delete-icon"
            aria-label="Abandon card"
            title="Abandon card"
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

  const contextP = modal.querySelector(".flow-modal-context");
  const createdRaw = String(initial.created ?? "").trim();
  const closedRaw = String(initial.closed ?? "").trim();
  if (contextP && (createdRaw || closedRaw)) {
    const meta = document.createElement("div");
    meta.className = "flow-modal-meta flow-modal-meta--dates";
    if (createdRaw) {
      const row = document.createElement("div");
      row.className = "flow-card-meta-row";
      const label = document.createElement("span");
      label.className = "flow-card-meta-label";
      label.textContent = "Created";
      const timeEl = document.createElement("time");
      timeEl.className = "flow-card-meta-value";
      timeEl.dateTime = createdRaw;
      timeEl.textContent = formatCardTimestampDisplay(createdRaw);
      row.append(label, timeEl);
      meta.append(row);
    }
    if (closedRaw) {
      const row = document.createElement("div");
      row.className = "flow-card-meta-row";
      const label = document.createElement("span");
      label.className = "flow-card-meta-label";
      label.textContent = "Closed";
      const timeEl = document.createElement("time");
      timeEl.className = "flow-card-meta-value";
      timeEl.dateTime = closedRaw;
      timeEl.textContent = formatCardTimestampDisplay(closedRaw);
      row.append(label, timeEl);
      meta.append(row);
    }
    contextP.insertAdjacentElement("afterend", meta);
  }

  const form = modal.querySelector("form");
  const titleInput = modal.querySelector('input[name="title"]');
  const strategicInput = modal.querySelector('input[name="strategic"]');
  const descInput = modal.querySelector('textarea[name="description"]');

  titleInput.value = String(initial.title ?? "").trim();
  if (strategicInput) strategicInput.checked = Boolean(initial.strategic);
  descInput.value = String(initial.description ?? "");

  const ownerField = createOwnerField(
    ctx.boardUsers,
    String(initial.owner ?? "").trim()
  );
  descInput.closest(".flow-field")?.insertAdjacentElement("afterend", ownerField.root);

  const noteFieldEl = el(`
    <label class="flow-field">
      <span class="flow-field-label">Note</span>
      <input class="flow-input" name="note" type="text" maxlength="300" autocomplete="off" placeholder="Short status (optional)" />
    </label>
  `);
  ownerField.root.insertAdjacentElement("afterend", noteFieldEl);
  const noteInput = noteFieldEl.querySelector('input[name="note"]');
  if (noteInput) noteInput.value = String(initial.note ?? "").trim();

  const nextActionField = createNextActionDateField(
    String(initial.next_action_date ?? "").trim()
  );
  noteFieldEl.insertAdjacentElement("afterend", nextActionField.root);
  const nextActionInput = nextActionField.input;

  const linksEditor = createLinksEditor(
    Array.isArray(initial.links) ? initial.links : []
  );
  nextActionField.root.insertAdjacentElement("afterend", linksEditor.root);

  createCardDescriptionEditor({ modal, descInput });

  function normalizeLinks(links) {
    if (!Array.isArray(links)) return [];
    return links.map((l) => ({
      text: String(l?.text ?? "").trim(),
      url: String(l?.url ?? "").trim(),
    }));
  }

  function snapshotDraft() {
    return JSON.stringify({
      title: String(titleInput.value ?? "").trim(),
      description: String(descInput.value ?? ""),
      note: String(noteInput?.value ?? "").trim(),
      owner: ownerField.getValue(),
      strategic: Boolean(strategicInput?.checked),
      nextActionDate: String(nextActionInput?.value ?? "").trim(),
      links: normalizeLinks(linksEditor.getLinks()),
    });
  }

  let initialDraftSnapshot = snapshotDraft();

  void (async () => {
    const saved = await readLocalUserIni();
    if (!saved) return;
    const trimmed = String(saved).trim();
    if (!trimmed) return;
    if (!String(initial.owner ?? "").trim()) {
      const ownerBefore = ownerField.getValue();
      ownerField.applyLocalDefault(trimmed);
      if (ownerField.getValue() !== ownerBefore) {
        initialDraftSnapshot = snapshotDraft();
      }
    }
  })();

  modal.querySelector(".flow-btn-history-icon")?.addEventListener("click", () => {
    void openCardGitHistoryNested(ctx);
  });

  modal.querySelector(".flow-btn-copy-card-link-icon")?.addEventListener("click", () => {
    const btn = modal.querySelector(".flow-btn-copy-card-link-icon");
    if (!(btn instanceof HTMLButtonElement)) return;
    void (async () => {
      const ok = await copyCardDeepLinkToClipboard({
        boardSlug: ctx.boardSlug,
        filename: ctx.filename,
      });
      if (ok) showCopyLinkButtonCopied(btn);
    })();
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
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        await showFlowAlert("Title is required.", { title: "Edit card" });
        return false;
      }

      const description = String(fd.get("description") || "");
      const note = String(fd.get("note") || "").trim();
      const nextActionDate = String(fd.get("next_action_date") || "").trim();
      const owner = ownerField.getValue();

      try {
        await updateCard({
          boardSlug: ctx.boardSlug,
          columnIndex: ctx.columnIndex,
          filename: ctx.filename,
          title,
          description,
          note,
          owner,
          strategic: Boolean(strategicInput?.checked),
          nextActionDate,
          links: linksEditor.getLinks(),
        });
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        finish(true);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save card" });
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

    modal.querySelector(".flow-btn-duplicate-card-icon")?.addEventListener("click", () => {
      void (async () => {
        const baseTitle = String(titleInput.value || "").trim();
        if (!baseTitle) {
          await showFlowAlert("Add a title before duplicating this card.", {
            title: "Duplicate card",
          });
          return;
        }
        const laneNum = Number(ctx.swimlaneIndex);
        if (!Number.isFinite(laneNum) || laneNum < 0) {
          await showFlowAlert(
            "Missing swimlane for this card; reopen from the board.",
            { title: "Duplicate card" }
          );
          return;
        }
        const newTitle = `${baseTitle} (copy)`;
        const description = String(descInput.value || "");
        const note = String(noteInput?.value || "").trim();
        const nextActionDate = String(nextActionInput?.value || "").trim();
        const owner = ownerField.getValue();
        const links = linksWithSourceCardLink(linksEditor.getLinks(), {
          boardSlug: ctx.boardSlug,
          filename: ctx.filename,
        });
        try {
          const created = await createCard({
            boardSlug: ctx.boardSlug,
            columnIndex: ctx.columnIndex,
            swimlaneIndex: laneNum,
            title: newTitle,
            description,
            note,
            owner,
            strategic: Boolean(strategicInput?.checked),
            nextActionDate,
            links,
          });
          finish(true);
          const filename =
            String(created.filename ?? "").trim() ||
            (created.id ? `${String(created.id).trim()}.ini` : "");
          if (filename) {
            queueCardEditorOpenAfterRefresh({
              boardSlug: ctx.boardSlug,
              columnIndex: ctx.columnIndex,
              filename,
              columnTitle: ctx.columnTitle,
              swimlaneIndex: ctx.swimlaneIndex,
              swimlaneTitle: ctx.swimlaneTitle,
              boardUsers: ctx.boardUsers,
            });
          }
          document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showFlowAlert(msg, { title: "Could not duplicate card" });
        }
      })();
    });

    modal.querySelector(".flow-btn-delete-icon")?.addEventListener("click", () => {
      void (async () => {
        const ok = await showFlowConfirm(
          "Abandon this card? It will be removed from the board and moved to the abandoned folder.",
          {
            title: "Abandon card",
            confirmLabel: "Abandon",
            cancelLabel: "Cancel",
            destructive: true,
          }
        );
        if (!ok) return;
        try {
          await abandonCard({
            boardSlug: ctx.boardSlug,
            columnIndex: ctx.columnIndex,
            filename: ctx.filename,
          });
          document.dispatchEvent(new CustomEvent("flow:refresh-board"));
          finish(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showFlowAlert(msg, { title: "Could not abandon card" });
        }
      })();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveDraft();
    });

    modal.showModal();
    titleInput.focus();
    titleInput.select();
  });
}
