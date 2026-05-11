/**
 * "Next action date" form field with a compact native date input plus quick
 * TODAY and CLEAR shortcuts on the same row. The native date input keeps its
 * `name="next_action_date"` so callers can still read it through `FormData`.
 *
 * @param {string} initialValue — YYYY-MM-DD or empty
 * @returns {{
 *   root: HTMLDivElement,
 *   input: HTMLInputElement,
 *   getValue: () => string,
 *   setValue: (next: string) => void,
 * }}
 */
export function createNextActionDateField(initialValue) {
  const fieldIdSuffix = Math.random().toString(36).slice(2, 8);
  const inputId = `flow-next-action-date-${fieldIdSuffix}`;

  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-field--next-action-date";

  const label = document.createElement("label");
  label.className = "flow-field-label";
  label.htmlFor = inputId;
  label.textContent = "Next action date";

  const row = document.createElement("div");
  row.className = "flow-next-action-date-row";

  const input = document.createElement("input");
  input.id = inputId;
  input.className = "flow-input flow-next-action-date-input";
  input.name = "next_action_date";
  input.type = "date";
  input.autocomplete = "off";
  input.value = String(initialValue ?? "").trim();

  const todayBtn = document.createElement("button");
  todayBtn.type = "button";
  todayBtn.className = "flow-btn flow-btn-icon flow-next-action-date-today";
  todayBtn.setAttribute("aria-label", "Set next action date to today");
  todayBtn.title = "Today";
  todayBtn.innerHTML = `<svg class="flow-next-action-date-today-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.25" y="4.75" width="17.5" height="16" rx="2"/><path d="M3.25 9.5h17.5"/><path d="M8 3v3M16 3v3"/><circle cx="12" cy="14.75" r="1.85" fill="currentColor" stroke="none"/></svg>`;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "flow-btn flow-btn-icon flow-next-action-date-clear";
  clearBtn.setAttribute("aria-label", "Clear next action date");
  clearBtn.title = "Clear";
  clearBtn.innerHTML = `<svg class="flow-next-action-date-clear-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

  function setValue(next) {
    input.value = String(next ?? "").trim();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  todayBtn.addEventListener("click", () => {
    setValue(todayLocalYmd());
  });

  clearBtn.addEventListener("click", () => {
    setValue("");
  });

  row.append(input, todayBtn, clearBtn);
  wrap.append(label, row);

  return {
    root: wrap,
    input,
    getValue() {
      return String(input.value ?? "").trim();
    },
    setValue,
  };
}

/** Local-timezone YYYY-MM-DD for the current day. */
function todayLocalYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
