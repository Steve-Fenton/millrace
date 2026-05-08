/**
 * In-process HTTP for Cucumber + supertest (same Node process as server coverage).
 */

/**
 * @param {import("supertest").SuperTest<import("express").Express>} agent
 * @param {string} method
 * @param {string} pathAndQuery path starting with /
 * @param {unknown} [jsonBody] parsed JSON for PUT / POST / PATCH
 * @returns {Promise<{ status: number, json: unknown, text: string }>}
 */
export async function millraceHttp(agent, method, pathAndQuery, jsonBody) {
  if (!agent) {
    throw new Error("flowApiAgent missing — start the integration harness first.");
  }
  const url = new URL(pathAndQuery, "http://127.0.0.1/");
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams);
  const m = String(method).toUpperCase();
  /** @type {import("supertest").Test} */
  let req;
  if (m === "GET") {
    req = agent.get(pathname).query(query);
  } else if (m === "DELETE") {
    req = agent.delete(pathname).query(query);
  } else if (m === "PUT") {
    req = agent.put(pathname).query(query).type("json");
    req =
      jsonBody !== undefined ? req.send(jsonBody) : req.send();
  } else if (m === "POST") {
    req = agent.post(pathname).query(query).type("json");
    req =
      jsonBody !== undefined ? req.send(jsonBody) : req.send();
  } else if (m === "PATCH") {
    req = agent.patch(pathname).query(query).type("json");
    req =
      jsonBody !== undefined ? req.send(jsonBody) : req.send();
  } else {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }
  const res = await req;
  /** @type {unknown} */
  let json = res.body;
  const text = res.text ?? "";
  const emptyObject =
    json &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    Object.keys(json).length === 0;
  if (
    json === undefined ||
    (emptyObject && text.trim() !== "" && text.trim() !== "{}")
  ) {
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }
  }
  return { status: res.status, json, text };
}
