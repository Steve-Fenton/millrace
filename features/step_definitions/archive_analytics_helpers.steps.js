import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  bucketStartMsForGranularity,
  completedClosedInWhenRange,
  parseCompletedWhenFilter,
  parseIsoMs,
  utcDayBucketMs,
  utcMonthBucketMs,
  utcWeekBucketStartMs,
} from "../../server/analytics/time.js";
import {
  completedRowMatchesSearch,
  legacySwimlaneFilterCandidates,
  resolveCompletedLaneFilterIndices,
} from "../../server/analytics/completedFilters.js";
import { buildCycleTimePeriodStats, medianSample, sampleStdDev } from "../../server/analytics/cycleTime.js";

When("I call parseCompletedWhenFilter with {string}", function (raw) {
  this.completedWhenFilter = parseCompletedWhenFilter(raw);
});

Then("the completed when filter should be {string}", function (expected) {
  assert.strictEqual(this.completedWhenFilter, expected);
});

When(
  "I check completedClosedInWhenRange with when {string} and closed {string} at now {string}",
  function (when, closed, nowIso) {
    this.closedWhenRangeMatch = completedClosedInWhenRange(
      closed,
      /** @type {import("../../server/analytics/time.js").CompletedWhenFilter} */ (
        when
      ),
      Date.parse(nowIso)
    );
  }
);

Then("the closed when range match should be true", function () {
  assert.strictEqual(this.closedWhenRangeMatch, true);
});

Then("the closed when range match should be false", function () {
  assert.strictEqual(this.closedWhenRangeMatch, false);
});

When("I call parseIsoMs with {string}", function (raw) {
  this.parsedMs = parseIsoMs(raw);
});

Then("the parsed ISO ms should be null", function () {
  assert.strictEqual(this.parsedMs, null);
});

Then("the parsed ISO ms should equal {int}", function (n) {
  assert.strictEqual(this.parsedMs, n);
});

When("I call utcDayBucketMs with {int}", function (n) {
  this.bucketMs = utcDayBucketMs(n);
});

When("I call utcMonthBucketMs with {int}", function (n) {
  this.bucketMs = utcMonthBucketMs(n);
});

When("I call utcWeekBucketStartMs for ISO {string}", function (iso) {
  this.bucketMs = utcWeekBucketStartMs(Date.parse(iso));
});

When(
  "I call bucketStartMsForGranularity with granularity {string} and ISO {string}",
  function (granularity, iso) {
    this.bucketMs = bucketStartMsForGranularity(Date.parse(iso), granularity);
  }
);

Then("the bucket ms should equal {int}", function (n) {
  assert.strictEqual(this.bucketMs, n);
});

Then("the bucket ms should equal the parsed ms of {string}", function (iso) {
  assert.strictEqual(this.bucketMs, Date.parse(iso));
});

When("I call medianSample with values JSON:", function (docString) {
  const arr = JSON.parse(docString.trim());
  this.medianResult = medianSample(arr);
});

Then("the median should be null", function () {
  assert.strictEqual(this.medianResult, null);
});

Then("the median should equal {int}", function (n) {
  assert.strictEqual(this.medianResult, n);
});

When("I call sampleStdDev with values JSON:", function (docString) {
  const arr = JSON.parse(docString.trim());
  this.stdDevResult = sampleStdDev(arr);
});

Then("the stdDev should be null", function () {
  assert.strictEqual(this.stdDevResult, null);
});

Then(
  "the stdDev should be approximately {float} within {float}",
  function (expected, tolerance) {
    assert.ok(
      Math.abs(this.stdDevResult - expected) < tolerance,
      `expected ~${expected}, got ${this.stdDevResult}`
    );
  }
);

When("I call buildCycleTimePeriodStats with points JSON:", function (docString) {
  const points = JSON.parse(docString.trim());
  this.periodStatsResult = buildCycleTimePeriodStats(points);
});

Then("the period stats should have length {int}", function (n) {
  assert.ok(Array.isArray(this.periodStatsResult));
  assert.strictEqual(this.periodStatsResult.length, n);
});

Then(
  "period stat at index {int} should have t {string}",
  function (index, expectedT) {
    assert.strictEqual(this.periodStatsResult[index].t, expectedT);
  }
);

Then("period stat at index {int} median should equal {int}", function (index, n) {
  assert.strictEqual(this.periodStatsResult[index].medianDays, n);
});

Then("period stat at index {int} count should equal {int}", function (index, n) {
  assert.strictEqual(this.periodStatsResult[index].count, n);
});

Then("period stat at index {int} stdDev should be null", function (index) {
  assert.strictEqual(this.periodStatsResult[index].stdevDays, null);
});

Then(
  "period stat at index {int} stdDev should be approximately {float} within {float}",
  function (index, expected, tolerance) {
    const actual = this.periodStatsResult[index].stdevDays;
    assert.ok(
      Math.abs(actual - expected) < tolerance,
      `expected ~${expected}, got ${actual}`
    );
  }
);

When(
  "I check completedRowMatchesSearch with query {string} and row JSON:",
  function (query, docString) {
    const row = JSON.parse(docString.trim());
    this.searchMatch = completedRowMatchesSearch(row, query.toLowerCase());
  }
);

Then("the search match should be true", function () {
  assert.strictEqual(this.searchMatch, true);
});

Then("the search match should be false", function () {
  assert.strictEqual(this.searchMatch, false);
});

When(
  "I call resolveCompletedLaneFilterIndices with lane {string} and swimlanes JSON:",
  function (lane, docString) {
    const swimlanes = JSON.parse(docString.trim());
    this.laneFilter = resolveCompletedLaneFilterIndices(lane, swimlanes);
  }
);

Then("the resolved lane filter should be null", function () {
  assert.strictEqual(this.laneFilter, null);
});

Then("the resolved lane filter should contain index {int}", function (n) {
  assert.ok(
    this.laneFilter instanceof Set,
    `expected a Set, got ${typeof this.laneFilter}`
  );
  assert.ok(
    this.laneFilter.has(n),
    `expected Set to contain ${n}, got ${[...this.laneFilter].join(",")}`
  );
});

When(
  "I call legacySwimlaneFilterCandidates with rows JSON:",
  function (docString) {
    this.legacyCandidatesRows = JSON.parse(docString.trim());
  }
);

When(
  "with swimlanes JSON:",
  function (docString) {
    this.legacyCandidates = legacySwimlaneFilterCandidates(
      this.legacyCandidatesRows,
      JSON.parse(docString.trim())
    );
  }
);

Then("the legacy swimlane candidates should equal JSON:", function (docString) {
  assert.deepStrictEqual(
    this.legacyCandidates,
    JSON.parse(docString.trim())
  );
});
