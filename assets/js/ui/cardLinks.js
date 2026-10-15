const REMOVE_ICON = `<svg class="flow-link-remove-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 4l6 6M10 4l-6 6"/></svg>`;

const OPEN_TAB_ICON = `<svg class="flow-link-open-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>`;

/**
 * Host for link label, e.g. `https://example.com/path` → `example.com`.
 * @param {string} raw
 * @returns {string}
 */
function displayHostFromUrlInput(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let candidate = s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    candidate = `https://${s}`;
  }
  try {
    const u = new URL(candidate);
    const host = (u.hostname || "").replace(/^www\./i, "");
    return host;
  } catch {
    return "";
  }
}

/**
 * Normalizes user-entered URL candidate for external navigation.
 * Rejects javascript:, data:, and vbscript: schemes.
 * @param {string} raw
 * @returns {string}
 */
function resolveExternalUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let candidate = s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    candidate = `https://${s}`;
  }
  try {
    const base =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : "http://localhost/";
    const u = new URL(candidate, base);
    if (
      u.protocol === "javascript:" ||
      u.protocol === "data:" ||
      u.protocol === "vbscript:"
    ) {
      return "";
    }
    return u.href;
  } catch {
    return "";
  }
}

/**
 * @param {Array<{ text?: string, url?: string }>} initialLinks
 */
export function createLinksEditor(initialLinks) {
  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-links-field";

  const label = document.createElement("span");
  label.className = "flow-field-label";
  label.textContent = "Links";

  const list = document.createElement("div");
  list.className = "flow-links-editor-list";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "flow-btn flow-btn-ghost flow-add-link";
  addBtn.textContent = "Add link";

  wrap.append(label, list, addBtn);

  function addRow(text = "", url = "", focusUrlField = false) {
    const row = document.createElement("div");
    row.className = "flow-link-row";

    const urlIn = document.createElement("input");
    urlIn.type = "text";
    urlIn.className = "flow-input flow-link-url";
    urlIn.placeholder = "https://…";
    urlIn.value = url;
    urlIn.autocomplete = "off";
    urlIn.spellcheck = false;

    const openLink = document.createElement("a");
    openLink.className = "flow-btn flow-btn-icon flow-link-open";
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.setAttribute("aria-label", "Open link in new tab");
    openLink.title = "Open link in new tab";
    openLink.innerHTML = OPEN_TAB_ICON;

    function syncOpenLink() {
      const href = resolveExternalUrl(urlIn.value);
      if (href) {
        openLink.href = href;
        openLink.removeAttribute("aria-disabled");
        openLink.removeAttribute("tabindex");
        openLink.classList.remove("is-disabled");
      } else {
        openLink.removeAttribute("href");
        openLink.setAttribute("aria-disabled", "true");
        openLink.setAttribute("tabindex", "-1");
        openLink.classList.add("is-disabled");
      }
    }

    urlIn.addEventListener("input", syncOpenLink);

    openLink.addEventListener("click", (e) => {
      syncOpenLink();
      if (!openLink.getAttribute("href")) {
        e.preventDefault();
      }
    });

    const textIn = document.createElement("input");
    textIn.type = "text";
    textIn.className = "flow-input flow-link-text";
    textIn.placeholder = "Link text";
    textIn.value = text;
    textIn.autocomplete = "off";

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "flow-link-remove";
    rm.setAttribute("aria-label", "Remove link");
    rm.title = "Remove link";
    rm.innerHTML = REMOVE_ICON;
    rm.addEventListener("click", () => {
      row.remove();
    });

    function syncTextFromUrlIfEmpty() {
      const host = displayHostFromUrlInput(urlIn.value);
      if (!host) return;
      if (!String(textIn.value).trim()) {
        textIn.value = host;
        requestAnimationFrame(() => textIn.select());
      }
    }

    textIn.addEventListener("focus", () => {
      syncTextFromUrlIfEmpty();
    });

    syncOpenLink();

    row.append(urlIn, openLink, textIn, rm);
    list.append(row);
    if (focusUrlField) {
      requestAnimationFrame(() => urlIn.focus());
    }
  }

  addBtn.addEventListener("click", () => addRow("", "", true));

  const seeds = Array.isArray(initialLinks) ? initialLinks : [];
  for (const l of seeds) {
    addRow(String(l?.text ?? ""), String(l?.url ?? ""));
  }

  return {
    root: wrap,
    /** @returns {{ text: string, url: string }[]} */
    getLinks() {
      const rows = list.querySelectorAll(".flow-link-row");
      /** @type {{ text: string, url: string }[]} */
      const out = [];
      for (const row of rows) {
        const textEl = row.querySelector(".flow-link-text");
        const urlEl = row.querySelector(".flow-link-url");
        const url = String(urlEl?.value ?? "").trim();
        if (!url) continue;
        out.push({
          text: String(textEl?.value ?? "").trim(),
          url,
        });
      }
      return out;
    },
  };
}
