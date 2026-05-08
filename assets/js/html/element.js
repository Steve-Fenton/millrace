/**
 * Parse HTML string into a single root element.
 * @param {string} html
 * @returns {Element | null}
 */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
