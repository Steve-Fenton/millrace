import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import {
  fetchLocalUserPreferences,
  patchLocalUserPreferences,
} from "../client.js";
import { showFlowAlert } from "../ui/showMessage.js";
import { escapeHtml } from "../html/escape.js";

/**
 * @param {{ syncMode: "automatic" | "manual" }} initial
 */
function renderPreferencesForm(initial) {
  const form = document.createElement("form");
  form.className = "preferences-form";

  const grid = document.createElement("div");
  grid.className = "preferences-grid";

  const syncLabel = document.createElement("label");
  syncLabel.className = "flow-field preferences-field";
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

  grid.append(syncLabel);

  const actions = document.createElement("div");
  actions.className = "preferences-form-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "flow-btn flow-btn-primary";
  saveBtn.textContent = "Save";
  actions.append(saveBtn);

  form.append(grid, actions);

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
  root.className = "board-shell admin-shell preferences-shell";

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

  const panel = document.createElement("div");
  panel.className = "preferences-panel";

  const secTitle = document.createElement("h2");
  secTitle.className =
    "charts-section-title preferences-panel__title";
  secTitle.textContent = "Local preferences";
  const blurb = document.createElement("p");
  blurb.className = "flow-modal-context preferences-panel__intro";
  blurb.innerHTML = `Stored in <code class="flow-board-editor-file">${escapeHtml("tasks/localuser.ini")}</code> under <code class="flow-board-editor-file">[preferences]</code>.`;

  panel.append(secTitle, blurb, form);
  body.append(panel);
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
