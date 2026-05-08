import { After, Given } from "@cucumber/cucumber";
import { startMillraceForProfile } from "../support/millrace_test_harness.js";
import { stopServer } from "../support/server_test_utils.js";

Given(
  "the Millrace integration server has profile {string}",
  async function (profile) {
    await startMillraceForProfile(this, profile);
  }
);

After(async function () {
  if (this.flowApiServer) {
    await stopServer(this.flowApiServer);
    this.flowApiServer = null;
  }
  if (
    this.flowApiServerState?.exitCode != null &&
    this.flowApiServerState.exitCode !== 0
  ) {
    throw new Error(
      `Millrace test server exited with ${this.flowApiServerState.exitCode}\nstdout:\n${this.flowApiServerState.stdout ?? ""}\nstderr:\n${this.flowApiServerState.stderr ?? ""}`
    );
  }
});
