import assert from "node:assert";
import { Before, BeforeAll, Given, When, Then } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import { createBoardFiltersPanel } from "../../assets/js/ui/boardFiltersPanel.js";
import { filterCardsBySearch } from "../../assets/js/ui/taskSearch.js";

BeforeAll(function () {
  if (!globalThis.document) {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
  }
  const win = globalThis.document.defaultView;
  globalThis.Event = win.Event;
  globalThis.HTMLElement = win.HTMLElement;
});

Before({ tags: "@board_filters_panel" }, function () {
  document.body.replaceChildren();
  this.boardFilterCards = [];
  this.boardFilterSearchQuery = "";
  this.boardFiltersPanelApi = null;
  this.boardFiltersOpen = false;
});

function filteredTitles(world) {
  return filterCardsBySearch(
    world.boardFilterCards,
    world.boardFilterSearchQuery,
    undefined
  ).map((c) => String(c.title ?? ""));
}

function mountPanel(world, { open = false } = {}) {
  /** @type {ReturnType<typeof createBoardFiltersPanel> | null} */
  let api = null;
  api = createBoardFiltersPanel({
    open,
    onOpenChange: (next) => {
      world.boardFiltersOpen = next;
    },
    searchValue: world.boardFilterSearchQuery,
    onSearch: (query) => {
      world.boardFilterSearchQuery = query;
    },
    onSearchClear: () => {
      world.boardFilterSearchQuery = "";
      if (api) api.searchInput.value = "";
    },
  });
  world.boardFiltersPanelApi = api;
  world.boardFiltersOpen = open;
  const shell = document.createElement("div");
  shell.append(api.toggle, api.panel);
  document.body.append(shell);
}

Given("board filter cards JSON:", function (docString) {
  this.boardFilterCards = JSON.parse(docString.trim());
});

Given("a board filters panel that starts closed", function () {
  mountPanel(this, { open: false });
});

When("I open the board filters panel", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  if (!api.isOpen()) api.toggle.click();
});

When("I close the board filters panel", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  if (api.isOpen()) api.toggle.click();
});

When("I search the board filters for {string}", function (query) {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  api.searchInput.value = query;
  api.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  api.searchBtn.click();
});

When("I clear the board filters search", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  const clearBtn = api.panel.querySelector(".flow-search-clear-btn");
  assert(clearBtn, "expected search clear button");
  clearBtn.click();
});

Then("the board filters panel should be open", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  assert.strictEqual(api.isOpen(), true);
  assert(
    api.panel.classList.contains("board-filters-panel--open"),
    "expected panel to have open class"
  );
  assert.strictEqual(api.panel.inert, false);
});

Then("the board filters panel should be closed", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  assert.strictEqual(api.isOpen(), false);
  assert(
    !api.panel.classList.contains("board-filters-panel--open"),
    "expected panel not to have open class"
  );
  assert.strictEqual(api.panel.inert, true);
});

Then(
  "the board filters toggle aria-expanded should be {string}",
  function (expected) {
    const api = this.boardFiltersPanelApi;
    assert(api, "board filters panel not mounted");
    assert.strictEqual(api.toggle.getAttribute("aria-expanded"), expected);
  }
);

Then("the board card search input should be visible", function () {
  const api = this.boardFiltersPanelApi;
  assert(api, "board filters panel not mounted");
  assert.strictEqual(api.searchInput.id, "flow-board-card-search");
  assert.strictEqual(api.panel.inert, false);
});

Then("the board filter search query should be {string}", function (expected) {
  assert.strictEqual(this.boardFilterSearchQuery, expected);
});

Then(
  "the filtered board card titles should be {string}",
  function (expected) {
    const titles = filteredTitles(this);
    assert.deepStrictEqual(titles, expected.split(","));
  }
);
