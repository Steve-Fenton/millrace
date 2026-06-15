import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  boardSlugFromMeta,
  newCardId,
  safeCardIniFilename,
  sanitizeSegment,
} from "../../server/board/cardPaths.js";
import { defaultNewBoardIniText } from "../../server/board/catalog.js";
import {
  columnIndexFromTasksPath,
  laneIndexFromBody,
  parseIniTruthy,
} from "../../server/board/model.js";

When("I call sanitizeSegment with {string}", function (raw) {
  this.sanitized = sanitizeSegment(raw);
});

When("I call boardSlugFromMeta with JSON:", function (doc) {
  const meta = JSON.parse(doc.trim());
  this.sanitized = boardSlugFromMeta(meta);
});

Then("the sanitized value should be {string}", function (expected) {
  assert.strictEqual(this.sanitized, expected);
});

When("I call safeCardIniFilename with {string}", function (raw) {
  this.safeFilename = safeCardIniFilename(raw);
});

Then("the safe card filename should be {string}", function (expected) {
  assert.strictEqual(this.safeFilename, expected);
});

Then("the safe card filename should be null", function () {
  assert.strictEqual(this.safeFilename, null);
});

When("I call parseIniTruthy with {string}", function (raw) {
  this.truthy = parseIniTruthy(raw);
});

Then("the truthy result should be true", function () {
  assert.strictEqual(this.truthy, true);
});

Then("the truthy result should be false", function () {
  assert.strictEqual(this.truthy, false);
});

When("I call columnIndexFromTasksPath with {string}", function (raw) {
  this.columnIndex = columnIndexFromTasksPath(raw);
});

Then("the column index should equal {int}", function (n) {
  assert.strictEqual(this.columnIndex, n);
});

Then("the column index should be null", function () {
  assert.strictEqual(this.columnIndex, null);
});

When(
  "I call laneIndexFromBody with lane number {int} and swimlanes JSON:",
  function (laneNum, doc) {
    const lanes = JSON.parse(doc.trim());
    this.laneIndex = laneIndexFromBody(laneNum, lanes);
  }
);

Then("the lane index should equal {int}", function (n) {
  assert.strictEqual(this.laneIndex, n);
});

When(
  "I call defaultNewBoardIniText with name {string} and slug {string}",
  function (name, slug) {
    this.boardIni = defaultNewBoardIniText(name, slug);
  }
);

Then("the generated board INI should contain {string}", function (substring) {
  assert.ok(
    this.boardIni.includes(substring),
    `expected INI to contain ${substring}, got:\n${this.boardIni}`
  );
});

When("I call newCardId", function () {
  this.cardId = newCardId();
});

Then("the generated card id should match {string}", function (regex) {
  const re = new RegExp(regex);
  assert.match(this.cardId, re);
});
