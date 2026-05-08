import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  extractSectionLines,
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
    owner: undefined,
    swimlane: undefined,
    column: undefined,
    sort_order: undefined,
    created: undefined,
    closed: undefined,
    links: [],
  };
}

Given("the task card INI text is:", function (docString) {
  this.taskCardText = docString;
});

Given("the task card INI text with CRLF newlines is:", function (docString) {
  this.taskCardText = docString.replace(/\n/g, "\r\n");
});

Given("the item section lines array JSON is:", function (docString) {
  this.itemLines = JSON.parse(docString.trim());
});

When("I extract section lines for {string}", function (sectionName) {
  this.extractedSectionLines = extractSectionLines(this.taskCardText, sectionName);
});

When("I parse the item section lines with parseItemSectionLines", function () {
  this.parsedItemFields = parseItemSectionLines(this.itemLines);
});

When("I parse with parseTaskCardIniFull", function () {
  this.taskCardFull = parseTaskCardIniFull(this.taskCardText);
});

When("I parse with parseTaskCardIni", function () {
  this.taskCard = parseTaskCardIni(this.taskCardText);
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

Then("the parseTaskCardIniFull result JSON should be:", function (docString) {
  assert.deepStrictEqual(
    this.taskCardFull,
    JSON.parse(docString.trim())
  );
});

Then("the parseTaskCardIni result JSON should be:", function (docString) {
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
