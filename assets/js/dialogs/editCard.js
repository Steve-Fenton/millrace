import { createLinksEditor } from "../ui/cardLinks.js";
import { renderLimitedMarkdown } from "../ui/limitedMarkdown.js";
import { showFlowAlert, showFlowConfirm } from "../ui/showMessage.js";
import { createOwnerField } from "../ui/selectOwner.js";
import {
  createCard,
  deleteCard,
  fetchCard,
  fetchCardGitHistory,
  readLocalUserIni,
  updateCard,
} from "../client.js";
import { el } from "../html/element.js";
import { escapeHtml } from "../html/escape.js";
import { beginModalFocusTrap } from "../ui/modalFocusTrap.js";

/**
 * @param {{ boardSlug: string, columnIndex: number, filename: string }} ctx
 */
async function openCardGitHistoryNested(ctx) {
  const nestedBackdrop = el(`
    <div class="flow-modal-backdrop flow-modal-backdrop--nested" tabindex="-1"></div>
  `);
  const histModal = el(`
    <div class="flow-modal flow-modal--git-history" role="dialog" aria-modal="true" aria-labelledby="flow-git-history-title">
      <h3 id="flow-git-history-title" class="flow-modal-title">Git history</h3>
      <p class="flow-git-history-meta flow-git-history-path">Loading…</p>
      <div class="flow-git-history-list" role="list"></div>
      <div class="flow-modal-actions flow-modal-actions--history">
        <button type="button" class="flow-btn flow-btn-primary flow-git-history-close">Close</button>
      </div>
    </div>
  `);
  nestedBackdrop.append(histModal);
  document.body.append(nestedBackdrop);

  const releaseNestedFocus = beginModalFocusTrap(nestedBackdrop);

  const pathEl = histModal.querySelector(".flow-git-history-path");
  const listEl = histModal.querySelector(".flow-git-history-list");

  function closeNested() {
    document.removeEventListener("keydown", onEscCapture, true);
    releaseNestedFocus();
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

  histModal.querySelector(".flow-git-history-close")?.focus();

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
  /** @type {{ title?: string, description?: string, owner?: string, created?: string, closed?: string, links?: { text?: string, url?: string }[] }} */
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

  const backdrop = el(`
    <div class="flow-modal-backdrop" role="presentation"></div>
  `);
  const modal = el(`
    <div class="flow-modal flow-modal--edit-card" role="dialog" aria-modal="true" aria-labelledby="flow-edit-card-title" aria-describedby="flow-edit-card-context">
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
        </div>
      </div>
      <p id="flow-edit-card-context" class="flow-modal-context">${escapeHtml(ctx.columnTitle)}${ctx.swimlaneTitle ? ` · ${escapeHtml(ctx.swimlaneTitle)}` : ""}</p>
      <form class="flow-modal-form">
        <label class="flow-field">
          <span class="flow-field-label">Title</span>
          <input class="flow-input" name="title" type="text" required autocomplete="off" placeholder="What needs doing?" />
        </label>
        <label class="flow-field">
          <span class="flow-field-label">Description</span>
          <textarea class="flow-input flow-textarea flow-textarea--edit-description" name="description" rows="12" placeholder="Optional"></textarea>
        </label>
        <div class="flow-modal-actions flow-modal-actions--split">
          <button
            type="button"
            class="flow-btn flow-btn-delete-icon"
            aria-label="Delete card"
            title="Delete card"
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

  const releaseFocusTrap = beginModalFocusTrap(backdrop);

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
  const descInput = modal.querySelector('textarea[name="description"]');
  const descField = descInput.closest(".flow-field");
  descField?.classList.add("flow-field--description");
  const descriptionIdSuffix = Math.random().toString(36).slice(2, 8);
  const descriptionTabListId = `flow-description-tabs-${descriptionIdSuffix}`;
  const previewTabId = `flow-description-preview-tab-${descriptionIdSuffix}`;
  const editTabId = `flow-description-edit-tab-${descriptionIdSuffix}`;
  const previewPanelId = `flow-description-preview-panel-${descriptionIdSuffix}`;
  const editPanelId = `flow-description-edit-panel-${descriptionIdSuffix}`;
  const descToolbar = document.createElement("div");
  descToolbar.className = "flow-description-toolbar";
  const descTabs = document.createElement("div");
  descTabs.className = "flow-description-tabs";
  descTabs.id = descriptionTabListId;
  descTabs.setAttribute("role", "tablist");
  descTabs.setAttribute("aria-label", "Description mode");
  const descPreviewTab = document.createElement("button");
  descPreviewTab.type = "button";
  descPreviewTab.className = "flow-description-tab";
  descPreviewTab.id = previewTabId;
  descPreviewTab.textContent = "Preview";
  descPreviewTab.setAttribute("role", "tab");
  descPreviewTab.setAttribute("aria-controls", previewPanelId);
  const descEditTab = document.createElement("button");
  descEditTab.type = "button";
  descEditTab.className = "flow-description-tab";
  descEditTab.id = editTabId;
  descEditTab.textContent = "Edit";
  descEditTab.setAttribute("role", "tab");
  descEditTab.setAttribute("aria-controls", editPanelId);
  descTabs.append(descPreviewTab, descEditTab);
  const descExpandToggle = document.createElement("button");
  descExpandToggle.type = "button";
  descExpandToggle.className =
    "flow-btn flow-btn-icon flow-description-expand-toggle";
  descExpandToggle.setAttribute("aria-pressed", "false");
  const expandIcon = document.createElement("span");
  expandIcon.className = "flow-description-expand-icon";
  expandIcon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  descExpandToggle.append(expandIcon);
  descToolbar.append(descTabs, descExpandToggle);
  descInput.insertAdjacentElement("beforebegin", descToolbar);
  descInput.id = editPanelId;
  descInput.setAttribute("role", "tabpanel");
  descInput.setAttribute("aria-labelledby", editTabId);
  const descPreview = document.createElement("div");
  descPreview.className = "flow-description-preview";
  descPreview.id = previewPanelId;
  descPreview.setAttribute("role", "tabpanel");
  descPreview.setAttribute("aria-labelledby", previewTabId);
  descField?.append(descPreview);

  titleInput.value = String(initial.title ?? "").trim();
  descInput.value = String(initial.description ?? "");

  const ownerField = createOwnerField(
    ctx.boardUsers,
    String(initial.owner ?? "").trim()
  );
  descInput.closest(".flow-field")?.insertAdjacentElement("afterend", ownerField.root);

  const linksEditor = createLinksEditor(
    Array.isArray(initial.links) ? initial.links : []
  );
  ownerField.root.insertAdjacentElement("afterend", linksEditor.root);

  /** @type {boolean | null} */
  let showingDescriptionPreview = null;
  let descriptionEditorExpanded = false;

  function syncDescriptionExpandUi() {
    modal.classList.toggle(
      "flow-modal--description-expanded",
      descriptionEditorExpanded
    );
    descField?.classList.toggle(
      "flow-field--description-expanded",
      descriptionEditorExpanded
    );
    const action = descriptionEditorExpanded ? "Collapse" : "Expand";
    descExpandToggle.setAttribute(
      "aria-label",
      `${action} description editor`
    );
    descExpandToggle.title = `${action} description editor`;
    descExpandToggle.setAttribute(
      "aria-pressed",
      String(descriptionEditorExpanded)
    );
  }

  function refreshDescriptionPreview() {
    renderLimitedMarkdown(descPreview, descInput.value);
  }
  function syncDescriptionPreviewHeight(editorHeightPx) {
    const resolvedHeight =
      Number.isFinite(editorHeightPx) && editorHeightPx > 0
        ? editorHeightPx
        : descInput.offsetHeight || descPreview.offsetHeight;
    if (!Number.isFinite(resolvedHeight) || resolvedHeight <= 0) return;
    descPreview.style.minHeight = `${resolvedHeight}px`;
  }
  function setDescriptionExpanded(nextExpanded, opts = {}) {
    const next = Boolean(nextExpanded);
    if (descriptionEditorExpanded === next) return;
    descriptionEditorExpanded = next;
    syncDescriptionExpandUi();
    requestAnimationFrame(() => {
      syncDescriptionPreviewHeight(descInput.offsetHeight || descPreview.offsetHeight);
      if (showingDescriptionPreview) refreshDescriptionPreview();
      if (!showingDescriptionPreview && opts.focusEditor) {
        descInput.focus();
      }
    });
  }
  function setDescriptionMode(mode, opts = {}) {
    const nextIsPreview = mode === "preview";
    if (showingDescriptionPreview === nextIsPreview) return;
    const editorHeightBeforeToggle = descInput.offsetHeight;
    showingDescriptionPreview = nextIsPreview;
    descPreview.hidden = !nextIsPreview;
    descInput.hidden = nextIsPreview;
    descPreviewTab.classList.toggle(
      "flow-description-tab--active",
      nextIsPreview
    );
    descPreviewTab.setAttribute("aria-selected", String(nextIsPreview));
    descPreviewTab.tabIndex = nextIsPreview ? 0 : -1;
    descEditTab.classList.toggle("flow-description-tab--active", !nextIsPreview);
    descEditTab.setAttribute("aria-selected", String(!nextIsPreview));
    descEditTab.tabIndex = nextIsPreview ? -1 : 0;
    descExpandToggle.hidden = nextIsPreview;
    descExpandToggle.disabled = nextIsPreview;
    descExpandToggle.tabIndex = nextIsPreview ? -1 : 0;
    if (nextIsPreview) {
      syncDescriptionPreviewHeight(editorHeightBeforeToggle);
      refreshDescriptionPreview();
      return;
    }
    if (opts.focusEditor) {
      descInput.focus();
      const len = descInput.value.length;
      descInput.setSelectionRange(len, len);
    }
  }

  syncDescriptionExpandUi();
  refreshDescriptionPreview();
  setDescriptionMode("preview");
  descExpandToggle.addEventListener("click", () => {
    setDescriptionExpanded(!descriptionEditorExpanded, {
      focusEditor: !showingDescriptionPreview,
    });
  });
  descPreviewTab.addEventListener("click", () => {
    setDescriptionMode("preview");
  });
  descEditTab.addEventListener("click", () => {
    setDescriptionMode("edit", { focusEditor: true });
  });
  descTabs.addEventListener("keydown", (ev) => {
    const tabOrder = [descPreviewTab, descEditTab];
    const currentIndex = tabOrder.findIndex((tab) => tab === document.activeElement);
    if (currentIndex < 0) return;
    let targetIndex = -1;
    if (ev.key === "ArrowRight") targetIndex = (currentIndex + 1) % tabOrder.length;
    if (ev.key === "ArrowLeft") targetIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    if (ev.key === "Home") targetIndex = 0;
    if (ev.key === "End") targetIndex = tabOrder.length - 1;
    if (targetIndex < 0) return;
    ev.preventDefault();
    const nextTab = tabOrder[targetIndex];
    nextTab.focus();
    if (nextTab === descPreviewTab) {
      setDescriptionMode("preview");
      return;
    }
    setDescriptionMode("edit");
  });

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
      owner: ownerField.getValue(),
      links: normalizeLinks(linksEditor.getLinks()),
    });
  }

  let initialDraftSnapshot = snapshotDraft();

  titleInput.focus();
  titleInput.select();

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

  let settled = false;

  return new Promise((resolve) => {
    function finish(ok) {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onEsc);
      releaseFocusTrap();
      backdrop.remove();
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
      const owner = ownerField.getValue();

      try {
        await updateCard({
          boardSlug: ctx.boardSlug,
          columnIndex: ctx.columnIndex,
          filename: ctx.filename,
          title,
          description,
          owner,
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

    function onEsc(ev) {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      void requestClose();
    }

    let backdropPointerDown = false;
    backdrop.addEventListener("pointerdown", (e) => {
      backdropPointerDown = e.target === backdrop;
    });
    backdrop.addEventListener("click", (e) => {
      const isFullBackdropClick = backdropPointerDown && e.target === backdrop;
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
        const owner = ownerField.getValue();
        const links = linksEditor.getLinks();
        try {
          await createCard({
            boardSlug: ctx.boardSlug,
            columnIndex: ctx.columnIndex,
            swimlaneIndex: laneNum,
            title: newTitle,
            description,
            owner,
            links,
          });
          document.dispatchEvent(new CustomEvent("flow:refresh-board"));
          finish(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showFlowAlert(msg, { title: "Could not duplicate card" });
        }
      })();
    });

    modal.querySelector(".flow-btn-delete-icon")?.addEventListener("click", () => {
      void (async () => {
        const ok = await showFlowConfirm(
          "Delete this card permanently? This removes the task file from disk.",
          {
            title: "Delete card",
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
            destructive: true,
          }
        );
        if (!ok) return;
        try {
          await deleteCard({
            boardSlug: ctx.boardSlug,
            columnIndex: ctx.columnIndex,
            filename: ctx.filename,
          });
          document.dispatchEvent(new CustomEvent("flow:refresh-board"));
          finish(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showFlowAlert(msg, { title: "Could not delete card" });
        }
      })();
    });

    document.addEventListener("keydown", onEsc);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveDraft();
    });
  });
}
