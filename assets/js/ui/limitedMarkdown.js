/**
 * Render a restricted markdown subset into `target`.
 * Supported blocks: headings (#..###), ordered/unordered lists (incl. `- [ ]` / `- [x]` tasks), GFM tables, fenced code (```), paragraphs.
 * Supported inline: **bold**, *italic*, ~~strikethrough~~, `code`, [text](https://example.com).
 * Content is always inserted as text (no raw HTML passthrough).
 *
 * @param {HTMLElement} target
 * @param {string} source
 * @param {{ interactiveTaskCheckboxes?: boolean }} [options]
 */
export function renderLimitedMarkdown(target, source, options) {
  const raw = String(source ?? "").replace(/\r\n?/g, "\n");
  const lines = raw.split("\n");
  const interactiveTasks = options?.interactiveTaskCheckboxes === true;
  const frag = document.createDocumentFragment();

  /**
   * Active list stack from outermost to innermost depth.
   * @type {Array<{ list: HTMLOListElement | HTMLUListElement, kind: "ol" | "ul", ulVariant: "bullet" | "task" | null, lastItem: HTMLLIElement | null }>}
   */
  let listStack = [];

  function closeLists() {
    listStack = [];
  }

  /**
   * @param {"ol" | "ul"} kind
   * @param {HTMLElement | DocumentFragment} parent
   * @param {"bullet" | "task" | null} ulVariant list flavor when kind is `ul` (ignored for `ol`)
   * @returns {HTMLOListElement | HTMLUListElement}
   */
  function createList(kind, parent, ulVariant) {
    const list = document.createElement(kind);
    list.className =
      kind === "ul" && ulVariant === "task" ? "flow-md-list flow-md-list--task" : "flow-md-list";
    parent.append(list);
    return list;
  }

  /**
   * @param {"ol" | "ul"} kind
   * @param {number} depth 1-based list depth
   * @param {"bullet" | "task"} [ulVariant] when kind is `ul`; defaults to `"bullet"`
   * @returns {HTMLOListElement | HTMLUListElement}
   */
  function ensureListAtDepth(kind, depth, ulVariant = "bullet") {
    const desiredDepth = Math.max(1, depth);
    while (listStack.length > desiredDepth) {
      listStack.pop();
    }

    if (listStack.length === desiredDepth) {
      const top = listStack[listStack.length - 1];
      if (top.kind !== kind) {
        listStack.pop();
      } else if (kind === "ul" && top.ulVariant !== ulVariant) {
        listStack.pop();
      }
    }

    const effectiveUlVariant = kind === "ul" ? ulVariant : "bullet";

    while (listStack.length < desiredDepth) {
      const parentEl = listStack[listStack.length - 1]?.lastItem ?? frag;
      const next = createList(kind, parentEl, kind === "ul" ? effectiveUlVariant : null);
      listStack.push({
        list: next,
        kind,
        ulVariant: kind === "ul" ? effectiveUlVariant : null,
        lastItem: null,
      });
    }

    return listStack[listStack.length - 1].list;
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    const fenceMatch = /^(`{3,})(.*)$/.exec(trimmed);
    if (fenceMatch) {
      closeLists();
      const info = fenceMatch[2].trim();
      const codeLines = [];
      lineIndex++;
      while (lineIndex < lines.length) {
        const codeLine = lines[lineIndex];
        if (/^(`{3,})\s*$/.test(codeLine.trim())) {
          break;
        }
        codeLines.push(codeLine);
        lineIndex++;
      }
      const pre = document.createElement("pre");
      pre.className = "flow-md-code-block";
      const code = document.createElement("code");
      if (info) code.dataset.flowMdLang = info;
      code.textContent = codeLines.join("\n");
      pre.append(code);
      frag.append(pre);
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

    const taskMatch = /^[-*]\s+\[([ xX])\]\s*(.*)$/.exec(trimmedStart);
    if (taskMatch) {
      const checked = taskMatch[1] === "x" || taskMatch[1] === "X";
      const li = document.createElement("li");
      li.className = "flow-md-task-item";
      if (interactiveTasks) li.dataset.flowTaskLine = String(lineIndex);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.disabled = !interactiveTasks;
      cb.checked = checked;
      cb.className = interactiveTasks
        ? "flow-md-task-checkbox flow-md-task-checkbox--interactive"
        : "flow-md-task-checkbox";
      cb.setAttribute(
        "aria-label",
        interactiveTasks
          ? checked
            ? "Mark as not done"
            : "Mark as done"
          : checked
            ? "Completed"
            : "Pending"
      );
      const body = document.createElement("span");
      body.className = "flow-md-task-item-body";
      appendInlineMarkdown(body, taskMatch[2]);
      li.append(cb, body);
      const list = ensureListAtDepth("ul", depth, "task");
      list.append(li);
      listStack[listStack.length - 1].lastItem = li;
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmedStart);
    if (unorderedMatch) {
      const li = document.createElement("li");
      appendInlineMarkdown(li, unorderedMatch[1]);
      const list = ensureListAtDepth("ul", depth, "bullet");
      list.append(li);
      listStack[listStack.length - 1].lastItem = li;
      continue;
    }

    const headerCells = parseTableRow(trimmed);
    if (headerCells && headerCells.length >= 1 && lineIndex + 1 < lines.length) {
      const separatorCells = parseTableRow(lines[lineIndex + 1].trim());
      if (
        separatorCells &&
        separatorCells.length === headerCells.length &&
        isTableSeparatorRow(separatorCells)
      ) {
        closeLists();
        const alignments = separatorCells.map(parseTableColumnAlignment);
        lineIndex += 2;
        const bodyRows = [];
        while (lineIndex < lines.length) {
          const bodyTrimmed = lines[lineIndex].trim();
          if (!bodyTrimmed) break;
          const rowCells = parseTableRow(bodyTrimmed);
          if (!rowCells || rowCells.length !== headerCells.length) break;
          bodyRows.push(rowCells);
          lineIndex++;
        }
        lineIndex--;
        appendMarkdownTable(frag, headerCells, bodyRows, alignments);
        continue;
      }
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
 * Split a markdown table row into trimmed cell strings, or null if the line is not a table row.
 * @param {string} line
 * @returns {string[] | null}
 */
function parseTableRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.includes("|")) return null;
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((cell) => cell.trim());
}

/**
 * @param {string[]} cells
 * @returns {boolean}
 */
function isTableSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * @param {string} separatorCell
 * @returns {"left" | "center" | "right"}
 */
function parseTableColumnAlignment(separatorCell) {
  const s = String(separatorCell ?? "").trim();
  const left = s.startsWith(":");
  const right = s.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

/**
 * @param {HTMLElement | DocumentFragment} parent
 * @param {string[]} headerCells
 * @param {string[][]} bodyRows
 * @param {Array<"left" | "center" | "right">} alignments
 */
function appendMarkdownTable(parent, headerCells, bodyRows, alignments) {
  const table = document.createElement("table");
  table.className = "flow-md-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (let col = 0; col < headerCells.length; col++) {
    const th = document.createElement("th");
    th.style.textAlign = alignments[col] ?? "left";
    appendInlineMarkdown(th, headerCells[col]);
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  if (bodyRows.length) {
    const tbody = document.createElement("tbody");
    for (const rowCells of bodyRows) {
      const tr = document.createElement("tr");
      for (let col = 0; col < rowCells.length; col++) {
        const td = document.createElement("td");
        td.style.textAlign = alignments[col] ?? "left";
        appendInlineMarkdown(td, rowCells[col]);
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
  }

  parent.append(table);
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

    if (text[i] === "`" && !text.startsWith("```", i)) {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        const code = document.createElement("code");
        code.className = "flow-md-code";
        code.textContent = text.slice(i + 1, end);
        parent.append(code);
        i = end + 1;
        continue;
      }
    }

    if (text.startsWith("~~", i)) {
      const end = text.indexOf("~~", i + 2);
      if (end > i + 2) {
        const strike = document.createElement("s");
        strike.className = "flow-md-strike";
        appendInlineMarkdown(strike, text.slice(i + 2, end));
        parent.append(strike);
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
  const nextStrike = text.indexOf("~~", from);
  const nextBacktick = text.indexOf("`", from);
  const nextStar = text.indexOf("*", from);
  const nextLink = text.indexOf("[", from);
  const idx = [nextBold, nextStrike, nextBacktick, nextStar, nextLink]
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];
  return idx == null ? text.length : idx;
}

/** Same task-line shape as the list parser (full physical line, incl. indent). */
const TASK_LINE_TOGGLE = /^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/;

/**
 * Flip `[ ]` ↔ `[x]` on one line (supports `-` / `*` bullets). No-op if the line is not a task item.
 *
 * @param {string} source
 * @param {number} lineIndex 0-based line index after `\r\n?` → `\n` normalization.
 * @returns {string}
 */
export function toggleMarkdownTaskLine(source, lineIndex) {
  const original = String(source ?? "");
  const raw = original.replace(/\r\n?/g, "\n");
  const lines = raw.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return original;
  const m = TASK_LINE_TOGGLE.exec(lines[lineIndex]);
  if (!m) return original;
  const inner = m[2];
  const nextInner = inner === "x" || inner === "X" ? " " : "x";
  lines[lineIndex] = m[1] + nextInner + m[3];
  return lines.join("\n");
}
