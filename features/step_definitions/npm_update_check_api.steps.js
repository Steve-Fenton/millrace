import assert from "node:assert";
import express from "express";
import { Given, Then } from "@cucumber/cucumber";
import supertest from "supertest";
import { semverIsNewer } from "../../server/npmUpdateCheck.js";
import { registerNpmUpdateRoutes } from "../../server/routes/npmUpdateRoutes.js";

Then(
  "the last JSON response should include updateAvailable true",
  function () {
    assert.strictEqual(this.lastJson.updateAvailable, true);
  }
);

Given("an Express app with mocked npm update check", async function () {
  const app = express();
  app.use(express.json({ limit: "512kb" }));
  registerNpmUpdateRoutes(app, {
    runNpmUpdateCheck: async () => ({
      currentVersion: "0.0.1",
      latestVersion: "0.0.2",
      updateAvailable: true,
      checkedRegistry: true,
      projectHasCycleScript: false,
      lockfileOutOfSync: false,
      packageMillraceSpec: null,
      lockSpecifier: null,
      lockResolvedVersion: null,
    }),
  });
  this.flowApiAgent = supertest(app);
});

Given(
  "an Express app with npm update routes where runNpmUpdateCheck throws",
  async function () {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    registerNpmUpdateRoutes(app, {
      runNpmUpdateCheck: async () => {
        throw new Error("mock npm update check failure");
      },
    });
    this.flowApiAgent = supertest(app);
  }
);

Given(
  "an Express app with npm update routes tracking cycle and install runners",
  async function () {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    /** @type {string | undefined} */
    let cycleVersion;
    registerNpmUpdateRoutes(app, {
      runProjectCycleAfterUserConfirm: async (latestVersion, opts) => {
        cycleVersion = latestVersion;
        assert.strictEqual(opts?.deferCycle, true);
        return { ok: true, cycleVersion: latestVersion };
      },
      runProjectInstallThenCycle: async () => ({
        ok: true,
        via: "install-sync",
      }),
    });
    this.npmRoutesCycleVersion = () => cycleVersion;
    this.flowApiAgent = supertest(app);
  }
);

Given(
  "an Express app with npm update routes where runProjectCycleAfterUserConfirm throws",
  async function () {
    const app = express();
    app.use(express.json({ limit: "512kb" }));
    registerNpmUpdateRoutes(app, {
      runProjectCycleAfterUserConfirm: async () => {
        throw new Error("mock cycle failure");
      },
    });
    this.flowApiAgent = supertest(app);
  }
);

Then(
  "semverIsNewer compares {string} and {string} expecting {word}",
  function (latest, current, expected) {
    const want = expected === "true";
    assert.strictEqual(semverIsNewer(latest, current), want);
  }
);

Then(
  "npm route cycle runner should have received latestVersion {string}",
  function (expected) {
    assert.strictEqual(this.npmRoutesCycleVersion(), expected);
  }
);
