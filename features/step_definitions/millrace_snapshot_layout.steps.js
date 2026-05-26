import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import {
  ensureMillraceSnapshotLayout,
  runMillraceSnapshotLayoutStartup,
} from "../../server/millraceSnapshotLayout.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

const SNAPSHOT_BOOTSTRAP_ROOT = path.join(
  INTEGRATION_DATA_ROOT,
  "snapshot-layout-unit"
);

/** @type {string[]} */
let gitPullOrder = [];
/** @type {boolean} */
let gitPullCalled = false;
/** @type {boolean} */
let gitCommitCalled = false;
/** @type {boolean} */
let gitPushCalled = false;

Given("a tasks directory exists without a Millrace snapshot layout", async function () {
  await fs.rm(SNAPSHOT_BOOTSTRAP_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks"), {
    recursive: true,
  });
  setMillraceDataRootForTesting(SNAPSHOT_BOOTSTRAP_ROOT);
});

Given(
  "a tasks directory exists with legacy millrace snapshots.json",
  async function () {
    await fs.rm(SNAPSHOT_BOOTSTRAP_ROOT, { recursive: true, force: true });
    const millraceDir = path.join(
      SNAPSHOT_BOOTSTRAP_ROOT,
      "tasks",
      ".millrace"
    );
    const demoDir = path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", "demo");
    await fs.mkdir(millraceDir, { recursive: true });
    await fs.mkdir(demoDir, { recursive: true });
    await fs.writeFile(
      path.join(millraceDir, "snapshots.json"),
      JSON.stringify(
        {
          settings: { boards: ["demo"] },
          demo: [
            {
              date: "2026-05-25",
              columns: [{ name: "To Do", type: "options", count: 3 }],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    setMillraceDataRootForTesting(SNAPSHOT_BOOTSTRAP_ROOT);
  }
);

When("I run the millrace snapshot layout bootstrap", async function () {
  await ensureMillraceSnapshotLayout();
});

When("I run the millrace snapshot layout startup with git mocked", async function () {
  gitPullCalled = false;
  gitCommitCalled = false;
  gitPushCalled = false;
  await runMillraceSnapshotLayoutStartup({
    dataRootHasGit: () => false,
    gitPullWithOptionalAutostash: async () => {
      gitPullCalled = true;
    },
    commitSnapshotPathsIfChanged: async () => {
      gitCommitCalled = true;
      return false;
    },
    gitPush: async () => {
      gitPushCalled = true;
    },
  });
});

When("I run the millrace snapshot layout startup", async function () {
  gitPullOrder = [];
  gitPullCalled = false;
  gitCommitCalled = false;
  gitPushCalled = false;
  await runMillraceSnapshotLayoutStartup({
    dataRootHasGit: () => true,
    gitPullWithOptionalAutostash: async () => {
      gitPullCalled = true;
      gitPullOrder.push("pull");
    },
    ensureMillraceSnapshotLayout: async () => {
      gitPullOrder.push("layout");
      await ensureMillraceSnapshotLayout();
    },
    captureTodayColumnSnapshots: async () => {
      gitPullOrder.push("capture");
    },
    commitSnapshotPathsIfChanged: async () => {
      gitCommitCalled = true;
      gitPullOrder.push("commit");
      return true;
    },
    gitPush: async () => {
      gitPushCalled = true;
      gitPullOrder.push("push");
    },
  });
});

Then("no snapshot layout git pull should have run", function () {
  assert.strictEqual(gitPullCalled, false);
  assert.strictEqual(gitCommitCalled, false);
  assert.strictEqual(gitPushCalled, false);
});

Then("a git pull should have run before the layout check", function () {
  assert.strictEqual(gitPullCalled, true);
  assert.deepStrictEqual(gitPullOrder, ["pull", "layout", "capture", "commit", "push"]);
});

Then("snapshot layout changes should be committed and pushed", function () {
  assert.strictEqual(gitCommitCalled, true);
  assert.strictEqual(gitPushCalled, true);
});

Then("the millrace snapshot folder should exist under tasks", async function () {
  const stat = await fs.stat(
    path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", ".millrace")
  );
  assert.ok(stat.isDirectory());
});

Then("legacy snapshots.json should be removed", async function () {
  await assert.rejects(
    fs.stat(
      path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", ".millrace", "snapshots.json")
    )
  );
});

Then("board demo should have migrated snapshots.json", async function () {
  const text = await fs.readFile(
    path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", "demo", "snapshots.json"),
    "utf8"
  );
  const data = JSON.parse(text);
  assert.ok(Array.isArray(data));
  assert.strictEqual(data[0].date, "2026-05-25");
  assert.strictEqual(data[0].columns[0].count, 3);
});

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
