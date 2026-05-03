import { createLinksEditor } from "./cardLinksUi.js";
import { showFlowAlert, showFlowConfirm } from "./flowDialogs.js";
import { createOwnerField } from "./flowOwnerField.js";
import {
  deleteCard,
  fetchCard,
  fetchCardGitHistory,
  readLocalUserIni,
  updateCard,
} from "./repoAccess.js";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
 * @param {{ boardSlug: string, columnIndex: number, filename: string, columnTitle: string, swimlaneTitle?: string, boardUsers?: import("./boardModel.js").BoardUserDef[] }} ctx
 * @returns {Promise<boolean>} true if saved
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
    <div class="flow-modal flow-modal--edit-card" role="dialog" aria-modal="true" aria-labelledby="flow-edit-card-title">
      <div class="flow-modal-header flow-modal-header--edit-card">
        <h2 id="flow-edit-card-title" class="flow-modal-title">Edit card</h2>
        <button
          type="button"
          class="flow-btn flow-btn-icon flow-btn-history-icon"
          aria-label="Git commit history for this card"
          title="Git history"
        >
          <svg class="flow-history-icon-svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
        </button>
      </div>
      <p class="flow-modal-context">${escapeHtml(ctx.columnTitle)}${ctx.swimlaneTitle ? ` · ${escapeHtml(ctx.swimlaneTitle)}` : ""}</p>
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

  titleInput.focus();
  titleInput.select();

  void (async () => {
    const saved = await readLocalUserIni();
    if (!saved) return;
    const trimmed = String(saved).trim();
    if (!trimmed) return;
    if (!String(initial.owner ?? "").trim()) {
      ownerField.applyLocalDefault(trimmed);
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
        await showFlowAlert("Title is required.", { title: "Edit card" });
        return;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save card" });
      }
    });
  });
}
