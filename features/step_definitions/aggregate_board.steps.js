import assert from "node:assert";
import { existsSync } from "node:fs";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  aggregateColumnIndexForSourceColumn,
  enrichAggregateBoardModel,
  validateAggregateBoard,
} from "../../assets/js/models/aggregateBoard.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

Given("aggregate column mapping input as JSON:", function (docString) {
  this.aggMapInput = JSON.parse(docString.trim());
});

When("I map a source column to an aggregate column index", function () {
  const o = this.aggMapInput;
  this.aggNumericResult = aggregateColumnIndexForSourceColumn(
    o.sourceColumnIndex,
    o.sourceColumns,
    o.aggregateColumns
  );
});

Given("aggregate enrich input as JSON:", function (docString) {
  this.aggEnrichInput = JSON.parse(docString.trim());
});

When("I enrich the aggregate board model", function () {
  this.bmModel = enrichAggregateBoardModel(
    this.aggEnrichInput.model,
    this.aggEnrichInput.catalog
  );
});

Given("aggregate validation input as JSON:", function (docString) {
  this.aggValidationInput = JSON.parse(docString.trim());
});

When("I validate the aggregate board", function () {
  this.bmValidationMessage = validateAggregateBoard(
    this.aggValidationInput.model,
    this.aggValidationInput.catalog
  );
});

Then("the numeric result should be {int}", function (value) {
  assert.strictEqual(this.aggNumericResult, value);
});

Then(
  "the first card in {string} should have field {string} equal to {string}",
  function (key, field, value) {
    const v = this.lastJson[key];
    assert.ok(Array.isArray(v) && v[0], `expected array at ${key}`);
    assert.strictEqual(String(v[0][field]), value);
  }
);

Then("the tasks directory for slug {string} should not exist", function (slug) {
  const dir = path.join(INTEGRATION_DATA_ROOT, "tasks", slug);
  assert.strictEqual(existsSync(dir), false, `expected missing ${dir}`);
});
