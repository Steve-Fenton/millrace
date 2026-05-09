import express from "express";
import { Given } from "@cucumber/cucumber";
import supertest from "supertest";
import { registerGitRoutes } from "../../server/routes/gitRoutes.js";

Given("an Express app with git routes whose git status check throws", async function () {
  const app = express();
  app.use(express.json({ limit: "512kb" }));
  registerGitRoutes(app, {
    checkGitRepoPresent: () => {
      throw new Error("simulated git status failure");
    },
  });
  this.flowApiAgent = supertest(app);
});

Given(
  "an Express app with git routes pretending the data root has git and mocked pipeline {string}",
  async function (kind) {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    let gitSyncPipeline;
    switch (kind.trim()) {
      case "conflicts":
        gitSyncPipeline = async () => ({
          kind: "conflicts",
          files: [{ path: "tasks/t.ini", content: "c" }],
        });
        break;
      case "bad-request":
        gitSyncPipeline = async () => ({
          kind: "badRequest",
          message: "mock validation",
        });
        break;
      case "pull-fail":
        gitSyncPipeline = async () => ({
          kind: "pullFail",
          err: new Error("mock pull"),
        });
        break;
      case "commit-fail":
        gitSyncPipeline = async () => ({
          kind: "commitFail",
          err: new Error("mock commit"),
        });
        break;
      case "push-fail":
        gitSyncPipeline = async () => ({
          kind: "pushFail",
          err: new Error("mock push"),
        });
        break;
      case "success":
        gitSyncPipeline = async () => ({ kind: "done" });
        break;
      default:
        throw new Error(`unknown pipeline kind: ${kind}`);
    }
    registerGitRoutes(app, {
      checkDataRootHasGit: () => true,
      gitSyncPipeline,
      clearDataRootPendingSync: async () => {},
    });
    this.flowApiAgent = supertest(app);
  }
);

Given(
  "an Express app with git routes pretending the data root has git and the serialized runner throws",
  async function () {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    registerGitRoutes(app, {
      checkDataRootHasGit: () => true,
      runGitSerialized: async () => {
        throw new Error("serialized runner failure");
      },
    });
    this.flowApiAgent = supertest(app);
  }
);

Given(
  "an Express app with git routes pretending the data root has git and the serialized runner throws a non-Error",
  async function () {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    registerGitRoutes(app, {
      checkDataRootHasGit: () => true,
      runGitSerialized: async () => {
        throw "not an Error object";
      },
    });
    this.flowApiAgent = supertest(app);
  }
);

Given(
  "an Express app with git routes using default pipeline mocks for {string}",
  async function (scenarioId) {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    let gitSyncImpl = {};
    switch (scenarioId.trim()) {
      case "resolution-stale":
        gitSyncImpl = {
          gitUnmergedPaths: async () => [],
        };
        break;
      case "resolution-invalid-path":
        gitSyncImpl = {
          gitUnmergedPaths: async () => ["tasks/a.ini"],
          safeRepoRelativePath: () => null,
        };
        break;
      case "resolution-map-git-add-fails":
        gitSyncImpl = {
          gitUnmergedPaths: async () => ["x"],
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          computeGitAddRelativePath: () => "..",
        };
        break;
      case "resolution-still-conflicted": {
        let uCalls = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            uCalls += 1;
            if (uCalls === 1) return ["tasks/a.ini"];
            return ["tasks/b.ini"];
          },
          safeRepoRelativePath: (rel) =>
            String(rel).includes("..") ? null : "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async () => {},
          readConflictFilePayloads: async (paths) =>
            paths.map((p) => ({ path: p })),
        };
        break;
      }
      case "resolution-commit-fails": {
        let uc = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            uc += 1;
            return uc === 1 ? ["x"] : [];
          },
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async () => {},
          commitOutstandingTasksDir: async () => {
            throw new Error("commit tasks failed");
          },
        };
        break;
      }
      case "resolution-both-merge-commits-fail": {
        let ucB = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            ucB += 1;
            return ucB === 1 ? ["x"] : [];
          },
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async (cmd, args) => {
            if (cmd === "git" && args[0] === "add") return;
            if (cmd === "git" && args[0] === "commit") {
              throw new Error("merge commit impossible");
            }
          },
          commitOutstandingTasksDir: async () => {},
        };
        break;
      }
      case "resolution-merge-msg-fallback": {
        let ucM = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            ucM += 1;
            return ucM === 1 ? ["x"] : [];
          },
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async (cmd, args) => {
            if (cmd === "git" && args[0] === "commit" && args[1] === "--no-edit") {
              throw new Error("no merge commit");
            }
          },
          commitOutstandingTasksDir: async () => {},
        };
        break;
      }
      case "resolution-full-success": {
        let ucS = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            ucS += 1;
            return ucS === 1 ? ["x"] : [];
          },
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async () => {},
          commitOutstandingTasksDir: async () => {},
        };
        break;
      }
      case "resolution-push-fails": {
        let uc2 = 0;
        gitSyncImpl = {
          gitUnmergedPaths: async () => {
            uc2 += 1;
            return uc2 === 1 ? ["x"] : [];
          },
          safeRepoRelativePath: () => "tasks/a.ini",
          writeFile: async () => {},
          execFileAsync: async (cmd, args) => {
            if (cmd === "git" && args[0] === "push") {
              throw new Error("push rejected");
            }
          },
          commitOutstandingTasksDir: async () => {},
        };
        break;
      }
      case "pull-fails-clean":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {
            throw new Error("pull failed");
          },
          gitUnmergedPaths: async () => [],
        };
        break;
      case "pull-merge-conflicts":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {
            throw new Error("pull failed");
          },
          gitUnmergedPaths: async () => ["conflict.ini"],
          readConflictFilePayloads: async (paths) =>
            paths.map((p) => ({ path: p })),
        };
        break;
      case "post-pull-conflicts":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {},
          gitUnmergedPaths: async () => ["left.ini"],
          readConflictFilePayloads: async (paths) =>
            paths.map((p) => ({ path: p })),
        };
        break;
      case "normal-commit-fails":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {},
          gitUnmergedPaths: async () => [],
          commitOutstandingTasksDir: async () => {
            throw new Error("normal commit failed");
          },
        };
        break;
      case "normal-push-fails":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {},
          gitUnmergedPaths: async () => [],
          commitOutstandingTasksDir: async () => {},
          execFileAsync: async (cmd, args) => {
            if (cmd === "git" && args[0] === "push") {
              throw new Error("push failed");
            }
          },
        };
        break;
      case "normal-success":
        gitSyncImpl = {
          gitPullWithOptionalAutostash: async () => {},
          gitUnmergedPaths: async () => [],
          commitOutstandingTasksDir: async () => {},
          execFileAsync: async () => {},
        };
        break;
      default:
        throw new Error(`unknown default pipeline mock: ${scenarioId}`);
    }
    registerGitRoutes(app, {
      checkDataRootHasGit: () => true,
      gitSyncImpl,
      clearDataRootPendingSync: async () => {},
    });
    this.flowApiAgent = supertest(app);
  }
);
