import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { boardIniTest } from "../support/millrace_fixtures.js";
import { millraceHttp } from "../support/integration_request.js";

When("I save the default test board definition unchanged", async function () {
  const { status, json } = await millraceHttp(
    this.flowApiAgent,
    "PUT",
    "/api/board-definition",
    { boardSlug: "test", text: boardIniTest() }
  );
  this.lastHttpStatus = status;
  this.lastJson = json;
});

Then(
  "the first board slug in the last response should be {string}",
  function (expectedSlug) {
    const boards = this.lastJson.boards;
    assert.ok(Array.isArray(boards) && boards.length > 0);
    assert.strictEqual(boards[0].slug, expectedSlug);
  }
);
