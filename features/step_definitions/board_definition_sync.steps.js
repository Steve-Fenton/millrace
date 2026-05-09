import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  boardTitleMultiset,
  isPureColumnSwimlaneReorderForTasks,
  multisetsEqual,
} from "../../server/boardDefinitionSync.js";

When(
  "I compare boardTitleMultiset for the old and new boards JSON:",
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
  "isPureColumnSwimlaneReorderForTasks should be true",
  function () {
    assert.strictEqual(this.lastReorderResult, true);
  }
);

Then(
  "isPureColumnSwimlaneReorderForTasks should be false",
  function () {
    assert.strictEqual(this.lastReorderResult, false);
  }
);

When("I take a multiset of columns from JSON:", function (doc) {
  const cols = JSON.parse(doc.trim());
  this.multiset = boardTitleMultiset({ columns: cols, swimlanes: [] }, "columns");
});

Then("the multiset entry for {string} should equal {int}", function (key, n) {
  assert.strictEqual(this.multiset.get(key), n);
});
