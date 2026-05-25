import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import {
  buildCumulativeFlowStack,
  utcSnapshotDateString,
} from "../../server/columnSnapshots.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import {
  CATALOG_ONE_BOARD,
  INTEGRATION_DATA_ROOT,
  boardIniTestWithSwimlanes,
} from "../support/millrace_fixtures.js";
import { defaultAggregateBoardIniText } from "../../server/boardCatalog.js";

const CUMULATIVE_FLOW_ROOT = path.join(
  INTEGRATION_DATA_ROOT,
  "cumulative-flow-unit"
);

const AGGREGATE_FLOW_ROOT = path.join(
  INTEGRATION_DATA_ROOT,
  "aggregate-cumulative-flow-unit"
);

const SNAPSHOT_DATE = "2026-05-25";

const WEEK_ONE_MS = Date.parse("2026-05-05T12:00:00.000Z");
const WEEK_TWO_MS = Date.parse("2026-05-12T12:00:00.000Z");

Given(
  "a millrace data root with cumulative flow snapshot and completion fixtures",
  async function () {
    await fs.rm(CUMULATIVE_FLOW_ROOT, { recursive: true, force: true });
    const tasksDir = path.join(CUMULATIVE_FLOW_ROOT, "tasks");
    const testDir = path.join(tasksDir, "test");
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, ".millrace.ini"),
      CATALOG_ONE_BOARD,
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, "test.ini"),
      boardIniTestWithSwimlanes(),
      "utf8"
    );
    await fs.mkdir(path.join(tasksDir, ".millrace"), { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, ".millrace", "snapshots.json"),
      JSON.stringify(
        {
          settings: { boards: [] },
          test: [
            {
              date: utcSnapshotDateString(WEEK_ONE_MS),
              columns: [{ name: "To Do", type: "to_do", count: 4 }],
            },
            {
              date: utcSnapshotDateString(WEEK_TWO_MS),
              columns: [{ name: "To Do", type: "to_do", count: 2 }],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-done-w1.ini"),
      `[item]
id = FLOW-done-w1
title = Done week one
column = Done
created = 2026-05-01T10:00:00.000Z
closed = 2026-05-06T10:00:00.000Z
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-done-w2a.ini"),
      `[item]
id = FLOW-done-w2a
title = Done week two a
column = Done
created = 2026-05-01T10:00:00.000Z
closed = 2026-05-13T10:00:00.000Z
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(testDir, "FLOW-done-w2b.ini"),
      `[item]
id = FLOW-done-w2b
title = Done week two b
column = Done
created = 2026-05-01T10:00:00.000Z
closed = 2026-05-14T10:00:00.000Z
`,
      "utf8"
    );
    setMillraceDataRootForTesting(CUMULATIVE_FLOW_ROOT);
  }
);

Given(
  "a millrace data root with aggregate cumulative flow snapshot fixtures",
  async function () {
    await fs.rm(AGGREGATE_FLOW_ROOT, { recursive: true, force: true });
    const tasksDir = path.join(AGGREGATE_FLOW_ROOT, "tasks");
    await fs.mkdir(path.join(tasksDir, ".millrace"), { recursive: true });
    await fs.writeFile(
      path.join(tasksDir, ".millrace.ini"),
      `[millrace]
boards = demo.ini, project.ini, all-boards.ini
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, "demo.ini"),
      `[board]
name = Demo
slug = demo

[columns.1]
title = To Do
type = options

[columns.2]
title = Doing
type = in_progress

[columns.3]
title = Done
type = done
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, "project.ini"),
      `[board]
name = Project
slug = project

[columns.1]
title = Ideas
type = options

[columns.2]
title = Doing
type = in_progress

[columns.3]
title = Review
type = waiting

[columns.4]
title = Done
type = done
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, "all-boards.ini"),
      defaultAggregateBoardIniText("All Boards", "all-boards", ["demo", "project"]),
      "utf8"
    );
    await fs.writeFile(
      path.join(tasksDir, ".millrace", "snapshots.json"),
      JSON.stringify(
        {
          settings: { boards: [] },
          demo: [
            {
              date: SNAPSHOT_DATE,
              columns: [
                { name: "To Do", type: "options", count: 2 },
                { name: "Doing", type: "in_progress", count: 3 },
              ],
            },
          ],
          project: [
            {
              date: SNAPSHOT_DATE,
              columns: [
                { name: "Ideas", type: "options", count: 5 },
                { name: "Doing", type: "in_progress", count: 1 },
                { name: "Review", type: "waiting", count: 4 },
              ],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    setMillraceDataRootForTesting(AGGREGATE_FLOW_ROOT);
  }
);

Given("the charts profile has cumulative flow snapshot data", async function () {
  const tasksRoot = path.join(INTEGRATION_DATA_ROOT, "tasks");
  await fs.mkdir(path.join(tasksRoot, ".millrace"), { recursive: true });
  await fs.writeFile(
    path.join(tasksRoot, ".millrace", "snapshots.json"),
    JSON.stringify(
      {
        settings: { boards: [] },
        test: [
          {
            date: utcSnapshotDateString(Date.now()),
            columns: [{ name: "To Do", type: "to_do", count: 2 }],
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );
});

When("I build the weekly cumulative flow stack for board test", async function () {
  this.cumulativeFlowStack = await buildCumulativeFlowStack("test", "weekly");
});

When("I build the weekly cumulative flow stack for board all-boards", async function () {
  this.cumulativeFlowStack = await buildCumulativeFlowStack("all-boards", "weekly");
});

Then(
  "the cumulative flow stack should include cumulative done counts by period",
  function () {
    const stack = this.cumulativeFlowStack;
    assert.ok(Array.isArray(stack.buckets) && stack.buckets.length >= 2);
    const doneSeries = stack.series.find((s) => s.key === "done");
    assert.ok(doneSeries);
    const doneCounts = stack.buckets.map((b) => b.counts.done);
    assert.ok(doneCounts.some((n) => n === 1));
    assert.ok(doneCounts.some((n) => n === 3));
    const last = stack.buckets[stack.buckets.length - 1];
    assert.strictEqual(last.counts.done, 3);
    const wipKey = stack.series.find((s) => s.key !== "done")?.key;
    assert.ok(wipKey);
    assert.strictEqual(last.counts[wipKey], 2);
  }
);

Then(
  "the aggregate cumulative flow stack should sum wip counts by column type",
  function () {
    const stack = this.cumulativeFlowStack;
    assert.ok(Array.isArray(stack.buckets) && stack.buckets.length >= 1);
    const last = stack.buckets[stack.buckets.length - 1];
    const byKey = (label) =>
      stack.series.find((s) => s.label === label)?.key;
    const optionsKey = byKey("Options");
    const inProgressKey = byKey("In progress");
    const waitingKey = byKey("Waiting");
    assert.ok(optionsKey);
    assert.ok(inProgressKey);
    assert.ok(waitingKey);
    assert.strictEqual(last.counts[optionsKey], 7);
    assert.strictEqual(last.counts[inProgressKey], 4);
    assert.strictEqual(last.counts[waitingKey], 4);
  }
);

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
