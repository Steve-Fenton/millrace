import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import {
  getFreePort,
  startServerForTest,
  stopServer,
} from "../support/server_test_utils.js";

const TEST_DATA_ROOT = "/tmp/test";

Given("the flow API test data root is prepared", async function () {
  await fs.rm(TEST_DATA_ROOT, { recursive: true, force: true });
  const tasksRoot = path.join(TEST_DATA_ROOT, "tasks");
  await fs.mkdir(tasksRoot, { recursive: true });

  await fs.writeFile(
    path.join(tasksRoot, ".millrace.ini"),
    `[millrace]
boards = test.ini
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(tasksRoot, "test.ini"),
    `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do

[columns.2]
title = Done
is_done = true
`,
    "utf8"
  );

  const port = await getFreePort();
  const state = await startServerForTest({
    dataRoot: TEST_DATA_ROOT,
    port,
    readyPath: "/api/flow",
  });
  this.flowApiBaseUrl = state.baseUrl;
  this.flowApiServer = state.child;
  this.flowApiServerState = state;
});

When("I request the flow API catalog", async function () {
  const res = await fetch(`${this.flowApiBaseUrl}/api/flow`);
  this.flowApiStatus = res.status;
  this.flowApiResponse = await res.json();
});

Then("the flow API boards JSON should be:", function (docString) {
  assert.strictEqual(this.flowApiStatus, 200);
  assert.deepStrictEqual(this.flowApiResponse.boards, JSON.parse(docString.trim()));
});

After(async function () {
  if (this.flowApiServer) {
    await stopServer(this.flowApiServer);
    this.flowApiServer = null;
  }
  if (
    this.flowApiServerState?.exitCode != null &&
    this.flowApiServerState.exitCode !== 0
  ) {
    throw new Error(
      `Flow API test server exited with ${this.flowApiServerState.exitCode}\nstdout:\n${this.flowApiServerState.stdout ?? ""}\nstderr:\n${this.flowApiServerState.stderr ?? ""}`
    );
  }
});
