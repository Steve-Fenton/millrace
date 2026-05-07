/**
 * Render a restricted markdown subset into `target`.
 * Supported blocks: headings (#..###), ordered/unordered lists, paragraphs.
 * Content is always inserted as text (no raw HTML passthrough).
 *
 * @param {HTMLElement} target
 * @param {string} source
 */
export function renderLimitedMarkdown(target, source) {
  const raw = String(source ?? "").replace(/\r\n?/g, "\n");
  const lines = raw.split("\n");
  const frag = document.createDocumentFragment();

  /** @type {HTMLOListElement | HTMLUListElement | null} */
  let list = null;
  /** @type {"ol" | "ul" | null} */
  let listKind = null;

  function closeList() {
    list = null;
    listKind = null;
  }

  function ensureList(kind) {
    if (list && listKind === kind) return list;
    closeList();
    list = document.createElement(kind);
    list.className = "flow-md-list";
    listKind = kind;
    frag.append(list);
    return list;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const heading = document.createElement(`h${level}`);
      heading.className = `flow-md-heading flow-md-heading-${level}`;
      heading.textContent = headingMatch[2];
      frag.append(heading);
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      const li = document.createElement("li");
      li.textContent = orderedMatch[1];
      ensureList("ol").append(li);
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unorderedMatch) {
      const li = document.createElement("li");
      li.textContent = unorderedMatch[1];
      ensureList("ul").append(li);
      continue;
    }

    closeList();
    const p = document.createElement("p");
    p.className = "flow-md-paragraph";
    p.textContent = trimmed;
    frag.append(p);
  }

  if (!frag.childNodes.length) {
    const empty = document.createElement("p");
    empty.className = "flow-md-empty";
    empty.textContent = "Click to add a description (# headings and lists supported).";
    frag.append(empty);
  }

  target.replaceChildren(frag);
}
