/**
 * On-page modal prompts matching `.flow-modal` styling (no `window.alert` / `confirm`),
 * plus a lightweight toast for non-blocking feedback.
 */

import { beginModalFocusTrap } from "./modalFocusTrap.js";

function flowModalInstanceId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** @type {HTMLElement | null} */
let toastEl = null;
/** @type {number} */
let toastTimer = 0;

/**
 * Brief non-blocking message (fixed near bottom of the viewport).
 * @param {string} message
 * @param {{ durationMs?: number }} [opts]
 */
export function showFlowToast(message, opts = {}) {
  const durationMs =
    typeof opts.durationMs === "number" && opts.durationMs >= 0
      ? opts.durationMs
      : 4500;
  const text = String(message ?? "").trim();
  if (!text) return;

  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "flow-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl?.remove();
    toastEl = null;
    toastTimer = 0;
  }, durationMs);
}

function backdropEl() {
  const b = document.createElement("div");
  b.className = "flow-modal-backdrop flow-modal-backdrop--nested";
  b.setAttribute("role", "presentation");
  return b;
}

/**
 * @param {string} message
 * @param {{ title?: string }} [opts]
 * @returns {Promise<void>}
 */
export function showFlowAlert(message, opts = {}) {
  const title = opts.title ?? "Notice";

  return new Promise((resolve) => {
    const backdrop = backdropEl();
    const modal = document.createElement("div");
    const uid = flowModalInstanceId();
    const titleId = `flow-flowalert-title-${uid}`;
    const descId = `flow-flowalert-desc-${uid}`;
    modal.className = "flow-modal flow-modal--prompt";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    modal.setAttribute("aria-describedby", descId);

    const h2 = document.createElement("h2");
    h2.id = titleId;
    h2.className = "flow-modal-title";
    h2.textContent = title;

    const p = document.createElement("p");
    p.id = descId;
    p.className = "flow-modal-message";
    p.textContent = message;

    const actions = document.createElement("div");
    actions.className = "flow-modal-actions";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "flow-btn flow-btn-primary";
    okBtn.textContent = "OK";

    actions.append(okBtn);
    modal.append(h2, p, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const releaseTrap = beginModalFocusTrap(backdrop);

    let settled = false;
    function close() {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, { capture: true });
      releaseTrap();
      backdrop.remove();
      resolve();
    }

    function onKey(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        close();
      }
    }

    okBtn.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener("keydown", onKey, { capture: true });
    okBtn.focus();
  });
}

/**
 * @param {string} message
 * @param {{
 *   title?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   destructive?: boolean,
 *   allowEscapeDismiss?: boolean,
 *   allowBackdropDismiss?: boolean
 * }} [opts]
 * @returns {Promise<boolean>} true if confirmed
 */
export function showFlowConfirm(message, opts = {}) {
  const title = opts.title ?? "Confirm";
  const confirmLabel = opts.confirmLabel ?? "OK";
  const cancelLabel = opts.cancelLabel ?? "Cancel";
  const destructive = Boolean(opts.destructive);
  const allowEscapeDismiss = opts.allowEscapeDismiss !== false;
  const allowBackdropDismiss = opts.allowBackdropDismiss !== false;

  return new Promise((resolve) => {
    const backdrop = backdropEl();
    const modal = document.createElement("div");
    const uid = flowModalInstanceId();
    const titleId = `flow-flowconfirm-title-${uid}`;
    const descId = `flow-flowconfirm-desc-${uid}`;
    modal.className = "flow-modal flow-modal--prompt";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    modal.setAttribute("aria-describedby", descId);

    const h2 = document.createElement("h2");
    h2.id = titleId;
    h2.className = "flow-modal-title";
    h2.textContent = title;

    const p = document.createElement("p");
    p.id = descId;
    p.className = "flow-modal-message";
    p.textContent = message;

    const actions = document.createElement("div");
    actions.className = "flow-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "flow-btn flow-btn-ghost";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = destructive
      ? "flow-btn flow-btn-danger"
      : "flow-btn flow-btn-primary";
    confirmBtn.textContent = confirmLabel;

    actions.append(cancelBtn, confirmBtn);
    modal.append(h2, p, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const releaseTrap = beginModalFocusTrap(backdrop);

    let settled = false;
    function finish(val) {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, { capture: true });
      releaseTrap();
      backdrop.remove();
      resolve(val);
    }

    function onKey(ev) {
      if (!allowEscapeDismiss) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        finish(false);
      }
    }

    cancelBtn.addEventListener("click", () => finish(false));
    confirmBtn.addEventListener("click", () => finish(true));
    backdrop.addEventListener("click", (e) => {
      if (!allowBackdropDismiss) return;
      if (e.target === backdrop) finish(false);
    });
    document.addEventListener("keydown", onKey, { capture: true });

    (destructive ? cancelBtn : confirmBtn).focus();
  });
}

/**
 * @param {string} message
 * @param {{ title?: string, placeholder?: string, defaultValue?: string, confirmLabel?: string, cancelLabel?: string }} [opts]
 * @returns {Promise<string | null>} trimmed value, or null if cancelled
 */
export function showFlowPrompt(message, opts = {}) {
  const title = opts.title ?? "Input";
  const placeholder = opts.placeholder ?? "";
  const defaultValue = opts.defaultValue ?? "";
  const confirmLabel = opts.confirmLabel ?? "Save";
  const cancelLabel = opts.cancelLabel ?? "Cancel";

  return new Promise((resolve) => {
    const backdrop = backdropEl();
    const modal = document.createElement("div");
    const uid = flowModalInstanceId();
    const titleId = `flow-flowprompt-title-${uid}`;
    const descId = `flow-flowprompt-desc-${uid}`;
    modal.className = "flow-modal flow-modal--prompt";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    modal.setAttribute("aria-describedby", descId);

    const h2 = document.createElement("h2");
    h2.id = titleId;
    h2.className = "flow-modal-title";
    h2.textContent = title;

    const p = document.createElement("p");
    p.id = descId;
    p.className = "flow-modal-message";
    p.textContent = message;

    const field = document.createElement("label");
    field.className = "flow-field flow-field--prompt";
    const lab = document.createElement("span");
    lab.className = "flow-field-label";
    lab.textContent = "Email";
    const input = document.createElement("input");
    input.className = "flow-input";
    input.type = "text";
    input.inputMode = "email";
    input.autocomplete = "email";
    input.spellcheck = false;
    input.placeholder = placeholder;
    input.value = defaultValue;
    field.append(lab, input);

    const actions = document.createElement("div");
    actions.className = "flow-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "flow-btn flow-btn-ghost";
    cancelBtn.textContent = cancelLabel;

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "flow-btn flow-btn-primary";
    okBtn.textContent = confirmLabel;

    actions.append(cancelBtn, okBtn);
    modal.append(h2, p, field, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const releaseTrap = beginModalFocusTrap(backdrop);

    let settled = false;
    function finish(val) {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, { capture: true });
      releaseTrap();
      backdrop.remove();
      resolve(val);
    }

    function onKey(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        finish(null);
      }
    }

    function tryOk() {
      const v = String(input.value ?? "").trim();
      if (!v) return;
      if (!v.includes("@")) return;
      finish(v);
    }

    okBtn.addEventListener("click", () => tryOk());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        tryOk();
      }
    });
    cancelBtn.addEventListener("click", () => finish(null));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(null);
    });
    document.addEventListener("keydown", onKey, { capture: true });
    input.focus();
    input.select();
  });
}
