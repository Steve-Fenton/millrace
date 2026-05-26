import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { Then, When } from "@cucumber/cucumber";
import { millraceHttp } from "../support/integration_request.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

When("I remember the last response card filename as the test card", function () {
  this.testCardFilename = this.lastJson.filename;
  assert.ok(
    typeof this.testCardFilename === "string" && this.testCardFilename.endsWith(".ini")
  );
});

When("I fetch the test card from column {int}", async function (columnIndex) {
  const fn = this.testCardFilename;
  assert.ok(fn, "expected testCardFilename from prior step");
  const path = `/api/card?boardSlug=test&columnIndex=${columnIndex}&filename=${encodeURIComponent(fn)}`;
  const { status, json } = await millraceHttp(this.flowApiAgent, "GET", path);
  this.lastHttpStatus = status;
  this.lastJson = json;
});

When(
  "I put the test card in column {int} with title {string} and empty owner",
  async function (columnIndex, title) {
    const fn = this.testCardFilename;
    assert.ok(fn);
    const { status, json } = await millraceHttp(
      this.flowApiAgent,
      "PUT",
      "/api/card",
      {
        boardSlug: "test",
        columnIndex,
        filename: fn,
        title,
        description: "",
        owner: "",
      }
    );
    this.lastHttpStatus = status;
    this.lastJson = json;
  }
);

When(
  "I put the test card in column {int} with title {string} and owner {string}",
  async function (columnIndex, title, owner) {
    const fn = this.testCardFilename;
    assert.ok(fn);
    const { status, json } = await millraceHttp(
      this.flowApiAgent,
      "PUT",
      "/api/card",
      {
        boardSlug: "test",
        columnIndex,
        filename: fn,
        title,
        description: "",
        owner,
      }
    );
    this.lastHttpStatus = status;
    this.lastJson = json;
  }
);

When("I delete the test card from column {int}", async function (columnIndex) {
  const fn = this.testCardFilename;
  assert.ok(fn);
  const reqPath = `/api/card?boardSlug=test&columnIndex=${columnIndex}&filename=${encodeURIComponent(fn)}`;
  const { status, json } = await millraceHttp(this.flowApiAgent, "DELETE", reqPath);
  this.lastHttpStatus = status;
  this.lastJson = json;
});

Then("the test card file should exist under abandoned", async function () {
  const fn = this.testCardFilename;
  assert.ok(fn);
  const year = new Date().getUTCFullYear();
  const abandonedPath = path.join(
    INTEGRATION_DATA_ROOT,
    "tasks",
    "test",
    "abandoned",
    String(year),
    fn
  );
  await fs.access(abandonedPath);
});
