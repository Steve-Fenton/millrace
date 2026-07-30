const MILLRACE_REPO_URL = "https://github.com/Steve-Fenton/millrace";

/** Inline mark so theme color follows `currentColor` and no external SVG fetch is required. */
const WATERWHEEL_MARK = `<svg class="millrace-brand__svg millrace-brand__svg--wheel" width="32" height="32" viewBox="10 50 196 200" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="108" cy="150" r="90" stroke-width="4" opacity="0.28"/><circle cx="108" cy="150" r="85" stroke-width="1.5" opacity="0.4"/><g stroke-width="3" opacity="0.72"><line x1="108" y1="150" x2="108" y2="65"/><line x1="108" y1="150" x2="168" y2="90"/><line x1="108" y1="150" x2="193" y2="150"/><line x1="108" y1="150" x2="23" y2="150"/><line x1="108" y1="150" x2="48" y2="90"/></g><g stroke-width="3.5" opacity="0.92"><line x1="108" y1="150" x2="168" y2="210"/><line x1="108" y1="150" x2="108" y2="235"/><line x1="108" y1="150" x2="48" y2="210"/></g></g><g fill="currentColor" opacity="0.78"><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(0 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(45 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(90 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(135 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(180 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(225 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(270 108 150)"/><rect x="94" y="57" width="28" height="10" rx="2" transform="rotate(315 108 150)"/></g><circle cx="108" cy="150" r="18" fill="currentColor"/><circle cx="108" cy="150" r="9" fill="currentColor" opacity="0.55"/></svg>`;

/**
 * Water-mill mark for the shell header. Links to the Millrace GitHub repository.
 * @returns {HTMLAnchorElement}
 */
export function createMillraceBrandMark() {
  const a = document.createElement("a");
  a.className = "millrace-brand";
  a.href = MILLRACE_REPO_URL;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.title = "Millrace on GitHub";
  a.setAttribute(
    "aria-label",
    "Millrace on GitHub (opens in a new tab)"
  );
  a.innerHTML = `<span class="millrace-brand__track">${WATERWHEEL_MARK}</span>`;
  return a;
}
