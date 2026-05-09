import { loadBoardCatalog } from "../boardCatalog.js";

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
}
