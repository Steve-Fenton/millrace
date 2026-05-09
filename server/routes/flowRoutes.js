import { loadBoardCatalog } from "../boardCatalog.js";

/** @param {import("express").Application} app */
export function registerFlowRoutes(app) {
  app.get("/api/flow", async (_req, res) => {
    try {
      const boards = await loadBoardCatalog();
      res.json({ boards });
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ message: "Failed to read board catalog (.millrace.ini)." });
    }
  });
}
