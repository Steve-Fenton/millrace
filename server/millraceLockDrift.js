import fs from "fs/promises";
import path from "path";
import { dataRoot } from "./dataRoot.js";

/**
 * Extract the millrace importer entry from the top of pnpm-lock.yaml (before `packages:`).
 * Supports lockfile layout with `specifier` / `version` under `importers`.`.<deps>`.millrace.
 *
 * @param {string} lockText
 * @returns {{ specifier: string, version: string } | null}
 */
export function parsePnpmLockMillrace(lockText) {
  const cut = lockText.indexOf("\npackages:");
  const head = cut >= 0 ? lockText.slice(0, cut) : lockText;
  const m = head.match(
    /^\s+millrace:\s*\r?\n\s+specifier:\s*(.+?)\s*\r?\n\s+version:\s*(.+?)\s*$/m
  );
  if (!m) return null;
  const specifier = stripQuotes(m[1].trim());
  let version = m[2].trim();
  const paren = version.indexOf("(");
  if (paren !== -1) version = version.slice(0, paren).trim();
  return { specifier, version };
}

/** @param {string} s */
function stripQuotes(s) {
  const t = String(s ?? "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * @param {string} spec millrace dependency string from package.json
 * @returns {string | null} plain X.Y.Z when `spec` is an exact version (no range prefix)
 */
function exactSemverOnly(spec) {
  const s = stripQuotes(spec).trim();
  if (/^[\^~>=<]/.test(s)) return null;
  return /^\d+\.\d+\.\d+$/.test(s) ? s : null;
}

/**
 * Compare Millrace in the data-root package.json with pnpm-lock.yaml (another user may have
 * changed package.json without running `pnpm install`).
 *
 * @returns {Promise<{
 *   lockfileOutOfSync: boolean,
 *   packageMillraceSpec: string | null,
 *   lockSpecifier: string | null,
 *   lockResolvedVersion: string | null,
 * }>}
 */
export async function readMillraceLockfileDrift() {
  const root = dataRoot();
  let pkgRaw;
  try {
    pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf8");
  } catch {
    return emptyDrift();
  }

  /** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */
  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    return emptyDrift();
  }

  const raw =
    (pkg.dependencies && pkg.dependencies.millrace) ||
    (pkg.devDependencies && pkg.devDependencies.millrace);
  const packageMillraceSpec =
    typeof raw === "string" && raw.trim() ? stripQuotes(raw.trim()) : null;

  if (!packageMillraceSpec) {
    return emptyDrift();
  }

  if (/^(workspace|file|link|portal):/i.test(packageMillraceSpec)) {
    return {
      lockfileOutOfSync: false,
      packageMillraceSpec,
      lockSpecifier: null,
      lockResolvedVersion: null,
    };
  }

  let lockRaw;
  try {
    lockRaw = await fs.readFile(path.join(root, "pnpm-lock.yaml"), "utf8");
  } catch {
    return {
      lockfileOutOfSync: true,
      packageMillraceSpec,
      lockSpecifier: null,
      lockResolvedVersion: null,
    };
  }

  const parsed = parsePnpmLockMillrace(lockRaw);
  if (!parsed) {
    return {
      lockfileOutOfSync: true,
      packageMillraceSpec,
      lockSpecifier: null,
      lockResolvedVersion: null,
    };
  }

  const pkgNorm = packageMillraceSpec.trim();
  const lockSpecNorm = parsed.specifier.trim();

  let lockfileOutOfSync = pkgNorm !== lockSpecNorm;

  const exact = exactSemverOnly(packageMillraceSpec);
  if (exact && parsed.version !== exact) {
    lockfileOutOfSync = true;
  }

  return {
    lockfileOutOfSync,
    packageMillraceSpec,
    lockSpecifier: parsed.specifier,
    lockResolvedVersion: parsed.version,
  };
}

function emptyDrift() {
  return {
    lockfileOutOfSync: false,
    packageMillraceSpec: null,
    lockSpecifier: null,
    lockResolvedVersion: null,
  };
}
