import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { ensureDefaultTasksLayout } from "../../server/bootstrapTasks.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

const BOOTSTRAP_ROOT = path.join(INTEGRATION_DATA_ROOT, "bootstrap-unit");

Given("an empty Millrace data root for bootstrap", async function () {
  await fs.rm(BOOTSTRAP_ROOT, { recursive: true, force: true });
  await fs.mkdir(BOOTSTRAP_ROOT, { recursive: true });
  setMillraceDataRootForTesting(BOOTSTRAP_ROOT);
});

Given(
  "a tasks directory exists without a Millrace catalog file",
  async function () {
    await fs.rm(BOOTSTRAP_ROOT, { recursive: true, force: true });
    await fs.mkdir(path.join(BOOTSTRAP_ROOT, "tasks"), { recursive: true });
    setMillraceDataRootForTesting(BOOTSTRAP_ROOT);
  }
);

When("I run the default tasks layout bootstrap", async function () {
  await ensureDefaultTasksLayout();
});

Then(
  "demo.ini in the bootstrap tasks folder should include slug demo",
  async function () {
    const text = await fs.readFile(
      path.join(BOOTSTRAP_ROOT, "tasks", "demo.ini"),
      "utf8"
    );
    assert.ok(text.includes("slug = demo"));
  }
);

Then(
  "the Millrace catalog should list demo.ini for boards",
  async function () {
    const text = await fs.readFile(
      path.join(BOOTSTRAP_ROOT, "tasks", ".millrace.ini"),
      "utf8"
    );
    assert.ok(text.includes("[millrace]"));
    assert.ok(text.includes("boards = demo.ini"));
  }
);

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
