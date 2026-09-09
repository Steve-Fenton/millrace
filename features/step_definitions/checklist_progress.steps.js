import assert from "node:assert";
import { Before, Given, Then, When } from "@cucumber/cucumber";
import { parseMarkdownChecklist } from "../../assets/js/ui/limitedMarkdown.js";

Before({ tags: "@checklist_progress" }, function () {
  this.checklistText = "";
  this.checklistResult = null;
});

Given("markdown text for checklist progress is:", function (text) {
  this.checklistText = text;
});

When("I parse checklist progress", function () {
  this.checklistResult = parseMarkdownChecklist(this.checklistText);
});

Then("checklist progress total should be {int}", function (expectedTotal) {
  assert(this.checklistResult, "expected checklist progress object but got null");
  assert.strictEqual(this.checklistResult.total, expectedTotal);
});

Then("checklist progress completed should be {int}", function (expectedCompleted) {
  assert(this.checklistResult, "expected checklist progress object but got null");
  assert.strictEqual(this.checklistResult.completed, expectedCompleted);
});

Then("checklist progress percent should be {int}", function (expectedPercent) {
  assert(this.checklistResult, "expected checklist progress object but got null");
  assert.strictEqual(this.checklistResult.percent, expectedPercent);
});

Then("checklist progress should be null", function () {
  assert.strictEqual(this.checklistResult, null);
});
