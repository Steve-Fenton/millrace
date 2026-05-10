import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  dispChange,
  linksFingerprint,
  summarizeCardIniDiff,
  truncOneLine,
} from "../../assets/js/git/taskDiff.js";
import { parseTaskCardIniFull } from "../../assets/js/models/taskModel.js";

Given("the card INI diff before text is:", function (docString) {
  this.cardDiffBefore = docString;
});

Given("the card INI diff after text is:", function (docString) {
  this.cardDiffAfter = docString;
});

Given("the card INI diff before raw is null", function () {
  this.cardDiffBefore = null;
});

Given("the card INI diff after raw is undefined", function () {
  this.cardDiffAfter = undefined;
});

Given(
  "the card INI diff after text has multiline description with a long continuation line",
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

When("I summarize the card INI diff", function () {
  this.cardDiffSummary = summarizeCardIniDiff(
    this.cardDiffBefore,
    this.cardDiffAfter
  );
});

When("I summarize the card INI diff simulating a before-parse failure", function () {
  this.cardDiffSummary = summarizeCardIniDiff(
    "[item]\nid=1",
    "[item]\nid=1",
    () => {
      throw new Error("parse");
    }
  );
});

When("I summarize the card INI diff simulating an after-parse failure", function () {
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
});

When("I verify task diff formatting helpers", function () {
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

When("I summarize the card INI diff with null item and sparse links from stubs", function () {
  let n = 0;
  this.cardDiffSummary = summarizeCardIniDiff("a", "b", () => {
    n++;
    if (n === 1) {
      return { item: null, links: [{ text: undefined, url: "https://example.com/a" }] };
    }
    return { item: null, links: [{ text: "hi", url: undefined }] };
  });
});

When("I summarize the card INI diff with a custom field turning null into text", function () {
  let n = 0;
  this.cardDiffSummary = summarizeCardIniDiff("a", "b", () => {
    n++;
    if (n === 1) {
      return { item: { id: "1", ghost: null }, links: [] };
    }
    return { item: { id: "1", ghost: "x" }, links: [] };
  });
});

Then("the card INI diff summary JSON should be:", function (docString) {
  assert.deepStrictEqual(
    this.cardDiffSummary,
    JSON.parse(docString.trim())
  );
});
