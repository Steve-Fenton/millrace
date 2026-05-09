/**
 * Keeps docs/quick-start.md example `millrace` dependency aligned with package.json `version`.
 * Run via `pnpm sync-docs`, or automatically on `npm version` / `prepublishOnly`.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const v = pkg.version;
const docPath = path.join(root, "docs/quick-start.md");
let text = readFileSync(docPath, "utf8");
const next = text.replace(/("millrace"\s*:\s*"\^)[0-9.]+"/, `$1${v}"`);
if (text === next) {
  if (!/"millrace"\s*:\s*"\^/.test(text)) {
    console.error(
      'sync-docs-version: could not find "millrace": "^…" in docs/quick-start.md'
    );
    process.exit(1);
  }
  process.exit(0);
}
writeFileSync(docPath, next, "utf8");
