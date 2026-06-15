import { resolveCardSwimlaneIndex } from "../../assets/js/ini/swimlaneResolve.js";
import { loadBoardColumnAndSwimlaneDefsForSlug } from "../board/model.js";
import { gatherCompletedAndArchiveRows } from "./cardRows/completedArchive.js";
import { bucketStartMsForGranularity, parseIsoMs } from "./time.js";

/**
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function aggregateCompletionBuckets(slug, granularity) {
  const rows = await gatherCompletedAndArchiveRows(slug);
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    if (closedMs == null) continue;
    const k = bucketStartMsForGranularity(closedMs, granularity);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts.keys()].sort((a, b) => a - b);
  return sorted.map((t) => ({
    t: new Date(t).toISOString(),
    n: counts.get(t) ?? 0,
  }));
}

/**
 * Completions per time bucket, split by resolved swimlane index (for stacked charts).
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function aggregateCompletionSwimlaneStack(slug, granularity) {
  const { swimlanes } = await loadBoardColumnAndSwimlaneDefsForSlug(slug);
  const rows = await gatherCompletedAndArchiveRows(slug);

  /** @type {Map<number, Map<number, number>>} bucket start ms → lane index → count */
  const byBucket = new Map();

  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    if (closedMs == null) continue;
    const bucketMs = bucketStartMsForGranularity(closedMs, granularity);
    const laneIdx = resolveCardSwimlaneIndex(
      /** @type {string | undefined} */ (row.swimlane),
      swimlanes
    );
    if (!byBucket.has(bucketMs)) byBucket.set(bucketMs, new Map());
    const inner = byBucket.get(bucketMs);
    inner.set(laneIdx, (inner.get(laneIdx) ?? 0) + 1);
  }

  /** @type {Set<number>} */
  const usedLanes = new Set();
  for (const m of byBucket.values()) {
    for (const k of m.keys()) usedLanes.add(k);
  }
  const fromDef = swimlanes.map((l) => l.index);
  const indices = [...new Set([...fromDef, ...usedLanes])].sort(
    (a, b) => a - b
  );

  /**
   * @param {number} i
   */
  function labelForLaneIndex(i) {
    const lane = swimlanes.find((l) => l.index === i);
    const t = lane?.title && String(lane.title).trim();
    if (t) return t;
    if (!swimlanes.length) return "Completed";
    return `Lane ${i}`;
  }

  const series = indices.map((index) => ({
    key: String(index),
    label: labelForLaneIndex(index),
    index,
  }));

  const sortedBuckets = [...byBucket.keys()].sort((a, b) => a - b);
  const buckets = sortedBuckets.map((bm) => {
    const inner = byBucket.get(bm) ?? new Map();
    /** @type {Record<string, number>} */
    const counts = {};
    for (const s of series) {
      counts[s.key] = inner.get(s.index) ?? 0;
    }
    return { t: new Date(bm).toISOString(), counts };
  });

  return { series, buckets };
}
