import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { serializeBoardIniFromModel } from "../../assets/js/boardIniSerialize.js";

Given("the board model JSON is:", function (docString) {
  this.boardModel = JSON.parse(docString.trim());
});

When("I serialize with serializeBoardIniFromModel", function () {
  this.serializedIni = serializeBoardIniFromModel(this.boardModel);
});

Then("the INI output should be:", function (docString) {
  assert.strictEqual(this.serializedIni, docString);
});
