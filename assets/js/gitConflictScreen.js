import {
  countConflictHunks,
  getFirstConflictHunk,
  hasConflictMarkerLines,
  replaceFirstConflictHunk,
} from "./gitConflictMerge.js";
import { showFlowAlert } from "./flowDialogs.js";

/**
 * Full-screen editor for merge conflict files returned by `/api/git/sync`.
 * @param {{ path: string, content: string }[]} files
 * @returns {Promise<{ path: string, content: string }[] | null>} resolutions, or null if cancelled
 */
export function openGitConflictResolutionScreen(files) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "git-conflict-backdrop";
    backdrop.setAttribute("role", "presentation");

    const panel = document.createElement("div");
    panel.className = "git-conflict-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "git-conflict-title");

    const header = document.createElement("header");
    header.className = "git-conflict-header";
    const h1 = document.createElement("h1");
    h1.id = "git-conflict-title";
    h1.className = "git-conflict-title";
    h1.textContent = "Resolve Git merge conflicts";
    const intro = document.createElement("p");
    intro.className = "git-conflict-intro";
    intro.textContent =
      "For each conflict, use Keep yours or Keep incoming to drop the other side, then adjust the full file below if needed. Repeat until no conflict remains, then Continue sync.";

    header.append(h1, intro);

    const scroll = document.createElement("div");
    scroll.className = "git-conflict-scroll";

    /** @type {Map<string, HTMLTextAreaElement>} */
    const areas = new Map();
    for (const f of files) {
      const p = String(f.path ?? "");
      const sec = document.createElement("section");
      sec.className = "git-conflict-file";
      const pathLab = document.createElement("label");
      pathLab.className = "git-conflict-file-label";
      const code = document.createElement("code");
      code.textContent = p;
      pathLab.append(code);

      const wrap = document.createElement("div");
      wrap.className = "git-conflict-file-wrap";

      const tools = document.createElement("div");
      tools.className = "git-conflict-hunk-tools";

      const meta = document.createElement("p");
      meta.className = "git-conflict-hunk-meta";

      const cols = document.createElement("div");
      cols.className = "git-conflict-hunk-columns";

      const colOurs = document.createElement("div");
      colOurs.className = "git-conflict-hunk-col";
      const labOurs = document.createElement("div");
      labOurs.className = "git-conflict-hunk-col-label";
      const preOurs = document.createElement("pre");
      preOurs.className = "git-conflict-side";
      preOurs.setAttribute("tabindex", "0");
      colOurs.append(labOurs, preOurs);

      const colTheirs = document.createElement("div");
      colTheirs.className = "git-conflict-hunk-col";
      const labTheirs = document.createElement("div");
      labTheirs.className = "git-conflict-hunk-col-label";
      const preTheirs = document.createElement("pre");
      preTheirs.className = "git-conflict-side";
      preTheirs.setAttribute("tabindex", "0");
      colTheirs.append(labTheirs, preTheirs);

      cols.append(colOurs, colTheirs);

      const actions = document.createElement("div");
      actions.className = "git-conflict-hunk-actions";
      const btnOurs = document.createElement("button");
      btnOurs.type = "button";
      btnOurs.className =
        "flow-btn flow-btn-primary git-conflict-keep-ours";
      btnOurs.textContent = "Keep yours";
      const btnTheirs = document.createElement("button");
      btnTheirs.type = "button";
      btnTheirs.className =
        "flow-btn flow-btn-ghost git-conflict-keep-theirs";
      btnTheirs.textContent = "Keep incoming";
      actions.append(btnOurs, btnTheirs);

      tools.append(meta, cols, actions);

      const editorLab = document.createElement("div");
      editorLab.className = "git-conflict-editor-label";
      editorLab.textContent = "Full file";

      const ta = document.createElement("textarea");
      ta.className = "git-conflict-textarea";
      ta.spellcheck = false;
      ta.value = String(f.content ?? "");
      ta.dataset.path = p;
      ta.setAttribute("aria-label", `Resolved content for ${p}`);
      const lines = String(ta.value).split("\n").length;
      ta.rows = Math.min(40, Math.max(14, lines + 3));
      areas.set(p, ta);

      function syncToolsFromTextarea() {
        const total = countConflictHunks(ta.value);
        const h = getFirstConflictHunk(ta.value);
        if (!h || total === 0) {
          tools.hidden = true;
          return;
        }
        tools.hidden = false;
        meta.textContent = `Conflict 1 of ${total} — pick a side, then edit below if needed.`;
        labOurs.textContent = `Yours — ${h.headLabel || "HEAD"}`;
        labTheirs.textContent = `Incoming — ${h.theirLabel || "theirs"}`;
        preOurs.textContent = h.ours.length ? h.ours : " ";
        preTheirs.textContent = h.theirs.length ? h.theirs : " ";
        preOurs.title = h.headLabel ? `Yours (${h.headLabel})` : "Yours (HEAD)";
        preTheirs.title = h.theirLabel
          ? `Incoming (${h.theirLabel})`
          : "Incoming";
      }

      btnOurs.addEventListener("click", () => {
        ta.value = replaceFirstConflictHunk(ta.value, "ours");
        syncToolsFromTextarea();
      });
      btnTheirs.addEventListener("click", () => {
        ta.value = replaceFirstConflictHunk(ta.value, "theirs");
        syncToolsFromTextarea();
      });
      ta.addEventListener("input", syncToolsFromTextarea);

      wrap.append(tools, editorLab, ta);
      sec.append(pathLab, wrap);
      scroll.append(sec);
      syncToolsFromTextarea();
    }

    const footer = document.createElement("footer");
    footer.className = "git-conflict-footer";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "flow-btn flow-btn-ghost";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "flow-btn flow-btn-primary";
    submit.textContent = "Continue sync";

    function cleanup() {
      document.removeEventListener("keydown", onKey, { capture: true });
      backdrop.remove();
    }

    function onKey(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        cleanup();
        resolve(null);
      }
    }

    cancel.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });
    submit.addEventListener("click", async () => {
      for (const ta of areas.values()) {
        ta.blur();
      }
      for (const ta of areas.values()) {
        const p = String(ta.dataset.path ?? "");
        if (hasConflictMarkerLines(ta.value)) {
          await showFlowAlert(
            `Remove or resolve remaining conflict markers in ${p} (lines starting with <<<<<<<, a line that is only =======, or >>>>>>>).`,
            { title: "Unresolved conflicts" }
          );
          return;
        }
      }
      const out = [...areas.values()].map((ta) => ({
        path: String(ta.dataset.path ?? "").trim(),
        content: ta.value,
      }));
      const bad = out.find((e) => !e.path);
      if (bad) {
        await showFlowAlert("Internal error: a conflicted file had no path.", {
          title: "Sync",
        });
        return;
      }
      cleanup();
      resolve(out);
    });

    footer.append(cancel, submit);
    panel.append(header, scroll, footer);
    backdrop.append(panel);
    document.body.append(backdrop);
    document.addEventListener("keydown", onKey, { capture: true });
    const firstKeep = scroll.querySelector(
      ".git-conflict-hunk-tools:not([hidden]) .git-conflict-keep-ours"
    );
    if (firstKeep instanceof HTMLElement) firstKeep.focus();
    else scroll.querySelector("textarea")?.focus();
  });
}
