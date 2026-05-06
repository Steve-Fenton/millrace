import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  defaultColumnIndex,
  resolveCardColumnIndex,
} from "../../assets/js/columnResolve.js";
import {
  defaultSwimlaneIndex,
  resolveCardSwimlaneIndex,
} from "../../assets/js/swimlaneResolve.js";

Given("the defaultColumnIndex columns JSON is:", function (docString) {
  this.columnsForDefaultCol = JSON.parse(docString.trim());
});

When("I compute defaultColumnIndex for columns", function () {
  this.resolvedIndex = defaultColumnIndex(this.columnsForDefaultCol);
});

Given("the resolveCardColumnIndex input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.columnsForResolveCol = o.columns;
  this.rawColumn = Object.prototype.hasOwnProperty.call(o, "raw")
    ? o.raw
    : undefined;
});

When("I resolve the card column index", function () {
  this.resolvedIndex = resolveCardColumnIndex(
    this.rawColumn,
    this.columnsForResolveCol
  );
});

Given("the defaultSwimlaneIndex swimlanes JSON is:", function (docString) {
  this.swimlanesForDefault = JSON.parse(docString.trim());
});

When("I compute defaultSwimlaneIndex for swimlanes", function () {
  this.resolvedIndex = defaultSwimlaneIndex(this.swimlanesForDefault);
});

Given("the resolveCardSwimlaneIndex input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.swimlanesForResolve = o.swimlanes;
  this.rawSwimlane = Object.prototype.hasOwnProperty.call(o, "raw")
    ? o.raw
    : undefined;
});

When("I resolve the card swimlane index", function () {
  this.resolvedIndex = resolveCardSwimlaneIndex(
    this.rawSwimlane,
    this.swimlanesForResolve
  );
});

Then("the resolved index should be {int}", function (expected) {
  assert.strictEqual(this.resolvedIndex, expected);
});
