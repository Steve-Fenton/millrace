import {
  boardActiveUsersSortedForUi,
  boardUserEntryForEmail,
  ownerDisplayLabel,
} from "../models/boardModel.js";

/**
 * @param {import("../models/boardModel.js").BoardUserDef[] | undefined} users
 * @param {string} initialEmail
 * @param {{
 *   label: string,
 *   name: string,
 *   ariaLabel: string,
 *   fallbackPlaceholder?: string,
 *   fieldClass?: string,
 *   wrapClass?: string,
 * }} meta
 * @returns {{ root: HTMLElement, getValue: () => string, focus: () => void }}
 */
export function createUserEmailField(users, initialEmail, meta) {
  const initial = String(initialEmail ?? "").trim();
  const sorted = boardActiveUsersSortedForUi(users);
  const inputClass = meta.fieldClass ?? "flow-input flow-owner-input";

  const wrap = document.createElement("label");
  wrap.className = meta.wrapClass ?? "flow-field";
  const lab = document.createElement("span");
  lab.className = "flow-field-label";
  lab.textContent = meta.label;
  wrap.append(lab);

  if (sorted.length === 0) {
    const input = document.createElement("input");
    input.className = inputClass;
    input.name = meta.name;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder =
      meta.fallbackPlaceholder ?? "Add users in tasks/.millrace.ini";
    input.setAttribute("aria-label", meta.ariaLabel);
    input.value = initial;
    wrap.append(input);
    return {
      root: wrap,
      getValue: () => String(input.value ?? "").trim(),
      focus: () => input.focus(),
    };
  }

  const select = document.createElement("select");
  select.className = inputClass;
  select.name = meta.name;
  select.setAttribute("aria-label", meta.ariaLabel);

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "—";
  select.append(blank);

  const emails = new Set(sorted.map((u) => u.email.toLowerCase()));
  for (const u of sorted) {
    const o = document.createElement("option");
    o.value = u.email;
    o.textContent = u.name.trim() ? u.name : u.email;
    if (u.name.trim() && u.name !== u.email) {
      o.title = u.email;
    }
    select.append(o);
  }

  if (initial && !emails.has(initial.toLowerCase())) {
    const o = document.createElement("option");
    o.value = initial;
    const entry = boardUserEntryForEmail(users, initial);
    const inactive = entry && entry.active === false;
    let optionLabel = ownerDisplayLabel(initial, users) || initial;
    if (inactive) optionLabel = `${optionLabel} (inactive)`;
    o.textContent = optionLabel;
    o.title = inactive
      ? "Inactive user — pick an active user or keep this selection."
      : "Not in tasks/.millrace.ini user list";
    select.append(o);
  }

  select.value = initial || "";
  wrap.append(select);
  return {
    root: wrap,
    getValue: () => String(select.value ?? "").trim(),
    focus: () => select.focus(),
  };
}

/**
 * @param {import("../models/boardModel.js").BoardUserDef[] | undefined} boardUsers
 * @param {string} initialEmail
 * @returns {{ root: HTMLElement, getValue: () => string, focus: () => void, applyLocalDefault: (email: string) => void }}
 */
export function createOwnerField(boardUsers, initialEmail) {
  const field = createUserEmailField(boardUsers, initialEmail, {
    label: "Owner",
    name: "owner",
    ariaLabel: "Owner",
    fallbackPlaceholder: "Last card owner ([user] owner in localuser.ini)",
  });
  const control = field.root.querySelector("input, select");
  return {
    ...field,
    /** @param {string} email */
    applyLocalDefault(email) {
      const t = String(email ?? "").trim();
      if (!t || !control) return;
      if (control instanceof HTMLInputElement) {
        if (!String(control.value ?? "").trim()) control.value = t;
        return;
      }
      if (String(control.value ?? "").trim()) return;
      const opt = [...control.options].find(
        (o) => o.value && o.value.toLowerCase() === t.toLowerCase()
      );
      if (opt) control.value = opt.value;
    },
  };
}
