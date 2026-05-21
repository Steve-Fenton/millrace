import { createFlowNavMenu } from "../ui/menu.js";
import { createMillraceBrandMark } from "../ui/brandMark.js";
import { setFlowDocumentTitle } from "../ui/documentTitle.js";
import {
  fetchLocalUserPreferences,
  patchLocalUserPreferences,
} from "../client.js";
import { showFlowAlert, showFlowToast } from "../ui/showMessage.js";
import { escapeHtml } from "../html/escape.js";
import { applyFlowTheme } from "../ui/applyTheme.js";

/**
 * @param {{ lastAutoGitPull: string, lastNpmUpdateCheck: string }} initial
 */
function renderPreferencesFlowTimestamps(initial) {
  const wrap = document.createElement("div");
  wrap.className = "preferences-flow-timestamps";

  const heading = document.createElement("h3");
  heading.className = "preferences-flow-timestamps__title";
  heading.textContent = "Background activity";

  /**
   * @param {string | undefined} iso
   */
  function formatIso(iso) {
    const s = String(iso ?? "").trim();
    if (!s) return "—";
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
   * @param {"git" | "npm"} which
   */
  function row(label, iso, which) {
    const rowEl = document.createElement("div");
    rowEl.className = "preferences-flow-timestamp-row";

    const lab = document.createElement("span");
    lab.className = "preferences-flow-timestamp-label";
    lab.textContent = label;

    const val = document.createElement("span");
    val.className = "preferences-flow-timestamp-value";
    val.textContent = formatIso(iso);

    rowEl.append(lab, val);

    const raw = String(iso ?? "").trim();
    if (raw) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className =
        "flow-btn flow-btn-ghost flow-btn-icon preferences-flow-clear";
      clearBtn.setAttribute(
        "aria-label",
        which === "git"
          ? "Clear last automatic git pull timestamp"
          : "Clear last npm update check timestamp"
      );
      clearBtn.innerHTML =
        '<svg class="preferences-flow-clear-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 4l6 6M10 4l-6 6"/></svg>';
      clearBtn.addEventListener("click", () => {
        void (async () => {
          clearBtn.disabled = true;
          try {
            await patchLocalUserPreferences(
              which === "git"
                ? { clearLastAutoGitPull: true }
                : { clearLastNpmUpdateCheck: true }
            );
            const fresh = await fetchLocalUserPreferences();
            rebuild(fresh);
            showFlowToast(
              which === "git"
                ? "Cleared git pull timestamp."
                : "Cleared npm check timestamp."
            );
          } catch (err) {
            clearBtn.disabled = false;
            const msg = err instanceof Error ? err.message : String(err);
            await showFlowAlert(msg, { title: "Could not clear timestamp" });
          }
        })();
      });
      rowEl.append(clearBtn);
    }

    return rowEl;
  }

  /**
   * @param {{ lastAutoGitPull: string, lastNpmUpdateCheck: string }} state
   */
  function rebuild(state) {
    wrap.replaceChildren();
    wrap.append(
      heading,
      row("Last automatic git pull", state.lastAutoGitPull, "git"),
      row("Last npm update check", state.lastNpmUpdateCheck, "npm")
    );
  }

  rebuild(initial);
  return wrap;
}

/**
 * @param {{ syncMode: "automatic" | "manual", theme: "dark" | "light", mine: string, owner: string }} initial
 */
function renderPreferencesForm(initial) {
  const form = document.createElement("form");
  form.className = "preferences-form";

  const grid = document.createElement("div");
  grid.className = "preferences-grid";

  const mineLabel = document.createElement("label");
  mineLabel.className = "flow-field preferences-field";
  const mineSpan = document.createElement("span");
  mineSpan.className = "flow-field-label";
  mineSpan.textContent = "Mine";
  const mineInput = document.createElement("input");
  mineInput.type = "email";
  mineInput.className = "flow-input";
  mineInput.name = "mine";
  mineInput.autocomplete = "email";
  mineInput.placeholder = "you@company.com";
  mineInput.setAttribute("aria-label", "Mine filter email");
  mineInput.value = initial.mine;
  mineLabel.append(mineSpan, mineInput);

  const ownerLabel = document.createElement("label");
  ownerLabel.className = "flow-field preferences-field";
  const ownerSpan = document.createElement("span");
  ownerSpan.className = "flow-field-label";
  ownerSpan.textContent = "Default owner";
  const ownerInput = document.createElement("input");
  ownerInput.type = "email";
  ownerInput.className = "flow-input";
  ownerInput.name = "owner";
  ownerInput.autocomplete = "email";
  ownerInput.placeholder = "Prefilled when adding cards";
  ownerInput.setAttribute("aria-label", "Default card owner email");
  ownerInput.value = initial.owner;
  ownerLabel.append(ownerSpan, ownerInput);

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

  const themeLabel = document.createElement("label");
  themeLabel.className = "flow-field preferences-field";
  const themeSpan = document.createElement("span");
  themeSpan.className = "flow-field-label";
  themeSpan.textContent = "Theme";
  const themeSelect = document.createElement("select");
  themeSelect.className = "flow-input";
  themeSelect.name = "theme";
  themeSelect.setAttribute("aria-label", "Theme");
  for (const { value, label } of [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    themeSelect.append(opt);
  }
  themeSelect.value = initial.theme;
  themeLabel.append(themeSpan, themeSelect);

  grid.append(mineLabel, ownerLabel, syncLabel, themeLabel);

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
    const theme =
      String(themeSelect.value || "").trim() === "light" ? "light" : "dark";
    void (async () => {
      saveBtn.disabled = true;
      try {
        await patchLocalUserPreferences({
          syncMode: v,
          theme,
          mine: String(mineInput.value ?? ""),
          owner: String(ownerInput.value ?? ""),
        });
        applyFlowTheme(theme);
        document.dispatchEvent(new CustomEvent("flow:refresh-board"));
        showFlowToast("Preferences saved.");
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
 * @param {HTMLElement} flowTimestamps
 */
function renderPreferencesShell(form, flowTimestamps) {
  setFlowDocumentTitle("Preferences");
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
  blurb.innerHTML = `Stored in <code class="flow-board-editor-file">${escapeHtml("tasks/localuser.ini")}</code>: <code class="flow-board-editor-file">[user]</code> (Mine and default owner), <code class="flow-board-editor-file">[preferences]</code> (sync mode and theme), <code class="flow-board-editor-file">[flow]</code> (background throttle timestamps shown below).`;

  panel.append(secTitle, blurb, form, flowTimestamps);
  body.append(panel);
  root.append(top, body);
  return root;
}

async function main() {
  const mount = document.getElementById("app");
  if (!mount) return;
  setFlowDocumentTitle("Preferences");
  mount.innerHTML = `<div class="app-loading">Loading…</div>`;
  try {
    const initial = await fetchLocalUserPreferences();
    applyFlowTheme(initial.theme);
    mount.replaceChildren();
    mount.append(
      renderPreferencesShell(
        renderPreferencesForm(initial),
        renderPreferencesFlowTimestamps({
          lastAutoGitPull: initial.lastAutoGitPull,
          lastNpmUpdateCheck: initial.lastNpmUpdateCheck,
        })
      )
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mount.innerHTML = `<div class="app-error">Could not load preferences: ${escapeHtml(msg)}</div>`;
  }
}

void main();
