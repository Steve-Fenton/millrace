import { runNpmUpdateCheck } from "../npmUpdateCheck.js";

/**
 * @param {import("express").Application} app
 * @param {{ runNpmUpdateCheck?: typeof runNpmUpdateCheck }} [deps]
 */
export function registerNpmUpdateRoutes(app, deps = {}) {
  const run = deps.runNpmUpdateCheck ?? runNpmUpdateCheck;

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
}
