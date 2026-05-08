import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { boardIniTest } from "../support/millrace_fixtures.js";

When("I save the default test board definition unchanged", async function () {
  const url = `${this.flowApiBaseUrl}/api/board-definition`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ boardSlug: "test", text: boardIniTest() }),
  });
  this.lastHttpStatus = res.status;
  const text = await res.text();
  try {
    this.lastJson = text ? JSON.parse(text) : null;
  } catch {
    this.lastJson = { _raw: text };
  }
});

Then(
  "the first board slug in the last response should be {string}",
  function (expectedSlug) {
    const boards = this.lastJson.boards;
    assert.ok(Array.isArray(boards) && boards.length > 0);
    assert.strictEqual(boards[0].slug, expectedSlug);
  }
);
