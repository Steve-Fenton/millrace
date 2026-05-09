/**
 * Keyboard focus trap for modal overlays (complements role="dialog" + aria-modal).
 * Restores focus to the previously focused element when released.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([hidden])',
  'button:not([disabled]):not([hidden])',
  'input:not([disabled]):not([hidden]):not([type="hidden"])',
  'select:not([disabled]):not([hidden])',
  'textarea:not([disabled]):not([hidden])',
  '[tabindex]:not([tabindex="-1"]):not([hidden])',
].join(", ");

/**
 * @param {Element} el
 */
function isFocusableVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute("disabled")) return false;
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

/**
 * @param {HTMLElement} container
 */
function listFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isFocusableVisible
  );
}

/**
 * Keeps Tab / Shift+Tab cycling within `container`. Call the returned function when
 * the modal closes to remove listeners and restore focus.
 *
 * @param {HTMLElement} container
 * @param {{ restoreFocus?: boolean }} [options]
 * @returns {() => void}
 */
export function beginModalFocusTrap(container, options = {}) {
  const restoreFocus = options.restoreFocus !== false;
  /** @type {HTMLElement | null} */
  let previous =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (previous && !document.body.contains(previous)) {
    previous = null;
  }

  /** @param {KeyboardEvent} ev */
  function onKeyDown(ev) {
    if (ev.key !== "Tab") return;
    if (!container.contains(document.activeElement)) return;
    const els = listFocusable(container);
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey) {
      if (active === first) {
        ev.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", onKeyDown);

  return function releaseModalFocusTrap() {
    container.removeEventListener("keydown", onKeyDown);
    if (!restoreFocus || !previous) return;
    try {
      if (document.body.contains(previous)) {
        previous.focus();
      }
    } catch {
      /* ignore */
    }
  };
}
