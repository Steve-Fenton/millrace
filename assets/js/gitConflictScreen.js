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
      "Edit each file below and remove all conflict markers (<<<<<<<, =======, >>>>>>>). When finished, choose Continue sync to commit the merge, save any pending task changes, and push to the remote.";

    header.append(h1, intro);

    const scroll = document.createElement("div");
    scroll.className = "git-conflict-scroll";

    /** @type {Map<string, HTMLTextAreaElement>} */
    const areas = new Map();
    for (const f of files) {
      const p = String(f.path ?? "");
      const sec = document.createElement("section");
      sec.className = "git-conflict-file";
      const lab = document.createElement("label");
      lab.className = "git-conflict-file-label";
      const code = document.createElement("code");
      code.textContent = p;
      lab.append(code);
      const ta = document.createElement("textarea");
      ta.className = "git-conflict-textarea";
      ta.spellcheck = false;
      ta.value = String(f.content ?? "");
      ta.dataset.path = p;
      ta.setAttribute("aria-label", `Resolved content for ${p}`);
      const lines = String(ta.value).split("\n").length;
      ta.rows = Math.min(40, Math.max(14, lines + 3));
      areas.set(p, ta);
      sec.append(lab, ta);
      scroll.append(sec);
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
        const v = ta.value;
        if (/<<<<<<<|=======|>>>>>>>/.test(v)) {
          await showFlowAlert(
            `Remove all conflict markers in ${p} (lines starting with <<<<<<<, =======, or >>>>>>>).`,
            { title: "Unresolved conflict markers" }
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
    scroll.querySelector("textarea")?.focus();
  });
}
