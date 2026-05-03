/** Lucide-style “open in new window” (square + arrow), inherits `currentColor`. */
const NEW_TAB_ICON_SVG = `<svg class="column-card-link__new-tab-icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>`;

/**
 * Renders link label plus the usual “opens externally / new tab” icon.
 * Caller sets `href`, `target`, `rel`, `className` base, listeners, etc.
 * @param {HTMLAnchorElement} a
 * @param {string} label
 */
export function fillCardLinkWithNewTabIcon(a, label) {
  a.classList.add("column-card-link--new-tab");
  a.setAttribute("aria-label", `${label} (opens in new tab)`);
  const text = document.createElement("span");
  text.className = "column-card-link__label";
  text.textContent = label;
  const iconWrap = document.createElement("span");
  iconWrap.className = "column-card-link__new-tab-icon-wrap";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = NEW_TAB_ICON_SVG;
  a.append(text, iconWrap);
}
