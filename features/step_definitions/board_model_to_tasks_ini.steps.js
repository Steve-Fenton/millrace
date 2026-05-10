import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { serializeBoardIniFromModel } from "../../assets/js/ini/boardIni.js";

Given("a board model:", function (docString) {
  this.boardModel = JSON.parse(docString.trim());
});

When("I serialize the board model to tasks INI", function () {
  this.serializedIni = serializeBoardIniFromModel(this.boardModel);
});

Then("the INI output should be:", function (docString) {
  assert.strictEqual(this.serializedIni, docString);
});
