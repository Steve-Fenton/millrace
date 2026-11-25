import { parseRecurrence } from "../ini/recurrence.js";

/**
 * "Recurring" checkbox with an "Every [n] [weeks|months]" row shown when ticked.
 *
 * @param {string | undefined} initialValue — INI recurrence text, e.g. "2 weeks"
 * @returns {{
 *   root: HTMLDivElement,
 *   checkbox: HTMLInputElement,
 *   getValue: () => string,
 * }}
 */
export function createRecurrenceField(initialValue) {
  const initial = parseRecurrence(initialValue);
  const suffix = Math.random().toString(36).slice(2, 8);
  const everyId = `flow-recurrence-every-${suffix}`;
  const unitId = `flow-recurrence-unit-${suffix}`;

  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-field--recurrence";

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "flow-field flow-field--checkbox";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "recurring";
  checkbox.checked = Boolean(initial);
  const toggleText = document.createElement("span");
  toggleText.className = "flow-field-label";
  toggleText.textContent = "Recurring";
  toggleLabel.append(checkbox, toggleText);

  const row = document.createElement("div");
  row.className = "flow-recurrence-row";

  const everyLabel = document.createElement("label");
  everyLabel.htmlFor = everyId;
  everyLabel.textContent = "Every";

  const every = document.createElement("input");
  every.id = everyId;
  every.className = "flow-input flow-recurrence-every";
  every.name = "recurrence_every";
  every.type = "number";
  every.min = "1";
  every.max = "520";
  every.step = "1";
  every.inputMode = "numeric";
  every.value = String(initial?.every ?? 1);

  const unit = document.createElement("select");
  unit.id = unitId;
  unit.className = "flow-input flow-recurrence-unit";
  unit.name = "recurrence_unit";
  unit.setAttribute("aria-label", "Recurrence unit");
  for (const [value, text] of [
    ["weeks", "weeks"],
    ["months", "months"],
  ]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    unit.append(opt);
  }
  unit.value = initial?.unit ?? "weeks";

  row.append(everyLabel, every, unit);
  wrap.append(toggleLabel, row);

  function syncVisibility() {
    row.hidden = !checkbox.checked;
  }
  checkbox.addEventListener("change", syncVisibility);
  syncVisibility();

  return {
    root: wrap,
    checkbox,
    getValue() {
      if (!checkbox.checked) return "";
      const r = parseRecurrence({ every: every.value, unit: unit.value });
      return r ? `${r.every} ${r.unit}` : "";
    },
  };
}
