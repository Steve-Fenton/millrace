import assert from "node:assert";
import { BeforeAll, Given, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import {
  buildCardDeepLinkUrl,
  cardMatchesId,
  clearCardDeepLinkFromUrl,
  findCardEditorContextFromBoard,
  linksWithSourceCardLink,
  normalizeCardId,
  parseCardDeepLinkParams,
} from "../../assets/js/ui/cardDeepLink.js";
import {
  queueCardEditorOpenAfterRefresh,
  takePendingCardEditorOpen,
} from "../../assets/js/ui/openCardEditorAfterRefresh.js";

BeforeAll(function () {
  const dom = new JSDOM(
    "<!DOCTYPE html><html><head><title></title></head><body></body></html>",
    { url: "http://localhost:7713/index.html" }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.history = dom.window.history;
  globalThis.URL = dom.window.URL;
});

Given("the browser location is {string}", function (href) {
  window.history.replaceState({}, "", href);
  this.browserHref = href;
});

When("I normalize the card id {string}", function (raw) {
  this.normalizedCardId = normalizeCardId(raw);
});

Then("the normalized card id should be {string}", function (expected) {
  assert.strictEqual(this.normalizedCardId, expected);
});

When(
  "I check whether a card with filename {string} matches id {string}",
  function (filename, cardId) {
    this.cardIdMatchResult = cardMatchesId({ filename }, cardId);
  }
);

When(
  "I check whether a card with id {string} matches id {string}",
  function (id, cardId) {
    this.cardIdMatchResult = cardMatchesId({ id }, cardId);
  }
);

Then("the card id match result should be {word}", function (expected) {
  assert.strictEqual(this.cardIdMatchResult, expected === "true");
});

When(
  "I build a card deep link for board {string} and card {string}",
  function (boardSlug, cardId) {
    this.cardDeepLinkUrl = buildCardDeepLinkUrl({ boardSlug, cardId });
  }
);

Then("the card deep link URL should be {string}", function (expected) {
  assert.strictEqual(this.cardDeepLinkUrl, expected);
});

When("I parse card deep link params from {string}", function (search) {
  this.parsedCardDeepLink = parseCardDeepLinkParams(
    new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  );
});

Then("the parsed card deep link board slug should be {string}", function (expected) {
  assert.ok(this.parsedCardDeepLink);
  assert.strictEqual(this.parsedCardDeepLink.boardSlug, expected);
});

Then("the parsed card deep link card id should be {string}", function (expected) {
  assert.ok(this.parsedCardDeepLink);
  assert.strictEqual(this.parsedCardDeepLink.cardId, expected);
});

Then("there should be no parsed card deep link", function () {
  assert.strictEqual(this.parsedCardDeepLink, null);
});

When("I clear the card deep link from the URL", function () {
  clearCardDeepLinkFromUrl();
});

Then("the browser location should be {string}", function (expected) {
  assert.strictEqual(window.location.href, expected);
});

When(
  "I add a source card link for board {string} and filename {string} to links:",
  function (boardSlug, filename, docString) {
    const links = JSON.parse(docString.trim());
    this.linksJson = linksWithSourceCardLink(links, { boardSlug, filename });
  }
);

Then("the links JSON should be:", function (docString) {
  assert.deepStrictEqual(this.linksJson, JSON.parse(docString.trim()));
});

When(
  "I find card editor context for card {string} on board {string} with:",
  function (cardId, boardSlug, docString) {
    const input = JSON.parse(docString.trim());
    /** @type {Map<number, object[]>} */
    const cardsByColumn = new Map();
    for (const [key, value] of Object.entries(input.cardsByColumn ?? {})) {
      cardsByColumn.set(Number(key), value);
    }
    this.cardEditorContext = findCardEditorContextFromBoard({
      cardsByColumn,
      model: {
        columns: input.columns ?? [],
        swimlanes: input.swimlanes ?? [],
      },
      boardSlug,
      cardId,
    });
  }
);

Then("the card editor context filename should be {string}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.filename, expected);
});

Then("the card editor context column title should be {string}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.columnTitle, expected);
});

Then("the card editor context swimlane index should be {int}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.swimlaneIndex, expected);
});

Then("there should be no card editor context", function () {
  assert.strictEqual(this.cardEditorContext, null);
});

When(
  "I queue a card editor open for board {string} and filename {string}",
  function (boardSlug, filename) {
    queueCardEditorOpenAfterRefresh({
      boardSlug,
      columnIndex: 1,
      filename,
      columnTitle: "To do",
      swimlaneIndex: 1,
    });
  }
);

When("I take the pending card editor open context", function () {
  this.pendingCardEditorOpen = takePendingCardEditorOpen();
});

Then("the pending card editor open filename should be {string}", function (expected) {
  assert.ok(this.pendingCardEditorOpen);
  assert.strictEqual(this.pendingCardEditorOpen.filename, expected);
});

Then("there should be no pending card editor open context", function () {
  assert.strictEqual(this.pendingCardEditorOpen, null);
});
