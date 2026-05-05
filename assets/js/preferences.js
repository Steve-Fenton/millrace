import { createFlowNavMenu } from "./flowNavMenu.js";
import { createMillraceBrandMark } from "./millraceBrandMark.js";
import {
  fetchLocalUserPreferences,
  patchLocalUserPreferences,
} from "./repoAccess.js";
import { showFlowAlert } from "./flowDialogs.js";
import { escapeHtml } from "./escapeHtml.js";

/**
 * @param {{ syncMode: "automatic" | "manual" }} initial
 */
function renderPreferencesForm(initial) {
  const form = document.createElement("form");
  form.className = "flow-modal-form preferences-form";

  const syncLabel = document.createElement("label");
  syncLabel.className = "flow-field";
  const syncSpan = document.createElement("span");
  syncSpan.className = "flow-field-label";
  syncSpan.textContent = "Sync mode";
  const syncSelect = document.createElement("select");
  syncSelect.className = "flow-input";
  syncSelect.name = "syncMode";
  syncSelect.setAttribute("aria-label", "Sync mode");
  for (const { value, label } of [
    { value: "automatic", label: "Automatic" },
    { value: "manual", label: "Manual" },
  ]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    syncSelect.append(opt);
  }
  syncSelect.value = initial.syncMode;
  syncLabel.append(syncSpan, syncSelect);

  const actions = document.createElement("div");
  actions.className = "flow-modal-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "flow-btn flow-btn-primary";
  saveBtn.textContent = "Save";
  actions.append(saveBtn);

  form.append(syncLabel, actions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v =
      String(syncSelect.value || "").trim() === "manual"
        ? "manual"
        : "automatic";
    void (async () => {
      saveBtn.disabled = true;
      try {
        await patchLocalUserPreferences({ syncMode: v });
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await showFlowAlert(msg, { title: "Could not save preferences" });
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
function renderPreferencesShell(form) {
  const root = document.createElement("div");
  root.className = "board-shell admin-shell";

  const top = document.createElement("div");
  top.className = "board-top";

  const topLeft = document.createElement("div");
  topLeft.className = "board-top-left";
  const brand = createMillraceBrandMark();
  const title = document.createElement("h1");
  title.className = "board-title";
  title.textContent = "Preferences";
  topLeft.append(brand, title);

  const topActions = document.createElement("div");
  topActions.className = "board-top-actions";
  const badge = document.createElement("span");
  badge.className = "board-badge";
  badge.textContent = "This device";
  const navMenu = createFlowNavMenu({ current: "preferences" });
  topActions.append(badge, navMenu);
  top.append(topLeft, topActions);

  const body = document.createElement("div");
  body.className = "admin-body";
  const secTitle = document.createElement("h2");
  secTitle.className = "charts-section-title";
  secTitle.textContent = "Local preferences";
  const blurb = document.createElement("p");
  blurb.className = "flow-modal-context";
  blurb.innerHTML = `Stored in <code class="flow-board-editor-file">${escapeHtml("tasks/localuser.ini")}</code> under <code class="flow-board-editor-file">[preferences]</code> (this page only edits that section).`;
  body.append(secTitle, blurb, form);
  root.append(top, body);
  return root;
}

async function main() {
  const mount = document.getElementById("app");
  if (!mount) return;
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;
  try {
    const initial = await fetchLocalUserPreferences();
    mount.replaceChildren();
    mount.append(renderPreferencesShell(renderPreferencesForm(initial)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load preferences: ${escapeHtml(msg)}</div>`;
  }
}

void main();
