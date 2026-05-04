/**
 * Helpers for standard Git merge conflict markers (<<<<<<< / ======= / >>>>>>>).
 * "Ours" = current branch (HEAD) side; "theirs" = incoming side (e.g. remote merge).
 */

/** Start of "ours" / HEAD side marker line (may be followed by branch name). */
const MARK_BEGIN = "<<<<<<<";
/** Separator between ours and theirs sections. */
const MARK_MIDDLE = "=======";
/** Start of "theirs" / incoming side end marker line (may be followed by branch name). */
const MARK_END = ">>>>>>>";

const RE_HEAD_LABEL = new RegExp(`^${MARK_BEGIN}\\s*`);
const RE_THEIR_LABEL = new RegExp(`^${MARK_END}\\s*`);

/**
 * @param {string} text
 * @returns {number}
 */
export function countConflictHunks(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let n = 0;
  for (const line of lines) {
    if (line.startsWith(MARK_BEGIN)) n++;
  }
  return n;
}

/**
 * @param {string} text
 * @returns {{ ours: string, theirs: string, headLabel: string, theirLabel: string } | null}
 */
export function getFirstConflictHunk(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let start = -1;
  for (let j = 0; j < lines.length; j++) {
    if (lines[j].startsWith(MARK_BEGIN)) {
      start = j;
      break;
    }
  }
  if (start === -1) return null;

  const headLabel = lines[start].replace(RE_HEAD_LABEL, "").trim();
  let j = start + 1;
  const ours = [];
  while (j < lines.length && lines[j] !== MARK_MIDDLE) {
    ours.push(lines[j]);
    j++;
  }
  if (j >= lines.length) return null;
  j++;
  const theirs = [];
  while (j < lines.length && !lines[j].startsWith(MARK_END)) {
    theirs.push(lines[j]);
    j++;
  }
  if (j >= lines.length) return null;
  const theirLabel = lines[j].replace(RE_THEIR_LABEL, "").trim();
  return {
    ours: ours.join("\n"),
    theirs: theirs.join("\n"),
    headLabel,
    theirLabel,
  };
}

/**
 * Replace the first well-formed conflict hunk with one side's text (markers removed).
 * @param {string} text
 * @param {"ours" | "theirs"} side
 * @returns {string}
 */
export function replaceFirstConflictHunk(text, side) {
  const lines = String(text ?? "").split(/\r?\n/);
  let start = -1;
  for (let j = 0; j < lines.length; j++) {
    if (lines[j].startsWith(MARK_BEGIN)) {
      start = j;
      break;
    }
  }
  if (start === -1) return text;

  let j = start + 1;
  const ours = [];
  while (j < lines.length && lines[j] !== MARK_MIDDLE) {
    ours.push(lines[j]);
    j++;
  }
  if (j >= lines.length) return text;
  j++;
  const theirs = [];
  while (j < lines.length && !lines[j].startsWith(MARK_END)) {
    theirs.push(lines[j]);
    j++;
  }
  if (j >= lines.length) return text;
  j++;

  const middle = side === "ours" ? ours.join("\n") : theirs.join("\n");
  const beforeLines = lines.slice(0, start);
  const afterLines = lines.slice(j);
  /** @type {string[]} */
  const parts = [];
  if (beforeLines.length) parts.push(beforeLines.join("\n"));
  parts.push(middle);
  if (afterLines.length) parts.push(afterLines.join("\n"));
  return parts.join("\n");
}

/**
 * True if any line looks like an unresolved Git conflict marker.
 * @param {string} text
 */
export function hasConflictMarkerLines(text) {
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (
      line.startsWith(MARK_BEGIN) ||
      line === MARK_MIDDLE ||
      line.startsWith(MARK_END)
    ) {
      return true;
    }
  }
  return false;
}
