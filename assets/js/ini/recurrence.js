/**
 * Recurring cards: `[item] recurrence = 2 weeks` (or `1 month`, `3 months`, …).
 * When an open recurring card's next action date arrives, the server creates a
 * copy in the board's "To do" column and moves the recurring card's next action
 * date to today plus the interval.
 */

/** @typedef {'weeks' | 'months'} RecurrenceUnit */
/** @typedef {{ every: number, unit: RecurrenceUnit }} Recurrence */

/** @type {readonly RecurrenceUnit[]} */
export const RECURRENCE_UNITS = ["weeks", "months"];

export const RECURRENCE_MAX_EVERY = 520;

/**
 * Parse a recurrence from INI text (`2 weeks`, `1 month`) or an object
 * (`{ every: 2, unit: "weeks" }`). Returns `null` when missing or invalid.
 * @param {unknown} raw
 * @returns {Recurrence | null}
 */
export function parseRecurrence(raw) {
  if (raw && typeof raw === "object") {
    const o = /** @type {{ every?: unknown, unit?: unknown }} */ (raw);
    return parseRecurrence(`${o.every ?? ""} ${o.unit ?? ""}`);
  }
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d+)\s*(weeks?|months?)$/);
  if (!m) return null;
  const every = Number.parseInt(m[1], 10);
  if (!Number.isInteger(every) || every < 1 || every > RECURRENCE_MAX_EVERY) {
    return null;
  }
  const unit = m[2].startsWith("week") ? "weeks" : "months";
  return { every, unit };
}

/**
 * INI value for `[item] recurrence`, or `""` when not recurring.
 * @param {unknown} raw
 */
export function formatRecurrenceIni(raw) {
  const r = parseRecurrence(raw);
  if (!r) return "";
  return `${r.every} ${r.unit}`;
}

/**
 * Human label, e.g. "Every week", "Every 3 months".
 * @param {unknown} raw
 */
export function recurrenceLabel(raw) {
  const r = parseRecurrence(raw);
  if (!r) return "";
  if (r.every === 1) return `Every ${r.unit.slice(0, -1)}`;
  return `Every ${r.every} ${r.unit}`;
}

/**
 * Local-timezone YYYY-MM-DD for the day containing `ms`.
 * @param {number} [ms]
 */
export function localYmd(ms = Date.now()) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Add the recurrence interval to a YYYY-MM-DD date. Month steps clamp to the
 * last day of the target month (31 Jan + 1 month → 28/29 Feb).
 * @param {string} ymd
 * @param {unknown} recurrence
 * @returns {string} YYYY-MM-DD, or `""` when either input is invalid
 */
export function addRecurrenceInterval(ymd, recurrence) {
  const r = parseRecurrence(recurrence);
  const m = String(ymd ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!r || !m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  /** Noon avoids DST edges when stepping whole days. */
  let next;
  if (r.unit === "weeks") {
    next = new Date(y, mo, d + r.every * 7, 12);
  } else {
    const targetMonth = mo + r.every;
    const lastDay = new Date(y, targetMonth + 1, 0, 12).getDate();
    next = new Date(y, targetMonth, Math.min(d, lastDay), 12);
  }
  return localYmd(next.getTime());
}
