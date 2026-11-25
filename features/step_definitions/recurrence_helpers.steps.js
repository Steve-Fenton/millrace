import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  addRecurrenceInterval,
  formatRecurrenceIni,
  recurrenceLabel,
} from "../../assets/js/ini/recurrence.js";
import {
  recurringItemIsDue,
  recurringTargetColumnIndex,
} from "../../server/recurringCards.js";

When("I parse the recurrence {string}", function (raw) {
  this.recurrenceRaw = raw;
});

Then("the recurrence INI value should be {string}", function (expected) {
  assert.strictEqual(formatRecurrenceIni(this.recurrenceRaw), expected);
});

Then("the recurrence label should be {string}", function (expected) {
  assert.strictEqual(recurrenceLabel(this.recurrenceRaw), expected);
});

Then(
  "adding {string} to {string} should give {string}",
  function (recurrence, from, to) {
    assert.strictEqual(addRecurrenceInterval(from, recurrence), to);
  }
);

Then(
  "the recurring target column for columns {string} should be {int}",
  function (spec, expected) {
    const columns = spec.split(",").map((part, i) => {
      const [type, title] = part.split(":");
      return { index: i + 1, title, type };
    });
    assert.strictEqual(recurringTargetColumnIndex(columns), expected);
  }
);

const ME = "me@example.com";

function dueCheck(closed, nad, recurrence, today, owner = ME) {
  /** @type {Record<string, string>} */
  const item = { next_action_date: nad, recurrence, owner };
  if (closed) item.closed = "2026-11-01T00:00:00.000Z";
  return recurringItemIsDue(item, today, ME);
}

Then(
  "a recurring item owned by {string} due {string} should be due on {string}",
  function (owner, nad, today) {
    assert.strictEqual(dueCheck(false, nad, "2 weeks", today, owner), true);
  }
);

Then(
  "a recurring item owned by {string} due {string} should not be due on {string}",
  function (owner, nad, today) {
    assert.strictEqual(dueCheck(false, nad, "2 weeks", today, owner), false);
  }
);

Then(
  "a recurring item with next action {string} and recurrence {string} should be due on {string}",
  function (nad, rec, today) {
    assert.strictEqual(dueCheck(false, nad, rec, today), true);
  }
);

Then(
  "a recurring item with next action {string} and recurrence {string} should not be due on {string}",
  function (nad, rec, today) {
    assert.strictEqual(dueCheck(false, nad, rec, today), false);
  }
);

Then(
  "a closed recurring item with next action {string} and recurrence {string} should not be due on {string}",
  function (nad, rec, today) {
    assert.strictEqual(dueCheck(true, nad, rec, today), false);
  }
);
