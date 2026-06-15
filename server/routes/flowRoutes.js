import { loadBoardCatalog } from "../board/catalog.js";
import {
  readMillraceCatalogUsers,
  validateMillraceUsersPayload,
  writeMillraceCatalogUsers,
} from "../millraceUsers.js";

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

  app.get("/api/millrace-users", async (_req, res) => {
    try {
      const users = await readMillraceCatalogUsers();
      res.json({ users });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to read Millrace users." });
    }
  });

  app.patch("/api/millrace-users", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      if (!Array.isArray(body.users)) {
        res.status(400).json({
          message: "Expected JSON body with users array.",
        });
        return;
      }
      const err = validateMillraceUsersPayload(body.users);
      if (err) {
        res.status(400).json({ message: err });
        return;
      }
      await writeMillraceCatalogUsers(body.users);
      const users = await readMillraceCatalogUsers();
      res.json({ users });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to save Millrace users.";
      res.status(500).json({ message: msg });
    }
  });
}
