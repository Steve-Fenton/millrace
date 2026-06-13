import fs from "fs/promises";
import { parseIni } from "../assets/js/ini/parseIni.js";
import { boardCatalogIniPath } from "./dataRoot.js";
import { markDataRootPendingSync } from "./localUserIni.js";

const USERS_SECTION_RE = /^users\.(\d+)$/i;

/**
 * @typedef {{ index: number, email: string, name: string, active: boolean }} MillraceUserDef
 */

/**
 * @param {Record<string, Record<string, string>>} sections
 * @returns {MillraceUserDef[]}
 */
export function parseMillraceUsersFromIniSections(sections) {
  /** @type {MillraceUserDef[]} */
  const users = [];
  for (const name of Object.keys(sections)) {
    const usr = name.match(USERS_SECTION_RE);
    if (!usr) continue;
    const idx = Number(usr[1]);
    const sec = sections[name];
    const email = String(sec.email ?? "").trim();
    if (!email) continue;
    const displayName = String(sec.name ?? "").trim();
    const inactiveRaw = String(sec.inactive ?? sec.Inactive ?? "")
      .trim()
      .toLowerCase();
    const inactive =
      inactiveRaw === "true" ||
      inactiveRaw === "1" ||
      inactiveRaw === "yes";
    const activeRaw = String(sec.active ?? sec.Active ?? "")
      .trim()
      .toLowerCase();
    const activeExplicitFalse =
      activeRaw === "false" ||
      activeRaw === "0" ||
      activeRaw === "no";
    const active = !inactive && !activeExplicitFalse;
    users.push({
      index: idx,
      email,
      name: displayName || email,
      active,
    });
  }
  users.sort((a, b) => a.index - b.index);
  return users;
}

/**
 * @param {string} name section name from `[name]`
 */
function isUsersIniSection(name) {
  return USERS_SECTION_RE.test(String(name ?? ""));
}

/**
 * @param {MillraceUserDef[]} users
 * @returns {string[]}
 */
function serializeMillraceUsersIniLines(users) {
  /** @type {string[]} */
  const lines = [];
  const sorted = [...users].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    const idx = i + 1;
    lines.push(`[users.${idx}]`);
    lines.push(`email = ${String(u.email).trim()}`);
    lines.push(`name = ${String(u.name ?? "").trim()}`);
    if (u.active === false) {
      lines.push("active = false");
    }
    lines.push("");
  }
  return lines;
}

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function stripUsersSectionsFromLines(lines) {
  /** @type {string[]} */
  const out = [];
  let inUsersSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const secMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (secMatch) {
      inUsersSection = isUsersIniSection(secMatch[1]);
      if (!inUsersSection) out.push(line);
      continue;
    }
    if (!inUsersSection) out.push(line);
  }
  while (out.length > 0 && out[out.length - 1].trim() === "") {
    out.pop();
  }
  return out;
}

/**
 * Millrace users from `[users.N]` in `tasks/.millrace.ini`.
 * @returns {Promise<{ email: string, name: string, active: boolean }[]>}
 */
export async function readMillraceCatalogUsers() {
  try {
    const text = await fs.readFile(boardCatalogIniPath(), "utf8");
    const sections = parseIni(text.replace(/^\uFEFF/, ""));
    return parseMillraceUsersFromIniSections(sections).map((u) => ({
      email: u.email,
      name: u.name,
      active: u.active,
    }));
  } catch {
    return [];
  }
}

/**
 * @param {{ email: string, name: string, active?: boolean }[]} users
 * @returns {string | null} error message, or null if valid
 */
export function validateMillraceUsersPayload(users) {
  if (!Array.isArray(users)) {
    return "Expected users array.";
  }
  const seen = new Set();
  for (const row of users) {
    const email = String(row?.email ?? "").trim();
    const name = String(row?.name ?? "").trim();
    if (!email && !name) continue;
    if (!email) {
      return "Each user row needs an email (or clear the display name on that row).";
    }
    if (!email.includes("@")) {
      return `Invalid email for user: ${email}`;
    }
    const low = email.toLowerCase();
    if (seen.has(low)) {
      return `Duplicate user email: ${email}`;
    }
    seen.add(low);
  }
  return null;
}

/**
 * Replace all `[users.N]` sections in `tasks/.millrace.ini`.
 * @param {{ email: string, name: string, active?: boolean }[]} users
 */
export async function writeMillraceCatalogUsers(users) {
  const err = validateMillraceUsersPayload(users);
  if (err) throw new Error(err);

  /** @type {MillraceUserDef[]} */
  const normalized = [];
  let idx = 1;
  for (const row of users) {
    const email = String(row?.email ?? "").trim();
    if (!email) continue;
    const name = String(row?.name ?? "").trim() || email;
    normalized.push({
      index: idx++,
      email,
      name,
      active: row?.active !== false,
    });
  }

  const catalogPath = boardCatalogIniPath();
  let catalogText = "";
  try {
    catalogText = await fs.readFile(catalogPath, "utf8");
  } catch {
    /* missing catalog */
  }

  const baseLines = catalogText.trim()
    ? stripUsersSectionsFromLines(catalogText.split(/\r?\n/))
    : [];
  const userLines = serializeMillraceUsersIniLines(normalized);
  const out = [...baseLines];
  if (userLines.length > 0) {
    if (out.length > 0) out.push("");
    out.push(...userLines);
  }
  const text = out.length > 0 ? `${out.join("\n").replace(/\n+$/, "\n")}\n` : "";
  await fs.writeFile(catalogPath, text, "utf8");
  await markDataRootPendingSync();
}
