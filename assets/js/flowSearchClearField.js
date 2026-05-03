/** Magnifying glass (submit search) — board + completed views. */
export const FLOW_SEARCH_SUBMIT_ICON = `<svg class="flow-search-submit-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 16l5.5 5.5"/></svg>`;

/**
 * Wraps a text search input with a clear control (large hit target, pointer cursor).
 * Clear is first in the DOM so Tab from the input reaches the outer search button before the clear control in reverse order is needed; visually the clear button still sits on the right of the field (absolute).
 * @param {HTMLInputElement} input
 * @param {() => void} onClear — run after the input value is cleared and focused
 * @returns {HTMLDivElement}
 */
export function wrapSearchInputWithClear(input, onClear) {
  input.classList.add("flow-search-clear-input");
  const wrap = document.createElement("div");
  wrap.className = "flow-search-clear-field";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "flow-search-clear-btn";
  btn.setAttribute("aria-label", "Clear search");
  btn.title = "Clear search";
  btn.innerHTML = `<svg class="flow-search-clear-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>`;

  function sync() {
    const has = Boolean(String(input.value ?? "").trim());
    btn.hidden = !has;
    btn.tabIndex = has ? 0 : -1;
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = "";
    input.focus();
    sync();
    onClear();
  });

  input.addEventListener("input", sync);
  sync();

  wrap.append(btn, input);
  return wrap;
}
