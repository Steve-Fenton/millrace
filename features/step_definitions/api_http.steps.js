import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { millraceHttp } from "../support/integration_request.js";

When(
  "I send a {word} request to {string} with JSON body:",
  async function (method, path, docString) {
    const body = JSON.parse(docString.trim());
    const { status, json } = await millraceHttp(
      this.flowApiAgent,
      method,
      path,
      body
    );
    this.lastHttpStatus = status;
    this.lastJson = json;
  }
);

When("I send a {word} request to {string}", async function (method, path) {
  const { status, json } = await millraceHttp(this.flowApiAgent, method, path);
  this.lastHttpStatus = status;
  this.lastJson = json;
});

Then("the last JSON field {string} should be {string}", function (field, value) {
  assert.strictEqual(String(this.lastJson[field]), value);
});

Then("the last JSON field {string} should be boolean true", function (field) {
  assert.strictEqual(this.lastJson[field], true);
});

Then("the last JSON field {string} should be boolean false", function (field) {
  assert.strictEqual(this.lastJson[field], false);
});

Then("the last JSON field {string} should contain {string}", function (field, part) {
  assert.ok(
    String(this.lastJson[field] ?? "").includes(part),
    `expected ${field} to contain ${part}, got ${this.lastJson[field]}`
  );
});

Then("the last JSON field {string} should be a non-empty array", function (field) {
  const v = this.lastJson[field];
  assert.ok(Array.isArray(v) && v.length > 0);
});

Then("the last JSON field {string} should be an empty array", function (field) {
  const v = this.lastJson[field];
  assert.ok(Array.isArray(v) && v.length === 0);
});

Then("the last JSON field {string} should equal number {int}", function (field, n) {
  assert.strictEqual(this.lastJson[field], n);
});

Then(
  "the last JSON field {string} should have array length at least {int}",
  function (field, min) {
    const v = this.lastJson[field];
    assert.ok(Array.isArray(v) && v.length >= min);
  }
);

When("I store the last JSON field {string} as {string}", function (field, name) {
  this[name] = this.lastJson[field];
});

Then("the last JSON field {string} should be null", function (field) {
  assert.strictEqual(this.lastJson[field], null);
});

Then(
  "the last JSON field {string} should not be {string}",
  function (field, value) {
    assert.notStrictEqual(String(this.lastJson[field] ?? ""), value);
  }
);

Then(
  "the last JSON field {string} should be ISO 8601",
  function (field) {
    const v = String(this.lastJson[field] ?? "");
    assert.match(
      v,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      `expected ISO 8601 timestamp, got ${v}`
    );
  }
);

Then(
  "the last JSON field {string} should be empty or missing",
  function (field) {
    const v = this.lastJson[field];
    assert.ok(
      v === undefined || v === null || String(v) === "",
      `expected empty / missing, got ${JSON.stringify(v)}`
    );
  }
);
