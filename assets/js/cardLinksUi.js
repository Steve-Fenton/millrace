const REMOVE_ICON = `<svg class="flow-link-remove-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 4l6 6M10 4l-6 6"/></svg>`;

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
    rm.innerHTML = REMOVE_ICON;
    rm.addEventListener("click", () => {
      row.remove();
    });

    function syncTextFromUrlIfEmpty() {
      const host = displayHostFromUrlInput(urlIn.value);
      if (!host) return;
      if (!String(textIn.value).trim()) {
        textIn.value = host;
      }
    }

    urlIn.addEventListener("input", syncTextFromUrlIfEmpty);

    row.append(urlIn, textIn, rm);
    list.append(row);
    syncTextFromUrlIfEmpty();
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
