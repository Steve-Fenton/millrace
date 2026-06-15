import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { utcSnapshotDateString } from "../../server/snapshots/format.js";
import { captureTodayColumnSnapshots } from "../../server/snapshots/storage.js";
import { ensureMillraceSnapshotLayout } from "../../server/millraceSnapshotLayout.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import {
  CATALOG_ONE_BOARD,
  INTEGRATION_DATA_ROOT,
} from "../support/millrace_fixtures.js";

const SNAPSHOT_CAPTURE_ROOT = path.join(
  INTEGRATION_DATA_ROOT,
  "column-snapshots-unit"
);

const FIXED_NOW_MS = Date.parse("2026-05-25T15:30:00.000Z");

Given(
  "a millrace data root with a test board and open cards for snapshots",
  async function () {
    await fs.rm(SNAPSHOT_CAPTURE_ROOT, { recursive: true, force: true });
    const tasksDir = path.join(SNAPSHOT_CAPTURE_ROOT, "tasks");
    const testDir = path.join(tasksDir, "test");
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, ".millrace.ini"),
      CATALOG_ONE_BOARD,
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, "test.ini"),
      `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do
type = to_do

[columns.2]
title = In Progress
type = in_progress

[columns.3]
title = Done
type = done
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-a.ini"),
      `[item]
id = FLOW-a
title = Card A
column = To Do
swimlane = Default
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-b.ini"),
      `[item]
id = FLOW-b
title = Card B
column = In Progress
swimlane = Default
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-c.ini"),
      `[item]
id = FLOW-c
title = Card C
column = Done
swimlane = Default
`,
      "utf8"
    );
    setMillraceDataRootForTesting(SNAPSHOT_CAPTURE_ROOT);
  }
);

Given("the millrace snapshot layout exists", async function () {
  await ensureMillraceSnapshotLayout();
});

Given("today's column snapshots have already been captured once", async function () {
  await captureTodayColumnSnapshots({
    nowMs: async () => FIXED_NOW_MS,
  });
});

When("I capture today's column snapshots", async function () {
  await captureTodayColumnSnapshots({
    nowMs: async () => FIXED_NOW_MS,
  });
});

When("I capture today's column snapshots again", async function () {
  await captureTodayColumnSnapshots({
    nowMs: async () => FIXED_NOW_MS,
  });
});

Then(
  "the test board snapshots.json should include today's snapshot counts",
  async function () {
    const text = await fs.readFile(
      path.join(SNAPSHOT_CAPTURE_ROOT, "tasks", "test", "snapshots.json"),
      "utf8"
    );
    const data = JSON.parse(text);
    assert.ok(Array.isArray(data));
    assert.strictEqual(data.length, 1);
    assert.strictEqual(
      data[0].date,
      utcSnapshotDateString(FIXED_NOW_MS)
    );
    assert.deepStrictEqual(data[0].columns, [
      { name: "To Do", type: "to_do", count: 1 },
      { name: "In Progress", type: "in_progress", count: 1 },
    ]);
  }
);

Then("today's test board snapshot should not include a done column", async function () {
  const text = await fs.readFile(
    path.join(SNAPSHOT_CAPTURE_ROOT, "tasks", "test", "snapshots.json"),
    "utf8"
  );
  const data = JSON.parse(text);
  const names = (data[0]?.columns ?? []).map(
    (col) => /** @type {{ name: string }} */ (col).name
  );
  const types = (data[0]?.columns ?? []).map(
    (col) => /** @type {{ type: string }} */ (col).type
  );
  assert.ok(!names.includes("Done"));
  assert.ok(!types.includes("done"));
});

Then("the test board should have only one snapshot for today", async function () {
  const text = await fs.readFile(
    path.join(SNAPSHOT_CAPTURE_ROOT, "tasks", "test", "snapshots.json"),
    "utf8"
  );
  const data = JSON.parse(text);
  const dates = data.map((snap) => /** @type {{ date: string }} */ (snap).date);
  assert.deepStrictEqual(dates, [utcSnapshotDateString(FIXED_NOW_MS)]);
});

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
