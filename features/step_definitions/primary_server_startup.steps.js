import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { runPrimaryServerPreListen } from "../../server/cli.js";

When("I run primary server pre-listen with mocked steps", async function () {
  /** @type {string[]} */
  const order = [];
  await runPrimaryServerPreListen({
    pullLatestProjectChanges: async () => {
      order.push("pull");
    },
    ensureDefaultTasksLayout: async () => {
      order.push("bootstrap");
    },
    runMillraceSnapshotLayoutStartup: async () => {
      order.push("snapshots");
    },
  });
  this.primaryServerPreListenOrder = order;
});

Then("the primary server pre-listen order should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.primaryServerPreListenOrder, expected);
});
