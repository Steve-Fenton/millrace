/**
 * Reset `tasks/demo/` cards from `scripts/demo-board-template/`.
 *
 * Shifts `created`, `closed`, and `next_action_date` so offsets from the
 * reference day (default 2026-05-17, local calendar) match offsets from the
 * day the script runs. Other fields and card ids are preserved.
 *
 * Usage:
 *   node scripts/reset-demo-board.mjs
 *   node scripts/reset-demo-board.mjs --dry-run
 *
 * Override reference or run day (local calendar, YYYY-MM-DD):
 *   MILLRACE_DEMO_REFERENCE_DATE=2026-05-17 node scripts/reset-demo-board.mjs
 *   MILLRACE_DEMO_RUN_DATE=2026-05-20 node scripts/reset-demo-board.mjs
 */
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDir = path.join(root, "scripts", "demo-board-template");
const demoDir = path.join(root, "tasks", "demo");
const CARD_INI_RE = /^FLOW-[\w.-]+\.ini$/i;

const REFERENCE_YMD =
  process.env.MILLRACE_DEMO_REFERENCE_DATE?.trim() || "2026-05-17";
const RUN_YMD = process.env.MILLRACE_DEMO_RUN_DATE?.trim() || "";
const dryRun = process.argv.includes("--dry-run");

/** @param {Date} d */
function localStartOfDayMs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** @param {string} ymd */
function parseLocalYmd(ymd) {
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid YYYY-MM-DD: ${ymd}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** @param {Date} d */
function formatLocalYmd(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** @param {string} iso */
function shiftIsoTimestamp(iso, deltaMs) {
  const ms = Date.parse(String(iso).trim());
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid ISO timestamp: ${iso}`);
  }
  return new Date(ms + deltaMs).toISOString();
}

/** @param {string} ymd */
function shiftNextActionDate(ymd, deltaMs) {
  const base = parseLocalYmd(ymd);
  return formatLocalYmd(new Date(base.getTime() + deltaMs));
}

/**
 * @param {string} text
 * @param {number} deltaMs
 */
function shiftCardIniDates(text, deltaMs) {
  if (!deltaMs) return text;
  return text
    .replace(/^created\s*=\s*.+$/m, (line) => {
      const raw = line.slice(line.indexOf("=") + 1).trim();
      return `created = ${shiftIsoTimestamp(raw, deltaMs)}`;
    })
    .replace(/^closed\s*=\s*.+$/m, (line) => {
      const raw = line.slice(line.indexOf("=") + 1).trim();
      return `closed = ${shiftIsoTimestamp(raw, deltaMs)}`;
    })
    .replace(/^next_action_date\s*=\s*.+$/m, (line) => {
      const raw = line.slice(line.indexOf("=") + 1).trim();
      return `next_action_date = ${shiftNextActionDate(raw, deltaMs)}`;
    });
}

function listCardInis(dir) {
  return readdirSync(dir)
    .filter((name) => CARD_INI_RE.test(name))
    .sort();
}

const referenceMs = localStartOfDayMs(parseLocalYmd(REFERENCE_YMD));
const runDay = RUN_YMD ? parseLocalYmd(RUN_YMD) : new Date();
const runMs = localStartOfDayMs(runDay);
const deltaMs = runMs - referenceMs;

const templates = listCardInis(templateDir);
if (!templates.length) {
  console.error(
    `reset-demo-board: no templates in ${path.relative(root, templateDir)}`
  );
  process.exit(1);
}

const existing = listCardInis(demoDir);
const runLabel = formatLocalYmd(runDay);

console.log(
  `reset-demo-board: reference ${REFERENCE_YMD} → run day ${runLabel} (${deltaMs >= 0 ? "+" : ""}${Math.round(deltaMs / 86400000)} days), ${templates.length} cards`
);

if (dryRun) {
  for (const name of templates) {
    const text = readFileSync(path.join(templateDir, name), "utf8");
    shiftCardIniDates(text, deltaMs);
  }
  console.log("reset-demo-board: dry run — no files written");
  process.exit(0);
}

for (const name of existing) {
  unlinkSync(path.join(demoDir, name));
}

for (const name of templates) {
  const text = readFileSync(path.join(templateDir, name), "utf8");
  const out = shiftCardIniDates(text, deltaMs);
  writeFileSync(path.join(demoDir, name), out, "utf8");
}

console.log(`reset-demo-board: wrote ${templates.length} cards to tasks/demo/`);
