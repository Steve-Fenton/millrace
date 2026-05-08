import { Given } from "@cucumber/cucumber";
import { startMillraceForProfileWithGit } from "../support/millrace_test_harness.js";

Given(
  "the Millrace integration server has profile {string} with git history",
  async function (profile) {
    await startMillraceForProfileWithGit(this, profile);
  }
);
