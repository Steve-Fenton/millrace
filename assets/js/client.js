/**
 * HTTP API to the Millrace Node server (same origin), with fallbacks when /api is absent.
 */

/**
 * Browsers treat 304 Not Modified as `response.ok === false` and often omit a JSON body,
 * which breaks parsed APIs after refresh. Always bypass the HTTP cache for these fetches.
 */
const NO_STORE = /** @type {const} */ ({ cache: "no-store" });

function emitPendingSync() {
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("flow:pending-sync"));
  }
}

/**
 * @param {Response} res
 */
async function errorBodyMessage(res) {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    return res.statusText || "Request failed";
  }
  const text = await res.text().catch(() => "");
  if (res.status === 404 && /cannot get\s+\//i.test(text)) {
    return "Card API unavailable — restart the Millrace server from this repo (`pnpm start`).";
  }
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length > 0 && oneLine.length < 400) {
    return oneLine.slice(0, 300);
  }
  return res.statusText || "Request failed";
}

/**
 * @param {string} [boardSlug] — which board definition (`tasks/.millrace.ini` catalog); default `board`
 * @returns {Promise<string>} raw board definition INI text
 */
/**
 * @param {string} boardSlug
 * @returns {Promise<{ text: string, slug: string, name: string, file: string }>}
 */
export async function fetchBoardDefinition(boardSlug) {
  const slug = encodeURIComponent(
    String(boardSlug && boardSlug.trim() ? boardSlug.trim() : "board")
  );
  const res = await fetch(`/api/board?boardSlug=${slug}`, NO_STORE);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return {
    text: String(data.text ?? ""),
    slug: String(data.slug ?? "").trim() || "board",
    name: String(data.name ?? "").trim() || "Board",
    file: String(data.file ?? "board.ini"),
  };
}

export async function fetchBoardIni(boardSlug) {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "file:"
  ) {
    throw new Error(
      "Open the app with an HTTP server (`pnpm start`) — opening index.html as a file cannot load data."
    );
  }

  const slug = encodeURIComponent(
    String(boardSlug && boardSlug.trim() ? boardSlug.trim() : "board")
  );
  const apiRes = await fetch(`/api/board?boardSlug=${slug}`, NO_STORE);
  const apiCt = apiRes.headers.get("content-type") ?? "";
  /** @type {{ text?: string, message?: string } | null} */
  let apiBody = null;
  if (apiCt.includes("application/json")) {
    try {
      apiBody = await apiRes.json();
    } catch {
      apiBody = null;
    }
  } else {
    await apiRes.text().catch(() => {});
  }

  if (apiRes.ok && apiBody && typeof apiBody.text === "string") {
    return apiBody.text;
  }

  const apiMessage =
    !apiRes.ok && apiBody && typeof apiBody.message === "string"
      ? apiBody.message
      : "";

  const staticRes = await fetch("/tasks/board.ini", NO_STORE);
  if (staticRes.ok) {
    return await staticRes.text();
  }

  throw new Error(
    apiMessage ||
      "Could not load board definition. Run `pnpm start` from the repo and open the printed URL, or serve the project so /api/board is reachable."
  );
}

/**
 * @param {{ boardSlug: string, text: string }} payload
 */
export async function updateBoardDefinition(payload) {
  const res = await fetch("/api/board-definition", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  emitPendingSync();
  return data;
}

/**
 * @param {string} name Display name for the new board
 * @param {{ kind?: string, sources?: string[] }} [options]
 * @returns {Promise<{ ok?: boolean, slug: string, name: string, file: string, kind?: string }>}
 */
export async function createBoardDefinition(name, options = {}) {
  /** @type {{ name: string, kind?: string, sources?: string[] }} */
  const body = { name };
  const kind = String(options.kind ?? "").trim();
  if (kind) body.kind = kind;
  if (Array.isArray(options.sources) && options.sources.length > 0) {
    body.sources = options.sources.map((s) => String(s ?? "").trim()).filter(Boolean);
  }
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  emitPendingSync();
  return {
    ok: Boolean(data.ok),
    slug: String(data.slug ?? "").trim(),
    name: String(data.name ?? "").trim(),
    file: String(data.file ?? "").trim(),
    kind: String(data.kind ?? "").trim() || undefined,
  };
}

/**
 * @param {string} boardSlug
 */
export async function deleteBoardDefinition(boardSlug) {
  const q = new URLSearchParams({ boardSlug });
  const res = await fetch(`/api/board-definition?${q}`, {
    method: "DELETE",
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  emitPendingSync();
  return data;
}

/**
 * @param {{ boardSlug: string, limit?: number }} args
 */
export async function fetchBoardDefinitionGitHistory(args) {
  const q = new URLSearchParams({ boardSlug: args.boardSlug });
  if (args.limit != null && Number.isFinite(args.limit)) {
    q.set("limit", String(args.limit));
  }
  const res = await fetch(`/api/board-definition/git-history?${q}`, NO_STORE);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return data;
}

/**
 * @param {string} boardSlug
 * @param {number} columnIndex
 */
export async function fetchColumnCards(boardSlug, columnIndex) {
  const q = new URLSearchParams({
    boardSlug,
    columnIndex: String(columnIndex),
  });
  const res = await fetch(`/api/column-cards?${q}`, NO_STORE);
  const ct = res.headers.get("content-type") ?? "";
  let data = {};
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    await res.text().catch(() => {});
  }

  if (res.ok && Array.isArray(data.cards)) {
    return data.cards;
  }

  /* Live Preview / static hosts serve board.ini but not POST/GET /api — don't fail the whole board. */
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      "[millrace] Column cards unavailable (HTTP %s). Cards need `pnpm start`. Empty column until API responds.",
      String(res.status)
    );
  }
  return [];
}

/**
 * @returns {Promise<{ owner: string, mine: string, chartsGranularity: string, pendingSync: boolean, syncMode: "automatic" | "manual", swimlaneCollapse: Record<string, Record<string, "scroll" | "collapsed">> }>}
 */
export async function fetchLocalUserProfile() {
  const empty = {
    owner: "",
    mine: "",
    chartsGranularity: "",
    pendingSync: false,
    /** @type {"automatic" | "manual"} */
    syncMode: /** @type {"automatic" | "manual"} */ ("automatic"),
    /** @type {Record<string, Record<string, "scroll" | "collapsed">>} */
    swimlaneCollapse: {},
  };
  try {
    const res = await fetch("/api/local-user", NO_STORE);
    if (!res.ok) return empty;
    const data = await res.json();
    const sm = String(data.syncMode ?? "").trim().toLowerCase();
    return {
      owner: String(data.owner ?? "").trim(),
      mine: String(data.mine ?? "").trim(),
      chartsGranularity: String(data.chartsGranularity ?? "").trim(),
      pendingSync: Boolean(data.pendingSync),
      syncMode: sm === "manual" ? "manual" : "automatic",
      swimlaneCollapse: normalizeSwimlaneCollapsePayload(data.swimlaneCollapse),
    };
  } catch {
    return empty;
  }
}

/**
 * Server may key entries by swimlane title (preferred) or by a legacy numeric
 * index. We preserve whatever the server sent so the UI can match by title
 * first and fall back to index for older `tasks/localuser.ini` files.
 * @param {unknown} raw
 * @returns {Record<string, Record<string, "scroll" | "collapsed">>}
 */
function normalizeSwimlaneCollapsePayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  /** @type {Record<string, Record<string, "scroll" | "collapsed">>} */
  const out = {};
  for (const slug of Object.keys(raw)) {
    const lanes = /** @type {Record<string, unknown>} */ (raw[slug]);
    if (!lanes || typeof lanes !== "object") continue;
    /** @type {Record<string, "scroll" | "collapsed">} */
    const map = {};
    for (const key of Object.keys(lanes)) {
      const k = String(key).trim();
      if (!k) continue;
      const v = String(lanes[key] ?? "").trim().toLowerCase();
      if (v === "scroll" || v === "collapsed") map[k] = v;
    }
    if (Object.keys(map).length > 0) out[slug] = map;
  }
  return out;
}

/**
 * Update a single lane's collapse mode in `tasks/localuser.ini`.
 * Storage is keyed by `laneTitle`. `laneIndex` is optional and lets the server
 * clean up any legacy index-keyed entry for the same lane.
 * @param {{ boardSlug: string, laneTitle: string, laneIndex?: number, mode: "open" | "scroll" | "collapsed" }} payload
 */
export async function patchSwimlaneCollapse(payload) {
  /** @type {Record<string, unknown>} */
  const swimlaneBody = {
    boardSlug: String(payload.boardSlug ?? "").trim(),
    laneTitle: String(payload.laneTitle ?? "").trim(),
    mode: payload.mode,
  };
  if (payload.laneIndex != null && Number.isFinite(Number(payload.laneIndex))) {
    swimlaneBody.laneIndex = Number(payload.laneIndex);
  }
  const res = await fetch("/api/local-user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ swimlaneCollapse: swimlaneBody }),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return {
    ok: Boolean(data.ok),
    swimlaneCollapse: normalizeSwimlaneCollapsePayload(data.swimlaneCollapse),
  };
}

/**
 * NPM registry update hint (server throttles via `last_npm_update_check` in tasks/localuser.ini `[flow]`).
 * Also compares data-root `package.json` vs `pnpm-lock.yaml` for Millrace (`lockfileOutOfSync`).
 * @returns {Promise<{
 *   currentVersion: string,
 *   latestVersion: string | null,
 *   updateAvailable: boolean,
 *   checkedRegistry: boolean,
 *   projectHasCycleScript: boolean,
 *   lockfileOutOfSync: boolean,
 *   packageMillraceSpec: string | null,
 *   lockSpecifier: string | null,
 *   lockResolvedVersion: string | null,
 * }>}
 */
export async function fetchNpmUpdateCheck() {
  const empty = {
    currentVersion: "",
    latestVersion: null,
    updateAvailable: false,
    checkedRegistry: false,
    projectHasCycleScript: false,
    lockfileOutOfSync: false,
    packageMillraceSpec: null,
    lockSpecifier: null,
    lockResolvedVersion: null,
  };
  try {
    const res = await fetch("/api/npm-update-check", NO_STORE);
    if (!res.ok) {
      return empty;
    }
    const data = await res.json();
    const latestRaw = data.latestVersion;
    return {
      currentVersion: String(data.currentVersion ?? "").trim(),
      latestVersion:
        latestRaw != null && String(latestRaw).trim()
          ? String(latestRaw).trim()
          : null,
      updateAvailable: Boolean(data.updateAvailable),
      checkedRegistry: Boolean(data.checkedRegistry),
      projectHasCycleScript: Boolean(data.projectHasCycleScript),
      lockfileOutOfSync: Boolean(data.lockfileOutOfSync),
      packageMillraceSpec:
        data.packageMillraceSpec != null &&
        String(data.packageMillraceSpec).trim()
          ? String(data.packageMillraceSpec).trim()
          : null,
      lockSpecifier:
        data.lockSpecifier != null && String(data.lockSpecifier).trim()
          ? String(data.lockSpecifier).trim()
          : null,
      lockResolvedVersion:
        data.lockResolvedVersion != null &&
        String(data.lockResolvedVersion).trim()
          ? String(data.lockResolvedVersion).trim()
          : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Runs `pnpm update --latest` then `pnpm cycle` in the data root (after user confirms).
 * @param {string} latestVersion registry version string from {@link fetchNpmUpdateCheck}
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string, restarting?: boolean }>}
 */
export async function postNpmUpdateRunCycle(latestVersion) {
  const res = await fetch("/api/npm-update-run-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latestVersion }),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return data;
}

/**
 * Runs `pnpm install` then `pnpm cycle` when package.json and the lockfile disagree on Millrace.
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string, restarting?: boolean }>}
 */
export async function postNpmInstallRunCycle() {
  const res = await fetch("/api/npm-update-run-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "install-sync" }),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return data;
}

/**
 * `[preferences]`, `[user]` mine/owner, and `[flow]` throttle timestamps from tasks/localuser.ini (preferences page).
 * @returns {Promise<{ syncMode: "automatic" | "manual", theme: "dark" | "light", mine: string, owner: string, lastAutoGitPull: string, lastNpmUpdateCheck: string }>}
 */
export async function fetchLocalUserPreferences() {
  try {
    const res = await fetch("/api/local-user/preferences", NO_STORE);
    if (!res.ok) {
      return {
        syncMode: "automatic",
        theme: "dark",
        mine: "",
        owner: "",
        lastAutoGitPull: "",
        lastNpmUpdateCheck: "",
      };
    }
    const data = await res.json();
    const sm = String(data.syncMode ?? "").trim().toLowerCase();
    const th = String(data.theme ?? "").trim().toLowerCase();
    return {
      syncMode: sm === "manual" ? "manual" : "automatic",
      theme: th === "light" ? "light" : "dark",
      mine: String(data.mine ?? "").trim(),
      owner: String(data.owner ?? "").trim(),
      lastAutoGitPull: String(data.lastAutoGitPull ?? "").trim(),
      lastNpmUpdateCheck: String(data.lastNpmUpdateCheck ?? "").trim(),
    };
  } catch {
    return {
      syncMode: "automatic",
      theme: "dark",
      mine: "",
      owner: "",
      lastAutoGitPull: "",
      lastNpmUpdateCheck: "",
    };
  }
}

/**
 * @param {{
 *   syncMode?: "automatic" | "manual",
 *   theme?: "dark" | "light",
 *   mine?: string,
 *   owner?: string,
 *   clearLastAutoGitPull?: boolean,
 *   clearLastNpmUpdateCheck?: boolean,
 * }} body
 */
export async function patchLocalUserPreferences(body) {
  /** @type {Record<string, string | boolean>} */
  const payload = {};
  if (body.syncMode !== undefined) {
    payload.syncMode = body.syncMode === "manual" ? "manual" : "automatic";
  }
  if (body.theme !== undefined) {
    payload.theme = body.theme === "light" ? "light" : "dark";
  }
  if (body.mine !== undefined) {
    payload.mine = String(body.mine ?? "").trim();
  }
  if (body.owner !== undefined) {
    payload.owner = String(body.owner ?? "").trim();
  }
  if (body.clearLastAutoGitPull === true) {
    payload.clearLastAutoGitPull = true;
  }
  if (body.clearLastNpmUpdateCheck === true) {
    payload.clearLastNpmUpdateCheck = true;
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("Nothing to save");
  }
  const res = await fetch("/api/local-user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
}

/** @returns {Promise<string>} */
export async function readLocalUserIni() {
  const { owner } = await fetchLocalUserProfile();
  return owner;
}

/**
 * @param {"weekly" | "monthly"} granularity
 */
export async function patchLocalUserChartsGranularity(granularity) {
  const res = await fetch("/api/local-user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chartsGranularity: granularity }),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
}

/**
 * Sets `tasks/localuser.ini` `[user] mine` (Mine filter). Pass empty string to clear.
 * @param {string} email
 */
export async function patchLocalUserMine(email) {
  const res = await fetch("/api/local-user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mine: email }),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
}

/**
 * @param {{ boardSlug: string, columnIndex: number, swimlaneIndex?: number, title: string, description?: string, note?: string, owner?: string, strategic?: boolean, nextActionDate?: string, links?: Array<{ text?: string, url?: string }> }} payload
 */
export async function createCard(payload) {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || res.statusText || "Request failed");
  }
  emitPendingSync();
  return data;
}

/**
 * @param {string} boardSlug
 * @param {number} columnIndex
 * @param {string} filename
 */
export async function fetchCard(boardSlug, columnIndex, filename) {
  const q = new URLSearchParams({
    boardSlug,
    columnIndex: String(columnIndex),
    filename,
  });
  const res = await fetch(`/api/card?${q}`, NO_STORE);
  if (!res.ok) {
    throw new Error(await errorBodyMessage(res));
  }
  return res.json();
}

/**
 * @param {{ boardSlug: string, columnIndex: number, filename: string, limit?: number }} args
 * @returns {Promise<{ gitAvailable: boolean, path?: string | null, commits: { hash: string, shortHash: string, date: string, author: string, subject: string }[], message?: string }>}
 */
export async function fetchCardGitHistory(args) {
  const q = new URLSearchParams({
    boardSlug: args.boardSlug,
    columnIndex: String(args.columnIndex),
    filename: args.filename,
  });
  if (args.limit != null && Number.isFinite(args.limit)) {
    q.set("limit", String(args.limit));
  }
  const res = await fetch(`/api/card/git-history?${q}`, NO_STORE);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : res.statusText || "Request failed"
    );
  }
  return data;
}

/**
 * @param {{ boardSlug: string, columnIndex: number, filename: string, title: string, description?: string, note?: string, owner?: string, strategic?: boolean, nextActionDate?: string, links?: Array<{ text?: string, url?: string }> }} payload
 */
export async function updateCard(payload) {
  const res = await fetch("/api/card", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  if (!res.ok) {
    throw new Error(await errorBodyMessage(res));
  }
  emitPendingSync();
  return res.json();
}

/**
 * @param {{ boardSlug: string, columnIndex: number, filename: string }} payload
 */
export async function deleteCard(payload) {
  const q = new URLSearchParams({
    boardSlug: payload.boardSlug,
    columnIndex: String(payload.columnIndex),
    filename: payload.filename,
  });
  const res = await fetch(`/api/card?${q}`, {
    method: "DELETE",
    ...NO_STORE,
  });
  if (!res.ok) {
    throw new Error(await errorBodyMessage(res));
  }
  emitPendingSync();
  return res.json();
}

/**
 * @param {{ boardSlug: string, filename: string, fromColumnIndex: number, toColumnIndex: number, swimlaneIndex: number }} payload
 */
export async function moveCard(payload) {
  const res = await fetch("/api/cards/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  if (!res.ok) {
    throw new Error(await errorBodyMessage(res));
  }
  emitPendingSync();
  return res.json();
}

/**
 * @param {{ boardSlug: string, columnIndex: number, swimlaneIndex: number, filenames: string[] }} payload
 */
export async function reorderCards(payload) {
  const res = await fetch("/api/cards/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  if (!res.ok) {
    throw new Error(await errorBodyMessage(res));
  }
  emitPendingSync();
  return res.json();
}

/** @returns {Promise<boolean>} */
export async function fetchGitRepoAvailable() {
  try {
    const res = await fetch("/api/git/status", NO_STORE);
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Boolean(data.gitRepo);
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} [body]
 * @returns {Promise<{ ok: boolean, needConflictResolution?: boolean, files?: { path: string, content: string }[], message?: string }>}
 */
export async function gitSyncRequest(body = {}) {
  const res = await fetch("/api/git/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body && typeof body === "object" ? body : {}),
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.needConflictResolution) {
    return {
      ok: false,
      needConflictResolution: true,
      files: Array.isArray(data.files) ? data.files : [],
    };
  }
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : await errorBodyMessage(res)
    );
  }
  return { ok: true, ...data };
}
