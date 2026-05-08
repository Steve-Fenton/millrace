import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { millraceHttp } from "../support/integration_request.js";

When("I request the board API for slug {string}", async function (slug) {
  const path = `/api/board?boardSlug=${encodeURIComponent(slug)}`;
  const { status, json } = await millraceHttp(this.flowApiAgent, "GET", path);
  this.boardApiStatus = status;
  this.boardApiResponse = json;
});

Then("the board API response status should be {int}", function (status) {
  assert.strictEqual(this.boardApiStatus, status);
});

Then("the board API response metadata should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(
    {
      slug: this.boardApiResponse.slug,
      name: this.boardApiResponse.name,
      file: this.boardApiResponse.file,
    },
    expected
  );
});

Then("the board API response text should be:", function (docString) {
  const expected = `${docString.trim()}\n`;
  assert.strictEqual(this.boardApiResponse.text, expected);
});
