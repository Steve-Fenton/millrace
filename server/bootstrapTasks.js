import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { BOARD_CATALOG_SECTION } from "./constants.js";
import { boardCatalogIniPath, dataRoot } from "./dataRoot.js";

/** Same content as the repo’s sample `tasks/demo.ini` (demo board + sample user). */
const DEFAULT_DEMO_INI = `[board]
name = Demo
slug = demo

; Columns appear in list order by section index (columns.1, columns.2, …).
[columns.1]
title = To Do

[columns.2]
title = Doing
wip_limit = 1

[columns.3]
title = Done
is_done = true

; Swimlanes split the board horizontally (e.g. by team or stream).
[swimlanes.1]
title = Default

[users.1]
email = millrace@example.com
name = Steve Fenton
`;

function defaultCatalogIniText() {
  return `; Boards listed here are INI files under tasks/ (comma-separated, in order).
[${BOARD_CATALOG_SECTION}]
boards = demo.ini

; How long after closed before a card moves to tasks/{slug}/archive/ (days). Omit for default 14. Use 0 to disable.
archive_closed_after_days = 14

; How long after closed before an archived card moves to cold-storage (months). Omit for default 12. Use 0 to disable.
cold_storage_archive_after_months = 12
`;
}

/**
 * When `tasks/` is missing or there is no board catalog (`.millrace.ini`), create a minimal
 * `tasks/.millrace.ini` and `tasks/demo.ini` so the UI has a working board.
 */
export async function ensureDefaultTasksLayout() {
  const tasksDir = path.join(dataRoot(), "tasks");
  const catalogPath = boardCatalogIniPath();
  const demoPath = path.join(tasksDir, "demo.ini");

  const needsBootstrap = !existsSync(tasksDir) || !existsSync(catalogPath);
  if (!needsBootstrap) return;

  await fs.mkdir(tasksDir, { recursive: true });
  if (!existsSync(demoPath)) {
    await fs.writeFile(demoPath, DEFAULT_DEMO_INI, "utf8");
  }
  if (!existsSync(catalogPath)) {
    await fs.writeFile(catalogPath, defaultCatalogIniText(), "utf8");
  }
}
