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

/** @param {import("express").Application} app */
export function registerGitRoutes(app) {
app.get("/api/git/status", async (_req, res) => {
  try {
    const gitRepo = existsSync(path.join(dataRoot(), ".git"));
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
  if (!existsSync(path.join(cwd, ".git"))) {
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
    const out = await runGitSerialized(async () => {
      if (resolutions && resolutions.length > 0) {
        const unmergedBefore = await gitUnmergedPaths(opts);
        if (unmergedBefore.length === 0) {
          return {
            kind: "badRequest",
            message:
              "No files are in a conflicted state anymore — try Sync again from the start, or finish resolving in another Git client.",
          };
        }
        for (const entry of resolutions) {
          const rel =
            typeof entry?.path === "string" ? entry.path.trim() : "";
          const content = entry?.content != null ? String(entry.content) : "";
          const safe = safeRepoRelativePath(rel);
          if (!safe) {
            return {
              kind: "badRequest",
              message: `Invalid or unsafe path: ${rel || "(empty)"}`,
            };
          }
          const abs = path.join(cwd, ...safe.split("/"));
          await fs.writeFile(abs, content, "utf8");
          const relForGit = path.relative(cwd, abs);
          if (!relForGit || relForGit.startsWith("..")) {
            return {
              kind: "badRequest",
              message: `Could not map path for git add: ${safe}`,
            };
          }
          await execFileAsync("git", ["add", "--", relForGit], opts);
        }
        const still = await gitUnmergedPaths(opts);
        if (still.length > 0) {
          return {
            kind: "conflicts",
            files: await readConflictFilePayloads(still, opts),
          };
        }
        try {
          await execFileAsync("git", ["commit", "--no-edit"], opts);
        } catch {
          try {
            await execFileAsync(
              "git",
              ["commit", "-m", "Merge: resolve conflicts (Millrace)"],
              opts
            );
          } catch {
            /* Nothing to commit (unusual); continue to tasks/ commit + push. */
          }
        }
        try {
          await commitOutstandingTasksDir(opts);
        } catch (e) {
          return { kind: "commitFail", err: e };
        }
        try {
          await execFileAsync("git", ["push"], opts);
        } catch (e) {
          return { kind: "pushFail", err: e };
        }
        return { kind: "done" };
      }

      try {
        await gitPullWithOptionalAutostash(opts);
      } catch (e) {
        const unmerged = await gitUnmergedPaths(opts);
        if (unmerged.length > 0) {
          return {
            kind: "conflicts",
            files: await readConflictFilePayloads(unmerged, opts),
          };
        }
        return { kind: "pullFail", err: e };
      }

      const unmergedAfter = await gitUnmergedPaths(opts);
      if (unmergedAfter.length > 0) {
        return {
          kind: "conflicts",
          files: await readConflictFilePayloads(unmergedAfter, opts),
        };
      }

      try {
        await commitOutstandingTasksDir(opts);
      } catch (e) {
        return { kind: "commitFail", err: e };
      }
      try {
        await execFileAsync("git", ["push"], opts);
      } catch (e) {
        return { kind: "pushFail", err: e };
      }
      return { kind: "done" };
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
      console.error("[flow] git sync: pull failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git pull", out.err),
      });
      return;
    }
    if (out.kind === "commitFail") {
      console.error("[flow] git sync: commit failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git commit", out.err),
      });
      return;
    }
    if (out.kind === "pushFail") {
      console.error("[flow] git sync: push failed", out.err);
      res.status(500).json({
        message: formatGitExecError("git push", out.err),
      });
      return;
    }

    await clearDataRootPendingSync();
    console.error("[flow] git sync: pull, commits, push ok");
    res.json({ ok: true });
  } catch (e) {
    console.error("[flow] git sync: failed", e);
    res.status(500).json({
      message: e instanceof Error ? e.message : "Git sync failed.",
    });
  }
});
}
