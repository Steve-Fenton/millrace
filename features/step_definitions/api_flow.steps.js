import assert from "node:assert";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import supertest from "supertest";
import { registerFlowRoutes } from "../../server/routes/flowRoutes.js";
import { localUserMatchesMillraceAdmin, localUserIsNonOwnerMillraceFollower } from "../../server/millraceCatalogSettings.js";
import { millraceHttp } from "../support/integration_request.js";
import { startMillraceForProfile } from "../support/millrace_test_harness.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

Given("the flow API test data root is prepared", async function () {
  await startMillraceForProfile(this, "flow-board");
});

Given("an Express app with flow routes registered", async function () {
  const app = express();
  app.use(express.json({ limit: "512kb" }));
  registerFlowRoutes(app);
  this.flowApiAgent = supertest(app);
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

When("I request GET {string}", async function (path) {
  const { status, json } = await millraceHttp(this.flowApiAgent, "GET", path);
  this.flowApiStatus = status;
  this.flowApiResponse = json;
});

When("I PATCH {string} with JSON:", async function (path, docString) {
  const body = JSON.parse(docString.trim());
  const { status, json } = await millraceHttp(
    this.flowApiAgent,
    "PATCH",
    path,
    body
  );
  this.flowApiStatus = status;
  this.flowApiResponse = json;
});

Then("the millrace catalog INI should contain {string}", async function (snippet) {
  const text = await fs.readFile(
    path.join(INTEGRATION_DATA_ROOT, "tasks", ".millrace.ini"),
    "utf8"
  );
  assert.ok(text.includes(snippet), `expected catalog INI to contain ${snippet}`);
});

Given("local user Mine is {string}", async function (email) {
  await fs.mkdir(path.join(INTEGRATION_DATA_ROOT, "tasks"), { recursive: true });
  await fs.writeFile(
    path.join(INTEGRATION_DATA_ROOT, "tasks", "localuser.ini"),
    `[user]
mine = ${email}
`,
    "utf8"
  );
});

When("I check whether the local user matches Millrace admin", async function () {
  this.localUserMatchesMillraceAdmin = await localUserMatchesMillraceAdmin();
});

When("I check whether the local user is a non-owner Millrace follower", async function () {
  this.localUserIsNonOwnerMillraceFollower =
    await localUserIsNonOwnerMillraceFollower();
});

Then("the local user should match Millrace admin", function () {
  assert.strictEqual(this.localUserMatchesMillraceAdmin, true);
});

Then("the local user should not match Millrace admin", function () {
  assert.strictEqual(this.localUserMatchesMillraceAdmin, false);
});

Then("the local user should be a non-owner Millrace follower", function () {
  assert.strictEqual(this.localUserIsNonOwnerMillraceFollower, true);
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
