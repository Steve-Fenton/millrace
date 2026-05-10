import { runNpmUpdateCheck } from "../npmUpdateCheck.js";
import {
  runProjectCycleAfterUserConfirm,
  runProjectInstallThenCycle,
} from "../projectCycleAfterUpdate.js";

/**
 * @param {import("express").Application} app
 * @param {{
 *   runNpmUpdateCheck?: typeof runNpmUpdateCheck,
 *   runProjectCycleAfterUserConfirm?: typeof runProjectCycleAfterUserConfirm,
 *   runProjectInstallThenCycle?: typeof runProjectInstallThenCycle,
 * }} [deps]
 */
export function registerNpmUpdateRoutes(app, deps = {}) {
  const run = deps.runNpmUpdateCheck ?? runNpmUpdateCheck;
  const runCycle =
    deps.runProjectCycleAfterUserConfirm ?? runProjectCycleAfterUserConfirm;
  const runInstall =
    deps.runProjectInstallThenCycle ?? runProjectInstallThenCycle;

  app.get("/api/npm-update-check", async (_req, res) => {
    try {
      const payload = await run();
      res.json(payload);
    } catch (e) {
      console.error(e);
      res.status(500).json({
        message: "Could not determine NPM update status.",
      });
    }
  });

  app.post("/api/npm-update-run-cycle", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const mode = String(body.mode ?? "").trim().toLowerCase();
      if (mode === "install-sync") {
        const result = await runInstall({ deferCycle: true });
        res.json(result);
        return;
      }
      const raw = body.latestVersion ?? body.latest_version;
      const latestVersion = String(raw ?? "").trim();
      if (!latestVersion) {
        res.status(400).json({
          message:
            "Expected JSON body with latestVersion (string), or mode=install-sync.",
        });
        return;
      }
      const result = await runCycle(latestVersion, { deferCycle: true });
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({
        message: "Could not run pnpm update/cycle.",
      });
    }
  });
}
