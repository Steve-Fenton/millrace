import fs from "fs/promises";
import { BOARD_CATALOG_SECTION } from "./constants.js";
import {
  boardCatalogIniPath,
  isBoardCatalogIniSection,
  millraceCatalogKeyBag,
} from "./dataRoot.js";
import { parseIni } from "../assets/js/ini/parseIni.js";
import {
  markDataRootPendingSync,
  readLocalUserIniSections,
} from "./localUserIni.js";
import {
  applyLegacyAdminEmailToUsers,
  parseMillraceUsersFromIniSections,
} from "./millraceUsers.js";

const ADMIN_INI_KEY = "admin_email";

/**
 * @returns {Promise<string[]>}
 */
export async function readMillraceCatalogAdminEmails() {
  try {
    const text = await fs.readFile(boardCatalogIniPath(), "utf8");
    const sections = parseIni(text.replace(/^\uFEFF/, ""));
    const bag = millraceCatalogKeyBag(sections);
    const legacyAdmin = String(
      bag.admin_email ?? bag.adminEmail ?? bag.admin ?? ""
    ).trim();
    const users = applyLegacyAdminEmailToUsers(
      parseMillraceUsersFromIniSections(sections),
      legacyAdmin
    );
    /** @type {Set<string>} */
    const emails = new Set();
    for (const u of users) {
      if (u.admin) emails.add(u.email.toLowerCase());
    }
    if (emails.size === 0 && legacyAdmin) {
      emails.add(legacyAdmin.toLowerCase());
    }
    return [...emails];
  } catch {
    return [];
  }
}

/**
 * Millrace admin email from `[millrace]` in `tasks/.millrace.ini`.
 * @returns {Promise<string>}
 */
export async function readMillraceCatalogAdminEmail() {
  const admins = await readMillraceCatalogAdminEmails();
  return admins[0] ?? "";
}

/**
 * @param {string} email trimmed; empty clears the stored value
 */
export async function writeMillraceCatalogAdminEmail(email) {
  const value = String(email ?? "").trim().replace(/\r?\n/g, " ");
  const catalogPath = boardCatalogIniPath();

  let catalogText = "";
  try {
    catalogText = await fs.readFile(catalogPath, "utf8");
  } catch {
    /* missing catalog */
  }

  if (!catalogText.trim()) {
    const lines = [`[${BOARD_CATALOG_SECTION}]`];
    if (value) lines.push(`${ADMIN_INI_KEY} = ${value}`);
    await fs.writeFile(catalogPath, `${lines.join("\n")}\n`, "utf8");
    await markDataRootPendingSync();
    return;
  }

  const lines = catalogText.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let inCatalogSection = false;
  let updatedAdmin = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const secMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (secMatch) {
      if (isBoardCatalogIniSection(secMatch[1])) {
        inCatalogSection = true;
        out.push(`[${BOARD_CATALOG_SECTION}]`);
        continue;
      }
      inCatalogSection = false;
      out.push(line);
      continue;
    }
    if (inCatalogSection && /^admin(?:_email)?\s*=/i.test(trimmed)) {
      if (value) {
        const indent = line.match(/^\s*/)?.[0] ?? "";
        out.push(`${indent}${ADMIN_INI_KEY} = ${value}`);
      }
      updatedAdmin = true;
      continue;
    }
    out.push(line);
  }

  if (!updatedAdmin && value) {
    const idx = out.findIndex((l) => l === `[${BOARD_CATALOG_SECTION}]`);
    if (idx >= 0) {
      out.splice(idx + 1, 0, `${ADMIN_INI_KEY} = ${value}`);
    } else {
      out.push("", `[${BOARD_CATALOG_SECTION}]`, `${ADMIN_INI_KEY} = ${value}`);
    }
  }

  await fs.writeFile(catalogPath, out.join("\n"), "utf8");
  await markDataRootPendingSync();
}

/**
 * Whether this machine should run Millrace-owner background work (e.g. archiving).
 * True when `tasks/localuser.ini` `[user]` mine matches a Millrace admin user.
 * @returns {Promise<boolean>}
 */
export async function localUserMatchesMillraceAdmin() {
  const admins = await readMillraceCatalogAdminEmails();
  if (admins.length === 0) return false;
  const sections = await readLocalUserIniSections();
  const mine = String(sections.user?.mine ?? sections.user?.Mine ?? "").trim();
  if (!mine) return false;
  const low = mine.toLowerCase();
  return admins.some((admin) => admin === low);
}

/**
 * Whether this machine should follow Millrace-owner updates (install/cycle after git pull).
 * True for anyone who is not the Millrace admin.
 * @returns {Promise<boolean>}
 */
export async function localUserIsNonOwnerMillraceFollower() {
  return !(await localUserMatchesMillraceAdmin());
}
