import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "fs/promises";
import path from "path";
import { dataRoot } from "./dataRoot.js";

const execFileAsync = promisify(execFile);

export { execFileAsync };

/** Non-interactive git (no editor / terminal prompt for pull merge messages / credentials). */
export function gitChildEnv() {
  return {
    ...process.env,
    GIT_EDITOR: "true",
    GIT_TERMINAL_PROMPT: "0",
  };
}

/** One git mutation at a time at the Millrace data root (e.g. `/api/git/sync` vs log endpoints). */
let gitSerializedChain = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function runGitSerialized(fn) {
  const run = gitSerializedChain.then(() => fn());
  gitSerializedChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

/**
 * @param {string} step
 * @param {unknown} err
 */
export function formatGitExecError(step, err) {
  const e = /** @type {Error & { stderr?: Buffer, stdout?: Buffer }} */ (err);
  const stderr = e.stderr ? e.stderr.toString().trim() : "";
  const stdout = e.stdout ? e.stdout.toString().trim() : "";
  const parts = [stderr, stdout, e.message].filter(
    (s) => String(s).trim().length > 0
  );
  const text = parts.join("\n").trim().slice(0, 2000);
  return text ? `${step}:\n${text}` : `${step} failed.`;
}

/**
 * Repo-relative path using `/`; rejects `..` and paths escaping the Millrace data root.
 * @param {string} rel
 * @returns {string | null}
 */
export function safeRepoRelativePath(rel) {
  const raw = String(rel ?? "").trim().replace(/\\/g, "/");
  if (!raw || raw.includes("..")) return null;
  const top = raw.split("/").filter(Boolean)[0] ?? "";
  if (top === ".git") return null;
  const abs = path.resolve(dataRoot(), ...raw.split("/"));
  const root = path.resolve(dataRoot());
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  const out = path.relative(root, abs);
  if (out.startsWith("..") || path.isAbsolute(out)) return null;
  return out.split(path.sep).join("/");
}

/**
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 * @returns {Promise<string[]>} repo-relative paths with `/`
 */
export async function gitUnmergedPaths(opts) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-only", "--diff-filter=U"],
      opts
    );
    return String(stdout ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {string[]} relPaths
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
export async function readConflictFilePayloads(relPaths, opts) {
  const cwd = opts.cwd;
  /** @type {{ path: string, content: string }[]} */
  const files = [];
  for (const raw of relPaths) {
    const rel = String(raw).trim().replace(/\\/g, "/");
    const safe = safeRepoRelativePath(rel);
    if (!safe) continue;
    const abs = path.join(cwd, ...safe.split("/"));
    let content = "";
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      content = "";
    }
    files.push({ path: safe, content });
  }
  return files;
}

/**
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
export async function gitIndexHasStagedChanges(opts) {
  try {
    await execFileAsync("git", ["diff", "--cached", "--quiet"], opts);
    return false;
  } catch {
    return true;
  }
}

/**
 * Stage everything under `tasks/` and create one commit if there are staged changes.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
export async function commitOutstandingTasksDir(opts) {
  await execFileAsync("git", ["add", "--", "tasks"], opts);
  if (!(await gitIndexHasStagedChanges(opts))) return;
  await execFileAsync(
    "git",
    ["commit", "-m", "Millrace: save pending changes"],
    opts
  );
}

/**
 * Stage `package.json` and `pnpm-lock.yaml` (whichever exist at `opts.cwd`) and create one
 * commit if there are staged changes. Used after the in-app `pnpm update --latest` /
 * `pnpm install` flow so the next git sync push carries the lockfile/package change.
 * Returns whether a commit was actually written.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export async function commitPnpmUpdateArtifactsIfChanged(opts, message) {
  const candidates = ["package.json", "pnpm-lock.yaml"];
  /** @type {string[]} */
  const present = [];
  for (const rel of candidates) {
    try {
      await fs.access(path.join(opts.cwd, rel));
      present.push(rel);
    } catch {
      /* file absent — skip from `git add` so it does not error */
    }
  }
  if (present.length === 0) return false;
  await execFileAsync("git", ["add", "--", ...present], opts);
  if (!(await gitIndexHasStagedChanges(opts))) return false;
  await execFileAsync("git", ["commit", "-m", message], opts);
  return true;
}

/**
 * `git pull --autostash` when available (Git 2.14+), else plain pull.
 * @param {{ cwd: string, env: Record<string, string | undefined>, maxBuffer: number }} opts
 */
export async function gitPullWithOptionalAutostash(opts) {
  try {
    await execFileAsync(
      "git",
      ["pull", "--no-edit", "--autostash"],
      opts
    );
    return;
  } catch (e) {
    const err = /** @type {Error & { stderr?: Buffer }} */ (e);
    const msg = `${err.stderr ? err.stderr.toString() : ""} ${err.message ?? ""}`.toLowerCase();
    if (
      msg.includes("unknown option") ||
      msg.includes("invalid option") ||
      msg.includes("unrecognized option")
    ) {
      await execFileAsync("git", ["pull", "--no-edit"], opts);
      return;
    }
    throw e;
  }
}
