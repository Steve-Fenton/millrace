export function parseIsoMs(raw) {
  const t = raw && String(raw).trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

export function utcDayBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function utcMonthBucketMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Monday 00:00 UTC of the calendar week containing `ms`. */
export function utcWeekBucketStartMs(ms) {
  const d = new Date(ms);
  const utcMidnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
  const dow = d.getUTCDay();
  const delta = dow === 0 ? 6 : dow - 1;
  return utcMidnight - delta * 86400000;
}

/**
 * @param {number} ms
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export function bucketStartMsForGranularity(ms, granularity) {
  if (granularity === "weekly") return utcWeekBucketStartMs(ms);
  if (granularity === "monthly") return utcMonthBucketMs(ms);
  return utcDayBucketMs(ms);
}

/** @typedef {"all" | "this_week" | "this_month" | "last_week" | "last_month"} CompletedWhenFilter */

/**
 * @param {string | undefined} raw
 * @returns {CompletedWhenFilter}
 */
export function parseCompletedWhenFilter(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (v === "this_week" || v === "thisweek") return "this_week";
  if (v === "this_month" || v === "thismonth") return "this_month";
  if (v === "last_week" || v === "lastweek") return "last_week";
  if (v === "last_month" || v === "lastmonth") return "last_month";
  return "all";
}

/**
 * UTC `[startMs, endMs)` for filtering completed cards by `closed` (ISO week = Monday).
 * @param {Exclude<CompletedWhenFilter, "all">} when
 * @param {number} nowMs
 * @returns {{ startMs: number, endMs: number }}
 */
export function completedWhenRangeBoundsMs(when, nowMs) {
  const weekStart = utcWeekBucketStartMs(nowMs);
  const monthStart = utcMonthBucketMs(nowMs);
  switch (when) {
    case "this_week":
      return { startMs: weekStart, endMs: weekStart + 7 * 86400000 };
    case "last_week":
      return { startMs: weekStart - 7 * 86400000, endMs: weekStart };
    case "this_month": {
      const d = new Date(monthStart);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const nextMonthStart =
        m === 11 ? Date.UTC(y + 1, 0, 1) : Date.UTC(y, m + 1, 1);
      return { startMs: monthStart, endMs: nextMonthStart };
    }
    case "last_month": {
      const prevStart = utcMonthBucketMs(monthStart - 1);
      return { startMs: prevStart, endMs: monthStart };
    }
    default:
      return { startMs: 0, endMs: Number.POSITIVE_INFINITY };
  }
}

/**
 * Whether a completed row's `closed` timestamp falls in the selected UTC period.
 * @param {string | undefined} closedIso
 * @param {CompletedWhenFilter} when
 * @param {number} [nowMs]
 */
export function completedClosedInWhenRange(closedIso, when, nowMs = Date.now()) {
  if (when === "all") return true;
  const closedMs = parseIsoMs(closedIso);
  if (closedMs == null) return false;
  const { startMs, endMs } = completedWhenRangeBoundsMs(when, nowMs);
  return closedMs >= startMs && closedMs < endMs;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** @param {number} ms */
export function utcDayStartMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export { MS_PER_DAY };
