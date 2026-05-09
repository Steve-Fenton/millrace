import assert from "node:assert";
import express from "express";
import { Given, Then, When } from "@cucumber/cucumber";
import supertest from "supertest";
import { registerFlowRoutes } from "../../server/routes/flowRoutes.js";
import { millraceHttp } from "../support/integration_request.js";
import { startMillraceForProfile } from "../support/millrace_test_harness.js";

Given("the flow API test data root is prepared", async function () {
  await startMillraceForProfile(this, "flow-board");
});

Given(
  "an Express app with flow routes that fail loading the catalog",
  async function () {
    const app = express();
    registerFlowRoutes(app, {
      loadBoardCatalog: async () => {
        throw new Error("simulated catalog load failure");
      },
    });
    this.flowApiAgent = supertest(app);
  }
);

When("I request the flow API catalog", async function () {
  const { status, json } = await millraceHttp(
    this.flowApiAgent,
    "GET",
    "/api/flow"
  );
  this.flowApiStatus = status;
  this.flowApiResponse = json;
});

Then("the flow API boards JSON should be:", function (docString) {
  assert.strictEqual(this.flowApiStatus, 200);
  assert.deepStrictEqual(this.flowApiResponse.boards, JSON.parse(docString.trim()));
});

Then("the flow API response status should be {int}", function (status) {
  assert.strictEqual(this.flowApiStatus, status);
});

Then("the flow API JSON field {string} should be:", function (field, docString) {
  const expected = docString.trim();
  assert.strictEqual(this.flowApiResponse[field], expected);
});
