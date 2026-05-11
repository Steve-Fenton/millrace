import assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";
import { startMillraceForProfileWithGit } from "../support/millrace_test_harness.js";

Given(
  "the Millrace integration server has profile {string} with git history",
  async function (profile) {
    await startMillraceForProfileWithGit(this, profile);
  }
);

Then(
  "the last JSON field {string} commit at index {int} should have changeSummary containing {string}",
  function (field, idx, part) {
    const commits = this.lastJson?.[field];
    assert.ok(
      Array.isArray(commits),
      `expected ${field} to be an array, got ${JSON.stringify(commits)}`
    );
    assert.ok(
      idx >= 0 && idx < commits.length,
      `expected ${field}[${idx}] to exist, got length ${commits.length}`
    );
    const summary = commits[idx]?.changeSummary;
    assert.ok(
      Array.isArray(summary),
      `expected ${field}[${idx}].changeSummary to be an array, got ${JSON.stringify(summary)}`
    );
    assert.ok(
      summary.some((line) => String(line).includes(part)),
      `expected ${field}[${idx}].changeSummary to contain a line matching "${part}", got ${JSON.stringify(summary)}`
    );
  }
);
