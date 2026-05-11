import { createLinksEditor } from "../ui/cardLinks.js";
import { createNextActionDateField } from "../ui/nextActionDateField.js";
import { createOwnerField } from "../ui/selectOwner.js";
import { createCard, readLocalUserIni } from "../client.js";
import { el } from "../html/element.js";
import { escapeHtml } from "../html/escape.js";
import { showFlowConfirm } from "../ui/showMessage.js";

/**
 * @param {{ boardSlug: string, columnIndex: number, columnTitle: string, swimlaneIndex: number, swimlaneTitle?: string, boardUsers?: import("../models/boardModel.js").BoardUserDef[] }} ctx
 * @returns {Promise<boolean>} true if a card file was written
 */
export function openAddCardDialog(ctx) {
  const modal = el(`
    <dialog class="flow-modal" aria-labelledby="flow-add-card-title" aria-describedby="flow-add-card-context">
      <h2 id="flow-add-card-title" class="flow-modal-title">New card</h2>
      <p id="flow-add-card-context" class="flow-modal-context">${escapeHtml(ctx.columnTitle)}${ctx.swimlaneTitle ? ` · ${escapeHtml(ctx.swimlaneTitle)}` : ""}</p>
      <form class="flow-modal-form">
        <label class="flow-field">
          <span class="flow-field-label">Title</span>
          <input class="flow-input" name="title" type="text" required autocomplete="off" placeholder="What needs doing?" />
        </label>
        <label class="flow-field">
          <span class="flow-field-label">Description</span>
          <textarea class="flow-input flow-textarea" name="description" rows="3" placeholder="Optional"></textarea>
        </label>
        <div class="flow-modal-actions">
          <button type="button" class="flow-btn flow-btn-ghost flow-cancel">Cancel</button>
          <button type="submit" class="flow-btn flow-btn-primary">Create</button>
        </div>
      </form>
    </dialog>
  `);

  document.body.append(modal);

  const form = modal.querySelector("form");
  const titleInput = modal.querySelector('input[name="title"]');
  const descInput = modal.querySelector('textarea[name="description"]');
  const ownerField = createOwnerField(ctx.boardUsers, "");
  descInput?.closest(".flow-field")?.insertAdjacentElement("afterend", ownerField.root);
  const noteFieldEl = el(`
    <label class="flow-field">
      <span class="flow-field-label">Note</span>
      <input class="flow-input" name="note" type="text" maxlength="300" autocomplete="off" placeholder="Short status (optional)" />
    </label>
  `);
  ownerField.root.insertAdjacentElement("afterend", noteFieldEl);
  const noteInput = noteFieldEl.querySelector('input[name="note"]');
  const nextActionField = createNextActionDateField("");
  noteFieldEl.insertAdjacentElement("afterend", nextActionField.root);
  const nextActionInput = nextActionField.input;
  const linksEditor = createLinksEditor([]);
  nextActionField.root.insertAdjacentElement("afterend", linksEditor.root);

  function focusTitle() {
    titleInput?.focus();
  }

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
      nextActionDate: String(nextActionInput?.value ?? "").trim(),
      links: normalizeLinks(linksEditor.getLinks()),
    });
  }

  let initialDraftSnapshot = snapshotDraft();

  void (async () => {
    const saved = await readLocalUserIni();
    if (!saved) return;
    const trimmed = String(saved).trim();
    const ownerBefore = ownerField.getValue();
    ownerField.applyLocalDefault(trimmed);
    if (ownerField.getValue() !== ownerBefore) {
      initialDraftSnapshot = snapshotDraft();
    }
  })();

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

    function showErr(msg) {
      let bar = modal.querySelector(".flow-modal-error");
      if (!bar) {
        bar = el(`<p class="flow-modal-error" role="alert"></p>`);
        form.insertAdjacentElement("beforebegin", bar);
      }
      bar.textContent = msg;
    }

    async function tryCreateCard() {
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        showErr("Title is required.");
        return false;
      }

      const description = String(fd.get("description") || "");
      const note = String(fd.get("note") || "").trim();
      const nextActionDate = String(fd.get("next_action_date") || "").trim();
      const owner = ownerField.getValue();

      try {
        await createCard({
          boardSlug: ctx.boardSlug,
          columnIndex: ctx.columnIndex,
          swimlaneIndex: ctx.swimlaneIndex,
          title,
          description,
          note,
          owner,
          nextActionDate,
          links: linksEditor.getLinks(),
        });
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        finish(true);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showErr(msg);
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
      const shouldCreate = await showFlowConfirm(
        "You have unsaved changes. Create this card before closing?",
        {
          title: "Unsaved changes",
          confirmLabel: "Create",
          cancelLabel: "Discard",
          allowEscapeDismiss: false,
          allowBackdropDismiss: false,
        }
      );
      closeInProgress = false;
      if (settled) return;
      if (shouldCreate) {
        await tryCreateCard();
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

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void tryCreateCard();
    });

    modal.showModal();
    focusTitle();
    requestAnimationFrame(focusTitle);
  });
}
