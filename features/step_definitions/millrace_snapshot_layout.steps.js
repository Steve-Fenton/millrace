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
  "a tasks directory exists with a custom millrace snapshots.json",
  async function () {
    await fs.rm(SNAPSHOT_BOOTSTRAP_ROOT, { recursive: true, force: true });
    const millraceDir = path.join(
      SNAPSHOT_BOOTSTRAP_ROOT,
      "tasks",
      ".millrace"
    );
    await fs.mkdir(millraceDir, { recursive: true });
    await fs.writeFile(
      path.join(millraceDir, "snapshots.json"),
      JSON.stringify(
        {
          settings: {
            boards: [],
            "custom snapshot marker": "yes",
          },
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
    commitPathIfChanged: async () => {
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
    commitPathIfChanged: async () => {
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

Then(
  "snapshots.json in the millrace snapshot folder should include settings",
  async function () {
    const text = await fs.readFile(
      path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", ".millrace", "snapshots.json"),
      "utf8"
    );
    const data = JSON.parse(text);
    assert.ok(Array.isArray(data.settings?.boards));
  }
);

Then(
  "snapshots.json in the millrace snapshot folder should still say custom snapshot marker",
  async function () {
    const text = await fs.readFile(
      path.join(SNAPSHOT_BOOTSTRAP_ROOT, "tasks", ".millrace", "snapshots.json"),
      "utf8"
    );
    const data = JSON.parse(text);
    assert.strictEqual(data.settings?.["custom snapshot marker"], "yes");
  }
);

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
