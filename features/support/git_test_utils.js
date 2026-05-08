import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * `git init` at data root, configure user, commit all tracked files (e.g. under tasks/).
 * @param {string} cwd
 */
export async function gitInitWithFirstCommit(cwd) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
  };
  const opts = { cwd, env };
  await execFileAsync("git", ["init"], opts);
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
