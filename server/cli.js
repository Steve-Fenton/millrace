import { existsSync, realpathSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runStartupArchiveStaleForCatalogSlugs } from "./archiveAnalytics.js";
import { portFromArgv } from "./cliArgs.js";
import { app } from "./createApp.js";
import { ensureDefaultTasksLayout } from "./bootstrapTasks.js";
import { boardCatalogIniPath, dataRoot } from "./dataRoot.js";

const PORT = portFromArgv(process.argv) ?? (Number(process.env.PORT) || 8888);
const HOST = process.env.HOST;

async function onListen() {
  const boardPath = path.join(dataRoot(), "tasks", "board.ini");
  const catalogPath = boardCatalogIniPath();
  const boardOk = existsSync(boardPath) || existsSync(catalogPath);
  const where =
    HOST != null && HOST !== ""
      ? `http://${HOST}:${PORT}/`
      : `http://localhost:${PORT}/`;
  console.error(
    `Millrace ${where} (data root ${dataRoot()}${boardOk ? "" : ` — warning: missing ${boardPath} and ${catalogPath}`})`
  );
  await runStartupArchiveStaleForCatalogSlugs();
}

/** Resolve to the real path so symlinked installs (e.g. pnpm) match argv[1]. */
function canonicalScriptPath(p) {
  const resolved = path.resolve(p);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export function isMillracePrimaryServerEntry() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    const entryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.js");
    return canonicalScriptPath(argv1) === canonicalScriptPath(entryPath);
  } catch {
    return false;
  }
}

export function startMillraceServerIfPrimary() {
  if (!isMillracePrimaryServerEntry()) return;
  void startPrimaryServer();
}

async function startPrimaryServer() {
  await ensureDefaultTasksLayout();
  if (HOST != null && HOST !== "") {
    app.listen(PORT, HOST, () => {
      void onListen();
    });
  } else {
    app.listen(PORT, () => {
      void onListen();
    });
  }
}
