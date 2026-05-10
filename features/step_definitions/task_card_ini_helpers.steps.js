import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  columnNameForIniItem,
  normalizeLinksForIni,
  serializeCardIni,
  serializeFullCardIni,
  swimlaneNameForIniItem,
} from "../../assets/js/ini/cardIni.js";

const FIXED_CREATED_ISO = "2024-01-15T10:20:30.000Z";

function withFixedCreated(fn) {
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(FIXED_CREATED_ISO);
      }
      super(...args);
    }
  };
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

Given("the JSON input for normalizeLinksForIni is:", function (docString) {
  this.normalizeLinksInput = JSON.parse(docString.trim());
});

When("I normalize links with normalizeLinksForIni", function () {
  this.result = normalizeLinksForIni(this.normalizeLinksInput);
});

Given("the columns array JSON is:", function (docString) {
  this.columnsPayload = JSON.parse(docString.trim());
});

Given("the column index is {int}", function (n) {
  this.columnIndex = n;
});

When("I compute columnNameForIniItem", function () {
  this.stringResult = columnNameForIniItem(
    this.columnsPayload,
    this.columnIndex
  );
});

Given("the swimlanes array JSON is:", function (docString) {
  this.swimlanesPayload = JSON.parse(docString.trim());
});

Given("the swimlane index is {int}", function (n) {
  this.swimlaneIndex = n;
});

When("I compute swimlaneNameForIniItem", function () {
  this.swimlaneResult = swimlaneNameForIniItem(
    this.swimlanesPayload,
    this.swimlaneIndex
  );
});

Then("the JSON result should be:", function (docString) {
  assert.deepStrictEqual(this.result, JSON.parse(docString.trim()));
});

Then("the string result should be:", function (docString) {
  const expected = docString.trim();
  const actual =
    this.stringResult !== undefined ? this.stringResult : this.swimlaneResult;
  assert.strictEqual(actual, expected);
});

Then("the swimlane name result is undefined", function () {
  assert.strictEqual(this.swimlaneResult, undefined);
});

Given("the full card item JSON is:", function (docString) {
  this.fullCardItem = JSON.parse(docString.trim());
});

Given(
  "the full card item has an own property with undefined value",
  function () {
    this.fullCardItem = { id: "u1", note: undefined };
  }
);

Given(
  "the full card item has a description getter that yields undefined then multiline text",
  function () {
    let first = true;
    this.fullCardItem = {
      id: "g1",
      get description() {
        if (first) {
          first = false;
          return undefined;
        }
        return "second-pass\nbody";
      },
    };
  }
);

Given("the full card links JSON is:", function (docString) {
  this.fullCardLinks = JSON.parse(docString.trim());
});

When("I serialize with serializeFullCardIni", function () {
  this.iniOutput = serializeFullCardIni(this.fullCardItem, this.fullCardLinks);
});

Given("the serializeCardIni fields JSON is:", function (docString) {
  this.serializeCardFields = JSON.parse(docString.trim());
});

When("I serialize with serializeCardIni", function () {
  this.iniOutput = withFixedCreated(() =>
    serializeCardIni(this.serializeCardFields)
  );
});

Then("the card INI output should be:", function (docString) {
  assert.strictEqual(this.iniOutput, docString);
});
