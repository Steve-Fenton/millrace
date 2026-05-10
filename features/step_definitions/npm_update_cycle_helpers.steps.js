import assert from "node:assert";
import fs from "node:fs/promises";
import path from "path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { setMillraceDataRootForTesting } from "../../server/dataRoot.js";
import {
  NPM_UPDATE_CHECK_INTERVAL_MS,
  readInstalledMillracePackageMeta,
  runNpmUpdateCheck,
  semverIsNewer,
} from "../../server/npmUpdateCheck.js";
import {
  readProjectHasCycleScript,
  runProjectCycleAfterUserConfirm,
  runProjectInstallThenCycle,
  setProjectCyclePnpmRunnerForTesting,
} from "../../server/projectCycleAfterUpdate.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";

const NPM_UNIT_ROOT = path.join(INTEGRATION_DATA_ROOT, "npm-update-unit");

/** Matches When JSON `nowMs` in cooldown scenarios. */
const NPM_UNIT_FIXED_NOW_MS = 1704193200000;
const ONE_HOUR_MS = 3600000;

Given("npm unit data root is prepared", async function () {
  await fs.rm(NPM_UNIT_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(NPM_UNIT_ROOT, "tasks"), { recursive: true });
  setMillraceDataRootForTesting(NPM_UNIT_ROOT);
});

Given(
  "npm unit localuser.ini contains last_npm_update_check 1 hour before fixed now",
  async function () {
    const iso = new Date(NPM_UNIT_FIXED_NOW_MS - ONE_HOUR_MS).toISOString();
    await fs.writeFile(
      path.join(NPM_UNIT_ROOT, "tasks", "localuser.ini"),
      `[flow]\nlast_npm_update_check = ${iso}\n`,
      "utf8"
    );
  }
);

Given("npm unit tasks localuser.ini is absent", async function () {
  try {
    await fs.unlink(path.join(NPM_UNIT_ROOT, "tasks", "localuser.ini"));
  } catch {
    /* absent */
  }
});

Given("npm unit package.json contains cycle script", async function () {
  await fs.writeFile(
    path.join(NPM_UNIT_ROOT, "package.json"),
    JSON.stringify(
      {
        name: "npm-unit-fixture",
        scripts: { cycle: "node -e \"\"" },
      },
      null,
      0
    ),
    "utf8"
  );
});

Given(
  "npm unit package.json has millrace {string} and cycle script",
  async function (millraceSpec) {
    await fs.writeFile(
      path.join(NPM_UNIT_ROOT, "package.json"),
      JSON.stringify(
        {
          name: "npm-unit-fixture",
          dependencies: { millrace: millraceSpec },
          scripts: { cycle: 'node -e ""' },
        },
        null,
        0
      ),
      "utf8"
    );
  }
);

Given(
  "npm unit pnpm-lock.yaml locks millrace specifier {string} version {string}",
  async function (specifier, version) {
    const specYaml = specifier.replace(/'/g, "''");
    const text = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      millrace:
        specifier: '${specYaml}'
        version: ${version}

packages:
`;
    await fs.writeFile(
      path.join(NPM_UNIT_ROOT, "pnpm-lock.yaml"),
      text,
      "utf8"
    );
  }
);

Given("npm unit package.json has empty scripts", async function () {
  await fs.writeFile(
    path.join(NPM_UNIT_ROOT, "package.json"),
    JSON.stringify({ name: "npm-unit-fixture", scripts: {} }, null, 0),
    "utf8"
  );
});

Given("npm unit package.json is invalid JSON", async function () {
  await fs.writeFile(
    path.join(NPM_UNIT_ROOT, "package.json"),
    "{ not json",
    "utf8"
  );
});

Given("project cycle pnpm is mocked to succeed", function () {
  /** @type {{ args: string[], cwd: string }[]} */
  const calls = [];
  this.pnpmMockCalls = calls;
  setProjectCyclePnpmRunnerForTesting(async (args, cwd) => {
    calls.push({ args: [...args], cwd });
  });
});

Given("project cycle pnpm is mocked to fail on first call", function () {
  let n = 0;
  setProjectCyclePnpmRunnerForTesting(async () => {
    n += 1;
    if (n === 1) {
      throw new Error("mock pnpm failure");
    }
  });
});

When("I run npm update check with JSON:", async function (doc) {
  const opts = JSON.parse(doc.trim());
  let fetchCalls = 0;
  /** Injected registry stub — never calls fetchLatestNpmVersion / registry.npmjs.org. */
  const fetchLatest = async () => {
    fetchCalls += 1;
    const r = opts.registryLatest;
    if (r === undefined || r === null) return null;
    return String(r);
  };
  const intervalMs =
    typeof opts.intervalMs === "number"
      ? opts.intervalMs
      : NPM_UPDATE_CHECK_INTERVAL_MS;
  this.npmUpdateResult = await runNpmUpdateCheck({
    fetchLatest,
    nowMs: opts.nowMs,
    intervalMs,
  });
  this.npmFetchCalls = fetchCalls;
});

When("I read project has cycle script flag", async function () {
  this.projectHasCycleFlag = await readProjectHasCycleScript();
});

When(
  "I run project cycle after confirm for version {string}",
  async function (ver) {
    this.projectCycleResult = await runProjectCycleAfterUserConfirm(ver);
  }
);

When("I run project install cycle after confirm", async function () {
  this.projectCycleResult = await runProjectInstallThenCycle();
});

Then("npm update fetchLatest call count should be {int}", function (n) {
  assert.strictEqual(this.npmFetchCalls, n);
});

Then("npm update fetchLatest call count should be at least {int}", function (n) {
  assert.ok(
    this.npmFetchCalls >= n,
    `expected >= ${n}, got ${this.npmFetchCalls}`
  );
});

Then(
  "npm update result checkedRegistry should be {word}",
  function (word) {
    const want = word === "true";
    assert.strictEqual(this.npmUpdateResult.checkedRegistry, want);
  }
);

Then(
  "npm update result latestVersion should be null",
  function () {
    assert.strictEqual(this.npmUpdateResult.latestVersion, null);
  }
);

Then(
  "npm update result latestVersion should be {string}",
  function (expected) {
    assert.strictEqual(this.npmUpdateResult.latestVersion, expected);
  }
);

Then(
  "npm update result updateAvailable should match semver {string} vs installed",
  async function (registryLatest) {
    const meta = await readInstalledMillracePackageMeta();
    const expected = semverIsNewer(registryLatest, meta.version);
    assert.strictEqual(this.npmUpdateResult.updateAvailable, expected);
  }
);

Then(
  "npm update result projectHasCycleScript should be true",
  function () {
    assert.strictEqual(this.npmUpdateResult.projectHasCycleScript, true);
  }
);

Then("project has cycle script should be false", function () {
  assert.strictEqual(this.projectHasCycleFlag, false);
});

Then("project has cycle script should be true", function () {
  assert.strictEqual(this.projectHasCycleFlag, true);
});

Then("project cycle result ok should be false", function () {
  assert.strictEqual(this.projectCycleResult.ok, false);
});

Then("project cycle result ok should be true", function () {
  assert.strictEqual(this.projectCycleResult.ok, true);
});

Then(
  "project cycle result reason should be {string}",
  function (reason) {
    assert.strictEqual(this.projectCycleResult.reason, reason);
  }
);

Then(
  "npm unit flow npm_auto_cycle_for should be {string}",
  async function (expected) {
    const text = await fs.readFile(
      path.join(NPM_UNIT_ROOT, "tasks", "localuser.ini"),
      "utf8"
    );
    assert.ok(
      text.includes(`npm_auto_cycle_for = ${expected}`),
      `expected npm_auto_cycle_for = ${expected}, file:\n${text}`
    );
  }
);

Then("mocked pnpm should have run update-latest then cycle", function () {
  const calls = this.pnpmMockCalls;
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[0].args, ["update", "--latest"]);
  assert.deepStrictEqual(calls[1].args, ["cycle"]);
});

Then("npm update result lockfileOutOfSync should be true", function () {
  assert.strictEqual(this.npmUpdateResult.lockfileOutOfSync, true);
});

Then("npm update result lockfileOutOfSync should be false", function () {
  assert.strictEqual(this.npmUpdateResult.lockfileOutOfSync, false);
});

Then("mocked pnpm should have run install then cycle", function () {
  const calls = this.pnpmMockCalls;
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[0].args, ["install"]);
  assert.deepStrictEqual(calls[1].args, ["cycle"]);
});

After(function () {
  setProjectCyclePnpmRunnerForTesting(null);
  setMillraceDataRootForTesting(INTEGRATION_DATA_ROOT);
});
