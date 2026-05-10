import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { ensureDefaultTasksLayout } from "../../server/bootstrapTasks.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

const BOOTSTRAP_ROOT = path.join(INTEGRATION_DATA_ROOT, "bootstrap-unit");

Given("bootstrap unit empty project directory", async function () {
  await fs.rm(BOOTSTRAP_ROOT, { recursive: true, force: true });
  await fs.mkdir(BOOTSTRAP_ROOT, { recursive: true });
  setMillraceDataRootForTesting(BOOTSTRAP_ROOT);
});

Given("bootstrap unit has tasks directory without catalog", async function () {
  await fs.rm(BOOTSTRAP_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(BOOTSTRAP_ROOT, "tasks"), { recursive: true });
  setMillraceDataRootForTesting(BOOTSTRAP_ROOT);
});

When("I call ensureDefaultTasksLayout", async function () {
  await ensureDefaultTasksLayout();
});

Then(
  "bootstrap unit tasks demo.ini should contain slug demo",
  async function () {
    const text = await fs.readFile(
      path.join(BOOTSTRAP_ROOT, "tasks", "demo.ini"),
      "utf8"
    );
    assert.ok(text.includes("slug = demo"));
  }
);

Then("bootstrap unit catalog lists demo.ini", async function () {
  const text = await fs.readFile(
    path.join(BOOTSTRAP_ROOT, "tasks", ".millrace.ini"),
    "utf8"
  );
  assert.ok(text.includes("[millrace]"));
  assert.ok(text.includes("boards = demo.ini"));
});

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
