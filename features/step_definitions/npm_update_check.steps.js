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

Then(
  "semverIsNewer compares {string} and {string} expecting {word}",
  function (latest, current, expected) {
    const want = expected === "true";
    assert.strictEqual(semverIsNewer(latest, current), want);
  }
);
