import { boardSlugFrom } from "../html/slug.js";
import { el } from "../html/element.js";
import { escapeHtml } from "../html/escape.js";
import { renameBoardDefinition } from "../client.js";
import { showFlowAlert } from "../ui/showMessage.js";
import {
  readStoredActiveBoardSlug,
  writeStoredActiveBoardSlug,
} from "../ui/boardSelector.js";

/**
 * @param {{ boardSlug: string, displayName: string, configFile: string }} ctx
 * @returns {Promise<boolean>}
 */
export async function openRenameBoardDialog(ctx) {
  const modal = el(`
    <dialog class="flow-modal flow-modal--rename-board" aria-labelledby="flow-rename-board-title" aria-describedby="flow-rename-board-context">
      <h2 id="flow-rename-board-title" class="flow-modal-title">Rename board</h2>
      <p id="flow-rename-board-context" class="flow-modal-context flow-modal-context--board">${escapeHtml(ctx.displayName)} · <code class="flow-board-editor-file">${escapeHtml(ctx.configFile)}</code></p>
      <form class="flow-modal-form flow-modal-form--rename-board">
        <label class="flow-field">
          <span class="flow-field-label">Board name</span>
          <input class="flow-input" name="boardName" type="text" required autocomplete="off" maxlength="120" />
        </label>
        <p class="flow-rename-board-slug-preview" aria-live="polite"></p>
        <p class="flow-modal-context flow-rename-board-note">
          Renaming updates the board slug, config file, and <code>tasks/</code> folder to match. Use Admin → Edit board to change columns and swimlanes.
        </p>
        <div class="flow-modal-actions">
          <button type="button" class="flow-btn flow-btn-ghost flow-cancel">Cancel</button>
          <button type="submit" class="flow-btn flow-btn-primary">Rename</button>
        </div>
      </form>
    </dialog>
  `);

  document.body.append(modal);

  const form = modal.querySelector("form");
  const nameInput = modal.querySelector('input[name="boardName"]');
  const slugPreview = modal.querySelector(".flow-rename-board-slug-preview");
  if (!(nameInput instanceof HTMLInputElement) || !slugPreview) {
    modal.remove();
    return false;
  }

  nameInput.value = ctx.displayName;

  function updateSlugPreview() {
    const name = String(nameInput.value ?? "").trim();
    if (!name) {
      slugPreview.textContent = "";
      return;
    }
    const slug = boardSlugFrom({ name });
    const folder = `tasks/${slug}/`;
    const file = `${slug}.ini`;
    if (slug === ctx.boardSlug && name === ctx.displayName) {
      slugPreview.textContent = "No changes yet.";
      return;
    }
    const parts = [`Slug: ${slug}`, `File: ${file}`];
    if (slug !== ctx.boardSlug) {
      parts.push(`Folder: ${folder}`);
    }
    slugPreview.textContent = parts.join(" · ");
  }

  nameInput.addEventListener("input", updateSlugPreview);
  updateSlugPreview();

  let settled = false;

  return new Promise((resolve) => {
    function finish(ok) {
      if (settled) return;
      settled = true;
      modal.close();
      modal.remove();
      resolve(ok);
    }

    async function submitRename() {
      const name = String(nameInput.value ?? "").trim();
      if (!name) {
        await showFlowAlert("Board name is required.", { title: "Rename board" });
        return;
      }
      if (name === ctx.displayName) {
        finish(false);
        return;
      }

      try {
        const result = await renameBoardDefinition({
          boardSlug: ctx.boardSlug,
          name,
        });
        const active = readStoredActiveBoardSlug();
        if (active === ctx.boardSlug || active === result.oldSlug) {
          writeStoredActiveBoardSlug(result.slug);
        }
        document.dispatchEvent(new CustomEvent("flow:admin-refresh"));
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        finish(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not rename board" });
      }
    }

    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) finish(false);
    });

    modal.querySelector(".flow-cancel")?.addEventListener("click", () => {
      finish(false);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void submitRename();
    });

    modal.showModal();
    nameInput.focus();
    nameInput.select();
  });
}
