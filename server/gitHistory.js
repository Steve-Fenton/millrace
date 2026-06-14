import { existsSync } from "fs";
import path from "path";
import { execFileAsync, gitChildEnv, formatGitExecError } from "./gitOps.js";
import { dataRoot } from "./dataRoot.js";

/** @typedef {{ hash: string, shortHash: string, date: string, author: string, subject: string, changeSummary?: string[] }} GitCommit */

/** @typedef {{ gitAvailable: boolean, path: string | null, commits: GitCommit[], message: string }} GitHistoryResult */

/** @typedef {{
 *   absolutePath: string;
 *   useFollow: boolean;
 *   limit?: number;
 *   summarizeDiff: (before: string | null, after: string | null) => string[];
 *   notFoundMessage?: string;
 *   invalidPathMessage?: string;
 * }} GetHistoryOptions */

export async function getGitHistory({
  absolutePath,
  useFollow = false,
  limit = 40,
  summarizeDiff,
  notFoundMessage = "File not found.",
  invalidPathMessage = "Invalid path for history.",
}) {
  if (!existsSync(absolutePath)) {
    return { gitAvailable: false, path: null, commits: [], message: notFoundMessage };
  }

  if (!existsSync(path.join(dataRoot(), ".git"))) {
    return { gitAvailable: false, path: null, commits: [], message: "No Git repository at the Millrace data root." };
  }

  const rel = path.relative(dataRoot(), absolutePath).split(path.sep).join("/");
  const norm = path.posix.normalize(rel);
  const absNorm = path.resolve(dataRoot(), norm);
  const tasksRoot = path.resolve(dataRoot(), "tasks");
  
  if (
    norm.startsWith("../") || norm === ".." || norm.startsWith("/") ||
    !norm.startsWith("tasks/") ||
    (!absNorm.startsWith(tasksRoot + path.sep) && absNorm !== tasksRoot)
  ) {
    return { gitAvailable: false, path: null, commits: [], message: invalidPathMessage };
  }

  const opts = { cwd: dataRoot(), env: gitChildEnv(), maxBuffer: 5 * 1024 * 1024 };
  const logArgs = ["log", useFollow ? "--follow" : null, `-n${Math.min(100, Math.max(1, limit))}`, "--format=%H%x1f%h%x1f%ai%x1f%an%x1f%s", "--", norm].filter(Boolean);
  
  /** @type {GitCommit[]} */
  const commits = [];
  let gitMessage = "";

  try {
    const { stdout } = await execFileAsync("git", logArgs, opts);
    for (const line of String(stdout ?? "").trim().split("\n")) {
      if (!line) continue;
      const p = line.split("\x1f");
      if (p.length >= 5) {
        commits.push({ hash: p[0], shortHash: p[1], date: p[2], author: p[3], subject: p.slice(4).join("\x1f") });
      }
    }
  } catch (e) {
    gitMessage = formatGitExecError("git log", e);
  }

  async function gitShowBlob(rev) {
    try {
      const { stdout } = await execFileAsync("git", ["show", `${rev}:${norm}`], opts);
      return String(stdout ?? "");
    } catch { return null; }
  }

  const batchSize = 6;
  for (let i = 0; i < commits.length; i += batchSize) {
    const slice = commits.slice(i, i + batchSize);
    await Promise.all(slice.map(async (c) => {
      const afterText = await gitShowBlob(c.hash);
      const beforeText = await gitShowBlob(`${c.hash}^`);
      c.changeSummary = summarizeDiff(beforeText, afterText);
    }));
  }

  return {
    gitAvailable: true,
    path: norm,
    commits,
    message: gitMessage || (commits.length === 0 ? "No commits found for this file (not tracked yet, or no history)." : ""),
  };
}