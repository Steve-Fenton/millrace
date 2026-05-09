import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runStartupArchiveStaleForCatalogSlugs } from "./archiveAnalytics.js";
import { portFromArgv } from "./cliArgs.js";
import { app } from "./createApp.js";
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

export function isMillracePrimaryServerEntry() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    const entryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.js");
    return path.resolve(argv1) === path.resolve(entryPath);
  } catch {
    return false;
  }
}

export function startMillraceServerIfPrimary() {
  if (!isMillracePrimaryServerEntry()) return;
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
