/**
 * Minimal INI parser: sections as [name], keys as key = value.
 * Lines starting with ; are comments.
 */
export function parseIni(text) {
  /** @type {Record<string, Record<string, string>>} */
  const sections = {};
  let current = "_root";
  sections[current] = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;

    const secMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (secMatch) {
      current = secMatch[1];
      if (!sections[current]) sections[current] = {};
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    sections[current][key] = value;
  }

  return sections;
}
