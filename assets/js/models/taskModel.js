import { parseIni } from "../ini/parseIni.js";

/**
 * @typedef {{ text: string, url: string }} TaskLink
 * @typedef {{ id?: string, title?: string, description?: string, owner?: string, swimlane?: string, column?: string, sort_order?: string, created?: string, closed?: string, links: TaskLink[], filename?: string }} TaskCard
 */

/**
 * Lines inside `[item]` … next section (excluding the `[item]` header).
 * @param {string} text
 * @param {string} sectionName
 * @returns {string[]}
 */
export function extractSectionLines(text, sectionName) {
  const marker = `[${sectionName}]`;
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === marker) {
      i++;
      const out = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.startsWith("[") && t.endsWith("]")) break;
        out.push(lines[i]);
        i++;
      }
      return out;
    }
    i++;
  }
  return [];
}

/**
 * Parse key/value pairs in an [item] body, including indented description continuations.
 * @param {string[]} lines
 * @returns {Record<string, string>}
 */
export function parseItemSectionLines(lines) {
  /** @type {Record<string, string>} */
  const fields = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      i++;
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const nt = next.trim();
      if (!nt) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length) {
          const ahead = lines[j].trim();
          if (/^[a-zA-Z_][a-zA-Z0-9_.]*\s*=/.test(ahead)) {
            break;
          }
        }
        value += "\n";
        i++;
        continue;
      }
      if (/^\[[^\]]+\]$/.test(nt)) break;
      if (/^[a-zA-Z_][a-zA-Z0-9_.]*\s*=/.test(nt)) break;
      if (/^\s/.test(next)) {
        value += "\n" + stripDescriptionContinuation(next);
        i++;
      } else {
        break;
      }
    }
    fields[key] = value;
  }
  return fields;
}

/**
 * Remove the indentation marker for multiline INI values while preserving
 * user-intended indentation (e.g. nested markdown list spacing).
 * @param {string} line
 * @returns {string}
 */
function stripDescriptionContinuation(line) {
  const raw = String(line ?? "").trimEnd();
  if (raw.startsWith("\t")) return raw.slice(1);
  return raw.replace(/^ {1,4}/, "");
}

/**
 * Full [item] record plus ordered links (for round-trip writes).
 * @param {string} text
 * @returns {{ item: Record<string, string>, links: TaskLink[] }}
 */
export function parseTaskCardIniFull(text) {
  const sections = parseIni(text);
  const itemLines = extractSectionLines(text, "item");
  const item =
    itemLines.length > 0
      ? parseItemSectionLines(itemLines)
      : { ...(sections.item ?? {}) };

  /** @type {{ index: number, text: string, url: string }[]} */
  const linkParts = [];

  for (const name of Object.keys(sections)) {
    const m = name.match(/^link\.(\d+)$/);
    if (!m) continue;
    const sec = sections[name];
    linkParts.push({
      index: Number(m[1]),
      text: String(sec.text ?? "").trim(),
      url: String(sec.url ?? "").trim(),
    });
  }

  linkParts.sort((a, b) => a.index - b.index);
  const links = linkParts.map(({ text: t, url: u }) => ({ text: t, url: u }));

  return { item, links };
}

/**
 * Parse a work-item INI file ([item], [link.N]).
 * @param {string} text
 * @returns {Omit<TaskCard, 'filename'>}
 */
export function parseTaskCardIni(text) {
  const { item, links } = parseTaskCardIniFull(text);

  return {
    id: item.id?.trim(),
    title: item.title?.trim(),
    description: item.description?.trim(),
    owner: item.owner?.trim(),
    swimlane: item.swimlane?.trim(),
    column: item.column?.trim(),
    sort_order: item.sort_order?.trim(),
    created: item.created?.trim(),
    closed: item.closed?.trim(),
    links,
  };
}
