import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (parent of `server/`); packaged UI static assets live here. */
export const REPO_ROOT = path.resolve(__dirname, "..");
