import { parseIni } from "../ini/parseIni.js";

/** @typedef {'options' | 'to_do' | 'in_progress' | 'waiting' | 'done'} ColumnType */

/** @type {readonly ColumnType[]} */
export const COLUMN_TYPES = [
  "options",
  "to_do",
  "in_progress",
  "waiting",
  "done",
];

/** @type {Record<ColumnType, string>} */
export const COLUMN_TYPE_LABELS = {
  options: "Options",
  to_do: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

/**
 * @param {string | undefined} raw
 * @returns {ColumnType | undefined}
 */
export function parseColumnTypeRaw(raw) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return undefined;
  return COLUMN_TYPES.find((t) => t === key);
}

/**
 * @param {ColumnDef | { type?: string, isDone?: boolean }} col
 * @returns {ColumnType}
 */
export function columnTypeOf(col) {
  const parsed = parseColumnTypeRaw(col?.type);
  if (parsed) return parsed;
  if (col?.isDone === true) return "done";
  return "in_progress";
}

/**
 * @param {ColumnDef | { type?: string, isDone?: boolean }} col
 * @returns {boolean}
 */
export function columnIsDone(col) {
  return columnTypeOf(col) === "done";
}

/**
 * @typedef {{ index: number, title: string, type: ColumnType, isDone?: boolean, wipLimit?: number }} ColumnDef
 * @typedef {{ index: number, title: string }} SwimlaneDef
 * @typedef {{ index: number, email: string, name: string, active?: boolean }} BoardUserDef
 * @typedef {{ name?: string, slug?: string }} BoardMeta
 * @typedef {{ board: BoardMeta, columns: ColumnDef[], swimlanes: SwimlaneDef[], users: BoardUserDef[] }} BoardModel
 */

/**
 * @param {Record<string, Record<string, string>>} sections
 * @returns {BoardModel}
 */
/**
 * @param {BoardUserDef[] | undefined} users
 * @param {string | undefined} ownerEmail
 * @returns {string}
 */
export function ownerDisplayLabel(ownerEmail, users) {
  const raw = String(ownerEmail ?? "").trim();
  if (!raw) return "";
  const list = users ?? [];
  const low = raw.toLowerCase();
  for (const u of list) {
    if (u.email.toLowerCase() === low) {
      const n = String(u.name ?? "").trim();
      return n || u.email;
    }
  }
  return raw;
}

function sortBoardUsersByDisplayName(list) {
  return [...list].sort((a, b) => {
    const la = (a.name.trim() ? a.name : a.email).toLowerCase();
    const lb = (b.name.trim() ? b.name : b.email).toLowerCase();
    const c = la.localeCompare(lb, undefined, { sensitivity: "base" });
    if (c !== 0) return c;
    return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
  });
}

/**
 * All board users with an email, sorted for display (active and inactive).
 * @param {BoardUserDef[] | undefined} users
 * @returns {BoardUserDef[]}
 */
export function boardUsersSortedForUi(users) {
  const list = Array.isArray(users)
    ? users.filter((u) => String(u.email ?? "").trim())
    : [];
  return sortBoardUsersByDisplayName(list);
}

/**
 * Active board users only (for owner picker and owner filter lists).
 * @param {BoardUserDef[] | undefined} users
 * @returns {BoardUserDef[]}
 */
export function boardActiveUsersSortedForUi(users) {
  return boardUsersSortedForUi(users).filter((u) => u.active !== false);
}

/**
 * Distinct owner emails for the board filter: active configured users only (empty if none).
 * @param {BoardUserDef[] | undefined} users
 * @returns {string[]}
 */
export function boardOwnerEmailsForFilter(users) {
  return boardActiveUsersSortedForUi(users).map((u) => u.email);
}

/**
 * @param {BoardUserDef[] | undefined} users
 * @param {string | undefined} email
 * @returns {BoardUserDef | undefined}
 */
export function boardUserEntryForEmail(users, email) {
  const raw = String(email ?? "").trim();
  if (!raw) return undefined;
  const low = raw.toLowerCase();
  for (const u of users ?? []) {
    if (String(u.email ?? "").trim().toLowerCase() === low) return u;
  }
  return undefined;
}

/**
 * Whether `ownerEmail` may be written as card owner (new card or owner change).
 * Emails not listed on the board stay allowed. Inactive listed users may only remain unchanged.
 * @param {string | undefined} ownerEmail
 * @param {BoardUserDef[] | undefined} users
 * @param {string | undefined} previousOwnerEmail
 */
export function canAssignCardOwner(ownerEmail, users, previousOwnerEmail) {
  const o = String(ownerEmail ?? "").trim();
  if (!o) return true;
  const prev = String(previousOwnerEmail ?? "").trim();
  if (prev && o.toLowerCase() === prev.toLowerCase()) return true;
  const u = boardUserEntryForEmail(users, o);
  if (!u) return true;
  return u.active !== false;
}

export function sectionsToBoardModel(sections) {
  const board = sections.board ?? {};
  /** @type {ColumnDef[]} */
  const columns = [];
  /** @type {SwimlaneDef[]} */
  const swimlanes = [];
  /** @type {BoardUserDef[]} */
  const users = [];

  for (const name of Object.keys(sections)) {
    const col = name.match(/^columns\.(\d+)$/);
    if (col) {
      const idx = Number(col[1]);
      const sec = sections[name];
      const title = sec.title ?? `Column ${idx}`;
      const doneRaw = String(sec.is_done ?? "").trim().toLowerCase();
      const isDoneLegacy =
        doneRaw === "true" || doneRaw === "1" || doneRaw === "yes";
      const typeKey =
        Object.keys(sec).find((k) => k.toLowerCase() === "type") ?? "type";
      const typeRaw = sec[typeKey];
      let type = parseColumnTypeRaw(typeRaw);
      if (!type && isDoneLegacy) type = "done";
      if (!type) type = "in_progress";

      let wipLimit = undefined;
      const wipRaw = sec.wip_limit ?? sec.wipLimit;
      if (wipRaw !== undefined && String(wipRaw).trim() !== "") {
        const n = Number(String(wipRaw).trim());
        if (Number.isFinite(n) && n >= 0) wipLimit = n;
      }

      /** @type {ColumnDef} */
      const colEntry = { index: idx, title, type };
      if (type === "done") colEntry.isDone = true;
      if (wipLimit !== undefined) colEntry.wipLimit = wipLimit;
      columns.push(colEntry);
      continue;
    }
    const lane = name.match(/^swimlanes\.(\d+)$/);
    if (lane) {
      const idx = Number(lane[1]);
      const title = sections[name].title ?? `Lane ${idx}`;
      swimlanes.push({ index: idx, title });
      continue;
    }
    const usr = name.match(/^users\.(\d+)$/);
    if (usr) {
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
  }

  columns.sort((a, b) => a.index - b.index);
  swimlanes.sort((a, b) => a.index - b.index);
  users.sort((a, b) => a.index - b.index);

  return { board, columns, swimlanes, users };
}

/**
 * @param {string} iniText
 * @returns {BoardModel}
 */
export function parseBoardIni(iniText) {
  return sectionsToBoardModel(parseIni(iniText));
}

/**
 * `tasks/localuser.ini` `[preferences] sync_mode` — default automatic unless explicitly `manual`.
 * @param {string | undefined} syncMode
 * @returns {boolean}
 */
export function userPreferenceSyncModeIsAutomatic(syncMode) {
  const raw = String(syncMode ?? "").trim().toLowerCase();
  return raw !== "manual";
}

/**
 * Kanban boards require exactly one column with type Done (`type = done` or legacy `is_done`).
 * @param {BoardModel} model
 * @returns {string | null} Error message, or null if valid.
 */
export function validateExactlyOneDoneColumn(model) {
  const cols = Array.isArray(model.columns) ? model.columns : [];
  const done = cols.filter((c) => columnIsDone(c));
  if (done.length === 0) {
    return "The board must have exactly one column marked Done. None are marked.";
  }
  if (done.length > 1) {
    const labels = done.map(
      (c) => String(c.title ?? "").trim() || `Column ${c.index}`
    );
    return `The board must have exactly one column marked Done. These ${done.length} are marked: ${labels.join(", ")}.`;
  }
  return null;
}
