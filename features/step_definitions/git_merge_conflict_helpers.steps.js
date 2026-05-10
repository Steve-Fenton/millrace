import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  countConflictHunks,
  getFirstConflictHunk,
  hasConflictMarkerLines,
  replaceFirstConflictHunk,
} from "../../assets/js/git/conflictMerge.js";

/** Expand macros from git_merge_conflict_helpers.feature */
function expandConflictDoc(s) {
  return String(s)
    .replaceAll("{NL}", "\n")
    .replaceAll("{MARK_BEGIN}", "<<<<<<<")
    .replaceAll("{MARK_MID}", "=======")
    .replaceAll("{MARK_END}", ">>>>>>>");
}

Given("a conflict document encoded as {string}", function (text) {
  this.conflictDoc = expandConflictDoc(text);
});

Given("the conflict document raw value is null", function () {
  this.conflictDoc = null;
});

Given("the conflict document raw value is undefined", function () {
  this.conflictDoc = undefined;
});

When("I count conflict hunks in the document", function () {
  this.hunkCount = countConflictHunks(this.conflictDoc);
});

Then("the conflict hunk count should be {int}", function (n) {
  assert.strictEqual(this.hunkCount, n);
});

When("I get the first conflict hunk from the document", function () {
  this.firstHunk = getFirstConflictHunk(this.conflictDoc);
});

Then("there is no first conflict hunk", function () {
  assert.strictEqual(this.firstHunk, null);
});

Then("the first hunk ours text should be encoded as {string}", function (ours) {
  assert(this.firstHunk, "expected a hunk");
  assert.strictEqual(this.firstHunk.ours, expandConflictDoc(ours));
});

Then("the first hunk theirs text should be encoded as {string}", function (theirs) {
  assert(this.firstHunk, "expected a hunk");
  assert.strictEqual(this.firstHunk.theirs, expandConflictDoc(theirs));
});

Then("the first hunk head label should be {string}", function (label) {
  assert(this.firstHunk, "expected a hunk");
  assert.strictEqual(this.firstHunk.headLabel, label);
});

Then("the first hunk their label should be {string}", function (label) {
  assert(this.firstHunk, "expected a hunk");
  assert.strictEqual(this.firstHunk.theirLabel, label);
});

When("I replace the first conflict hunk choosing {string}", function (side) {
  if (side !== "ours" && side !== "theirs") {
    throw new Error(`side must be ours or theirs, got ${side}`);
  }
  this.replacedDoc = replaceFirstConflictHunk(this.conflictDoc, side);
});

Then("the document should become encoded as {string}", function (expected) {
  assert.strictEqual(this.replacedDoc, expandConflictDoc(expected));
});

Then("the document should stay encoded as {string}", function (text) {
  assert.strictEqual(this.replacedDoc, expandConflictDoc(text));
});

Then("the replaced document raw should be null", function () {
  assert.strictEqual(this.replacedDoc, null);
});

Then("the replaced document raw should be undefined", function () {
  assert.strictEqual(this.replacedDoc, undefined);
});

When("I ask whether the document has conflict marker lines", function () {
  this.hasMarkers = hasConflictMarkerLines(this.conflictDoc);
});

Then("the answer should be {word}", function (word) {
  const expected = word === "true";
  assert.strictEqual(this.hasMarkers, expected);
});
