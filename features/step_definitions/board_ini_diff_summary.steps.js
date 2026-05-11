import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { summarizeBoardIniDiff } from "../../assets/js/git/boardDiff.js";

Given("the earlier board INI text is:", function (docString) {
  this.boardDiffBefore = docString;
});

Given("the later board INI text is:", function (docString) {
  this.boardDiffAfter = docString;
});

Given("the earlier board INI text is null", function () {
  this.boardDiffBefore = null;
});

Given("the later board INI text is undefined", function () {
  this.boardDiffAfter = undefined;
});

When("I summarize the board INI diff", function () {
  this.boardDiffSummary = summarizeBoardIniDiff(
    this.boardDiffBefore,
    this.boardDiffAfter
  );
});

When(
  "I summarize the board INI diff assuming the earlier version fails to parse",
  function () {
    this.boardDiffSummary = summarizeBoardIniDiff(
      "[board]\nname=A\nslug=t",
      "[board]\nname=A\nslug=t",
      () => {
        throw new Error("parse");
      }
    );
  }
);

When(
  "I summarize the board INI diff assuming the later version fails to parse",
  function () {
    let n = 0;
    this.boardDiffSummary = summarizeBoardIniDiff(
      "[board]\nname=A\nslug=t",
      "[board]\nname=A\nslug=t",
      (raw) => {
        n++;
        if (n === 2) throw new Error("parse");
        return {
          board: { name: "A", slug: "t" },
          columns: [{ index: 1, title: "To Do", isDone: true }],
          swimlanes: [],
          users: [],
        };
      }
    );
  }
);

Then("the board diff summary JSON should be:", function (docString) {
  assert.deepStrictEqual(this.boardDiffSummary, JSON.parse(docString.trim()));
});

Then(
  "the board diff summary JSON should have at most {int} lines",
  function (max) {
    assert.ok(
      Array.isArray(this.boardDiffSummary) &&
        this.boardDiffSummary.length <= max,
      `expected ≤ ${max} lines, got ${JSON.stringify(this.boardDiffSummary)}`
    );
  }
);
