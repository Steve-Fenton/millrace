import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { parseIni } from "../../assets/js/ini/parseIni.js";

Given("the INI text is:", function (docString) {
  this.iniText = docString;
});

When("I parse the INI document", function () {
  this.parsed = parseIni(this.iniText);
});

Then("the parsed JSON should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.parsed, expected);
});
