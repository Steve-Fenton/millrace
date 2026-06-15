import fs from "fs/promises";
import path from "path";
import { dataRoot } from "../dataRoot.js";
import { ensureDir } from "../fsUtil.js";

export function sanitizeSegment(s) {
  const t = String(s)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return t || "board";
}

/** Slug from `[board]` metadata (matches client `boardSlugFrom`). */
export function boardSlugFromMeta(board) {
  const raw = String(board?.slug ?? board?.name ?? "board").trim();
  return sanitizeSegment(raw);
}

export function newCardId() {
  return `FLOW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {unknown} name */
export function safeCardIniFilename(name) {
  const base = path.basename(String(name ?? "").trim());
  if (!base.endsWith(".ini")) return null;
  if (!/^[\w.-]+\.ini$/i.test(base)) return null;
  return base;
}

/**
 * Cards live at tasks/{slug}/{filename}.ini (flat). Legacy: tasks/{slug}/columns.{n}/{filename}.
 * @param {string} slug
 * @param {number} col — hint for legacy layout search order
 * @param {string} filename
 * @returns {Promise<string | null>} absolute path or null
 */
export async function resolveCardFilePath(slug, col, filename) {
  const flat = path.join(dataRoot(), "tasks", slug, filename);
  try {
    await fs.access(flat);
    return flat;
  } catch {
    /* legacy */
  }

  const primary = path.join(
    dataRoot(),
    "tasks",
    slug,
    `columns.${col}`,
    filename
  );
  try {
    await fs.access(primary);
    return primary;
  } catch {
    /* continue */
  }

  const boardRoot = path.join(dataRoot(), "tasks", slug);
  let dirents;
  try {
    dirents = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const ent of dirents) {
    if (!ent.isDirectory()) continue;
    if (!/^columns\.\d+$/.test(ent.name)) continue;
    const candidate = path.join(boardRoot, ent.name, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Move a card file from the active board folder to `tasks/{slug}/abandoned/{year}/`.
 * @param {string} slug
 * @param {string} srcPath absolute path to the card INI
 * @param {string} filename basename of the card file
 * @returns {Promise<string>} absolute path to the abandoned file
 */
export async function abandonCardFile(slug, srcPath, filename) {
  const year = new Date().getUTCFullYear();
  const destDir = path.join(dataRoot(), "tasks", slug, "abandoned", String(year));
  await ensureDir(destDir);
  const destPath = path.join(destDir, filename);
  try {
    await fs.access(destPath);
    throw new Error(`Abandoned card already exists: ${filename}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Abandoned card already exists")) {
      throw e;
    }
    /* destination available */
  }
  await fs.rename(srcPath, destPath);
  return destPath;
}
