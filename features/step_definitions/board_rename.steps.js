import assert from "node:assert";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Then } from "@cucumber/cucumber";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

Then(
  "the tasks directory for slug {string} should exist",
  async function (slug) {
    const dir = path.join(INTEGRATION_DATA_ROOT, "tasks", slug);
    assert.ok(existsSync(dir), `expected folder ${dir}`);
  }
);

Then(
  "the board ini file {string} should exist under tasks",
  async function (basename) {
    const file = path.join(INTEGRATION_DATA_ROOT, "tasks", basename);
    assert.ok(existsSync(file), `expected file ${file}`);
  }
);

Then(
  "the board ini file {string} should not exist under tasks",
  async function (basename) {
    const file = path.join(INTEGRATION_DATA_ROOT, "tasks", basename);
    assert.ok(!existsSync(file), `expected missing file ${file}`);
  }
);

Then(
  "the board ini file {string} should contain {string}",
  async function (basename, snippet) {
    const file = path.join(INTEGRATION_DATA_ROOT, "tasks", basename);
    const text = await fs.readFile(file, "utf8");
    assert.ok(
      text.includes(snippet),
      `expected ${basename} to contain ${JSON.stringify(snippet)}`
    );
  }
);
