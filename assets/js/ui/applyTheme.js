const NO_STORE = /** @type {const} */ ({ cache: "no-store" });

/**
 * @param {unknown} raw
 * @returns {"dark" | "light"}
 */
export function normalizeFlowTheme(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase() === "light"
    ? "light"
    : "dark";
}

/**
 * @param {"dark" | "light"} theme
 */
export function applyFlowTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
  } else {
    delete root.dataset.theme;
    root.style.colorScheme = "dark";
  }
}

/**
 * Load theme from `tasks/localuser.ini` via the preferences API and apply it.
 * @returns {Promise<"dark" | "light">}
 */
export async function initFlowTheme() {
  let theme = /** @type {"dark" | "light"} */ ("dark");
  try {
    const res = await fetch("/api/local-user/preferences", NO_STORE);
    if (res.ok) {
      const data = await res.json();
      theme = normalizeFlowTheme(data.theme);
    }
  } catch {
    /* offline or static preview — keep default dark */
  }
  applyFlowTheme(theme);
  return theme;
}
