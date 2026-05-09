import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  bucketStartMsForGranularity,
  completedRowMatchesSearch,
  medianSample,
  parseIsoMs,
  resolveCompletedLaneFilterIndices,
  sampleStdDev,
  utcDayBucketMs,
  utcMonthBucketMs,
  utcWeekBucketStartMs,
} from "../../server/archiveAnalytics.js";

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
