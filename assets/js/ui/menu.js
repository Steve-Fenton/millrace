/** @param {"board" | "completed" | "charts" | "preferences" | "users" | "admin"} kind */
function navMenuItemIconSvg(kind) {
  const stroke =
    'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  switch (kind) {
    case "board":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.75" ${stroke}/></svg>`;
    case "completed":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M5 13l4 4L19 7"/></svg>`;
    case "charts":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M4 19V5M4 19h16"/><path ${stroke} d="M7 15l4-4 3 3 5-6"/></svg>`;
    case "preferences":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M4 21v-6M4 13V3M12 21v-3M12 15V3M20 21v-9M20 10V3"/><circle cx="4" cy="13" r="2" ${stroke}/><circle cx="12" cy="15" r="2" ${stroke}/><circle cx="20" cy="10" r="2" ${stroke}/></svg>`;
    case "users":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" ${stroke}/><path ${stroke} d="M22 21v-2a4 4 0 00-3-3.87"/><path ${stroke} d="M16 3.13a4 4 0 010 7.75"/></svg>`;
    case "admin":
      return `<svg class="flow-nav-menu__item-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path ${stroke} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869L9.594 3.94z"/><path ${stroke} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
    default:
      return "";
  }
}

/**
 * @param {{ board: string, completed: string, charts: string, preferences: string, users: string, admin: string }} hrefs
 * @param {"board" | "completed" | "charts" | "preferences" | "users" | "admin"} current
 */
function navHrefMap(current) {
  switch (current) {
    case "board":
      return {
        board: "index.html",
        completed: "complete/",
        charts: "charts/",
        preferences: "preferences/",
        users: "users/",
        admin: "admin/",
      };
    case "completed":
      return {
        board: "../index.html",
        completed: "index.html",
        charts: "../charts/",
        preferences: "../preferences/",
        users: "../users/",
        admin: "../admin/",
      };
    case "charts":
      return {
        board: "../index.html",
        completed: "../complete/",
        charts: "index.html",
        preferences: "../preferences/",
        users: "../users/",
        admin: "../admin/",
      };
    case "preferences":
      return {
        board: "../index.html",
        completed: "../complete/",
        charts: "../charts/",
        preferences: "index.html",
        users: "../users/",
        admin: "../admin/",
      };
    case "users":
      return {
        board: "../index.html",
        completed: "../complete/",
        charts: "../charts/",
        preferences: "../preferences/",
        users: "index.html",
        admin: "../admin/",
      };
    case "admin":
      return {
        board: "../index.html",
        completed: "../complete/",
        charts: "../charts/",
        preferences: "../preferences/",
        users: "../users/",
        admin: "index.html",
      };
    default:
      return {
        board: "index.html",
        completed: "complete/",
        charts: "charts/",
        preferences: "preferences/",
        users: "users/",
        admin: "admin/",
      };
  }
}

/**
 * @param {string} href
 * @param {string} label
 * @param {boolean} isCurrent
 * @param {"board" | "completed" | "charts" | "preferences" | "users" | "admin"} kind
 * @param {"menuitem" | undefined} role
 * @returns {HTMLAnchorElement}
 */
function createNavItem(href, label, isCurrent, kind, role) {
  const a = document.createElement("a");
  a.className = "flow-nav-menu__item";
  if (isCurrent) {
    a.classList.add("flow-nav-menu__item--current");
    a.setAttribute("aria-current", "page");
  }
  a.href = href;
  if (role) a.setAttribute("role", role);

  const icon = document.createElement("span");
  icon.className = "flow-nav-menu__item-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = navMenuItemIconSvg(kind);

  const text = document.createElement("span");
  text.className = "flow-nav-menu__item-text";
  text.textContent = label;

  a.append(icon, text);
  return a;
}

/**
 * Header navigation: visible tabs on wide viewports, overflow menu on narrow ones.
 * @param {{ current: "board" | "completed" | "charts" | "preferences" | "users" | "admin" }} opts
 * @returns {HTMLElement}
 */
export function createFlowNavMenu(opts) {
  const { current } = opts;
  const hrefs = navHrefMap(current);

  /** @type {Array<{ href: string, label: string, kind: "board" | "completed" | "charts" | "preferences" | "users" | "admin" }>} */
  const items = [
    { href: hrefs.board, label: "Board", kind: "board" },
    { href: hrefs.completed, label: "Completed", kind: "completed" },
    { href: hrefs.charts, label: "Charts", kind: "charts" },
    { href: hrefs.preferences, label: "Preferences", kind: "preferences" },
    { href: hrefs.users, label: "Users", kind: "users" },
    { href: hrefs.admin, label: "Boards", kind: "admin" },
  ];

  const wrap = document.createElement("div");
  wrap.className = "flow-nav-menu";

  const links = document.createElement("nav");
  links.className = "flow-nav-menu__links";
  links.setAttribute("aria-label", "Primary");
  for (const item of items) {
    links.append(
      createNavItem(item.href, item.label, current === item.kind, item.kind)
    );
  }

  const panelId = "flow-nav-panel";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "flow-nav-menu__trigger";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", panelId);
  btn.title = "Menu";
  btn.setAttribute("aria-label", "Open menu");
  btn.innerHTML = `<svg class="flow-nav-menu__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zm0 4.25h14V15H3v-1.5z"/></svg>`;

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "flow-nav-menu__panel";
  panel.hidden = true;
  panel.setAttribute("role", "menu");
  panel.setAttribute("aria-label", "Navigation");

  for (const item of items) {
    panel.append(
      createNavItem(
        item.href,
        item.label,
        current === item.kind,
        item.kind,
        "menuitem"
      )
    );
  }

  let closeOnDoc = null;

  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (closeOnDoc) {
      document.removeEventListener("mousedown", closeOnDoc);
      closeOnDoc = null;
    }
  }

  function open() {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (!closeOnDoc) {
      closeOnDoc = (e) => {
        if (!wrap.contains(/** @type {Node} */ (e.target))) close();
      };
      document.addEventListener("mousedown", closeOnDoc);
    }
  }

  function toggle() {
    if (panel.hidden) open();
    else close();
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  panel.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("a.flow-nav-menu__item")) close();
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close();
      btn.focus();
    }
  });

  wrap.append(links, btn, panel);
  return wrap;
}
