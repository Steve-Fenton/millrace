import assert from "node:assert";
import { Before, BeforeAll, Given, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import {
  CARD_LINK_COPIED_ICON_SVG,
  CARD_LINK_ICON_SVG,
  buildCardDeepLinkUrl,
  cardFilenameFromId,
  cardMatchesId,
  clearCardDeepLinkFromUrl,
  copyCardDeepLinkToClipboard,
  findCardEditorContextFromBoard,
  linksWithSourceCardLink,
  normalizeCardId,
  parseCardDeepLinkParams,
  showCopyLinkButtonCopied,
  tryOpenCardFromDeepLink,
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
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
});

Before(function () {
  if (window?.HTMLButtonElement) {
    globalThis.HTMLButtonElement = window.HTMLButtonElement;
  }
  document.body.innerHTML = "";
  document.querySelectorAll(".flow-toast").forEach((el) => el.remove());
  delete window.navigator.clipboard;
  delete document.execCommand;
  this.clipboardWriteText = undefined;
  this.execCommandResult = undefined;
  this.execCommandThrows = false;
});

Given("the browser location is {string}", function (href) {
  window.history.replaceState({}, "", href);
  this.browserHref = href;
});

Given("the clipboard API succeeds", function () {
  window.navigator.clipboard = {
    writeText: async (text) => {
      this.clipboardWriteText = text;
    },
  };
});

Given("the clipboard API is unavailable and execCommand copy succeeds", function () {
  delete window.navigator.clipboard;
  document.execCommand = () => {
    this.execCommandUsed = true;
    return this.execCommandResult !== false;
  };
});

Given("the clipboard API is unavailable and execCommand copy returns false", function () {
  delete window.navigator.clipboard;
  this.execCommandResult = false;
  document.execCommand = () => false;
});

Given("the clipboard API is unavailable and execCommand copy fails", function () {
  delete window.navigator.clipboard;
  document.execCommand = () => {
    throw new Error("copy failed");
  };
});

When("I normalize the card id {string}", function (raw) {
  if (raw === "null") {
    this.normalizedCardId = normalizeCardId(null);
    return;
  }
  this.normalizedCardId = normalizeCardId(raw);
});

Then("the normalized card id should be {string}", function (expected) {
  assert.strictEqual(this.normalizedCardId, expected);
});

When("I build the card filename from id {string}", function (cardId) {
  this.cardFilenameResult = cardFilenameFromId(cardId);
});

Then("the card filename result should be {string}", function (expected) {
  assert.strictEqual(this.cardFilenameResult, expected);
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

When("I check whether an empty card matches id {string}", function (cardId) {
  this.cardIdMatchResult = cardMatchesId({}, cardId);
});

Then("the card id match result should be {word}", function (expected) {
  assert.strictEqual(this.cardIdMatchResult, expected === "true");
});

When(
  "I build a card deep link for board {string} and card {string}",
  function (boardSlug, cardId) {
    this.cardDeepLinkUrl = buildCardDeepLinkUrl({ boardSlug, cardId });
  }
);

When("I build a card deep link with JSON payload:", function (docString) {
  this.cardDeepLinkUrl = buildCardDeepLinkUrl(JSON.parse(docString.trim()));
});

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

Then("the parsed card deep link board slug should be undefined", function () {
  assert.ok(this.parsedCardDeepLink);
  assert.strictEqual(this.parsedCardDeepLink.boardSlug, undefined);
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

When("I add a source card link with JSON payload:", function (docString) {
  const payload = JSON.parse(docString.trim());
  this.linksJson = linksWithSourceCardLink(payload.links, payload.source);
});

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
    /** @type {import("../../assets/js/models/boardModel.js").BoardModel} */
    const model = {
      columns: input.columns ?? [],
      swimlanes: input.swimlanes ?? [],
    };
    if (Object.prototype.hasOwnProperty.call(input, "board")) {
      model.board = input.board;
    }
    if (input.users !== undefined) {
      model.users = input.users;
    }
    this.cardEditorContext = findCardEditorContextFromBoard({
      cardsByColumn,
      model,
      boardSlug,
      cardId,
    });
  }
);

Then("the card editor context filename should be {string}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.filename, expected);
});

Then("the card editor context board slug should be {string}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.boardSlug, expected);
});

Then("the card editor context column index should be {int}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.columnIndex, expected);
});

Then("the card editor context column title should be {string}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.columnTitle, expected);
});

Then("the card editor context swimlane index should be {int}", function (expected) {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.swimlaneIndex, expected);
});

Then("the card editor context swimlane title should be undefined", function () {
  assert.ok(this.cardEditorContext);
  assert.strictEqual(this.cardEditorContext.swimlaneTitle, undefined);
});

Then("there should be no card editor context", function () {
  assert.strictEqual(this.cardEditorContext, null);
});

When(
  "I copy the card deep link for board {string} and filename {string}",
  async function (boardSlug, filename) {
    this.copyCardDeepLinkResult = await copyCardDeepLinkToClipboard({
      boardSlug,
      filename,
    });
  }
);

When("I copy the card deep link with JSON payload:", async function (docString) {
  const payload = JSON.parse(docString.trim());
  this.copyCardDeepLinkResult = await copyCardDeepLinkToClipboard(payload);
});

Then("the copy card deep link result should be {word}", function (expected) {
  assert.strictEqual(this.copyCardDeepLinkResult, expected === "true");
});

Then("the clipboard should contain {string}", function (expected) {
  assert.strictEqual(this.clipboardWriteText, expected);
});

Then("the flow toast message should be:", function (docString) {
  const toast = document.querySelector(".flow-toast");
  assert.ok(toast, "expected a flow toast");
  assert.strictEqual(toast.textContent, docString.trim());
});

Given("a copy link button with the default icon", function () {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "flow-btn-copy-card-link-icon";
  btn.innerHTML = CARD_LINK_ICON_SVG;
  document.body.append(btn);
  this.copyLinkButton = btn;
});

When("I show the copy link button copied state", function () {
  showCopyLinkButtonCopied(this.copyLinkButton);
});

When(
  "I show the copy link button copied state for {int} ms",
  function (durationMs) {
    showCopyLinkButtonCopied(this.copyLinkButton, { durationMs });
  }
);

When("I show the copy link button copied state on a non-button element", function () {
  const el = document.createElement("div");
  document.body.append(el);
  showCopyLinkButtonCopied(el);
  this.copyLinkButton = el;
});

When("I show the copy link button copied state again", function () {
  showCopyLinkButtonCopied(this.copyLinkButton, { durationMs: 0 });
});

When("I remove the copy link button from the document", function () {
  this.copyLinkButton.remove();
});

When("I clear the saved copy link button icon markup", function () {
  delete this.copyLinkButton.dataset.copyLinkIconOriginal;
});

When("I wait for the copy link button restore timer", async function () {
  await new Promise((resolve) => window.setTimeout(resolve, 100));
});

Then("the copy link button should show the copied icon", function () {
  assert.strictEqual(this.copyLinkButton.tagName, "BUTTON");
  assert.ok(this.copyLinkButton.innerHTML.includes("flow-copy-link-icon-svg--copied"));
  assert.ok(
    this.copyLinkButton.classList.contains("flow-btn-copy-card-link-icon--copied")
  );
  assert.strictEqual(this.copyLinkButton.getAttribute("aria-label"), "Link copied");
});

Then("the copy link button should show the original icon", function () {
  assert.strictEqual(this.copyLinkButton.tagName, "BUTTON");
  assert.ok(this.copyLinkButton.innerHTML.includes("flow-copy-link-icon-svg"));
  assert.ok(!this.copyLinkButton.innerHTML.includes("flow-copy-link-icon-svg--copied"));
  assert.ok(
    !this.copyLinkButton.classList.contains("flow-btn-copy-card-link-icon--copied")
  );
  assert.strictEqual(
    this.copyLinkButton.getAttribute("aria-label"),
    "Copy link to this card"
  );
});

Then("the copy link trigger element should remain unchanged", function () {
  assert.strictEqual(this.copyLinkButton.innerHTML, "");
});

Then("the copy link button should no longer be connected", function () {
  assert.strictEqual(this.copyLinkButton.isConnected, false);
});

When(
  "I try to open card {string} from a deep link on the loaded board:",
  function (cardId, docString) {
    const input = JSON.parse(docString.trim());
    /** @type {Map<number, object[]>} */
    const cardsByColumn = new Map();
    for (const [key, value] of Object.entries(input.cardsByColumn ?? {})) {
      cardsByColumn.set(Number(key), value);
    }
    /** @type {import("../../assets/js/models/boardModel.js").BoardModel} */
    const model = {
      columns: input.columns ?? [],
      swimlanes: input.swimlanes ?? [],
    };
    if (Object.prototype.hasOwnProperty.call(input, "board")) {
      model.board = input.board;
    }
    window.history.replaceState(
      {},
      "",
      `http://localhost:7713/index.html?board=demo&card=${encodeURIComponent(cardId)}`
    );
    this.deepLinkEditorContext = null;
    tryOpenCardFromDeepLink(
      { cardId },
      {
        model,
        cardsByColumn,
      },
      (ctx) => {
        this.deepLinkEditorContext = ctx;
      }
    );
  }
);

Then("the deep link editor context filename should be {string}", function (expected) {
  assert.ok(this.deepLinkEditorContext);
  assert.strictEqual(this.deepLinkEditorContext.filename, expected);
});

Then("there should be no deep link editor context", function () {
  assert.strictEqual(this.deepLinkEditorContext, null);
});

Then("the browser location should no longer include card or board params", function () {
  const u = new URL(window.location.href);
  assert.strictEqual(u.searchParams.has("card"), false);
  assert.strictEqual(u.searchParams.has("board"), false);
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
