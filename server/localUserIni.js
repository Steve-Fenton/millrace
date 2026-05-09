import fs from "fs/promises";
import path from "path";
import { dataRoot } from "./dataRoot.js";
import { ensureDir } from "./fsUtil.js";
import { parseIni } from "../assets/js/ini/parseIni.js";

const LOCAL_USER_REL = path.join("tasks", "localuser.ini");

/** @returns {string} */
export function localUserPath() {
  return path.join(dataRoot(), LOCAL_USER_REL);
}

/**
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export async function readLocalUserIniSections() {
  try {
    const text = await fs.readFile(localUserPath(), "utf8");
    return parseIni(text.replace(/^\uFEFF/, ""));
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, string> | undefined} pref `[preferences]` section
 * @returns {"automatic" | "manual"}
 */
export function syncModeFromPreferencesSection(pref) {
  const raw = String(pref?.sync_mode ?? pref?.syncMode ?? "")
    .trim()
    .toLowerCase();
  return raw === "manual" ? "manual" : "automatic";
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
export function serializeLocalUserIniFile(sections) {
  const out = [];
  const allNames = Object.keys(sections).filter((n) => n !== "_root");
  /** @param {string} name */
  function emitSection(name) {
    const sec = sections[name];
    if (!sec || typeof sec !== "object") return;
    const keys = Object.keys(sec).filter((k) => {
      const v = sec[k];
      return v != null && String(v).trim() !== "";
    });
    if (keys.length === 0) return;
    keys.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    out.push(`[${name}]`);
    for (const k of keys) {
      const val = String(sec[k]).trim().replace(/\r?\n/g, " ");
      out.push(`${k} = ${val}`);
    }
    out.push("");
  }
  const preferred = ["user", "flow", "preferences"];
  const seen = new Set();
  for (const n of preferred) {
    if (!allNames.includes(n)) continue;
    emitSection(n);
    seen.add(n);
  }
  for (const n of [...allNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  )) {
    if (seen.has(n)) continue;
    emitSection(n);
  }
  if (out.length === 0) return "";
  return out.join("\n").replace(/\n+\z/, "\n");
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
export async function writeLocalUserIniSections(sections) {
  const text = serializeLocalUserIniFile(sections);
  const tasksDir = path.join(dataRoot(), "tasks");
  await ensureDir(tasksDir);
  if (!text.trim()) {
    try {
      await fs.unlink(localUserPath());
    } catch {
      /* absent or unreadable */
    }
    return;
  }
  await fs.writeFile(localUserPath(), text, "utf8");
}

/**
 * @param {Record<string, Record<string, string>>} sections
 */
export function pendingSyncFromSections(sections) {
  const v = sections.flow?.pending_sync ?? sections.flow?.pendingSync ?? "";
  return /^1|true|yes$/i.test(String(v).trim());
}

export async function markDataRootPendingSync() {
  try {
    const sections = await readLocalUserIniSections();
    sections.flow = sections.flow ?? {};
    sections.flow.pending_sync = "1";
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn("[flow] could not set pending_sync:", e);
  }
}

export async function clearDataRootPendingSync() {
  try {
    const sections = await readLocalUserIniSections();
    if (!sections.flow) return;
    delete sections.flow.pending_sync;
    delete sections.flow.pendingSync;
    await writeLocalUserIniSections(sections);
  } catch (e) {
    console.warn("[flow] could not clear pending_sync:", e);
  }
}

export async function writeLocalUserIni(owner) {
  const value = String(owner).trim();
  if (!value) return;
  const line = value.replace(/\r?\n/g, " ");
  const sections = await readLocalUserIniSections();
  sections.user = sections.user ?? {};
  sections.user.owner = line;
  await writeLocalUserIniSections(sections);
}
