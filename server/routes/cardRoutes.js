import { registerCardCrudRoutes } from "./card/crudRoutes.js";
import { registerCardMoveRoutes } from "./card/moveRoutes.js";
import { registerCardReadRoutes } from "./card/readRoutes.js";

/** @param {import("express").Application} app */
export function registerCardRoutes(app) {
  registerCardReadRoutes(app);
  registerCardCrudRoutes(app);
  registerCardMoveRoutes(app);
}
