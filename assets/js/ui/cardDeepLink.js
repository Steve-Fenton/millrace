import { cardStorageBoardSlug } from "../models/aggregateBoard.js";
import { boardSlugFrom } from "../html/slug.js";
import { resolveCardSwimlaneIndex } from "../ini/swimlaneResolve.js";
import { showFlowToast } from "./showMessage.js";

/** Lucide-style chain link icon (inherits `currentColor`). */
export const CARD_LINK_ICON_SVG = `<svg class="flow-copy-link-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

/** Lucide-style check icon shown briefly after copying a card link. */
export const CARD_LINK_COPIED_ICON_SVG = `<svg class="flow-copy-link-icon-svg flow-copy-link-icon-svg--copied" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

const COPY_LINK_RESTORE_MS = 2500;

/** @type {WeakMap<HTMLElement, number>} */
const copyLinkRestoreTimers = new WeakMap();

/**
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function normalizeCardId(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\.ini$/i, "");
}

/**
 * @param {string} cardId
 * @returns {string}
 */
export function cardFilenameFromId(cardId) {
  const id = normalizeCardId(cardId);
  if (!id) return "";
  return `${id}.ini`;
}

/**
 * @param {{ filename?: string, id?: string }} card
 * @param {string} cardId
 */
export function cardMatchesId(card, cardId) {
  const target = normalizeCardId(cardId);
  if (!target) return false;
  const fn = String(card.filename ?? "").trim();
  if (fn && normalizeCardId(fn) === target) return true;
  return String(card.id ?? "").trim() === target;
}

/**
 * @param {{ boardSlug: string, cardId: string }} opts
 * @returns {string}
 */
export function buildCardDeepLinkUrl(opts) {
  const boardSlug = String(opts.boardSlug ?? "").trim();
  const cardId = normalizeCardId(opts.cardId);
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("board", boardSlug);
  u.searchParams.set("card", cardId);
  return u.toString();
}

export const SOURCE_CARD_LINK_TEXT = "Source card";

/**
 * @param {Array<{ text?: string, url?: string }>} links
 * @param {{ boardSlug: string, filename: string }} source
 * @returns {Array<{ text: string, url: string }>}
 */
export function linksWithSourceCardLink(links, source) {
  const boardSlug = String(source.boardSlug ?? "").trim();
  const filename = String(source.filename ?? "").trim();
  const normalized = Array.isArray(links)
    ? links.map((l) => ({
        text: String(l?.text ?? "").trim(),
        url: String(l?.url ?? "").trim(),
      }))
    : [];
  if (!boardSlug || !filename) return normalized;
  return [
    ...normalized,
    {
      text: SOURCE_CARD_LINK_TEXT,
      url: buildCardDeepLinkUrl({
        boardSlug,
        cardId: normalizeCardId(filename),
      }),
    },
  ];
}

/**
 * @param {URLSearchParams} params
 * @returns {{ boardSlug?: string, cardId: string } | null}
 */
export function parseCardDeepLinkParams(params) {
  const cardRaw = params.get("card");
  if (!cardRaw || !String(cardRaw).trim()) return null;
  const cardId = normalizeCardId(cardRaw);
  if (!cardId) return null;
  const boardRaw = String(params.get("board") ?? "").trim();
  return {
    boardSlug: boardRaw || undefined,
    cardId,
  };
}

export function clearCardDeepLinkFromUrl() {
  const u = new URL(window.location.href);
  if (!u.searchParams.has("card") && !u.searchParams.has("board")) return;
  u.searchParams.delete("card");
  u.searchParams.delete("board");
  const next =
    u.pathname +
    (u.searchParams.toString() ? `?${u.searchParams.toString()}` : "") +
    u.hash;
  window.history.replaceState({}, "", next);
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * @param {{ boardSlug: string, filename: string }} opts
 */
export async function copyCardDeepLinkToClipboard(opts) {
  const boardSlug = String(opts.boardSlug ?? "").trim();
  const cardId = normalizeCardId(opts.filename);
  if (!boardSlug || !cardId) {
    await showFlowToast("Could not copy link for this card.");
    return false;
  }
  const url = buildCardDeepLinkUrl({ boardSlug, cardId });
  const ok = await copyTextToClipboard(url);
  if (ok) return true;
  await showFlowToast("Could not copy link.");
  return false;
}

/**
 * Briefly swap the copy-link button icon to a check mark.
 * @param {HTMLElement} btn
 * @param {{ durationMs?: number }} [opts]
 */
export function showCopyLinkButtonCopied(btn, opts = {}) {
  if (!(btn instanceof HTMLButtonElement)) return;
  const durationMs =
    typeof opts.durationMs === "number" && opts.durationMs >= 0
      ? opts.durationMs
      : COPY_LINK_RESTORE_MS;

  const prevTimer = copyLinkRestoreTimers.get(btn);
  if (prevTimer) window.clearTimeout(prevTimer);

  if (!btn.dataset.copyLinkIconOriginal) {
    btn.dataset.copyLinkIconOriginal = btn.innerHTML;
  }

  btn.innerHTML = CARD_LINK_COPIED_ICON_SVG;
  btn.classList.add("flow-btn-copy-card-link-icon--copied");
  btn.setAttribute("aria-label", "Link copied");
  btn.title = "Link copied";

  const timer = window.setTimeout(() => {
    copyLinkRestoreTimers.delete(btn);
    if (!btn.isConnected) return;
    btn.innerHTML = btn.dataset.copyLinkIconOriginal ?? CARD_LINK_ICON_SVG;
    btn.classList.remove("flow-btn-copy-card-link-icon--copied");
    btn.setAttribute("aria-label", "Copy link to this card");
    btn.title = "Copy link";
  }, durationMs);

  copyLinkRestoreTimers.set(btn, timer);
}

/**
 * @param {{
 *   cardsByColumn: Map<number, object[]>,
 *   model: import("../models/boardModel.js").BoardModel,
 *   boardSlug: string,
 *   cardId: string,
 *   sourceSwimlaneDefs?: Map<string, import("../models/boardModel.js").SwimlaneDef[]>,
 * }} opts
 * @returns {{
 *   boardSlug: string,
 *   columnIndex: number,
 *   filename: string,
 *   columnTitle: string,
 *   swimlaneIndex: number,
 *   swimlaneTitle?: string,
 *   boardUsers?: import("../models/boardModel.js").BoardUserDef[],
 * } | null}
 */
export function findCardEditorContextFromBoard(opts) {
  const { cardsByColumn, model, boardSlug, cardId } = opts;
  const swimlanes =
    model.swimlanes?.length > 0
      ? model.swimlanes
      : [{ index: 0, title: "" }];

  for (const col of model.columns) {
    const colIdx = Number(col.index);
    const cards = cardsByColumn.get(colIdx) ?? [];
    for (const card of cards) {
      if (!cardMatchesId(card, cardId)) continue;

      const filename =
        String(card.filename ?? "").trim() || cardFilenameFromId(cardId);
      const storageSlug = cardStorageBoardSlug(card, boardSlug, model);
      const columnIndex = Number(card.sourceColumnIndex ?? col.index);
      const swimlaneIndex = resolveCardSwimlaneIndex(card.swimlane, swimlanes);
      const swimlaneTitle = swimlanes.find((l) => l.index === swimlaneIndex)?.title;

      return {
        boardSlug: storageSlug,
        columnIndex,
        filename,
        columnTitle: col.title,
        swimlaneIndex,
        swimlaneTitle: swimlaneTitle || undefined,
        boardUsers: model.users,
      };
    }
  }

  return null;
}

/**
 * @param {{ boardSlug?: string, cardId: string }} deepLink
 * @param {{
 *   model: import("../models/boardModel.js").BoardModel,
 *   cardsByColumn: Map<number, object[]>,
 * }} boardCache
 * @param {(ctx: NonNullable<ReturnType<typeof findCardEditorContextFromBoard>>) => void | Promise<void>} openEditor
 */
export function tryOpenCardFromDeepLink(deepLink, boardCache, openEditor) {
  const boardSlug = boardSlugFrom(boardCache.model.board ?? {});

  const ctx = findCardEditorContextFromBoard({
    cardsByColumn: boardCache.cardsByColumn,
    model: boardCache.model,
    boardSlug,
    cardId: deepLink.cardId,
  });

  clearCardDeepLinkFromUrl();

  if (!ctx) {
    showFlowToast("Card from link was not found on this board.");
    return;
  }

  void openEditor(ctx);
}
