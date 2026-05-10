import assert from "node:assert";
import path from "node:path";
import { Then, When } from "@cucumber/cucumber";
import { cliOptionsFromArgv, portFromArgv } from "../../server/cliArgs.js";

When("I parse argv as JSON:", function (docString) {
  const argv = JSON.parse(docString.trim());
  this.cliOptions = cliOptionsFromArgv(argv);
});

When("I parse argv that is not an array", function () {
  this.cliOptions = cliOptionsFromArgv(/** @type {any} */ ("not-an-array"));
});

When(
  "I take the port via portFromArgv from argv as JSON:",
  function (docString) {
    const argv = JSON.parse(docString.trim());
    this.cliOptions = { port: portFromArgv(argv), dataRoot: null };
  }
);

Then("the parsed CLI options should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.cliOptions, expected);
});

Then("the CLI port should be {int}", function (port) {
  assert.strictEqual(this.cliOptions.port, port);
});

Then("the CLI port should be null", function () {
  assert.strictEqual(this.cliOptions.port, null);
});

Then("the CLI dataRoot should be null", function () {
  assert.strictEqual(this.cliOptions.dataRoot, null);
});

Then(
  "the CLI dataRoot should be the resolved path {string}",
  function (rawPath) {
    assert.strictEqual(this.cliOptions.dataRoot, path.resolve(rawPath));
  }
);
