import express from "express";
import { runStartupArchiveStaleForCatalogSlugs } from "./archiveAnalytics.js";
import { dataRoot } from "./dataRoot.js";
import { REPO_ROOT } from "./repoRoot.js";
import { registerBoardRoutes } from "./routes/boardRoutes.js";
import { registerCardRoutes } from "./routes/cardRoutes.js";
import { registerColumnAndAnalyticsRoutes } from "./routes/columnAndAnalyticsRoutes.js";
import { registerFlowRoutes } from "./routes/flowRoutes.js";
import { registerGitRoutes } from "./routes/gitRoutes.js";
import { registerLocalUserRoutes } from "./routes/localUserRoutes.js";
import { registerNpmUpdateRoutes } from "./routes/npmUpdateRoutes.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "512kb" }));
  registerFlowRoutes(app);
  registerNpmUpdateRoutes(app);
  registerBoardRoutes(app);
  registerColumnAndAnalyticsRoutes(app);
  registerCardRoutes(app);
  registerGitRoutes(app);
  registerLocalUserRoutes(app);

  /** User project (tasks/, optional files); then packaged UI if not present there. */
  app.use((req, res, next) => express.static(dataRoot())(req, res, next));
  app.use(express.static(REPO_ROOT));
  return app;
}

export const app = createApp();

/** Cold-storage / archive sweep — same as after HTTP listen in production. */
export async function millraceIntegrationStartup() {
  await runStartupArchiveStaleForCatalogSlugs();
}
