import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TEST_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_EDITOR: "true",
};

/**
 * `git init` at data root, configure user, commit all tracked files (e.g. under tasks/).
 * @param {string} cwd
 */
export async function gitInitWithFirstCommit(cwd) {
  const opts = { cwd, env: GIT_TEST_ENV };
  await execFileAsync("git", ["init", "--template="], opts);
  await execFileAsync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Millrace Test", "add", "-A"],
    opts
  );
  await execFileAsync(
    "git",
    [
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Millrace Test",
      "commit",
      "-m",
      "fixture initial",
    ],
    opts
  );
}

/**
 * Initialise a bare upstream repo and a local clone configured with git user / origin.
 * Returns absolute paths for both directories.
 *
 * @param {string} parentDir directory in which the upstream + clone live (must exist)
 * @returns {Promise<{ upstream: string, clone: string }>}
 */
export async function gitInitBareUpstreamWithClone(parentDir) {
  const upstream = path.join(parentDir, "upstream.git");
  const clone = path.join(parentDir, "clone");
  await fs.mkdir(upstream, { recursive: true });
  await execFileAsync("git", ["init", "--bare", "--quiet"], {
    cwd: upstream,
    env: GIT_TEST_ENV,
  });
  await execFileAsync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], {
    cwd: upstream,
    env: GIT_TEST_ENV,
  });
  await execFileAsync("git", ["init", "--quiet", "--template=", clone], {
    cwd: parentDir,
    env: GIT_TEST_ENV,
  });
  const opts = { cwd: clone, env: GIT_TEST_ENV };
  await execFileAsync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], opts);
  await execFileAsync("git", ["config", "user.email", "test@example.com"], opts);
  await execFileAsync("git", ["config", "user.name", "Millrace Test"], opts);
  await execFileAsync(
    "git",
    ["remote", "add", "origin", upstream],
    opts
  );
  await execFileAsync(
    "git",
    ["commit", "--allow-empty", "-m", "root"],
    opts
  );
  await execFileAsync(
    "git",
    ["push", "-u", "origin", "main"],
    opts
  );
  return { upstream, clone };
}

/**
 * @param {string} cwd
 * @param {string} message
 */
export async function gitCommitAll(cwd, message) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
  };
  const opts = { cwd, env };
  await execFileAsync("git", ["add", "-A"], opts);
  await execFileAsync(
    "git",
    [
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Millrace Test",
      "commit",
      "-m",
      message,
    ],
    opts
  );
}
