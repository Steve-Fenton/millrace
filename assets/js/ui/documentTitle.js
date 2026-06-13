const BRAND = "Millrace";

/**
 * Browser tab title: `Page : Board | Millrace` when `boardDisplayName` is set,
 * otherwise `Page | Millrace`.
 * @param {string} pageLabel e.g. "Board", "Charts", "Completed"
 * @param {string} [boardDisplayName] project board display name (omit on Preferences, Boards, etc.)
 */
export function setFlowDocumentTitle(pageLabel, boardDisplayName) {
  const page = String(pageLabel ?? "").trim() || BRAND;
  const board =
    boardDisplayName != null ? String(boardDisplayName).trim() : "";
  if (board) {
    document.title = `${page} : ${board} | ${BRAND}`;
  } else {
    document.title = `${page} | ${BRAND}`;
  }
}
