import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  formatGitExecError,
  gitChildEnv,
  runGitSerialized,
  safeRepoRelativePath,
} from "../../server/gitOps.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

When("I read the millrace gitChildEnv", function () {
  this.gitEnv = gitChildEnv();
});

Then(
  "the gitChildEnv should set {string} to {string}",
  function (key, value) {
    assert.strictEqual(this.gitEnv[key], value);
  }
);

When(
  "I format the git error with step {string} and JSON:",
  function (step, doc) {
    const raw = JSON.parse(doc.trim());
    const err = new Error(raw.message ?? "");
    if (raw.stderr) {
      Object.assign(err, { stderr: Buffer.from(raw.stderr) });
    }
    if (raw.stdout) {
      Object.assign(err, { stdout: Buffer.from(raw.stdout) });
    }
    this.formattedGitError = formatGitExecError(step, err);
  }
);

Then("the formatted git error should contain {string}", function (sub) {
  assert.ok(
    this.formattedGitError.includes(sub),
    `expected to contain ${sub}, got: ${this.formattedGitError}`
  );
});

Then("the formatted git error should equal {string}", function (expected) {
  assert.strictEqual(this.formattedGitError, expected);
});

Given("the integration data root is set", function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});

When("I call safeRepoRelativePath with {string}", function (raw) {
  this.safePath = safeRepoRelativePath(raw);
});

Then("the safe repo path should be null", function () {
  assert.strictEqual(this.safePath, null);
});

Then("the safe repo path should be {string}", function (expected) {
  assert.strictEqual(this.safePath, expected);
});

When("I run two runGitSerialized tasks concurrently", async function () {
  /** @type {string[]} */
  const order = [];
  const taskA = async () => {
    order.push("A1");
    await new Promise((r) => setTimeout(r, 5));
    order.push("A2");
  };
  const taskB = async () => {
    order.push("B1");
    await new Promise((r) => setTimeout(r, 1));
    order.push("B2");
  };
  const a = runGitSerialized(taskA);
  const b = runGitSerialized(taskB);
  await Promise.all([a, b]);
  this.runOrder = order.join(",");
});

Then("the runGitSerialized order should be {string}", function (expected) {
  assert.strictEqual(this.runOrder, expected);
});
