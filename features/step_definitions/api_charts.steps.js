import assert from "node:assert";
import { Then } from "@cucumber/cucumber";

Then(
  "the first completed card title should be {string}",
  function (expectedTitle) {
    const cards = this.lastJson.cards;
    assert.ok(Array.isArray(cards) && cards.length > 0);
    assert.strictEqual(cards[0].title, expectedTitle);
  }
);

Then(
  "some bucket in the last response should have count at least {int}",
  function (min) {
    const buckets = this.lastJson.buckets;
    assert.ok(Array.isArray(buckets));
    const ok = buckets.some((b) => typeof b.n === "number" && b.n >= min);
    assert.ok(ok, `expected a bucket with n >= ${min}, got ${JSON.stringify(buckets)}`);
  }
);
