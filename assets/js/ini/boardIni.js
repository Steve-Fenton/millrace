import {
  isAggregateBoard,
  standardAggregateColumns,
} from "../models/aggregateBoard.js";
import { columnTypeOf } from "../models/boardModel.js";

/**
 * Serialize a parsed board model back to tasks/*.ini text (board + columns + swimlanes + users).
 * Column and swimlane indices are 1..n in list order.
 * @param {import("../models/boardModel.js").BoardModel} model
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
  const kind = String(b.kind ?? "").trim();
  if (kind) lines.push(`kind = ${kind}`);
  lines.push("");

  const sources = [...(model.sources ?? [])].sort((a, b) => a.index - b.index);
  if (sources.length > 0) {
    lines.push(
      "; Aggregate boards include tasks from the listed source boards (by column type)."
    );
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const idx = i + 1;
      lines.push(`[sources.${idx}]`);
      lines.push(`slug = ${String(src.slug ?? "").trim()}`);
      lines.push("");
    }
  }

  lines.push(
    "; Columns appear in list order by section index (columns.1, columns.2, …)."
  );

  const cols = (
    isAggregateBoard(model) ? standardAggregateColumns() : model.columns ?? []
  ).sort((a, b) => a.index - b.index);
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const idx = i + 1;
    lines.push(`[columns.${idx}]`);
    const title = String(col.title ?? "").trim() || `Column ${idx}`;
    lines.push(`title = ${title}`);
    if (col.wipLimit != null && Number.isFinite(Number(col.wipLimit)) && Number(col.wipLimit) >= 0) {
      lines.push(`wip_limit = ${Math.round(Number(col.wipLimit))}`);
    }
    lines.push(`type = ${columnTypeOf(col)}`);
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

  if (isAggregateBoard(model)) {
    return lines.join("\n").replace(/\n+$/, "\n");
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
