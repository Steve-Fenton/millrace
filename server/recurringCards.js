import fs from "fs/promises";
import path from "path";
import {
  columnNameForIniItem,
  normalizeNextActionDate,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../assets/js/ini/cardIni.js";
import { defaultColumnIndex } from "../assets/js/ini/columnResolve.js";
import {
  addRecurrenceInterval,
  localYmd,
  parseRecurrence,
} from "../assets/js/ini/recurrence.js";
import { resolveCardSwimlaneIndex } from "../assets/js/ini/swimlaneResolve.js";
import { linksWithSourceCardLink } from "../assets/js/ui/cardDeepLink.js";
import { isAggregateBoard } from "../assets/js/models/aggregateBoard.js";
import { columnTypeOf } from "../assets/js/models/boardModel.js";
import { parseTaskCardIniFull } from "../assets/js/models/taskModel.js";
import { loadBoardCatalog } from "./board/catalog.js";
import { newCardId, sanitizeSegment } from "./board/cardPaths.js";
import { loadBoardModelForSlug, maxSortOrderForCell } from "./board/model.js";
import { dataRoot } from "./dataRoot.js";
import {
  markDataRootPendingSync,
  readLocalUserIniSections,
} from "./localUserIni.js";

/**
 * Column that receives copies of recurring cards: the first `type = to_do`
 * column (whatever its title), else the board's first column.
 * @param {import("../assets/js/models/boardModel.js").ColumnDef[]} columns
 */
export function recurringTargetColumnIndex(columns) {
  const list = [...(Array.isArray(columns) ? columns : [])].sort(
    (a, b) => a.index - b.index
  );
  const todo = list.find((c) => columnTypeOf(c) === "to_do");
  return todo ? todo.index : defaultColumnIndex(list);
}

/**
 * True when an `[item]` record is an open recurring card owned by `mine` whose
 * next action date is today or earlier (`todayYmd` is local YYYY-MM-DD).
 * Cards owned by someone else (or nobody) wait until their owner runs Millrace,
 * so nothing piles up for people who are away.
 * @param {Record<string, string>} item
 * @param {string} todayYmd
 * @param {string} mine — local user's email (`[user] mine`)
 */
export function recurringItemIsDue(item, todayYmd, mine) {
  if (String(item?.closed ?? "").trim()) return false;
  const me = String(mine ?? "").trim().toLowerCase();
  const owner = String(item?.owner ?? "").trim().toLowerCase();
  if (!me || owner !== me) return false;
  if (!parseRecurrence(item?.recurrence)) return false;
  const nad = normalizeNextActionDate(item?.next_action_date);
  return Boolean(nad) && nad <= todayYmd;
}

/** Keys not carried from a recurring card onto its spawned copy. */
const SPAWN_SKIP_KEYS = new Set([
  "id",
  "created",
  "closed",
  "column",
  "swimlane",
  "sort_order",
  "recurrence",
  "next_action_date",
]);

/** Fallback origin for "Source card" links when no request/server address is known. */
const DEFAULT_BASE_HREF = "http://localhost:8888/";

/** Per-slug in-flight runs so concurrent board loads never double-spawn. */
const inFlight = new Map();

/**
 * Spawn copies of due recurring cards on one board and roll their next action
 * dates forward. Safe to call repeatedly; does nothing when nothing is due.
 * @param {string} slugRaw
 * @param {{ nowMs?: number, mine?: string, baseHref?: string }} [opts] — `mine` defaults to
 *   `[user] mine` in localuser.ini; `baseHref` is the app origin for the "Source card" link
 * @returns {Promise<{ spawned: Array<{ source: string, filename: string }> }>}
 */
export function runRecurringCardsForSlug(slugRaw, opts = {}) {
  const slug = sanitizeSegment(slugRaw);
  const prev = inFlight.get(slug) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => spawnDueRecurringCards(slug, opts));
  inFlight.set(slug, next);
  void next.finally(() => {
    if (inFlight.get(slug) === next) inFlight.delete(slug);
  }).catch(() => {});
  return next;
}

/**
 * @param {string} slug
 * @param {{ nowMs?: number, mine?: string, baseHref?: string }} opts
 */
async function spawnDueRecurringCards(slug, opts) {
  /** @type {Array<{ source: string, filename: string }>} */
  const spawned = [];
  let mine = opts.mine;
  if (mine === undefined) {
    const sections = await readLocalUserIniSections();
    mine = String(sections.user?.mine ?? sections.user?.Mine ?? "");
  }
  mine = mine.trim();
  if (!mine) return { spawned };
  let model;
  try {
    model = await loadBoardModelForSlug(slug);
  } catch {
    return { spawned };
  }
  if (isAggregateBoard(model)) return { spawned };

  const columns = model.columns ?? [];
  const swimlanes = model.swimlanes ?? [];
  if (!columns.length) return { spawned };

  const nowMs = opts.nowMs ?? Date.now();
  const todayYmd = localYmd(nowMs);
  const boardRoot = path.join(dataRoot(), "tasks", slug);

  let dirents;
  try {
    dirents = await fs.readdir(boardRoot, { withFileTypes: true });
  } catch {
    return { spawned };
  }

  const targetCol = recurringTargetColumnIndex(columns);

  for (const ent of dirents) {
    if (!ent.isFile() || !ent.name.endsWith(".ini")) continue;
    const srcPath = path.join(boardRoot, ent.name);
    let raw;
    try {
      raw = await fs.readFile(srcPath, "utf8");
    } catch {
      continue;
    }
    const { item, links } = parseTaskCardIniFull(raw);
    if (!recurringItemIsDue(item, todayYmd, mine)) continue;

    const recurrence = parseRecurrence(item.recurrence);
    const dueYmd = normalizeNextActionDate(item.next_action_date);
    const laneIdx = resolveCardSwimlaneIndex(item.swimlane, swimlanes);
    const maxSo = await maxSortOrderForCell(
      slug,
      targetCol,
      laneIdx,
      columns,
      swimlanes,
      null
    );

    const id = newCardId();
    /** @type {Record<string, string>} */
    const copy = { id };
    for (const [k, v] of Object.entries(item)) {
      if (!SPAWN_SKIP_KEYS.has(k)) copy[k] = v;
    }
    copy.next_action_date = dueYmd;
    const laneName = swimlaneNameForIniItem(swimlanes, laneIdx);
    if (laneName !== undefined) copy.swimlane = laneName;
    copy.column = columnNameForIniItem(columns, targetCol);
    copy.sort_order = String(Math.round(maxSo + 10));
    copy.created = new Date(nowMs).toISOString();

    const filename = `${id}.ini`;
    try {
      await fs.writeFile(
        path.join(boardRoot, filename),
        serializeFullCardIni(
          copy,
          linksWithSourceCardLink(links, {
            boardSlug: slug,
            filename: ent.name,
            baseHref: opts.baseHref || DEFAULT_BASE_HREF,
          })
        ),
        "utf8"
      );
    } catch (e) {
      console.warn("[millrace] recurring: could not create copy of", ent.name, e);
      continue;
    }

    item.next_action_date = addRecurrenceInterval(todayYmd, recurrence);
    try {
      await fs.writeFile(srcPath, serializeFullCardIni(item, links), "utf8");
    } catch (e) {
      console.warn("[millrace] recurring: could not update", ent.name, e);
    }
    spawned.push({ source: ent.name, filename });
    console.error(
      `[millrace] Recurring card ${slug}/${ent.name} → ${filename}; next ${item.next_action_date}`
    );
  }

  if (spawned.length) await markDataRootPendingSync();
  return { spawned };
}

/**
 * Run the recurring sweep for every board in the catalog (startup).
 * @param {{ baseHref?: string }} [opts]
 */
export async function runRecurringCardsForCatalogSlugs(opts = {}) {
  let catalog = [];
  try {
    catalog = await loadBoardCatalog();
  } catch {
    return;
  }
  for (const entry of catalog) {
    try {
      await runRecurringCardsForSlug(entry.slug, opts);
    } catch (e) {
      console.warn("[millrace] recurring sweep failed for", entry.slug, e);
    }
  }
}
