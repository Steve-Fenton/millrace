import assert from "node:assert";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { After, Given, Then, When } from "@cucumber/cucumber";

const TEST_DATA_ROOT = "/tmp/test";

/**
 * @returns {Promise<number>}
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close(() => {
          reject(new Error("Could not allocate a free test port."));
        });
        return;
      }
      const { port } = addr;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

/**
 * @param {import("node:child_process").ChildProcess} child
 */
function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null || child.killed) {
      resolve();
      return;
    }
    const done = () => resolve();
    child.once("exit", done);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode == null && !child.killed) child.kill("SIGKILL");
      resolve();
    }, 1000).unref();
  });
}

/**
 * @param {string} url
 */
async function waitForServerReady(url) {
  const deadline = Date.now() + 10000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} while waiting for server`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Timed out waiting for server at ${url}${lastError ? `: ${String(lastError)}` : ""}`
  );
}

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
  const serverPath = path.resolve(process.cwd(), "server.js");
  this.flowApiBaseUrl = `http://127.0.0.1:${port}`;
  this.flowApiServer = spawn(
    process.execPath,
    [serverPath, "--data-root", TEST_DATA_ROOT, String(port)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  this.flowApiStdErr = "";
  this.flowApiStdOut = "";
  this.flowApiServer.stdout?.on("data", (buf) => {
    this.flowApiStdOut += String(buf);
  });
  this.flowApiServer.stderr?.on("data", (buf) => {
    this.flowApiStdErr += String(buf);
  });
  this.flowApiServer.once("exit", (code) => {
    if (!this.flowApiServerExitCode) this.flowApiServerExitCode = code;
  });

  await waitForServerReady(`${this.flowApiBaseUrl}/api/flow`);
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
  if (this.flowApiServerExitCode != null && this.flowApiServerExitCode !== 0) {
    throw new Error(
      `Flow API test server exited with ${this.flowApiServerExitCode}\nstdout:\n${this.flowApiStdOut ?? ""}\nstderr:\n${this.flowApiStdErr ?? ""}`
    );
  }
});
