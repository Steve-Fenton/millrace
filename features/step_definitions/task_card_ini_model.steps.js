import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  displayTaskTitle,
  extractSectionLines,
  parseIniTruthy,
  parseItemSectionLines,
  parseTaskCardIni,
  parseTaskCardIniFull,
  stripDescriptionContinuation,
} from "../../assets/js/models/taskModel.js";

function baselineTaskCard() {
  return {
    id: undefined,
    title: undefined,
    description: undefined,
    note: undefined,
    owner: undefined,
    swimlane: undefined,
    column: undefined,
    sort_order: undefined,
    created: undefined,
    closed: undefined,
    strategic: false,
    links: [],
  };
}

Given("the task card INI text is:", function (docString) {
  this.taskCardText = docString;
});

Given("the task card INI text with CRLF newlines is:", function (docString) {
  this.taskCardText = docString.replace(/\n/g, "\r\n");
});

Given("the item section lines as JSON:", function (docString) {
  this.itemLines = JSON.parse(docString.trim());
});

When("I extract lines for the {string} section", function (sectionName) {
  this.extractedSectionLines = extractSectionLines(this.taskCardText, sectionName);
});

When("I parse item section lines into fields", function () {
  this.parsedItemFields = parseItemSectionLines(this.itemLines);
});

When("I parse the full task card INI", function () {
  this.taskCardFull = parseTaskCardIniFull(this.taskCardText);
});

When("I parse the task card INI into model fields", function () {
  this.taskCard = parseTaskCardIni(this.taskCardText);
});

When("I evaluate the INI truthy token {string}", function (raw) {
  this.iniTruthyResult = parseIniTruthy(raw);
});

Then("the INI truthy result should be true", function () {
  assert.strictEqual(this.iniTruthyResult, true);
});

Then("the INI truthy result should be false", function () {
  assert.strictEqual(this.iniTruthyResult, false);
});

When("I compute the display title from task fields:", function (docString) {
  this.displayTitle = displayTaskTitle(JSON.parse(docString.trim()));
});

Then("the display title should be {string}", function (expected) {
  assert.strictEqual(this.displayTitle, expected);
});

Then("the extracted section lines JSON should be:", function (docString) {
  assert.deepStrictEqual(
    this.extractedSectionLines,
    JSON.parse(docString.trim())
  );
});

Then("the parsed item fields JSON should be:", function (docString) {
  assert.deepStrictEqual(
    this.parsedItemFields,
    JSON.parse(docString.trim())
  );
});

Then("the full task card parse JSON should be:", function (docString) {
  assert.deepStrictEqual(this.taskCardFull, JSON.parse(docString.trim()));
});

Then("the task card model JSON should be:", function (docString) {
  const partial = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.taskCard, {
    ...baselineTaskCard(),
    ...partial,
  });
});

Then(
  "stripDescriptionContinuation should normalize nullish and tab-prefixed lines",
  function () {
    assert.strictEqual(stripDescriptionContinuation(undefined), "");
    assert.strictEqual(stripDescriptionContinuation(null), "");
    assert.strictEqual(stripDescriptionContinuation("plain"), "plain");
    assert.strictEqual(stripDescriptionContinuation("\ttabbed"), "tabbed");
  }
);
