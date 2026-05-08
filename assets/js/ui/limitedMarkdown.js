/**
 * Render a restricted markdown subset into `target`.
 * Supported blocks: headings (#..###), ordered/unordered lists, paragraphs.
 * Supported inline: **bold**, *italic*, [text](https://example.com).
 * Content is always inserted as text (no raw HTML passthrough).
 *
 * @param {HTMLElement} target
 * @param {string} source
 */
export function renderLimitedMarkdown(target, source) {
  const raw = String(source ?? "").replace(/\r\n?/g, "\n");
  const lines = raw.split("\n");
  const frag = document.createDocumentFragment();

  /**
   * Active list stack from outermost to innermost depth.
   * @type {Array<{ list: HTMLOListElement | HTMLUListElement, kind: "ol" | "ul", lastItem: HTMLLIElement | null }>}
   */
  let listStack = [];

  function closeLists() {
    listStack = [];
  }

  /**
   * @param {"ol" | "ul"} kind
   * @param {HTMLElement | DocumentFragment} parent
   * @returns {HTMLOListElement | HTMLUListElement}
   */
  function createList(kind, parent) {
    const list = document.createElement(kind);
    list.className = "flow-md-list";
    parent.append(list);
    return list;
  }

  /**
   * @param {"ol" | "ul"} kind
   * @param {number} depth 1-based list depth
   * @returns {HTMLOListElement | HTMLUListElement}
   */
  function ensureListAtDepth(kind, depth) {
    const desiredDepth = Math.max(1, depth);
    while (listStack.length > desiredDepth) {
      listStack.pop();
    }

    if (listStack.length === desiredDepth && listStack[listStack.length - 1]?.kind !== kind) {
      listStack.pop();
    }

    while (listStack.length < desiredDepth) {
      const parent = listStack[listStack.length - 1]?.lastItem ?? frag;
      const next = createList(kind, parent);
      listStack.push({ list: next, kind, lastItem: null });
    }

    return listStack[listStack.length - 1].list;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      const heading = document.createElement(`h${level}`);
      heading.className = `flow-md-heading flow-md-heading-${level}`;
      appendInlineMarkdown(heading, headingMatch[2]);
      frag.append(heading);
      continue;
    }

    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    const normalizedIndent = leadingWhitespace.replace(/\t/g, "  ").length;
    const depth = Math.floor(normalizedIndent / 2) + 1;
    const trimmedStart = line.trimStart();

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmedStart);
    if (orderedMatch) {
      const li = document.createElement("li");
      appendInlineMarkdown(li, orderedMatch[1]);
      const list = ensureListAtDepth("ol", depth);
      list.append(li);
      listStack[listStack.length - 1].lastItem = li;
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmedStart);
    if (unorderedMatch) {
      const li = document.createElement("li");
      appendInlineMarkdown(li, unorderedMatch[1]);
      const list = ensureListAtDepth("ul", depth);
      list.append(li);
      listStack[listStack.length - 1].lastItem = li;
      continue;
    }

    closeLists();
    const p = document.createElement("p");
    p.className = "flow-md-paragraph";
    appendInlineMarkdown(p, trimmed);
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

/**
 * @param {string} raw
 * @returns {string}
 */
function safeLinkHref(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

/**
 * Append limited inline markdown into `parent`.
 * @param {HTMLElement} parent
 * @param {string} raw
 */
function appendInlineMarkdown(parent, raw) {
  const text = String(raw ?? "");
  let i = 0;

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        const strong = document.createElement("strong");
        appendInlineMarkdown(strong, text.slice(i + 2, end));
        parent.append(strong);
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        const em = document.createElement("em");
        appendInlineMarkdown(em, text.slice(i + 1, end));
        parent.append(em);
        i = end + 1;
        continue;
      }
    }

    if (text[i] === "[") {
      const closeLabel = text.indexOf("]", i + 1);
      if (closeLabel > i + 1 && text[closeLabel + 1] === "(") {
        const closeUrl = text.indexOf(")", closeLabel + 2);
        if (closeUrl > closeLabel + 2) {
          const label = text.slice(i + 1, closeLabel);
          const href = safeLinkHref(text.slice(closeLabel + 2, closeUrl));
          if (href) {
            const a = document.createElement("a");
            a.href = href;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            appendInlineMarkdown(a, label);
            parent.append(a);
            i = closeUrl + 1;
            continue;
          }
        }
      }
    }

    const next = findNextInlineTokenStart(text, i + 1);
    parent.append(document.createTextNode(text.slice(i, next)));
    i = next;
  }
}

/**
 * @param {string} text
 * @param {number} from
 * @returns {number}
 */
function findNextInlineTokenStart(text, from) {
  const nextBold = text.indexOf("**", from);
  const nextStar = text.indexOf("*", from);
  const nextLink = text.indexOf("[", from);
  const idx = [nextBold, nextStar, nextLink]
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];
  return idx == null ? text.length : idx;
}
