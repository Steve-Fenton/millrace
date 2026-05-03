import {
  boardActiveUsersSortedForUi,
  boardUserEntryForEmail,
  ownerDisplayLabel,
} from "./boardModel.js";

/**
 * @param {import("./boardModel.js").BoardUserDef[] | undefined} boardUsers
 * @param {string} initialEmail
 * @returns {{ root: HTMLElement, getValue: () => string, focus: () => void }}
 */
export function createOwnerField(boardUsers, initialEmail) {
  const initial = String(initialEmail ?? "").trim();
  const sorted = boardActiveUsersSortedForUi(boardUsers);

  const wrap = document.createElement("label");
  wrap.className = "flow-field";
  const lab = document.createElement("span");
  lab.className = "flow-field-label";
  lab.textContent = "Owner";
  wrap.append(lab);

  if (sorted.length === 0) {
    const input = document.createElement("input");
    input.className = "flow-input flow-owner-input";
    input.name = "owner";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Last card owner ([user] owner in localuser.ini)";
    input.value = initial;
    wrap.append(input);
    return {
      root: wrap,
      getValue: () => String(input.value ?? "").trim(),
      focus: () => input.focus(),
      /** @param {string} email */
      applyLocalDefault(email) {
        const t = String(email ?? "").trim();
        if (t && !String(input.value ?? "").trim()) input.value = t;
      },
    };
  }

  const select = document.createElement("select");
  select.className = "flow-input flow-owner-input";
  select.name = "owner";
  select.setAttribute("aria-label", "Owner");

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
    const entry = boardUserEntryForEmail(boardUsers, initial);
    const inactive = entry && entry.active === false;
    let lab = ownerDisplayLabel(initial, boardUsers) || initial;
    if (inactive) lab = `${lab} (inactive)`;
    o.textContent = lab;
    o.title = inactive
      ? "Inactive board user — pick an active owner to reassign, or keep this selection."
      : "Not in board user list";
    select.append(o);
  }

  select.value = initial || "";

  wrap.append(select);
  return {
    root: wrap,
    getValue: () => String(select.value ?? "").trim(),
    focus: () => select.focus(),
    /** @param {string} email */
    applyLocalDefault(email) {
      const t = String(email ?? "").trim();
      if (!t) return;
      if (String(select.value ?? "").trim()) return;
      const opt = [...select.options].find(
        (o) =>
          o.value &&
          o.value.toLowerCase() === t.toLowerCase()
      );
      if (opt) select.value = opt.value;
    },
  };
}
