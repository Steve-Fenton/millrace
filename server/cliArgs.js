import path from "path";

/**
 * Parse startup args from `node server.js ...`.
 * Supports a positional port and a data-root override:
 * - node server.js 9999
 * - node server.js --data-root /tmp/millrace-test
 * - node server.js --data-root=/tmp/millrace-test 9999
 *
 * @param {string[]} argv
 * @returns {{ port: number | null, dataRoot: string | null }}
 */
export function cliOptionsFromArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  let port = null;
  let cliDataRootOverride = null;
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    if (!raw) continue;
    if (raw === "--data-root") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        cliDataRootOverride = path.resolve(next);
        i += 1;
      }
      continue;
    }
    if (raw.startsWith("--data-root=")) {
      const value = raw.slice("--data-root=".length).trim();
      if (value) cliDataRootOverride = path.resolve(value);
      continue;
    }
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      if (n >= 1 && n <= 65535) {
        port = n;
      }
    }
  }
  return { port, dataRoot: cliDataRootOverride };
}

/**
 * @param {string[]} argv
 */
export function portFromArgv(argv) {
  return cliOptionsFromArgv(argv).port;
}
