import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import { readMillraceCatalogRetentionSettings } from "../../server/catalogRetention.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

Given("the integration data root is freshly empty", async function () {
  await fs.rm(INTEGRATION_DATA_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(INTEGRATION_DATA_ROOT, "tasks"), {
    recursive: true,
  });
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});

Given(
  "the integration data root has a millrace catalog INI with:",
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

When("I read the millrace catalog retention settings", async function () {
  this.retention = await readMillraceCatalogRetentionSettings();
});

Then(
  "the retention archiveClosedAfterDays should equal {int}",
  function (n) {
    assert.strictEqual(this.retention.archiveClosedAfterDays, n);
  }
);

Then(
  "the retention coldStorageArchiveAfterMonths should equal {int}",
  function (n) {
    assert.strictEqual(this.retention.coldStorageArchiveAfterMonths, n);
  }
);
