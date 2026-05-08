import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

/**
 * @returns {Promise<number>}
 */
export function getFreePort() {
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
 * @param {string} url
 */
export async function waitForServerReady(url) {
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

/**
 * @param {{ dataRoot: string, port: number, readyPath?: string }} opts
 * @returns {Promise<{ baseUrl: string, child: import("node:child_process").ChildProcess, stdout: string, stderr: string, exitCode: number | null }>}
 */
export async function startServerForTest(opts) {
  const readyPath = opts.readyPath ?? "/api/flow";
  const serverPath = path.resolve(process.cwd(), "server.js");
  const baseUrl = `http://127.0.0.1:${opts.port}`;
  /** @type {{ baseUrl: string, child: import("node:child_process").ChildProcess, stdout: string, stderr: string, exitCode: number | null }} */
  const state = {
    baseUrl,
    child: spawn(
      process.execPath,
      [serverPath, "--data-root", opts.dataRoot, String(opts.port)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    ),
    stdout: "",
    stderr: "",
    exitCode: null,
  };
  state.child.stdout?.on("data", (buf) => {
    state.stdout += String(buf);
  });
  state.child.stderr?.on("data", (buf) => {
    state.stderr += String(buf);
  });
  state.child.once("exit", (code) => {
    state.exitCode = code;
  });
  await waitForServerReady(`${baseUrl}${readyPath}`);
  return state;
}

/**
 * @param {import("node:child_process").ChildProcess | null | undefined} child
 */
/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [options]
 */
export async function fetchJson(url, options = {}) {
  const method = options.method ?? "GET";
  /** @type {RequestInit} */
  const init = {
    method,
    headers: { ...(options.headers ?? {}) },
  };
  if (
    options.body !== undefined &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    init.headers = {
      ...init.headers,
      "content-type": "application/json",
    };
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

export function stopServer(child) {
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
