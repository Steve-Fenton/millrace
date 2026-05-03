/**
 * Serialize a parsed board model back to tasks/*.ini text (board + columns + swimlanes + users).
 * Column and swimlane indices are 1..n in list order.
 * @param {import("./boardModel.js").BoardModel} model
 * @returns {string}
 */
export function serializeBoardIniFromModel(model) {
  const lines = [];
  const b = model.board ?? {};

  lines.push("[board]");
  const name = String(b.name ?? "").trim();
  if (name) lines.push(`name = ${name}`);
  const slug = String(b.slug ?? "").trim();
  if (slug) lines.push(`slug = ${slug}`);
  const pf = b.pull_frequency ?? b.pullFrequency;
  if (pf !== undefined && String(pf).trim() !== "") {
    lines.push(`pull_frequency = ${String(pf).trim()}`);
  }
  lines.push("");
  lines.push(
    "; Columns appear in list order by section index (columns.1, columns.2, …)."
  );

  const cols = [...(model.columns ?? [])].sort((a, b) => a.index - b.index);
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const idx = i + 1;
    lines.push(`[columns.${idx}]`);
    const title = String(col.title ?? "").trim() || `Column ${idx}`;
    lines.push(`title = ${title}`);
    if (col.wipLimit != null && Number.isFinite(Number(col.wipLimit)) && Number(col.wipLimit) >= 0) {
      lines.push(`wip_limit = ${Math.round(Number(col.wipLimit))}`);
    }
    if (col.isDone) {
      lines.push(`is_done = true`);
    }
    lines.push("");
  }

  lines.push(
    "; Swimlanes split the board horizontally (e.g. by team or stream)."
  );
  const lanes = [...(model.swimlanes ?? [])].sort((a, b) => a.index - b.index);
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const idx = i + 1;
    lines.push(`[swimlanes.${idx}]`);
    const title = String(lane.title ?? "").trim() || `Lane ${idx}`;
    lines.push(`title = ${title}`);
    lines.push("");
  }

  const users = [...(model.users ?? [])].sort((a, b) => a.index - b.index);
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const idx = i + 1;
    lines.push(`[users.${idx}]`);
    lines.push(`email = ${String(u.email ?? "").trim()}`);
    lines.push(`name = ${String(u.name ?? "").trim()}`);
    if (u.active === false) {
      lines.push(`active = false`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n+$/, "\n");
}
