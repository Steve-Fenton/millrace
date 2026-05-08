import assert from "node:assert";
import { When } from "@cucumber/cucumber";

When("I remember the last response card filename as the test card", function () {
  this.testCardFilename = this.lastJson.filename;
  assert.ok(
    typeof this.testCardFilename === "string" && this.testCardFilename.endsWith(".ini")
  );
});

When("I fetch the test card from column {int}", async function (columnIndex) {
  const fn = this.testCardFilename;
  assert.ok(fn, "expected testCardFilename from prior step");
  const url = `${this.flowApiBaseUrl}/api/card?boardSlug=test&columnIndex=${columnIndex}&filename=${encodeURIComponent(fn)}`;
  const res = await fetch(url);
  this.lastHttpStatus = res.status;
  const text = await res.text();
  try {
    this.lastJson = text ? JSON.parse(text) : null;
  } catch {
    this.lastJson = { _raw: text };
  }
});

When(
  "I put the test card in column {int} with title {string} and empty owner",
  async function (columnIndex, title) {
    const fn = this.testCardFilename;
    assert.ok(fn);
    const url = `${this.flowApiBaseUrl}/api/card`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        boardSlug: "test",
        columnIndex,
        filename: fn,
        title,
        description: "",
        owner: "",
      }),
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

When("I delete the test card from column {int}", async function (columnIndex) {
  const fn = this.testCardFilename;
  assert.ok(fn);
  const url = `${this.flowApiBaseUrl}/api/card?boardSlug=test&columnIndex=${columnIndex}&filename=${encodeURIComponent(fn)}`;
  const res = await fetch(url, { method: "DELETE" });
  this.lastHttpStatus = res.status;
  const text = await res.text();
  try {
    this.lastJson = text ? JSON.parse(text) : null;
  } catch {
    this.lastJson = { _raw: text };
  }
});
