import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  dispChange,
  linksFingerprint,
  summarizeCardIniDiff,
  truncOneLine,
} from "../../assets/js/git/taskDiff.js";
import { parseTaskCardIniFull } from "../../assets/js/models/taskModel.js";

Given("the earlier task card INI text is:", function (docString) {
  this.cardDiffBefore = docString;
});

Given("the later task card INI text is:", function (docString) {
  this.cardDiffAfter = docString;
});

Given("the earlier task card INI text is null", function () {
  this.cardDiffBefore = null;
});

Given("the later task card INI text is undefined", function () {
  this.cardDiffAfter = undefined;
});

Given(
  "the later task card INI has a multiline description with a long continuation line",
  function () {
    const tail = "y".repeat(60);
    this.cardDiffAfter = [
      "[item]",
      "id = 1",
      "description = line1",
      `  ${tail}`,
      "",
    ].join("\n");
  }
);

When("I summarize the task card INI diff", function () {
  this.cardDiffSummary = summarizeCardIniDiff(
    this.cardDiffBefore,
    this.cardDiffAfter
  );
});

When(
  "I summarize the task card INI diff assuming the earlier version fails to parse",
  function () {
    this.cardDiffSummary = summarizeCardIniDiff(
      "[item]\nid=1",
      "[item]\nid=1",
      () => {
        throw new Error("parse");
      }
    );
  }
);

When(
  "I summarize the task card INI diff assuming the later version fails to parse",
  function () {
    let n = 0;
    this.cardDiffSummary = summarizeCardIniDiff(
      "[item]\nid=1",
      "[item]\nid=1",
      (raw) => {
        n++;
        if (n === 2) throw new Error("parse");
        return parseTaskCardIniFull(raw);
      }
    );
  }
);

When("I verify formatting helpers for task diff output", function () {
  assert.strictEqual(truncOneLine(undefined), "");
  assert.strictEqual(truncOneLine(null), "");
  assert.ok(truncOneLine("z".repeat(200)).endsWith("…"));
  assert.ok(truncOneLine("z".repeat(70)).length < 71);
  assert.strictEqual(dispChange(undefined), "∅");
  assert.strictEqual(dispChange(null), "∅");
  assert.strictEqual(
    linksFingerprint([
      { text: undefined, url: "https://example.com" },
      { text: "t", url: undefined },
      { text: undefined, url: undefined },
    ]),
    "\thttps://example.com\nt\t\n\t"
  );
});

When(
  "I summarize the task card INI diff with null item and sparse links from stubs",
  function () {
    let n = 0;
    this.cardDiffSummary = summarizeCardIniDiff("a", "b", () => {
      n++;
      if (n === 1) {
        return {
          item: null,
          links: [{ text: undefined, url: "https://example.com/a" }],
        };
      }
      return { item: null, links: [{ text: "hi", url: undefined }] };
    });
  }
);

When(
  "I summarize the task card INI diff when a custom field goes from null to text",
  function () {
    let n = 0;
    this.cardDiffSummary = summarizeCardIniDiff("a", "b", () => {
      n++;
      if (n === 1) {
        return { item: { id: "1", ghost: null }, links: [] };
      }
      return { item: { id: "1", ghost: "x" }, links: [] };
    });
  }
);

Then("the diff summary JSON should be:", function (docString) {
  assert.deepStrictEqual(this.cardDiffSummary, JSON.parse(docString.trim()));
});
