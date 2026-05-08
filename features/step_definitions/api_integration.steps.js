import { After, Given } from "@cucumber/cucumber";
import { startMillraceForProfile } from "../support/millrace_test_harness.js";

Given(
  "the Millrace integration server has profile {string}",
  async function (profile) {
    await startMillraceForProfile(this, profile);
  }
);

After(async function () {
  this.flowApiAgent = undefined;
});
