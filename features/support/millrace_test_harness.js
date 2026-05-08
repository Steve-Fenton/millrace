import fs from "node:fs/promises";
import path from "node:path";
import { getFreePort, startServerForTest } from "./server_test_utils.js";
import {
  INTEGRATION_DATA_ROOT,
  writeMillraceProfile,
} from "./millrace_fixtures.js";
import { gitCommitAll, gitInitWithFirstCommit } from "./git_test_utils.js";

/**
 * @param {object} world
 * @param {string} profile
 * @param {{ readyPath?: string }} [opts]
 */
export async function startMillraceForProfile(world, profile, opts = {}) {
  await fs.rm(INTEGRATION_DATA_ROOT, { recursive: true, force: true });
  await writeMillraceProfile(profile, INTEGRATION_DATA_ROOT);
  const port = await getFreePort();
  const state = await startServerForTest({
    dataRoot: INTEGRATION_DATA_ROOT,
    port,
    readyPath: opts.readyPath ?? "/api/flow",
  });
  world.flowApiBaseUrl = state.baseUrl;
  world.flowApiServer = state.child;
  world.flowApiServerState = state;
}

/**
 * Same as {@link startMillraceForProfile} but runs `git init` and two commits at the data root
 * so git-history endpoints return `gitAvailable: true`.
 * @param {object} world
 * @param {string} profile
 */
export async function startMillraceForProfileWithGit(world, profile) {
  await fs.rm(INTEGRATION_DATA_ROOT, { recursive: true, force: true });
  await writeMillraceProfile(profile, INTEGRATION_DATA_ROOT);
  await gitInitWithFirstCommit(INTEGRATION_DATA_ROOT);
  const boardPath = path.join(
    INTEGRATION_DATA_ROOT,
    "tasks",
    "test.ini"
  );
  await fs.appendFile(boardPath, "\n; fixture bump\n", "utf8");
  await gitCommitAll(INTEGRATION_DATA_ROOT, "fixture second");
  const port = await getFreePort();
  const state = await startServerForTest({
    dataRoot: INTEGRATION_DATA_ROOT,
    port,
    readyPath: "/api/flow",
  });
  world.flowApiBaseUrl = state.baseUrl;
  world.flowApiServer = state.child;
  world.flowApiServerState = state;
}
