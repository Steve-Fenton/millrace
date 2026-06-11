import { loadBoardCatalog } from "../boardCatalog.js";
import {
  readMillraceCatalogAdminEmail,
  writeMillraceCatalogAdminEmail,
} from "../millraceCatalogSettings.js";

/**
 * @param {import("express").Application} app
 * @param {{ loadBoardCatalog?: typeof loadBoardCatalog }} [deps]
 */
export function registerFlowRoutes(app, deps = {}) {
  const loadCatalog = deps.loadBoardCatalog ?? loadBoardCatalog;
  app.get("/api/flow", async (_req, res) => {
    try {
      const boards = await loadCatalog();
      res.json({ boards });
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ message: "Failed to read board catalog (.millrace.ini)." });
    }
  });

  app.get("/api/millrace-settings", async (_req, res) => {
    try {
      const admin = await readMillraceCatalogAdminEmail();
      res.json({ admin });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read Millrace settings." });
    }
  });

  app.patch("/api/millrace-settings", async (req, res) => {
    try {
      if (req.body?.admin === undefined) {
        res.status(400).json({
          message: "Expected JSON body with admin (email address).",
        });
        return;
      }
      const admin = String(req.body.admin ?? "").trim();
      if (admin && !admin.includes("@")) {
        res.status(400).json({
          message: "admin must look like an email address.",
        });
        return;
      }
      await writeMillraceCatalogAdminEmail(admin);
      res.json({ admin });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to save Millrace settings." });
    }
  });
}
