import {
  boardUsersSortedForUi,
  columnTypeOf,
  enrichBoardUsersWithMillraceCatalog,
  parseBoardIni,
} from "./boardModel.js";

/** @typedef {'normal' | 'aggregate'} BoardKind */

export const AGGREGATE_BOARD_KIND = "aggregate";

/**
 * @param {import("./boardModel.js").BoardModel | { board?: { kind?: string } }} model
 * @returns {boolean}
 */
export function isAggregateBoard(model) {
  const kind = String(model?.board?.kind ?? "")
    .trim()
    .toLowerCase();
  return kind === AGGREGATE_BOARD_KIND;
}

/**
 * Standard aggregate columns (one per workflow type).
 * @returns {import("./boardModel.js").ColumnDef[]}
 */
export function standardAggregateColumns() {
  return [
    { index: 1, title: "Options", type: "options" },
    { index: 2, title: "To do", type: "to_do" },
    { index: 3, title: "In progress", type: "in_progress" },
    { index: 4, title: "Waiting", type: "waiting" },
    { index: 5, title: "Done", type: "done", isDone: true },
  ];
}

/**
 * @param {import("./boardModel.js").ColumnDef[]} columns
 * @param {import("./boardModel.js").ColumnType} type
 * @returns {import("./boardModel.js").ColumnDef | undefined}
 */
export function columnWithType(columns, type) {
  return (columns ?? []).find((c) => columnTypeOf(c) === type);
}

/**
 * Map a source-board column index to the aggregate column index (by column type).
 * @param {number} sourceColumnIndex
 * @param {import("./boardModel.js").ColumnDef[]} sourceColumns
 * @param {import("./boardModel.js").ColumnDef[]} aggregateColumns
 * @returns {number | null}
 */
export function aggregateColumnIndexForSourceColumn(
  sourceColumnIndex,
  sourceColumns,
  aggregateColumns
) {
  const sourceCol = (sourceColumns ?? []).find(
    (c) => Number(c.index) === Number(sourceColumnIndex)
  );
  if (!sourceCol) return null;
  const hit = columnWithType(aggregateColumns, columnTypeOf(sourceCol));
  return hit ? Number(hit.index) : null;
}

/**
 * Map an aggregate column index to a source-board column index (by column type).
 * @param {number} aggregateColumnIndex
 * @param {import("./boardModel.js").ColumnDef[]} aggregateColumns
 * @param {import("./boardModel.js").ColumnDef[]} sourceColumns
 * @returns {number | null}
 */
export function sourceColumnIndexForAggregateColumn(
  aggregateColumnIndex,
  aggregateColumns,
  sourceColumns
) {
  const aggCol = (aggregateColumns ?? []).find(
    (c) => Number(c.index) === Number(aggregateColumnIndex)
  );
  if (!aggCol) return null;
  const hit = columnWithType(sourceColumns, columnTypeOf(aggCol));
  return hit ? Number(hit.index) : null;
}

/**
 * Merge board users from source boards (dedupe by email, preserve first name/active).
 * @param {import("./boardModel.js").BoardModel[]} sourceModels
 * @returns {import("./boardModel.js").BoardUserDef[]}
 */
export function mergeUsersFromSourceBoards(sourceModels) {
  /** @type {Map<string, import("./boardModel.js").BoardUserDef>} */
  const byEmail = new Map();
  for (const src of sourceModels ?? []) {
    for (const u of src?.users ?? []) {
      const email = String(u.email ?? "").trim();
      if (!email) continue;
      const low = email.toLowerCase();
      if (byEmail.has(low)) continue;
      byEmail.set(low, {
        index: 0,
        email,
        name: email,
        active: u.active !== false,
      });
    }
  }
  const sorted = boardUsersSortedForUi([...byEmail.values()]);
  return sorted.map((u, i) => ({ ...u, index: i + 1 }));
}

/**
 * @param {import("./boardModel.js").BoardModel} model
 * @param {{ slug: string, name?: string }[]} catalogBoards
 * @param {{ sourceModels?: import("./boardModel.js").BoardModel[] }} [options]
 * @returns {import("./boardModel.js").BoardModel}
 */
export function enrichAggregateBoardModel(model, catalogBoards, options = {}) {
  if (!isAggregateBoard(model)) return model;
  const sources = model.sources ?? [];
  /** @type {import("./boardModel.js").SwimlaneDef[]} */
  const swimlanes = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const slug = String(src.slug ?? "").trim();
    if (!slug) continue;
    const hit = (catalogBoards ?? []).find((b) => b.slug === slug);
    swimlanes.push({
      index: swimlanes.length + 1,
      title: String(hit?.name ?? slug).trim() || slug,
    });
  }
  const sourceModels = options.sourceModels;
  const catalogUsers = options.catalogUsers;
  let users =
    sourceModels && sourceModels.length > 0
      ? mergeUsersFromSourceBoards(sourceModels)
      : [];
  if (catalogUsers && catalogUsers.length > 0 && users.length > 0) {
    users = enrichBoardUsersWithMillraceCatalog(
      users.map((u) => ({ email: u.email, active: u.active })),
      catalogUsers
    );
  }
  return {
    ...model,
    columns: standardAggregateColumns(),
    swimlanes,
    users,
  };
}

/**
 * @param {import("./boardModel.js").BoardModel} model
 * @param {{ slug: string, kind?: string }[]} catalogBoards
 * @param {{ requireSources?: boolean }} [options]
 * @returns {string | null}
 */
export function validateAggregateBoard(model, catalogBoards, options = {}) {
  if (!isAggregateBoard(model)) return null;
  const requireSources = options.requireSources !== false;
  const selfSlug = String(model.board?.slug ?? "").trim();
  const sources = model.sources ?? [];
  const boards = catalogBoards ?? [];
  if (sources.length === 0) {
    return requireSources
      ? "An aggregate board must include at least one source board."
      : null;
  }
  const catalogSlugs = new Set(boards.map((b) => b.slug));
  /** @type {Set<string>} */
  const seen = new Set();
  for (const src of sources) {
    const slug = String(src.slug ?? "").trim();
    if (!slug) {
      return "Each aggregate source must have a slug.";
    }
    if (selfSlug && slug === selfSlug) {
      return "An aggregate board cannot include itself as a source.";
    }
    if (seen.has(slug)) {
      return `Duplicate aggregate source board: ${slug}.`;
    }
    seen.add(slug);
    if (!catalogSlugs.has(slug)) {
      return `Aggregate source board not found in catalog: ${slug}.`;
    }
    const hit = boards.find((b) => b.slug === slug);
    if (hit?.kind === AGGREGATE_BOARD_KIND) {
      return `Aggregate boards cannot include other aggregate boards (${slug}).`;
    }
  }
  return null;
}

/**
 * @param {string} iniText
 * @param {(raw: string) => import("./boardModel.js").BoardModel} [parseBoard]
 * @returns {boolean}
 */
export function iniTextIsAggregateBoard(iniText, parseBoard = parseBoardIni) {
  try {
    return isAggregateBoard(
      parseBoard(String(iniText ?? "").replace(/^\uFEFF/, ""))
    );
  } catch {
    return false;
  }
}

/**
 * @param {object} card
 * @param {string} viewBoardSlug
 * @param {import("./boardModel.js").BoardModel} model
 */
export function cardStorageBoardSlug(card, viewBoardSlug, model) {
  if (isAggregateBoard(model)) {
    const src = String(card?.sourceBoardSlug ?? "").trim();
    if (src) return src;
  }
  return viewBoardSlug;
}

/**
 * @param {object} card
 * @param {import("./boardModel.js").BoardModel} viewModel
 * @param {Map<string, import("./boardModel.js").ColumnDef[]> | undefined} sourceColumnDefs
 * @param {number} aggregateColumnIndex
 * @returns {number | null}
 */
export function sourceColumnIndexForAggregateViewColumn(
  card,
  viewModel,
  sourceColumnDefs,
  aggregateColumnIndex
) {
  const sourceSlug = String(card?.sourceBoardSlug ?? "").trim();
  if (!sourceSlug) return null;
  const sourceColumns = sourceColumnDefs?.get(sourceSlug) ?? [];
  return sourceColumnIndexForAggregateColumn(
    aggregateColumnIndex,
    viewModel.columns ?? standardAggregateColumns(),
    sourceColumns
  );
}
