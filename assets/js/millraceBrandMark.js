const MILLRACE_REPO_URL = "https://github.com/Steve-Fenton/millrace";

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
  a.innerHTML = `<svg class="millrace-brand__svg" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="5.75"/><path d="M8 8.25v11.5M2.25 14h11.5"/><path d="M3.9 10.05l8.2 7.9M12.1 10.05l-8.2 7.9M4.35 17.65l7.3-7.3M11.65 17.65l-7.3-7.3"/><path d="M12.75 18V10.5L18 5.25 23.25 10.5V18H12.75z"/><path d="M12.25 18.5h11.25" opacity="0.85"/><path d="M1.5 19.35c2.1-.55 4.35-.45 6.55.15 1.95.45 3.95.45 5.9-.05 2.35-.55 4.85-.65 7.05.05" opacity="0.45"/></g></svg>`;
  return a;
}
