import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { runStartupArchiveStaleForCatalogSlugs } from "../../server/archiveAnalytics.js";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

const ARCHIVE_GIT_ROOT = path.join(INTEGRATION_DATA_ROOT, "archive-git-unit");
const ARCHIVE_OWNER_EMAIL = "archive-owner@example.com";

/** @type {string[]} */
let gitPullOrder = [];
/** @type {boolean} */
let gitPullCalled = false;
/** @type {boolean} */
let gitCommitCalled = false;
/** @type {boolean} */
let gitPushCalled = false;

const STALE_CARD = "FLOW-stale-archive-test.ini";

async function writeArchiveOwnerLocalUser(root) {
  await fs.writeFile(
    path.join(root, "tasks", "localuser.ini"),
    `[user]
mine = ${ARCHIVE_OWNER_EMAIL}
`,
    "utf8"
  );
}

Given("a board with no stale closed cards for archive", async function () {
  await fs.rm(ARCHIVE_GIT_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(ARCHIVE_GIT_ROOT, "tasks", "test"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", ".millrace.ini"),
    `[millrace]
boards = test.ini
admin_email = ${ARCHIVE_OWNER_EMAIL}
`,
    "utf8"
  );
  await writeArchiveOwnerLocalUser(ARCHIVE_GIT_ROOT);
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", "test.ini"),
    `[board]
name = Test
slug = test

[columns.1]
title = Done
type = done
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", "test", "FLOW-open.ini"),
    `[item]
title = Open card
column = To Do
`,
    "utf8"
  );
  setMillraceDataRootForTesting(ARCHIVE_GIT_ROOT);
});

Given("a board with a stale closed card eligible for archive", async function () {
  await fs.rm(ARCHIVE_GIT_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(ARCHIVE_GIT_ROOT, "tasks", "test"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", ".millrace.ini"),
    `[millrace]
boards = test.ini
admin_email = ${ARCHIVE_OWNER_EMAIL}
archive_closed_after_days = 1
`,
    "utf8"
  );
  await writeArchiveOwnerLocalUser(ARCHIVE_GIT_ROOT);
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", "test.ini"),
    `[board]
name = Test
slug = test

[columns.1]
title = Done
type = done
`,
    "utf8"
  );
  const closed = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await fs.writeFile(
    path.join(ARCHIVE_GIT_ROOT, "tasks", "test", STALE_CARD),
    `[item]
title = Stale closed
column = Done
closed = ${closed}
`,
    "utf8"
  );
  setMillraceDataRootForTesting(ARCHIVE_GIT_ROOT);
});

Given(
  "a board with a stale closed card and Mine does not match Millrace admin",
  async function () {
    await fs.rm(ARCHIVE_GIT_ROOT, { recursive: true, force: true });
    await fs.mkdir(path.join(ARCHIVE_GIT_ROOT, "tasks", "test"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(ARCHIVE_GIT_ROOT, "tasks", ".millrace.ini"),
      `[millrace]
boards = test.ini
admin_email = ${ARCHIVE_OWNER_EMAIL}
archive_closed_after_days = 1
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(ARCHIVE_GIT_ROOT, "tasks", "localuser.ini"),
      `[user]
mine = someone-else@example.com
`,
      "utf8"
    );
    await fs.writeFile(
      path.join(ARCHIVE_GIT_ROOT, "tasks", "test.ini"),
      `[board]
name = Test
slug = test

[columns.1]
title = Done
type = done
`,
      "utf8"
    );
    const closed = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await fs.writeFile(
      path.join(ARCHIVE_GIT_ROOT, "tasks", "test", STALE_CARD),
      `[item]
title = Stale closed
column = Done
closed = ${closed}
`,
      "utf8"
    );
    setMillraceDataRootForTesting(ARCHIVE_GIT_ROOT);
  }
);

When("I run the millrace archive startup with git mocked", async function () {
  gitPullOrder = [];
  gitPullCalled = false;
  gitCommitCalled = false;
  gitPushCalled = false;
  await runStartupArchiveStaleForCatalogSlugs({
    dataRootHasGit: () => true,
    gitPullWithOptionalAutostash: async () => {
      gitPullCalled = true;
      gitPullOrder.push("pull");
    },
    commitOutstandingTasksDir: async () => {
      gitCommitCalled = true;
      gitPullOrder.push("commit");
    },
    gitPush: async () => {
      gitPushCalled = true;
      gitPullOrder.push("push");
    },
    markDataRootPendingSync: async () => {},
    clearDataRootPendingSync: async () => {},
  });
});

When(
  "I run the millrace archive startup with git mocked and no repository",
  async function () {
    gitPullCalled = false;
    gitCommitCalled = false;
    gitPushCalled = false;
    await runStartupArchiveStaleForCatalogSlugs({
      dataRootHasGit: () => false,
      gitPullWithOptionalAutostash: async () => {
        gitPullCalled = true;
      },
      commitOutstandingTasksDir: async () => {
        gitCommitCalled = true;
      },
      gitPush: async () => {
        gitPushCalled = true;
      },
      markDataRootPendingSync: async () => {},
      clearDataRootPendingSync: async () => {},
    });
  }
);

Then("no archive git pull should have run", function () {
  assert.strictEqual(gitPullCalled, false);
  assert.strictEqual(gitCommitCalled, false);
  assert.strictEqual(gitPushCalled, false);
});

Then("an archive git pull should have run", function () {
  assert.strictEqual(gitPullCalled, true);
});

Then("archive changes should not be committed or pushed", function () {
  assert.strictEqual(gitCommitCalled, false);
  assert.strictEqual(gitPushCalled, false);
});

Then("a git pull should have run before the archive check", function () {
  assert.strictEqual(gitPullCalled, true);
  assert.ok(gitPullOrder.indexOf("pull") < gitPullOrder.indexOf("commit"));
});

Then("archive changes should be committed and pushed", function () {
  assert.strictEqual(gitCommitCalled, true);
  assert.strictEqual(gitPushCalled, true);
});

Then("the stale card should be in archive", async function () {
  await assert.rejects(
    fs.access(path.join(ARCHIVE_GIT_ROOT, "tasks", "test", STALE_CARD))
  );
  await fs.access(
    path.join(ARCHIVE_GIT_ROOT, "tasks", "test", "archive", STALE_CARD)
  );
});

Then("the stale card should remain on the board", async function () {
  await fs.access(path.join(ARCHIVE_GIT_ROOT, "tasks", "test", STALE_CARD));
  await assert.rejects(
    fs.access(path.join(ARCHIVE_GIT_ROOT, "tasks", "test", "archive", STALE_CARD))
  );
});

After(function () {
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
