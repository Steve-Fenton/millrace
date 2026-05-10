import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import { readMillraceCatalogRetentionSettings } from "../../server/catalogRetention.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

Given("tasks exist but the catalog INI is absent", async function () {
  await fs.rm(INTEGRATION_DATA_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(INTEGRATION_DATA_ROOT, "tasks"), {
    recursive: true,
  });
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});

Given(
  "the millrace catalog INI under the integration data root contains:",
  async function (docString) {
    await fs.rm(INTEGRATION_DATA_ROOT, { recursive: true, force: true });
    await fs.mkdir(path.join(INTEGRATION_DATA_ROOT, "tasks"), {
      recursive: true,
    });
    setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
    await fs.writeFile(
      path.join(INTEGRATION_DATA_ROOT, "tasks", ".millrace.ini"),
      `${docString}\n`,
      "utf8"
    );
  }
);

When("I read retention thresholds from the catalog INI", async function () {
  this.retention = await readMillraceCatalogRetentionSettings();
});

Then("days before archiving closed cards should be {int}", function (n) {
  assert.strictEqual(this.retention.archiveClosedAfterDays, n);
});

Then(
  "months before cold-storage archive should be {int}",
  function (n) {
    assert.strictEqual(this.retention.coldStorageArchiveAfterMonths, n);
  }
);
