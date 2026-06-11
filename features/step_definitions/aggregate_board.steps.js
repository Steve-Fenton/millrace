import assert from "node:assert";
import { existsSync } from "node:fs";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  aggregateColumnIndexForSourceColumn,
  cardStorageBoardSlug,
  columnWithType,
  enrichAggregateBoardModel,
  iniTextIsAggregateBoard,
  isAggregateBoard,
  mergeUsersFromSourceBoards,
  sourceColumnIndexForAggregateColumn,
  sourceColumnIndexForAggregateViewColumn,
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

When("I map an aggregate column to a source column index", function () {
  const o = this.aggMapInput;
  this.aggNumericResult = sourceColumnIndexForAggregateColumn(
    o.aggregateColumnIndex,
    o.aggregateColumns,
    o.sourceColumns
  );
});

When("I map an aggregate view column to a source column index", function () {
  const o = this.aggMapInput;
  const sourceColumnDefs = o.sourceColumnDefs
    ? new Map(Object.entries(o.sourceColumnDefs))
    : undefined;
  this.aggNumericResult = sourceColumnIndexForAggregateViewColumn(
    o.card,
    o.viewModel,
    sourceColumnDefs,
    o.aggregateColumnIndex
  );
});

Given("aggregate enrich input as JSON:", function (docString) {
  this.aggEnrichInput = JSON.parse(docString.trim());
});

When("I enrich the aggregate board model", function () {
  this.bmModel = enrichAggregateBoardModel(
    this.aggEnrichInput.model,
    this.aggEnrichInput.catalog,
    this.aggEnrichInput.options
  );
});

Given("aggregate source board models as JSON:", function (docString) {
  this.aggSourceModels = JSON.parse(docString.trim());
});

When("I merge users from aggregate source boards", function () {
  this.bmArrayResult = mergeUsersFromSourceBoards(this.aggSourceModels);
});

Given("aggregate validation input as JSON:", function (docString) {
  this.aggValidationInput = JSON.parse(docString.trim());
});

When("I validate the aggregate board", function () {
  const o = this.aggValidationInput;
  this.bmValidationMessage = validateAggregateBoard(
    o.model,
    o.catalog,
    o.options
  );
});

Given("aggregate board model JSON:", function (docString) {
  this.aggBoardModel = JSON.parse(docString.trim());
});

When("I check whether the board model is aggregate", function () {
  this.aggBoolResult = isAggregateBoard(this.aggBoardModel);
});

Given("aggregate board INI text:", function (docString) {
  this.aggIniText = docString;
});

Given("aggregate board INI text has a UTF-8 BOM prefix and content:", function (docString) {
  this.aggIniText = `\uFEFF${docString}`;
});

When("I detect whether the INI text is an aggregate board", function () {
  this.aggBoolResult = iniTextIsAggregateBoard(this.aggIniText);
});

Given("the aggregate board INI text is null", function () {
  this.aggIniText = null;
});

When(
  "I detect whether the INI text is an aggregate board assuming parse fails",
  function () {
    this.aggBoolResult = iniTextIsAggregateBoard("[board]\nkind=aggregate", () => {
      throw new Error("parse");
    });
  }
);

Given("card storage slug input as JSON:", function (docString) {
  this.aggCardStorageInput = JSON.parse(docString.trim());
});

When("I resolve the card storage board slug", function () {
  const o = this.aggCardStorageInput;
  this.aggStringResult = cardStorageBoardSlug(o.card, o.viewBoardSlug, o.model);
});

Given("columnWithType lookup input as JSON:", function (docString) {
  this.aggColumnWithTypeInput = JSON.parse(docString.trim());
});

When("I look up a column by type", function () {
  const o = this.aggColumnWithTypeInput;
  this.aggColumnWithTypeResult = columnWithType(o.columns, o.type);
});

Then("the numeric result should be {int}", function (value) {
  assert.strictEqual(this.aggNumericResult, value);
});

Then("the numeric result should be null", function () {
  assert.strictEqual(this.aggNumericResult, null);
});

Then("the aggregate boolean result is {string}", function (value) {
  assert.strictEqual(this.aggBoolResult, value === "true");
});

Then("the aggregate string result should be:", function (docString) {
  assert.strictEqual(this.aggStringResult, docString.trim());
});

Then("the looked-up column JSON should be:", function (docString) {
  assert.deepStrictEqual(
    this.aggColumnWithTypeResult,
    JSON.parse(docString.trim())
  );
});

Then("the looked-up column should be undefined", function () {
  assert.strictEqual(this.aggColumnWithTypeResult, undefined);
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
