import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { startMillraceForProfile } from "../support/millrace_test_harness.js";

Given("the flow API test data root is prepared", async function () {
  await startMillraceForProfile(this, "flow-board");
});

When("I request the flow API catalog", async function () {
  const res = await fetch(`${this.flowApiBaseUrl}/api/flow`);
  this.flowApiStatus = res.status;
  this.flowApiResponse = await res.json();
});

Then("the flow API boards JSON should be:", function (docString) {
  assert.strictEqual(this.flowApiStatus, 200);
  assert.deepStrictEqual(this.flowApiResponse.boards, JSON.parse(docString.trim()));
});
