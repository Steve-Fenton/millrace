import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { dataRoot } from "../dataRoot.js";
import {
  commitOutstandingTasksDir,
  execFileAsync,
  formatGitExecError,
  gitChildEnv,
  gitPullWithOptionalAutostash,
  gitUnmergedPaths,
  readConflictFilePayloads,
  runGitSerialized,
  safeRepoRelativePath,
} from "../gitOps.js";
import { clearDataRootPendingSync } from "../localUserIni.js";

/**
 * Result shape produced by the `/api/git/sync` pipeline (before HTTP mapping).
 * @typedef {{
 *   kind: "conflicts";
 *   files: unknown[];
 * } | {
 *   kind: "badRequest";
 *   message: string;
 * } | {
 *   kind: "pullFail" | "commitFail" | "pushFail";
 *   err: unknown;
 * } | {
 *   kind: "done";
 * }} GitSyncPipelineOut
 */

/**
 * Optional overrides for {@link runDefaultGitSyncPipeline} (tests only).
 * @typedef {{
 *   writeFile?: typeof fs.writeFile;
 *   gitUnmergedPaths?: typeof gitUnmergedPaths;
 *   safeRepoRelativePath?: typeof safeRepoRelativePath;
 *   execFileAsync?: typeof execFileAsync;
 *   readConflictFilePayloads?: typeof readConflictFilePayloads;
 *   commitOutstandingTasksDir?: typeof commitOutstandingTasksDir;
 *   gitPullWithOptionalAutostash?: typeof gitPullWithOptionalAutostash;
 *   computeGitAddRelativePath?: (cwd: string, abs: string) => string;
 * }} GitSyncImplOverrides
 */

/**
 * Default Git sync pipeline used when no `gitSyncPipeline` mock is installed.
 * @param {{ cwd: string; resolutions: unknown[] | null; opts: object }} params
 * @param {GitSyncImplOverrides} [impl]
 * @returns {Promise<GitSyncPipelineOut>}
 */
export async function runDefaultGitSyncPipeline(
  { cwd, resolutions, opts },
  impl = {}
) {
  const writeFile = impl.writeFile ?? fs.writeFile.bind(fs);
  const gitUnmergedPathsFn = impl.gitUnmergedPaths ?? gitUnmergedPaths;
  const safeRel = impl.safeRepoRelativePath ?? safeRepoRelativePath;
  const execFileAsyncFn = impl.execFileAsync ?? execFileAsync;
  const readConflictPayloadsFn =
    impl.readConflictFilePayloads ?? readConflictFilePayloads;
  const commitTasksFn =
    impl.commitOutstandingTasksDir ?? commitOutstandingTasksDir;
  const gitPullFn =
    impl.gitPullWithOptionalAutostash ?? gitPullWithOptionalAutostash;

  if (resolutions && resolutions.length > 0) {
    const unmergedBefore = await gitUnmergedPathsFn(opts);
    if (unmergedBefore.length === 0) {
      return {
        kind: "badRequest",
        message:
          "No files are in a conflicted state anymore — try Sync again from the start, or finish resolving in another Git client.",
      };
    }
    for (const entry of resolutions) {
      const rel = typeof entry?.path === "string" ? entry.path.trim() : "";
      const content = entry?.content != null ? String(entry.content) : "";
      const safe = safeRel(rel);
      if (!safe) {
        return {
          kind: "badRequest",
          message: `Invalid or unsafe path: ${rel || "(empty)"}`,
        };
      }
      const abs = path.join(cwd, ...safe.split("/"));
      await writeFile(abs, content, "utf8");
      const relForGit = impl.computeGitAddRelativePath
        ? impl.computeGitAddRelativePath(cwd, abs)
        : path.relative(cwd, abs);
      if (!relForGit || relForGit.startsWith("..")) {
        return {
          kind: "badRequest",
          message: `Could not map path for git add: ${safe}`,
        };
      }
      await execFileAsyncFn("git", ["add", "--", relForGit], opts);
    }
    const still = await gitUnmergedPathsFn(opts);
    if (still.length > 0) {
      return {
        kind: "conflicts",
        files: await readConflictPayloadsFn(still, opts),
      };
    }
    try {
      await execFileAsyncFn("git", ["commit", "--no-edit"], opts);
    } catch {
      try {
        await execFileAsyncFn(
          "git",
          ["commit", "-m", "Merge: resolve conflicts (Millrace)"],
          opts
        );
      } catch {
        /* Nothing to commit (unusual); continue to tasks/ commit + push. */
      }
    }
    try {
      await commitTasksFn(opts);
    } catch (e) {
      return { kind: "commitFail", err: e };
    }
    try {
      await execFileAsyncFn("git", ["push"], opts);
    } catch (e) {
      return { kind: "pushFail", err: e };
    }
    return { kind: "done" };
  }

  try {
    await gitPullFn(opts);
  } catch (e) {
    const unmerged = await gitUnmergedPathsFn(opts);
    if (unmerged.length > 0) {
      return {
        kind: "conflicts",
        files: await readConflictPayloadsFn(unmerged, opts),
      };
    }
    return { kind: "pullFail", err: e };
  }

  const unmergedAfter = await gitUnmergedPathsFn(opts);
  if (unmergedAfter.length > 0) {
    return {
      kind: "conflicts",
      files: await readConflictPayloadsFn(unmergedAfter, opts),
    };
  }

  try {
    await commitTasksFn(opts);
  } catch (e) {
    return { kind: "commitFail", err: e };
  }
  try {
    await execFileAsyncFn("git", ["push"], opts);
  } catch (e) {
    return { kind: "pushFail", err: e };
  }
  return { kind: "done" };
}

/**
 * @param {import("express").Application} app
 * @param {{
 *   checkGitRepoPresent?: () => boolean;
 *   checkDataRootHasGit?: () => boolean;
 *   runGitSerialized?: typeof runGitSerialized;
 *   gitSyncPipeline?: (
 *     req: import("express").Request
 *   ) => Promise<GitSyncPipelineOut>;
 *   gitSyncImpl?: GitSyncImplOverrides;
 *   clearDataRootPendingSync?: typeof clearDataRootPendingSync;
 * }} [deps]
 */
export function registerGitRoutes(app, deps = {}) {
  const checkGitRepoPresent =
    deps.checkGitRepoPresent ??
    (() => existsSync(path.join(dataRoot(), ".git")));

  const dataRootHasGit =
    deps.checkDataRootHasGit ??
    (() => existsSync(path.join(dataRoot(), ".git")));

  const runSerialized = deps.runGitSerialized ?? runGitSerialized;

  const clearPending =
    deps.clearDataRootPendingSync ?? clearDataRootPendingSync;

  const gitSyncImpl = deps.gitSyncImpl ?? {};

  app.get("/api/git/status", async (_req, res) => {
    try {
      const gitRepo = checkGitRepoPresent();
      res.json({ gitRepo });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read git status." });
    }
  });

  /**
   * Sync: pull (with autostash when supported), optional conflict resolution payload,
   * commit outstanding `tasks/` changes, push. Body: `{ conflictResolutions?: { path, content }[] }`.
   */
  app.post("/api/git/sync", async (req, res) => {
    const cwd = dataRoot();
    if (!dataRootHasGit()) {
      res.status(400).json({
        message:
          "No Git repository at the Millrace data root — run the server from your clone (see FLOW_ROOT).",
      });
      return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const rawResolutions = body.conflictResolutions;
    const resolutions = Array.isArray(rawResolutions) ? rawResolutions : null;

    const env = gitChildEnv();
    const opts = {
      cwd,
      env,
      maxBuffer: 10 * 1024 * 1024,
    };

    try {
      const out = await runSerialized(async () => {
        if (deps.gitSyncPipeline) {
          return await deps.gitSyncPipeline(req);
        }

        return await runDefaultGitSyncPipeline(
          { cwd, resolutions, opts },
          gitSyncImpl
        );
      });

      if (out.kind === "conflicts") {
        res.json({
          ok: false,
          needConflictResolution: true,
          files: out.files,
        });
        return;
      }
      if (out.kind === "badRequest") {
        res.status(400).json({ message: out.message });
        return;
      }
      if (out.kind === "pullFail") {
        console.error("[millrace] git sync: pull failed", out.err);
        res.status(500).json({
          message: formatGitExecError("git pull", out.err),
        });
        return;
      }
      if (out.kind === "commitFail") {
        console.error("[millrace] git sync: commit failed", out.err);
        res.status(500).json({
          message: formatGitExecError("git commit", out.err),
        });
        return;
      }
      if (out.kind === "pushFail") {
        console.error("[millrace] git sync: push failed", out.err);
        res.status(500).json({
          message: formatGitExecError("git push", out.err),
        });
        return;
      }

      await clearPending();
      console.error("[millrace] git sync: pull, commits, push ok");
      res.json({ ok: true });
    } catch (e) {
      console.error("[millrace] git sync: failed", e);
      res.status(500).json({
        message: e instanceof Error ? e.message : "Git sync failed.",
      });
    }
  });
}
