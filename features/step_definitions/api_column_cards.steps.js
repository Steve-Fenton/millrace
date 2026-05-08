import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { millraceHttp } from "../support/integration_request.js";

When("I fetch JSON from {string}", async function (pathOrUrl) {
  if (pathOrUrl.startsWith("http")) {
    const res = await fetch(pathOrUrl);
    this.lastHttpStatus = res.status;
    this.lastJson = await res.json();
    return;
  }
  const { status, json } = await millraceHttp(
    this.flowApiAgent,
    "GET",
    pathOrUrl
  );
  this.lastHttpStatus = status;
  this.lastJson = json;
});

Then("the response status should be {int}", function (status) {
  assert.strictEqual(this.lastHttpStatus, status);
});

Then("the JSON at {string} should be a non-empty array", function (key) {
  const v = this.lastJson[key];
  assert.ok(Array.isArray(v) && v.length > 0, `expected non-empty array at ${key}`);
});

Then(
  "the first card in {string} should have title {string}",
  function (key, title) {
    const v = this.lastJson[key];
    assert.ok(Array.isArray(v) && v[0], `expected array at ${key}`);
    assert.strictEqual(v[0].title, title);
  }
);

When("I store the last JSON response as {string}", function (name) {
  this[name] = structuredClone(this.lastJson);
});

Then("the last JSON response should equal stored {string}", function (name) {
  assert.deepStrictEqual(this.lastJson, this[name]);
});

When("I store JSON {string} as {string}", function (key, name) {
  this[name] = this.lastJson[key];
});
