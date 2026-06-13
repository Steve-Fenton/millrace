/**
 * Board access checkboxes against Millrace catalog users.
 * @param {{ email: string, name: string, active?: boolean }[]} millraceUsers
 * @param {{ email: string, active?: boolean }[]} boardAccess active users on this board
 */

/** @returns {string} */
function millraceUsersPageHref() {
  const p = window.location.pathname;
  return /\/(admin|charts|complete|preferences|users)(\/|$)/.test(p)
    ? "../users/"
    : "users/";
}

export function createBoardUserAccessCheckboxes(millraceUsers, boardAccess) {
  const wrap = document.createElement("div");
  wrap.className = "flow-field flow-board-user-access";

  const label = document.createElement("span");
  label.className = "flow-field-label";
  label.textContent = "Board access";

  const hint = document.createElement("p");
  hint.className = "flow-board-user-hint";
  hint.textContent =
    "Users are defined in tasks/.millrace.ini. Check to grant board access; uncheck to remove access.";

  const list = document.createElement("div");
  list.className = "flow-board-user-access-list";

  wrap.append(label, hint, list);

  /** @type {Set<string>} */
  const activeOnBoard = new Set();
  for (const u of boardAccess ?? []) {
    const email = String(u.email ?? "").trim();
    if (!email || u.active === false) continue;
    activeOnBoard.add(email.toLowerCase());
  }

  const sorted = [...(millraceUsers ?? [])]
    .filter((u) => String(u.email ?? "").trim())
    .sort((a, b) => {
      const la = (String(a.name ?? "").trim() || a.email).toLowerCase();
      const lb = (String(b.name ?? "").trim() || b.email).toLowerCase();
      return la.localeCompare(lb, undefined, { sensitivity: "base" });
    });

  /** @type {Map<string, HTMLInputElement>} */
  const checkboxes = new Map();

  for (const u of sorted) {
    const email = String(u.email).trim();
    const low = email.toLowerCase();
    const checked = activeOnBoard.has(low);
    const millraceInactive = u.active === false;

    const row = document.createElement("label");
    row.className = "flow-board-user-access-option";
    if (millraceInactive) {
      row.classList.add("flow-board-user-access-option--millrace-inactive");
    }

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = email;
    cb.checked = checked;
    cb.disabled = millraceInactive;
    if (millraceInactive) {
      cb.title = "Inactive in Millrace users — restore from Users page first";
    }
    checkboxes.set(low, cb);

    const displayName = String(u.name ?? "").trim() || email;
    const text = document.createTextNode(` ${displayName}`);
    if (displayName !== email) row.title = email;
    row.append(cb, text);
    list.append(row);
  }

  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "flow-board-user-access-empty";
    empty.append(document.createTextNode("No users in tasks/.millrace.ini. "));
    const link = document.createElement("a");
    link.href = millraceUsersPageHref();
    link.textContent = "Add users on the Users page";
    empty.append(link, document.createTextNode(" first."));
    list.append(empty);
  }

  return {
    root: wrap,
    /** @returns {{ email: string, active: boolean }[]} */
    getAccess() {
      /** @type {{ email: string, active: boolean }[]} */
      const rows = [];
      for (const u of sorted) {
        const email = String(u.email).trim();
        const low = email.toLowerCase();
        const cb = checkboxes.get(low);
        if (!cb || cb.disabled || !cb.checked) continue;
        rows.push({ email, active: true });
      }
      return rows;
    },
  };
}
