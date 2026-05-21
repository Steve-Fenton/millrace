import { renderLimitedMarkdown, toggleMarkdownTaskLine } from "./limitedMarkdown.js";

/**
 * Preview/edit tabs, expand toggle, and markdown preview for card description fields.
 * @param {{
 *   modal: HTMLElement,
 *   descInput: HTMLTextAreaElement,
 *   descField?: Element | null,
 *   initialMode?: "preview" | "edit",
 * }} opts
 */
export function createCardDescriptionEditor({
  modal,
  descInput,
  descField = descInput.closest(".flow-field"),
  initialMode = "preview",
}) {
  descField?.classList.add("flow-field--description");
  const descriptionIdSuffix = Math.random().toString(36).slice(2, 8);
  const descriptionTabListId = `flow-description-tabs-${descriptionIdSuffix}`;
  const previewTabId = `flow-description-preview-tab-${descriptionIdSuffix}`;
  const editTabId = `flow-description-edit-tab-${descriptionIdSuffix}`;
  const previewPanelId = `flow-description-preview-panel-${descriptionIdSuffix}`;
  const editPanelId = `flow-description-edit-panel-${descriptionIdSuffix}`;
  const descToolbar = document.createElement("div");
  descToolbar.className = "flow-description-toolbar";
  const descTabs = document.createElement("div");
  descTabs.className = "flow-description-tabs";
  descTabs.id = descriptionTabListId;
  descTabs.setAttribute("role", "tablist");
  descTabs.setAttribute("aria-label", "Description mode");
  const descPreviewTab = document.createElement("button");
  descPreviewTab.type = "button";
  descPreviewTab.className = "flow-description-tab";
  descPreviewTab.id = previewTabId;
  descPreviewTab.textContent = "Preview";
  descPreviewTab.setAttribute("role", "tab");
  descPreviewTab.setAttribute("aria-controls", previewPanelId);
  const descEditTab = document.createElement("button");
  descEditTab.type = "button";
  descEditTab.className = "flow-description-tab";
  descEditTab.id = editTabId;
  descEditTab.textContent = "Edit";
  descEditTab.setAttribute("role", "tab");
  descEditTab.setAttribute("aria-controls", editPanelId);
  descTabs.append(descPreviewTab, descEditTab);
  const descExpandToggle = document.createElement("button");
  descExpandToggle.type = "button";
  descExpandToggle.className =
    "flow-btn flow-btn-icon flow-description-expand-toggle";
  descExpandToggle.setAttribute("aria-pressed", "false");
  const expandIcon = document.createElement("span");
  expandIcon.className = "flow-description-expand-icon";
  expandIcon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  descExpandToggle.append(expandIcon);
  descToolbar.append(descTabs, descExpandToggle);
  descInput.insertAdjacentElement("beforebegin", descToolbar);
  descInput.id = editPanelId;
  descInput.setAttribute("role", "tabpanel");
  descInput.setAttribute("aria-labelledby", editTabId);
  const descPreview = document.createElement("div");
  descPreview.className = "flow-description-preview";
  descPreview.id = previewPanelId;
  descPreview.setAttribute("role", "tabpanel");
  descPreview.setAttribute("aria-labelledby", previewTabId);
  descField?.append(descPreview);

  /** @type {boolean | null} */
  let showingDescriptionPreview = null;
  let descriptionEditorExpanded = false;

  function syncDescriptionExpandUi() {
    modal.classList.toggle(
      "flow-modal--description-expanded",
      descriptionEditorExpanded
    );
    descField?.classList.toggle(
      "flow-field--description-expanded",
      descriptionEditorExpanded
    );
    const action = descriptionEditorExpanded ? "Collapse" : "Expand";
    descExpandToggle.setAttribute(
      "aria-label",
      `${action} description editor`
    );
    descExpandToggle.title = `${action} description editor`;
    descExpandToggle.setAttribute(
      "aria-pressed",
      String(descriptionEditorExpanded)
    );
  }

  function refreshDescriptionPreview() {
    renderLimitedMarkdown(descPreview, descInput.value, {
      interactiveTaskCheckboxes: true,
    });
  }

  function toggleDescriptionTaskFromPreview(cb) {
    if (!(cb instanceof HTMLInputElement) || cb.type !== "checkbox") return;
    if (!cb.classList.contains("flow-md-task-checkbox--interactive")) return;
    const li = cb.closest(".flow-md-task-item");
    const rawIdx = li?.dataset?.flowTaskLine;
    if (rawIdx == null) return;
    const lineIndex = Number(rawIdx);
    if (!Number.isFinite(lineIndex)) return;
    const next = toggleMarkdownTaskLine(descInput.value, lineIndex);
    if (next === descInput.value) return;
    descInput.value = next;
    refreshDescriptionPreview();
    requestAnimationFrame(() => {
      const again = descPreview.querySelector(
        `.flow-md-task-item[data-flow-task-line="${lineIndex}"] .flow-md-task-checkbox--interactive`
      );
      again?.focus();
    });
  }

  descPreview.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains("flow-md-task-checkbox--interactive")) return;
    ev.preventDefault();
    toggleDescriptionTaskFromPreview(t);
  });

  descPreview.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    const t = ev.target;
    if (!(t instanceof HTMLInputElement) || t.type !== "checkbox") return;
    if (!t.classList.contains("flow-md-task-checkbox--interactive")) return;
    ev.preventDefault();
    toggleDescriptionTaskFromPreview(t);
  });

  function syncDescriptionPreviewHeight(editorHeightPx) {
    const resolvedHeight =
      Number.isFinite(editorHeightPx) && editorHeightPx > 0
        ? editorHeightPx
        : descInput.offsetHeight || descPreview.offsetHeight;
    if (!Number.isFinite(resolvedHeight) || resolvedHeight <= 0) return;
    descPreview.style.minHeight = `${resolvedHeight}px`;
  }

  function setDescriptionExpanded(nextExpanded, opts = {}) {
    const next = Boolean(nextExpanded);
    if (descriptionEditorExpanded === next) return;
    descriptionEditorExpanded = next;
    syncDescriptionExpandUi();
    requestAnimationFrame(() => {
      syncDescriptionPreviewHeight(descInput.offsetHeight || descPreview.offsetHeight);
      if (showingDescriptionPreview) refreshDescriptionPreview();
      if (!showingDescriptionPreview && opts.focusEditor) {
        descInput.focus();
      }
    });
  }

  function setDescriptionMode(mode, opts = {}) {
    const nextIsPreview = mode === "preview";
    if (showingDescriptionPreview === nextIsPreview) return;
    const editorHeightBeforeToggle = descInput.offsetHeight;
    showingDescriptionPreview = nextIsPreview;
    descPreview.hidden = !nextIsPreview;
    descInput.hidden = nextIsPreview;
    descPreviewTab.classList.toggle(
      "flow-description-tab--active",
      nextIsPreview
    );
    descPreviewTab.setAttribute("aria-selected", String(nextIsPreview));
    descPreviewTab.tabIndex = nextIsPreview ? 0 : -1;
    descEditTab.classList.toggle("flow-description-tab--active", !nextIsPreview);
    descEditTab.setAttribute("aria-selected", String(!nextIsPreview));
    descEditTab.tabIndex = nextIsPreview ? -1 : 0;
    descExpandToggle.hidden = nextIsPreview;
    descExpandToggle.disabled = nextIsPreview;
    descExpandToggle.tabIndex = nextIsPreview ? -1 : 0;
    if (nextIsPreview) {
      syncDescriptionPreviewHeight(editorHeightBeforeToggle);
      refreshDescriptionPreview();
      return;
    }
    if (opts.focusEditor) {
      descInput.focus();
      const len = descInput.value.length;
      descInput.setSelectionRange(len, len);
    }
  }

  syncDescriptionExpandUi();
  refreshDescriptionPreview();
  setDescriptionMode(initialMode);
  descExpandToggle.addEventListener("click", () => {
    setDescriptionExpanded(!descriptionEditorExpanded, {
      focusEditor: !showingDescriptionPreview,
    });
  });
  descPreviewTab.addEventListener("click", () => {
    setDescriptionMode("preview");
  });
  descEditTab.addEventListener("click", () => {
    setDescriptionMode("edit", { focusEditor: true });
  });
  descTabs.addEventListener("keydown", (ev) => {
    const tabOrder = [descPreviewTab, descEditTab];
    const currentIndex = tabOrder.findIndex((tab) => tab === document.activeElement);
    if (currentIndex < 0) return;
    let targetIndex = -1;
    if (ev.key === "ArrowRight") targetIndex = (currentIndex + 1) % tabOrder.length;
    if (ev.key === "ArrowLeft") targetIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    if (ev.key === "Home") targetIndex = 0;
    if (ev.key === "End") targetIndex = tabOrder.length - 1;
    if (targetIndex < 0) return;
    ev.preventDefault();
    const nextTab = tabOrder[targetIndex];
    nextTab.focus();
    if (nextTab === descPreviewTab) {
      setDescriptionMode("preview");
      return;
    }
    setDescriptionMode("edit");
  });

  return {
    refreshDescriptionPreview,
    setDescriptionMode,
    setDescriptionExpanded,
  };
}
