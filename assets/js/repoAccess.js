/**
 * HTTP API to the Millrace Node server (same origin), with fallbacks when /api is absent.
 */

/**
 * Browsers treat 304 Not Modified as `response.ok === false` and often omit a JSON body,
 * which breaks parsed APIs after refresh. Always bypass the HTTP cache for these fetches.
 */
const NO_STORE = /** @type {const} */ ({ cache: "no-store" });

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
 * @param {string} [boardSlug] — which board definition (`tasks/flow.ini`); default `board`
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
  return data;
}

/**
 * @param {string} name Display name for the new board
 * @returns {Promise<{ ok?: boolean, slug: string, name: string, file: string }>}
 */
export async function createBoardDefinition(name) {
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
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
    slug: String(data.slug ?? "").trim(),
    name: String(data.name ?? "").trim(),
    file: String(data.file ?? "").trim(),
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
      "[flow] Column cards unavailable (HTTP %s). Cards need `pnpm start`. Empty column until API responds.",
      String(res.status)
    );
  }
  return [];
}

/**
 * @returns {Promise<{ owner: string, mine: string, chartsGranularity: string, firstUnsyncedCommitAt: string }>}
 */
export async function fetchLocalUserProfile() {
  try {
    const res = await fetch("/api/local-user", NO_STORE);
    if (!res.ok) {
      return {
        owner: "",
        mine: "",
        chartsGranularity: "",
        firstUnsyncedCommitAt: "",
      };
    }
    const data = await res.json();
    return {
      owner: String(data.owner ?? "").trim(),
      mine: String(data.mine ?? "").trim(),
      chartsGranularity: String(data.chartsGranularity ?? "").trim(),
      firstUnsyncedCommitAt: String(
        data.firstUnsyncedCommitAt ?? ""
      ).trim(),
    };
  } catch {
    return {
      owner: "",
      mine: "",
      chartsGranularity: "",
      firstUnsyncedCommitAt: "",
    };
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
 * @param {{ boardSlug: string, columnIndex: number, swimlaneIndex?: number, title: string, description?: string, owner?: string, links?: Array<{ text?: string, url?: string }> }} payload
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
 * @param {{ boardSlug: string, columnIndex: number, filename: string, title: string, description?: string, owner?: string, links?: Array<{ text?: string, url?: string }> }} payload
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
 * Runs `git pull` then `git push` in the server’s data root (your clone).
 * @returns {Promise<{ ok?: boolean, pull?: string, push?: string }>}
 */
export async function gitSyncRemote() {
  const res = await fetch("/api/git/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    ...NO_STORE,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : await errorBodyMessage(res)
    );
  }
  return data;
}
