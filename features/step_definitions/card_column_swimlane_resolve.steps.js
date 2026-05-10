import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  defaultColumnIndex,
  resolveCardColumnIndex,
} from "../../assets/js/ini/columnResolve.js";
import {
  defaultSwimlaneIndex,
  resolveCardSwimlaneIndex,
} from "../../assets/js/ini/swimlaneResolve.js";

Given("columns on the board as JSON:", function (docString) {
  this.columnsForDefaultCol = JSON.parse(docString.trim());
});

When("I compute the default column index", function () {
  this.resolvedIndex = defaultColumnIndex(this.columnsForDefaultCol);
});

Given("card column resolution input as JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.columnsForResolveCol = o.columns;
  this.rawColumn = Object.prototype.hasOwnProperty.call(o, "raw")
    ? o.raw
    : undefined;
});

When("I resolve the card column index from item text", function () {
  this.resolvedIndex = resolveCardColumnIndex(
    this.rawColumn,
    this.columnsForResolveCol
  );
});

Given("swimlanes on the board as JSON:", function (docString) {
  this.swimlanesForDefault = JSON.parse(docString.trim());
});

When("I compute the default swimlane index", function () {
  this.resolvedIndex = defaultSwimlaneIndex(this.swimlanesForDefault);
});

Given("card swimlane resolution input as JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.swimlanesForResolve = o.swimlanes;
  this.rawSwimlane = Object.prototype.hasOwnProperty.call(o, "raw")
    ? o.raw
    : undefined;
});

When("I resolve the swimlane index from item text", function () {
  this.resolvedIndex = resolveCardSwimlaneIndex(
    this.rawSwimlane,
    this.swimlanesForResolve
  );
});

Then("the resolved index should be {int}", function (expected) {
  assert.strictEqual(this.resolvedIndex, expected);
});
