import fs from "fs/promises";
import {
  columnIsDone,
  columnTypeOf,
} from "../assets/js/models/boardModel.js";
import { loadBoardCatalog, loadBoardColumnAndSwimlaneDefsForSlug } from "./boardCatalog.js";
import { gatherOpenBoardRows } from "./archiveAnalytics.js";
import { snapshotsJsonPath } from "./dataRoot.js";

/** Reserved top-level key for snapshot settings (not a board slug). */
export const SNAPSHOTS_SETTINGS_KEY = "settings";

/**
 * @typedef {{ name: string, type: string, count: number }} ColumnCountSnapshot
 * @typedef {{ date: string, columns: ColumnCountSnapshot[] }} BoardColumnSnapshot
 * @typedef {{ boards?: string[] }} SnapshotsSettings
 * @typedef {{ settings: SnapshotsSettings, boardSnapshots: Record<string, BoardColumnSnapshot[]> }} SnapshotsDocument
 */

/**
 * @param {number} [ms]
 * @returns {string} UTC calendar date `YYYY-MM-DD`
 */
export function utcSnapshotDateString(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {SnapshotsSettings | undefined} settings
 * @returns {string[] | null} `null` = all non-aggregate catalog boards
 */
export function boardSlugsFromSnapshotSettings(settings) {
  const raw = settings?.boards;
  if (!Array.isArray(raw)) return null;
  const list = raw.map((s) => String(s).trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

/**
 * @param {unknown} snap
 * @returns {BoardColumnSnapshot}
 */
export function normalizeBoardSnapshot(snap) {
  const o = snap && typeof snap === "object" ? /** @type {Record<string, unknown>} */ (snap) : {};
  const columnsRaw = Array.isArray(o.columns) ? o.columns : [];
  /** @type {ColumnCountSnapshot[]} */
  const columns = [];
  for (const col of columnsRaw) {
    if (!col || typeof col !== "object") continue;
    const c = /** @type {Record<string, unknown>} */ (col);
    columns.push({
      name: String(c.name ?? "").trim(),
      type: String(c.type ?? "").trim(),
      count: Number(c.count) || 0,
    });
  }
  return {
    date: String(o.date ?? "").trim(),
    columns,
  };
}

/**
 * @param {unknown} raw
 * @returns {SnapshotsDocument}
 */
export function parseSnapshotsDocument(raw) {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};
  const settingsRaw =
    data[SNAPSHOTS_SETTINGS_KEY] && typeof data[SNAPSHOTS_SETTINGS_KEY] === "object"
      ? /** @type {SnapshotsSettings} */ (data[SNAPSHOTS_SETTINGS_KEY])
      : {};
  const settings = {
    boards: Array.isArray(settingsRaw.boards)
      ? settingsRaw.boards.map((s) => String(s).trim()).filter(Boolean)
      : [],
  };

  /** @type {Record<string, BoardColumnSnapshot[]>} */
  const boardSnapshots = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === SNAPSHOTS_SETTINGS_KEY || !Array.isArray(value)) continue;
    boardSnapshots[key] = value.map(normalizeBoardSnapshot);
  }

  return { settings, boardSnapshots };
}

/**
 * @param {SnapshotsSettings} settings
 * @param {Record<string, BoardColumnSnapshot[]>} boardSnapshots
 * @returns {string}
 */
export function serializeSnapshotsDocument(settings, boardSnapshots) {
  /** @type {Record<string, unknown>} */
  const out = {
    [SNAPSHOTS_SETTINGS_KEY]: {
      boards: settings.boards ?? [],
    },
  };

  const slugs = Object.keys(boardSnapshots).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  for (const slug of slugs) {
    out[slug] = boardSnapshots[slug] ?? [];
  }

  return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * @param {string} slug
 * @param {() => Promise<number>} [nowMs]
 * @returns {Promise<BoardColumnSnapshot>}
 */
export async function captureInFlightColumnCountsForSlug(
  slug,
  nowMs = async () => Date.now()
) {
  const { columns } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const rows = await gatherOpenBoardRows(slug);
  const colList = [...columns]
    .filter((col) => !columnIsDone(col))
    .sort((a, b) => a.index - b.index);

  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const row of rows) {
    const idx = row.columnIndex;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }

  return {
    date: utcSnapshotDateString(await nowMs()),
    columns: colList.map((col) => ({
      name: String(col.title ?? "").trim() || `Column ${col.index}`,
      type: columnTypeOf(col),
      count: counts.get(col.index) ?? 0,
    })),
  };
}

/**
 * Replace today's snapshot for `slug` or append a new dated entry.
 * @param {BoardColumnSnapshot[]} existing
 * @param {BoardColumnSnapshot} today
 */
export function upsertTodayBoardSnapshot(existing, today) {
  const next = [...existing];
  const idx = next.findIndex((snap) => snap.date === today.date);
  if (idx >= 0) {
    next[idx] = today;
    return next;
  }
  next.push(today);
  return next;
}

/**
 * @param {{
 *   loadBoardCatalog?: typeof loadBoardCatalog;
 *   captureInFlightColumnCountsForSlug?: typeof captureInFlightColumnCountsForSlug;
 *   readFile?: typeof fs.readFile;
 *   writeFile?: typeof fs.writeFile;
 *   nowMs?: () => Promise<number>;
 * }} [deps]
 * @returns {Promise<boolean>} whether `snapshots.json` was rewritten
 */
export async function captureTodayColumnSnapshots(deps = {}) {
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;
  const captureFn =
    deps.captureInFlightColumnCountsForSlug ?? captureInFlightColumnCountsForSlug;
  const readFile = deps.readFile ?? fs.readFile.bind(fs);
  const writeFile = deps.writeFile ?? fs.writeFile.bind(fs);
  const nowMs = deps.nowMs ?? (async () => Date.now());

  const jsonPath = snapshotsJsonPath();
  let doc = /** @type {SnapshotsDocument} */ ({
    settings: { boards: [] },
    boardSnapshots: {},
  });
  try {
    const text = await readFile(jsonPath, "utf8");
    doc = parseSnapshotsDocument(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    /* new or invalid file — start fresh */
  }

  const catalog = await loadCatalog();
  const filter = boardSlugsFromSnapshotSettings(doc.settings);
  const boards = catalog.filter((entry) => {
    if (entry.kind === "aggregate") return false;
    if (!filter) return true;
    return filter.includes(entry.slug);
  });

  const boardSnapshots = { ...doc.boardSnapshots };
  for (const entry of boards) {
    const today = await captureFn(entry.slug, nowMs);
    boardSnapshots[entry.slug] = upsertTodayBoardSnapshot(
      boardSnapshots[entry.slug] ?? [],
      today
    );
  }

  const nextText = serializeSnapshotsDocument(doc.settings, boardSnapshots);
  let previous = "";
  try {
    previous = await readFile(jsonPath, "utf8");
  } catch {
    /* new file */
  }
  if (previous === nextText) return false;
  await writeFile(jsonPath, nextText, "utf8");
  return true;
}
