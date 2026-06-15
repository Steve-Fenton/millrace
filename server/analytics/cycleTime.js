import { gatherCompletedAndArchiveRows } from "./cardRows/completedArchive.js";
import { bucketStartMsForGranularity, parseIsoMs } from "./time.js";

/**
 * @param {number[]} values
 * @returns {number | null}
 */
export function medianSample(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Sample standard deviation (n >= 2); otherwise null.
 * @param {number[]} values
 * @returns {number | null}
 */
export function sampleStdDev(values) {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const varSum = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  return Math.sqrt(varSum / (n - 1));
}

/**
 * Median and sample σ per close bucket from scatter points.
 * @param {{ bucket?: string, t?: string, d: number }[]} points
 * @returns {{ t: string, medianDays: number | null, stdevDays: number | null, count: number }[]}
 */
export function buildCycleTimePeriodStats(points) {
  /** @type {Map<string, number[]>} */
  const byBucket = new Map();
  for (const p of points) {
    const bucket =
      typeof p.bucket === "string" ? p.bucket : typeof p.t === "string" ? p.t : "";
    if (!bucket) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(p.d);
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([t, values]) => ({
      t,
      medianDays: medianSample(values),
      stdevDays: sampleStdDev(values),
      count: values.length,
    }));
}

/**
 * Per-card cycle length (closed − created) in days.
 * Scatter x uses actual `closed`; `periodStats` group by UTC close bucket.
 * @param {string} slug
 * @param {"daily" | "weekly" | "monthly"} granularity
 */
export async function buildCycleTimeScatter(slug, granularity) {
  const rows = await gatherCompletedAndArchiveRows(slug);
  /** @type {{ closed: string, bucket: string, d: number }[]} */
  const points = [];
  for (const row of rows) {
    const closedMs = parseIsoMs(row.closed);
    const createdMs = parseIsoMs(row.created);
    if (closedMs == null || createdMs == null) continue;
    const cycleMs = closedMs - createdMs;
    if (!Number.isFinite(cycleMs) || cycleMs < 0) continue;
    const bucketMs = bucketStartMsForGranularity(closedMs, granularity);
    const d = cycleMs / (24 * 60 * 60 * 1000);
    points.push({
      closed: new Date(closedMs).toISOString(),
      bucket: new Date(bucketMs).toISOString(),
      d,
    });
  }
  const values = points.map((p) => p.d);
  return {
    granularity,
    points,
    periodStats: buildCycleTimePeriodStats(points),
    medianDays: medianSample(values),
    stdevDays: sampleStdDev(values),
    count: values.length,
  };
}
