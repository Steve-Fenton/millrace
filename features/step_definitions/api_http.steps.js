import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

When(
  "I send a {word} request to {string} with JSON body:",
  async function (method, path, docString) {
    const url = `${this.flowApiBaseUrl}${path}`;
    const res = await fetch(url, {
      method: String(method).toUpperCase(),
      headers: { "content-type": "application/json" },
      body: docString.trim(),
    });
    this.lastHttpStatus = res.status;
    const text = await res.text();
    try {
      this.lastJson = text ? JSON.parse(text) : null;
    } catch {
      this.lastJson = { _raw: text };
    }
  }
);

When("I send a {word} request to {string}", async function (method, path) {
  const url = `${this.flowApiBaseUrl}${path}`;
  const res = await fetch(url, { method: String(method).toUpperCase() });
  this.lastHttpStatus = res.status;
  const text = await res.text();
  try {
    this.lastJson = text ? JSON.parse(text) : null;
  } catch {
    this.lastJson = { _raw: text };
  }
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
