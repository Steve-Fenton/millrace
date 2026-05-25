/** Catalog of board INIs under `tasks/` (dotfile, distinct from `*.ini` boards). */
export const BOARD_CATALOG_INI_BASENAME = ".millrace.ini";
/** Millrace-managed data under `tasks/` (column snapshots, etc.). */
export const MILLRACE_DATA_DIRNAME = ".millrace";
/** Column count snapshots (`tasks/.millrace/snapshots.json`). */
export const SNAPSHOTS_JSON_BASENAME = "snapshots.json";
/** Section in that file listing board INI basenames. Legacy section name: `flow`. */
export const BOARD_CATALOG_SECTION = "millrace";
export const LEGACY_BOARD_CATALOG_SECTION = "flow";

/** Default when `tasks/.millrace.ini` omits `archive_closed_after_days` / `cold_storage_archive_after_months`. */
export const DEFAULT_ARCHIVE_CLOSED_AFTER_DAYS = 14;
export const DEFAULT_COLD_STORAGE_ARCHIVE_AFTER_MONTHS = 12;

/** Average Gregorian month length for age cutoffs (archive → cold-storage). */
export const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;
