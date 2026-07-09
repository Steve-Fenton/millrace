import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { Before, BeforeAll, After, Given, When, Then } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import {
  boardMatchesPickerFilter,
  boardsForTitlePicker,
  createBoardTitlePicker,
  FLOW_ACTIVE_BOARD_SLUG_KEY,
  pickActiveSlug,
  readStoredActiveBoardSlug,
  resolveActiveBoardSelection,
  writeStoredActiveBoardSlug,
} from "../../assets/js/ui/boardSelector.js";

/** @type {import("jsdom").JSDOM} */
let dom;

/** @type {typeof fetch | undefined} */
let savedFetch;

BeforeAll(function () {
  const cssPath = path.join(process.cwd(), "assets/css/app.css");
  const css = fs.readFileSync(cssPath, "utf8");
  dom = new JSDOM(
    `<!DOCTYPE html><html><head><style>${css}</style></head><body></body></html>`,
    { url: "http://localhost/" }
  );
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.requestAnimationFrame = (fn) => {
    fn(0);
    return 0;
  };
  savedFetch = globalThis.fetch;
});

Before({ tags: "@board_title_picker" }, function () {
  document.body.replaceChildren();
  localStorage.clear();
  globalThis.fetch = savedFetch;
  if (this.restoreLocalStorageGetItem) this.restoreLocalStorageGetItem();
  if (this.restoreLocalStorageSetItem) this.restoreLocalStorageSetItem();
  this.boardPickerFilterMatch = undefined;
  this.groupedBoardPicker = undefined;
  this.boardTitlePicker = undefined;
  this.boardTitlePickerSelectedSlug = undefined;
  this.boardPickerCatalog = undefined;
  this.pickedActiveBoardSlug = undefined;
  this.storedActiveBoardSlug = undefined;
  this.resolvedBoardSelection = undefined;
});

After({ tags: "@board_title_picker" }, function () {
  document.body.replaceChildren();
  localStorage.clear();
  globalThis.fetch = savedFetch;
  if (this.restoreLocalStorageGetItem) this.restoreLocalStorageGetItem();
  if (this.restoreLocalStorageSetItem) this.restoreLocalStorageSetItem();
});

function installFlowFetchMock(handler) {
  globalThis.fetch = async (url, init) => {
    if (String(url) === "/api/flow") {
      return handler(init);
    }
    if (savedFetch) return savedFetch(url, init);
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

When("I check board picker filter match for board JSON:", function (docString) {
  this.boardPickerFilterBoard = JSON.parse(docString.trim());
});

When("I use board picker filter query {string}", function (query) {
  this.boardPickerFilterMatch = boardMatchesPickerFilter(
    this.boardPickerFilterBoard,
    query
  );
});

Then("the board picker filter match should be {word}", function (expected) {
  assert.strictEqual(this.boardPickerFilterMatch, expected === "true");
});

When("I group boards for the title picker from JSON:", function (docString) {
  this.groupedBoardPicker = boardsForTitlePicker(JSON.parse(docString.trim()));
});

Then("the grouped board picker aggregate slugs should be {string}", function (expected) {
  const slugs = this.groupedBoardPicker.aggregates.map((b) => b.slug).join(",");
  assert.strictEqual(slugs, expected);
});

Then("the grouped board picker normal slugs should be {string}", function (expected) {
  const slugs = this.groupedBoardPicker.normal.map((b) => b.slug).join(",");
  assert.strictEqual(slugs, expected);
});

Given("board picker catalog JSON:", function (docString) {
  this.boardPickerCatalog = JSON.parse(docString.trim());
});

When("I pick the active board slug with stored slug {string}", function (stored) {
  this.pickedActiveBoardSlug = pickActiveSlug(this.boardPickerCatalog, stored);
});

Then("the picked active board slug should be {string}", function (expected) {
  assert.strictEqual(this.pickedActiveBoardSlug, expected);
});

Given("localStorage active board slug is {string}", function (slug) {
  if (slug) localStorage.setItem(FLOW_ACTIVE_BOARD_SLUG_KEY, slug);
  else localStorage.removeItem(FLOW_ACTIVE_BOARD_SLUG_KEY);
});

When("I read the stored active board slug", function () {
  this.storedActiveBoardSlug = readStoredActiveBoardSlug();
});

Then("the stored active board slug should be {string}", function (expected) {
  assert.strictEqual(this.storedActiveBoardSlug, expected);
});

When("I write stored active board slug {string}", function (slug) {
  writeStoredActiveBoardSlug(slug);
});

Then("localStorage active board slug should be {string}", function (expected) {
  assert.strictEqual(localStorage.getItem(FLOW_ACTIVE_BOARD_SLUG_KEY), expected);
});

Then("localStorage should have no active board slug", function () {
  assert.strictEqual(localStorage.getItem(FLOW_ACTIVE_BOARD_SLUG_KEY), null);
});

Given("localStorage read is blocked", function () {
  const proto = Object.getPrototypeOf(localStorage);
  const original = proto.getItem;
  proto.getItem = () => {
    throw new Error("localStorage read blocked");
  };
  this.restoreLocalStorageGetItem = () => {
    proto.getItem = original;
  };
});

Given("localStorage write is blocked", function () {
  const proto = Object.getPrototypeOf(localStorage);
  const original = proto.setItem;
  proto.setItem = () => {
    throw new Error("localStorage write blocked");
  };
  this.restoreLocalStorageSetItem = () => {
    proto.setItem = original;
  };
});

Given("the flow API returns boards JSON:", function (docString) {
  const boards = JSON.parse(docString.trim());
  installFlowFetchMock(async () => ({
    ok: true,
    async json() {
      return { boards };
    },
  }));
});

Given("the flow API returns status {int}", function (status) {
  installFlowFetchMock(async () => ({
    ok: false,
    status,
    async json() {
      return {};
    },
  }));
});

Given("the flow API returns ok with invalid JSON", function () {
  installFlowFetchMock(async () => ({
    ok: true,
    async json() {
      throw new Error("invalid json");
    },
  }));
});

When("I resolve the active board selection", async function () {
  this.resolvedBoardSelection = await resolveActiveBoardSelection();
});

Then("the resolved board slugs should be {string}", function (expected) {
  const slugs = this.resolvedBoardSelection.boards.map((b) => b.slug).join(",");
  assert.strictEqual(slugs, expected);
});

Then("the resolved board names should be {string}", function (expected) {
  const names = this.resolvedBoardSelection.boards.map((b) => b.name).join(",");
  assert.strictEqual(names, expected);
});

Then("the resolved active board slug should be {string}", function (expected) {
  assert.strictEqual(this.resolvedBoardSelection.activeSlug, expected);
});

Given("a board title picker for boards JSON:", function (docString) {
  this.boardPickerBoards = JSON.parse(docString.trim());
});

Given("the board title picker active slug is {string}", function (slug) {
  const boards = this.boardPickerBoards;
  const activeSlug = slug;
  const picker = createBoardTitlePicker({ boards, activeSlug }, (selected) => {
    this.boardTitlePickerSelectedSlug = selected;
  });
  document.body.append(picker);
  this.boardTitlePicker = picker;
});

function pickerRoot() {
  return /** @type {HTMLElement} */ (this.boardTitlePicker);
}

function visibleOptionLabels(picker) {
  return [...picker.querySelectorAll(".board-title-picker__option")]
    .filter(
      (el) =>
        !el.hidden &&
        !el.classList.contains("board-title-picker__option--filtered-out")
    )
    .map((el) => el.textContent?.trim() ?? "");
}

function allOptionLabels(picker) {
  return [...picker.querySelectorAll(".board-title-picker__option")].map(
    (el) => el.textContent?.trim() ?? ""
  );
}

Then("the board title picker should be a plain heading titled {string}", function (title) {
  const el = pickerRoot.call(this);
  assert.strictEqual(el.tagName, "H1");
  assert.strictEqual(el.className, "board-title");
  assert.strictEqual(el.textContent, title);
});

Then("the board title picker option labels should be {string}", function (expected) {
  const labels = allOptionLabels(pickerRoot.call(this));
  assert.deepStrictEqual(labels, expected.split(","));
});

Then("the visible board title picker option labels should be {string}", function (expected) {
  const labels = visibleOptionLabels(pickerRoot.call(this));
  assert.deepStrictEqual(labels, expected.split(","));
});

Then("the board title picker separator should be visible", function () {
  const sep = pickerRoot.call(this).querySelector(".board-title-picker__separator");
  assert(sep, "expected separator element");
  assert.strictEqual(sep.hidden, false);
});

Then("the board title picker separator should be hidden", function () {
  const sep = pickerRoot.call(this).querySelector(".board-title-picker__separator");
  assert(sep, "expected separator element");
  assert.strictEqual(sep.hidden, true);
});

When("I open the board title picker", function () {
  const trigger = pickerRoot.call(this).querySelector(".board-title-picker__trigger");
  assert(trigger, "expected picker trigger");
  trigger.click();
});

When("I close the board title picker", function () {
  const trigger = pickerRoot.call(this).querySelector(".board-title-picker__trigger");
  assert(trigger, "expected picker trigger");
  trigger.click();
});

Then("the board title picker panel should be hidden", function () {
  const panel = pickerRoot.call(this).querySelector(".board-title-picker__panel");
  assert(panel, "expected picker panel");
  assert.strictEqual(panel.hidden, true);
});

Then("the board title picker filter input should be focused", function () {
  const input = pickerRoot.call(this).querySelector(".board-title-picker__filter-input");
  assert.strictEqual(document.activeElement, input);
});

Then("the board title picker trigger should be focused", function () {
  const trigger = pickerRoot.call(this).querySelector(".board-title-picker__trigger");
  assert.strictEqual(document.activeElement, trigger);
});

Then("the board title picker filter value should be {string}", function (expected) {
  const input = pickerRoot.call(this).querySelector(".board-title-picker__filter-input");
  assert.strictEqual(input?.value ?? "", expected);
});

When("I filter the board title picker with {string}", function (query) {
  const input = pickerRoot.call(this).querySelector(".board-title-picker__filter-input");
  assert(input, "expected filter input");
  input.value = query;
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
});

When("I focus the board title picker trigger", function () {
  const trigger = pickerRoot.call(this).querySelector(".board-title-picker__trigger");
  assert(trigger, "expected picker trigger");
  trigger.focus();
});

When("I press Escape on the board title picker", function () {
  pickerRoot.call(this).dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
});

When("I press Escape in the board title picker filter", function () {
  const input = pickerRoot.call(this).querySelector(".board-title-picker__filter-input");
  assert(input, "expected filter input");
  input.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
});

When("I mousedown outside the board title picker", function () {
  document.body.dispatchEvent(
    new dom.window.MouseEvent("mousedown", { bubbles: true })
  );
});

Then("the board title picker list should be hidden", function () {
  const list = pickerRoot.call(this).querySelector(".board-title-picker__list");
  assert(list, "expected picker list");
  assert.strictEqual(list.hidden, true);
});

Then("the board title picker empty message should be visible", function () {
  const empty = pickerRoot.call(this).querySelector(".board-title-picker__empty");
  assert(empty, "expected empty message");
  assert.strictEqual(empty.hidden, false);
  assert.strictEqual(empty.textContent, "No matching boards");
});

When("I choose board title picker option {string}", function (label) {
  const options = [...pickerRoot.call(this).querySelectorAll(".board-title-picker__option")];
  const hit = options.find((el) => el.textContent?.trim() === label);
  assert(hit, `expected option ${JSON.stringify(label)}`);
  hit.click();
});

Then("the board title picker selected slug should be {string}", function (slug) {
  assert.strictEqual(this.boardTitlePickerSelectedSlug, slug);
});
