import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  boardTitleMultiset,
  isPureColumnSwimlaneReorderForTasks,
  multisetsEqual,
} from "../../server/boardDefinitionSync.js";

When(
  "I compare old and new board models for pure reorder:",
  function (doc) {
    const { old: oldModel, new: newModel } = JSON.parse(doc.trim());
    this.lastReorderResult = isPureColumnSwimlaneReorderForTasks(
      oldModel,
      newModel
    );
    this.lastMultisetEqual = multisetsEqual(
      boardTitleMultiset(oldModel, "columns"),
      boardTitleMultiset(newModel, "columns")
    );
  }
);

Then(
  "the board change qualifies as a pure column swimlane reorder",
  function () {
    assert.strictEqual(this.lastReorderResult, true);
  }
);

Then(
  "the board change does not qualify as a pure column swimlane reorder",
  function () {
    assert.strictEqual(this.lastReorderResult, false);
  }
);

When("I take multiset counts of column titles from JSON:", function (doc) {
  const cols = JSON.parse(doc.trim());
  this.multiset = boardTitleMultiset({ columns: cols, swimlanes: [] }, "columns");
});

Then("the multiset entry for {string} should equal {int}", function (key, n) {
  assert.strictEqual(this.multiset.get(key), n);
});
