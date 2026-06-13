import { fetchMillraceUsers, patchMillraceUsers } from "../client.js";
import { createSortableBoardUserList } from "../ui/boardOrderedRowsEditor.js";
import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import { setFlowDocumentTitle } from "../ui/documentTitle.js";
import { escapeHtml } from "../html/escape.js";
import { initFlowTheme } from "../ui/applyTheme.js";
import { showFlowAlert, showFlowToast } from "../ui/showMessage.js";

/**
 * @param {{ email: string, name: string, active?: boolean, admin?: boolean }[]} initial
 */
function renderUsersForm(initial) {
  const form = document.createElement("form");
  form.className = "preferences-form";

  const userEditor = createSortableBoardUserList(initial, {
    label: "Users (use arrows to reorder)",
    hint: "Stored in tasks/.millrace.ini as [users.N] sections. Tick Admin for users who run owner-only background tasks on their machine. Deactivate keeps the record but marks the user inactive.",
    addLabel: "Add user",
    showAdmin: true,
  });

  const actions = document.createElement("div");
  actions.className = "preferences-form-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "flow-btn flow-btn-primary";
  saveBtn.textContent = "Save";
  actions.append(saveBtn);

  form.append(userEditor.root, actions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      const rawRows = userEditor.getRows();
      const seenEmails = new Set();
      for (const r of rawRows) {
        const em = String(r.email ?? "").trim();
        const nm = String(r.name ?? "").trim();
        if (!em && !nm) continue;
        if (!em) {
          await showFlowAlert(
            "Each user row needs an email (or clear the display name on that row).",
            { title: "Users" }
          );
          return;
        }
        if (!em.includes("@")) {
          await showFlowAlert(`Invalid email for user: ${em}`, { title: "Users" });
          return;
        }
        const low = em.toLowerCase();
        if (seenEmails.has(low)) {
          await showFlowAlert(`Duplicate user email: ${em}`, { title: "Users" });
          return;
        }
        seenEmails.add(low);
      }

      saveBtn.disabled = true;
      try {
        await patchMillraceUsers(rawRows);
        showFlowToast("Users saved.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save users" });
      } finally {
        saveBtn.disabled = false;
      }
    })();
  });

  return form;
}

/**
 * @param {HTMLElement} form
 */
function renderUsersShell(form) {
  setFlowDocumentTitle("Users");
  const root = document.createElement("div");
  root.className = "board-shell admin-shell preferences-shell users-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";
  const brand = createMillraceBrandMark();
  const title = document.createElement("h1");
  title.className = "board-title";
  title.textContent = "Users";
  topLeft.append(brand, title);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";
  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "Millrace";
  const navMenu = createFlowNavMenu({ current: "users" });
  topActions.append(badge, navMenu);
  top.append(topLeft, topActions);

  const body = document.createElement("div");
  body.className = "admin-body";

  const panel = document.createElement("div");
  panel.className = "preferences-panel";

  const secTitle = document.createElement("h2");
  secTitle.className = "charts-section-title preferences-panel__title";
  secTitle.textContent = "Millrace users";
  const blurb = document.createElement("p");
  blurb.className = "flow-modal-context preferences-panel__intro";
  blurb.innerHTML = `Stored in <code class="flow-board-editor-file">${escapeHtml("tasks/.millrace.ini")}</code> as <code class="flow-board-editor-file">[users.N]</code> sections (email, name, and optional <code class="flow-board-editor-file">admin</code>).`;

  panel.append(secTitle, blurb, form);
  body.append(panel);
  root.append(top, body);
  return root;
}

async function main() {
  void initFlowTheme();
  const mount = document.getElementById("app");
  if (!mount) return;
  setFlowDocumentTitle("Users");
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;
  try {
    const initial = await fetchMillraceUsers();
    mount.replaceChildren();
    mount.append(renderUsersShell(renderUsersForm(initial)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load users: ${escapeHtml(msg)}</div>`;
  }
}

void main();
