import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  columnNameForIniItem,
  daysUntilNextActionDate,
  isNextActionDateImminent,
  normalizeLinksForIni,
  normalizeNextActionDate,
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

Given("JSON input for link normalization:", function (docString) {
  this.normalizeLinksInput = JSON.parse(docString.trim());
});

When("I normalize links for task card INI", function () {
  this.result = normalizeLinksForIni(this.normalizeLinksInput);
});

Given("the columns array JSON is:", function (docString) {
  this.columnsPayload = JSON.parse(docString.trim());
});

Given("the column index is {int}", function (n) {
  this.columnIndex = n;
});

When("I compute the column name for INI output", function () {
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

When("I compute the swimlane name for INI output", function () {
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

When("I serialize the full card to INI", function () {
  this.iniOutput = serializeFullCardIni(this.fullCardItem, this.fullCardLinks);
});

Given("the serializeCardIni fields JSON is:", function (docString) {
  this.serializeCardFields = JSON.parse(docString.trim());
});

When("I serialize the card model to INI", function () {
  this.iniOutput = withFixedCreated(() =>
    serializeCardIni(this.serializeCardFields)
  );
});

Then("the card INI output should be:", function (docString) {
  assert.strictEqual(this.iniOutput, docString);
});

When(
  "I normalize the next action date input {string}",
  function (raw) {
    this.nextActionDateResult = normalizeNextActionDate(raw);
  }
);

Then(
  "the normalized next action date should be {string}",
  function (expected) {
    assert.strictEqual(this.nextActionDateResult, expected);
  }
);

When(
  "I evaluate next action imminence for date {string} with today {string}",
  function (raw, todayYmd) {
    const [y, m, d] = String(todayYmd).split("-").map((n) => Number.parseInt(n, 10));
    const todayMs = new Date(y, m - 1, d, 12, 0, 0).getTime();
    this.nextActionDaysUntilResult = daysUntilNextActionDate(raw, todayMs);
    this.nextActionImminentResult = isNextActionDateImminent(raw, todayMs);
  }
);

Then(
  "the days until the next action date should be {string}",
  function (expected) {
    const want = String(expected).trim();
    if (want === "null") {
      assert.strictEqual(this.nextActionDaysUntilResult, null);
      return;
    }
    const wantNum = Number.parseInt(want, 10);
    assert.ok(
      Number.isFinite(wantNum),
      `Expected an integer or "null", got "${expected}"`
    );
    assert.strictEqual(this.nextActionDaysUntilResult, wantNum);
  }
);

Then(
  "the next action imminence result should be {string}",
  function (expected) {
    const want = String(expected).trim().toLowerCase();
    if (want !== "imminent" && want !== "not imminent") {
      throw new Error(
        `Expected token must be "imminent" or "not imminent", got "${expected}"`
      );
    }
    assert.strictEqual(this.nextActionImminentResult, want === "imminent");
  }
);
