import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  applySwimlaneCollapseUpdate,
  nextSwimlaneCollapseMode,
  normalizeSwimlaneCollapseMode,
  readSwimlaneCollapseStates,
} from "../../assets/js/ui/swimlaneCollapse.js";

When("I normalize swimlane collapse mode {string}", function (raw) {
  this.normalizedSwimlaneMode = normalizeSwimlaneCollapseMode(raw);
});

Then("the swimlane collapse mode should be {string}", function (expected) {
  assert.strictEqual(this.normalizedSwimlaneMode, expected);
});

When(
  "I cycle the swimlane collapse mode starting at {string}",
  function (start) {
    /** @type {string[]} */
    const steps = [];
    let current = normalizeSwimlaneCollapseMode(start);
    for (let i = 0; i < 3; i++) {
      current = nextSwimlaneCollapseMode(current);
      steps.push(current);
    }
    this.cycledSwimlaneModes = steps;
  }
);

Then("the cycled modes should be {string}", function (expected) {
  assert.deepStrictEqual(
    this.cycledSwimlaneModes,
    expected.split(",").map((s) => s.trim())
  );
});

When(
  "I read swimlane collapse states from sections JSON:",
  function (docString) {
    const sections = JSON.parse(docString.trim());
    this.parsedSwimlaneStates = readSwimlaneCollapseStates(sections);
  }
);

Then(
  "the parsed swimlane collapse states should deeply equal JSON:",
  function (docString) {
    assert.deepStrictEqual(
      this.parsedSwimlaneStates,
      JSON.parse(docString.trim())
    );
  }
);

When(
  "I apply swimlane collapse update JSON to empty sections:",
  function (docString) {
    const update = JSON.parse(docString.trim());
    this.updatedSwimlaneSections = applySwimlaneCollapseUpdate({}, update);
  }
);

When(
  "I apply swimlane collapse update JSON to sections JSON:",
  function (docString) {
    const o = JSON.parse(docString.trim());
    this.updatedSwimlaneSections = applySwimlaneCollapseUpdate(
      o.sections ?? {},
      o.update ?? {}
    );
  }
);

Then(
  "the updated sections JSON should deeply equal:",
  function (docString) {
    assert.deepStrictEqual(
      this.updatedSwimlaneSections,
      JSON.parse(docString.trim())
    );
  }
);
