import fs from "fs/promises";
import {
  DEFAULT_ARCHIVE_CLOSED_AFTER_DAYS,
  DEFAULT_COLD_STORAGE_ARCHIVE_AFTER_MONTHS,
} from "./constants.js";
import { boardCatalogIniPath, millraceCatalogKeyBag } from "./dataRoot.js";
import { parseIni } from "../assets/js/ini/parseIni.js";

/**
 * Retention thresholds from `[millrace]` in `tasks/.millrace.ini` (same section as `boards`).
 * @returns {Promise<{ archiveClosedAfterDays: number, coldStorageArchiveAfterMonths: number }>}
 */
export async function readMillraceCatalogRetentionSettings() {
  let archiveClosedAfterDays = DEFAULT_ARCHIVE_CLOSED_AFTER_DAYS;
  let coldStorageArchiveAfterMonths = DEFAULT_COLD_STORAGE_ARCHIVE_AFTER_MONTHS;
  try {
    const text = await fs.readFile(boardCatalogIniPath(), "utf8");
    const sections = parseIni(text.replace(/^\uFEFF/, ""));
    const bag = millraceCatalogKeyBag(sections);
    const ad =
      bag.archive_closed_after_days ?? bag.archiveClosedAfterDays;
    const cm =
      bag.cold_storage_archive_after_months ??
      bag.coldStorageArchiveAfterMonths;
    if (ad !== undefined && String(ad).trim() !== "") {
      const n = Number.parseInt(String(ad).trim(), 10);
      if (Number.isFinite(n) && n >= 0) archiveClosedAfterDays = n;
    }
    if (cm !== undefined && String(cm).trim() !== "") {
      const n = Number.parseFloat(String(cm).trim());
      if (Number.isFinite(n) && n >= 0) coldStorageArchiveAfterMonths = n;
    }
  } catch {
    /* missing or unreadable catalog — defaults */
  }
  return { archiveClosedAfterDays, coldStorageArchiveAfterMonths };
}
