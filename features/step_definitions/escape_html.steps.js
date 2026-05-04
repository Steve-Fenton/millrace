import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { escapeHtml } from "../../assets/js/escapeHtml.js";

/** Expand table cell macros (see escape_html.feature). */
function expandMacros(s) {
  return String(s)
    .replaceAll("{NL}", "\n")
    .replaceAll("{LT}", "<")
    .replaceAll("{GT}", ">")
    .replaceAll("{QUOT}", '"')
    .replaceAll("{AMP}", "&");
}

Given(
  "the macro-encoded raw is {string} and expected is {string}",
  function (raw, expected) {
    if (raw === "__undefined__") {
      this.rawInput = undefined;
    } else if (raw === "__null__") {
      this.rawInput = null;
    } else {
      this.rawInput = expandMacros(raw);
    }
    this.expectedAfterEscape = expandMacros(expected);
  }
);

When("I escape the prepared input for HTML", function () {
  this.escaped = escapeHtml(this.rawInput);
});

Then("the result should match the prepared expected output", function () {
  assert.strictEqual(this.escaped, this.expectedAfterEscape);
});
