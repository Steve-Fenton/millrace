/** Re-export barrel for archive retention and analytics helpers. */
export {
  archiveStaleClosedTaskFiles,
  moveStaleArchiveFilesToColdStorage,
  runArchiveStaleClosedForSlug,
  runStartupArchiveStaleForCatalogSlugs,
  syncGitAfterArchiveMoves,
} from "./archive/retention.js";

export {
  bucketStartMsForGranularity,
  completedClosedInWhenRange,
  completedWhenRangeBoundsMs,
  parseCompletedWhenFilter,
  parseIsoMs,
  utcDayBucketMs,
  utcMonthBucketMs,
  utcWeekBucketStartMs,
} from "./analytics/time.js";

export {
  completedRowMatchesSearch,
  distinctSwimlaneRawStrings,
  legacySwimlaneFilterCandidates,
  resolveCompletedLaneFilterIndices,
} from "./analytics/completedFilters.js";

export { gatherCompletedAndArchiveRows } from "./analytics/cardRows/completedArchive.js";
export {
  gatherAbandonedCardRows,
  gatherColdStorageCardRows,
  gatherCompletedArchiveAndOptionalCold,
  gatherInFlightCardRows,
} from "./analytics/cardRows/supplemental.js";
export { gatherOpenBoardRows } from "./analytics/cardRows/openBoard.js";

export {
  aggregateCompletionBuckets,
  aggregateCompletionSwimlaneStack,
} from "./analytics/completionCharts.js";

export {
  buildCycleTimePeriodStats,
  buildCycleTimeScatter,
  medianSample,
  sampleStdDev,
} from "./analytics/cycleTime.js";

export {
  aggregateColumnSwimlaneStack,
  buildCardAgeDistribution,
} from "./analytics/boardCharts.js";
