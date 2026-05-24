/**
 * Queue opening a card editor until the current view finishes reloading
 * (board or completed list after `flow:refresh-board`).
 */

/** @type {{
 *   boardSlug: string,
 *   columnIndex: number,
 *   filename: string,
 *   columnTitle: string,
 *   swimlaneIndex: number,
 *   swimlaneTitle?: string,
 *   boardUsers?: import("../models/boardModel.js").BoardUserDef[],
 * } | null} */
let pendingCardEditorOpen = null;

/**
 * @param {{
 *   boardSlug: string,
 *   columnIndex: number,
 *   filename: string,
 *   columnTitle: string,
 *   swimlaneIndex: number,
 *   swimlaneTitle?: string,
 *   boardUsers?: import("../models/boardModel.js").BoardUserDef[],
 * }} ctx
 */
export function queueCardEditorOpenAfterRefresh(ctx) {
  pendingCardEditorOpen = ctx;
}

/** @returns {NonNullable<typeof pendingCardEditorOpen>} */
export function takePendingCardEditorOpen() {
  const ctx = pendingCardEditorOpen;
  pendingCardEditorOpen = null;
  return ctx;
}
