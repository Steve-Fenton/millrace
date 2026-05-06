import { createLinksEditor } from "./cardLinksUi.js";
import { createOwnerField } from "./flowOwnerField.js";
import { createCard, readLocalUserIni } from "./repoAccess.js";
import { escapeHtml } from "./escapeHtml.js";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/**
 * @param {{ boardSlug: string, columnIndex: number, columnTitle: string, swimlaneIndex: number, swimlaneTitle?: string, boardUsers?: import("./models/boardModel.js").BoardUserDef[] }} ctx
 * @returns {Promise<boolean>} true if a card file was written
 */
export function openAddCardDialog(ctx) {
  const backdrop = el(`
    <div class="flow-modal-backdrop" role="presentation"></div>
  `);
  const modal = el(`
    <div class="flow-modal" role="dialog" aria-modal="true" aria-labelledby="flow-add-card-title">
      <h2 id="flow-add-card-title" class="flow-modal-title">New card</h2>
      <p class="flow-modal-context">${escapeHtml(ctx.columnTitle)}${ctx.swimlaneTitle ? ` · ${escapeHtml(ctx.swimlaneTitle)}` : ""}</p>
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
    </div>
  `);

  backdrop.append(modal);
  document.body.append(backdrop);

  const form = modal.querySelector("form");
  const titleInput = modal.querySelector('input[name="title"]');
  const descInput = modal.querySelector('textarea[name="description"]');
  const ownerField = createOwnerField(ctx.boardUsers, "");
  descInput?.closest(".flow-field")?.insertAdjacentElement("afterend", ownerField.root);
  const linksEditor = createLinksEditor([]);
  ownerField.root.insertAdjacentElement("afterend", linksEditor.root);

  function focusTitle() {
    titleInput?.focus();
  }
  focusTitle();
  requestAnimationFrame(focusTitle);

  void (async () => {
    const saved = await readLocalUserIni();
    if (!saved) return;
    ownerField.applyLocalDefault(String(saved).trim());
  })();

  let settled = false;

  return new Promise((resolve) => {
    function finish(ok) {
      if (settled) return;
      settled = true;
      backdrop.remove();
      resolve(ok);
    }

    function showErr(msg) {
      let bar = modal.querySelector(".flow-modal-error");
      if (!bar) {
        bar = el(`<p class="flow-modal-error" role="alert"></p>`);
        form.insertAdjacentElement("beforebegin", bar);
      }
      bar.textContent = msg;
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(false);
    });

    modal.querySelector(".flow-cancel").addEventListener("click", () => finish(false));

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
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        showErr("Title is required.");
        return;
      }

      const description = String(fd.get("description") || "");
      const owner = ownerField.getValue();

      try {
        await createCard({
          boardSlug: ctx.boardSlug,
          columnIndex: ctx.columnIndex,
          swimlaneIndex: ctx.swimlaneIndex,
          title,
          description,
          owner,
          links: linksEditor.getLinks(),
        });
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        finish(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showErr(msg);
      }
    });
  });
}
