import {
  countConflictHunks,
  getFirstConflictHunk,
  hasConflictMarkerLines,
  replaceFirstConflictHunk,
} from "../git/conflictMerge.js";
import { showFlowAlert } from "../ui/showMessage.js";

/** @param {string} [s] @param {number} [max] */
function shortRef(s, max = 40) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Full-screen editor for merge conflict files returned by `/api/git/sync`.
 * @param {{ path: string, content: string }[]} files
 * @returns {Promise<{ path: string, content: string }[] | null>} resolutions, or null if cancelled
 */
export function openGitConflictResolutionScreen(files) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "git-conflict-dialog";
    dialog.setAttribute("aria-labelledby", "git-conflict-title");
    dialog.setAttribute("aria-describedby", "git-conflict-intro");

    const panel = document.createElement("div");
    panel.className = "git-conflict-panel";

    const header = document.createElement("header");
    header.className = "git-conflict-header";
    const h1 = document.createElement("h1");
    h1.id = "git-conflict-title";
    h1.className = "git-conflict-title";
    h1.textContent = "Resolve Git merge conflicts";
    const intro = document.createElement("p");
    intro.id = "git-conflict-intro";
    intro.className = "git-conflict-intro";
    intro.textContent =
      "For each conflict, choose one version with the button under that column, then adjust the full file below if needed. Repeat until no conflict markers remain, then Continue sync.";

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

      const colFirst = document.createElement("div");
      colFirst.className = "git-conflict-hunk-col git-conflict-hunk-col--first";
      const labFirst = document.createElement("div");
      labFirst.className = "git-conflict-hunk-col-label";
      const preFirst = document.createElement("pre");
      preFirst.className = "git-conflict-side";
      preFirst.setAttribute("tabindex", "0");
      const actFirst = document.createElement("div");
      actFirst.className = "git-conflict-col-action";
      const btnFirst = document.createElement("button");
      btnFirst.type = "button";
      btnFirst.className = "flow-btn flow-btn-ghost git-conflict-keep-side";
      btnFirst.textContent = "Use this version";
      actFirst.append(btnFirst);
      colFirst.append(labFirst, preFirst, actFirst);

      const colSecond = document.createElement("div");
      colSecond.className =
        "git-conflict-hunk-col git-conflict-hunk-col--second";
      const labSecond = document.createElement("div");
      labSecond.className = "git-conflict-hunk-col-label";
      const preSecond = document.createElement("pre");
      preSecond.className = "git-conflict-side";
      preSecond.setAttribute("tabindex", "0");
      const actSecond = document.createElement("div");
      actSecond.className = "git-conflict-col-action";
      const btnSecond = document.createElement("button");
      btnSecond.type = "button";
      btnSecond.className =
        "flow-btn flow-btn-ghost git-conflict-keep-side";
      btnSecond.textContent = "Use this version";
      actSecond.append(btnSecond);
      colSecond.append(labSecond, preSecond, actSecond);

      cols.append(colFirst, colSecond);

      tools.append(meta, cols);

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
        meta.textContent = `Conflict 1 of ${total} — pick one column, then edit the full file below if needed.`;
        const leftTitle = shortRef(h.headLabel) || "Left";
        const rightTitle = shortRef(h.theirLabel) || "Right";
        labFirst.textContent = leftTitle;
        labSecond.textContent = rightTitle;
        preFirst.textContent = h.ours.length ? h.ours : " ";
        preSecond.textContent = h.theirs.length ? h.theirs : " ";
        preFirst.title = h.headLabel || leftTitle;
        preSecond.title = h.theirLabel || rightTitle;
        const leftFull = h.headLabel || leftTitle;
        const rightFull = h.theirLabel || rightTitle;
        btnFirst.setAttribute(
          "aria-label",
          `Keep the text from the left column (${leftFull})`
        );
        btnSecond.setAttribute(
          "aria-label",
          `Keep the text from the right column (${rightFull})`
        );
      }

      btnFirst.addEventListener("click", () => {
        ta.value = replaceFirstConflictHunk(ta.value, "ours");
        syncToolsFromTextarea();
      });
      btnSecond.addEventListener("click", () => {
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

    footer.append(cancel, submit);
    panel.append(header, scroll, footer);
    dialog.append(panel);
    document.body.append(dialog);

    let finalized = false;
    function finalize(result) {
      if (finalized) return;
      finalized = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    }

    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      finalize(null);
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) finalize(null);
    });

    cancel.addEventListener("click", () => {
      finalize(null);
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
      finalize(out);
    });

    dialog.showModal();
    const firstKeep = scroll.querySelector(
      ".git-conflict-hunk-tools:not([hidden]) .git-conflict-keep-side"
    );
    if (firstKeep instanceof HTMLElement) firstKeep.focus();
    else scroll.querySelector("textarea")?.focus();
  });
}
