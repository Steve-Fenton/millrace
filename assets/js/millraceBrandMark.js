const MILLRACE_REPO_URL = "https://github.com/Steve-Fenton/millrace";

const WATERWHEEL_SVG_URL = new URL("../svg/waterwheel.svg", import.meta.url).href;
const MILLRACE_WORDMARK_SVG_URL = new URL("../svg/millrace.svg", import.meta.url).href;

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
  a.innerHTML = `<span class="millrace-brand__track"><img class="millrace-brand__svg millrace-brand__svg--wheel" src="${WATERWHEEL_SVG_URL}" width="32" height="32" alt="" decoding="async" aria-hidden="true" /><img class="millrace-brand__svg millrace-brand__svg--mark" src="${MILLRACE_WORDMARK_SVG_URL}" width="968" height="300" alt="" decoding="async" aria-hidden="true" /></span>`;
  return a;
}
