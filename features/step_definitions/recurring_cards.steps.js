import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import { millraceHttp } from "../support/integration_request.js";
import { INTEGRATION_DATA_ROOT } from "../support/millrace_fixtures.js";
import { addRecurrenceInterval, localYmd } from "../../assets/js/ini/recurrence.js";
import { parseTaskCardIniFull } from "../../assets/js/models/taskModel.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function boardDir(slug) {
  return path.join(INTEGRATION_DATA_ROOT, "tasks", slug);
}

async function readCard(slug, filename) {
  const raw = await fs.readFile(path.join(boardDir(slug), filename), "utf8");
  return parseTaskCardIniFull(raw);
}

async function cardFiles(slug) {
  const ents = await fs.readdir(boardDir(slug), { withFileTypes: true });
  return ents.filter((e) => e.isFile() && e.name.endsWith(".ini")).map((e) => e.name);
}

async function spawnedCopy(slug, source) {
  const others = (await cardFiles(slug)).filter((f) => f !== source);
  assert.strictEqual(others.length, 1, `expected one copy, found ${others.join(", ")}`);
  return readCard(slug, others[0]);
}

Given("the integration board {string} is defined as:", async function (slug, ini) {
  await fs.writeFile(path.join(INTEGRATION_DATA_ROOT, "tasks", `${slug}.ini`), `${ini}\n`, "utf8");
});

Given(
  "the integration board {string} has a recurring card {string} in column {string} due {int} days ago repeating {string}",
  async function (slug, filename, column, daysAgo, recurrence) {
    await fs.mkdir(boardDir(slug), { recursive: true });
    const nad = localYmd(Date.now() - daysAgo * DAY_MS);
    const lines = [
      "[item]",
      `id = ${filename.replace(/\.ini$/, "")}`,
      "title = Water the plants",
      "description = Every plant in the office.",
      "owner = owner@example.com",
      `next_action_date = ${nad}`,
    ];
    if (recurrence) lines.push(`recurrence = ${recurrence}`);
    lines.push(
      `column = ${column}`,
      "sort_order = 10",
      "created = 2026-01-01T00:00:00.000Z",
      "",
      "[link.1]",
      "text = Plant guide",
      "url = https://example.com/plants",
      ""
    );
    await fs.writeFile(path.join(boardDir(slug), filename), lines.join("\n"), "utf8");
  }
);

When(
  "I put card {string} in column {int} on board {string} with recurrence {string}",
  async function (filename, columnIndex, slug, recurrence) {
    const { status, json } = await millraceHttp(this.flowApiAgent, "PUT", "/api/card", {
      boardSlug: slug,
      columnIndex,
      filename,
      title: "Water the plants",
      description: "",
      owner: "",
      recurrence,
    });
    this.lastHttpStatus = status;
    this.lastJson = json;
  }
);

Then("the integration board {string} should have {int} card files", async function (slug, n) {
  assert.strictEqual((await cardFiles(slug)).length, n);
});

Then(
  "the recurring card {string} on board {string} should have next action date {int} days from today",
  async function (filename, slug, days) {
    const { item } = await readCard(slug, filename);
    assert.strictEqual(item.next_action_date, localYmd(Date.now() + days * DAY_MS));
  }
);

Then(
  "the recurring card {string} on board {string} should have next action date 1 month from today",
  async function (filename, slug) {
    const { item } = await readCard(slug, filename);
    assert.strictEqual(item.next_action_date, addRecurrenceInterval(localYmd(), "1 months"));
  }
);

Then(
  "the recurring card {string} on board {string} should still have recurrence {string}",
  async function (filename, slug, recurrence) {
    const { item } = await readCard(slug, filename);
    assert.strictEqual(item.recurrence ?? "", recurrence);
  }
);

Then(
  "the spawned copy of {string} on board {string} should be in column {string}",
  async function (source, slug, column) {
    const { item } = await spawnedCopy(slug, source);
    assert.strictEqual(item.column, column);
  }
);

Then(
  "the spawned copy of {string} on board {string} should have next action date {int} days ago",
  async function (source, slug, days) {
    const { item } = await spawnedCopy(slug, source);
    assert.strictEqual(item.next_action_date, localYmd(Date.now() - days * DAY_MS));
  }
);

Then(
  "the spawned copy of {string} on board {string} should not be recurring",
  async function (source, slug) {
    const { item } = await spawnedCopy(slug, source);
    assert.strictEqual(item.recurrence, undefined);
  }
);

Then(
  "the spawned copy of {string} on board {string} should keep the title, owner and links",
  async function (source, slug) {
    const { item, links } = await spawnedCopy(slug, source);
    assert.strictEqual(item.title, "Water the plants");
    assert.strictEqual(item.owner, "owner@example.com");
    assert.deepStrictEqual(links, [{ text: "Plant guide", url: "https://example.com/plants" }]);
    assert.notStrictEqual(item.id, source.replace(/\.ini$/, ""));
  }
);
