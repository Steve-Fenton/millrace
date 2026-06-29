import assert from "node:assert";
import { Before, BeforeAll, Given, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import {
  renderLimitedMarkdown,
  toggleMarkdownTaskLine,
} from "../../assets/js/ui/limitedMarkdown.js";

/** @type {typeof globalThis.Element | undefined} */
let ElementCtor;

BeforeAll(function () {
  if (!globalThis.document) {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
  }
  const win = globalThis.document.defaultView;
  globalThis.HTMLElement = win.HTMLElement;
  ElementCtor = win.Element;
});

Before({ tags: "@limited_markdown" }, function () {
  this.markdownSource = "";
  this.markdownTarget = document.createElement("div");
  document.body.append(this.markdownTarget);
  this.markdownTaskToggleSource = "";
  this.markdownTaskToggleResult = "";
});

/** Expand table cell macros (see limited_markdown.feature). */
function expandMarkdownMacros(s) {
  return String(s).replaceAll("{NL}", "\n");
}

function markdownBlocks(world) {
  assert(world.markdownTarget instanceof ElementCtor);
  return [...world.markdownTarget.children];
}

function markdownBlockAt(world, index) {
  const blocks = markdownBlocks(world);
  assert(
    index >= 0 && index < blocks.length,
    `expected block index ${index}, got ${blocks.length} block(s)`
  );
  return blocks[index];
}

Given("limited markdown source is:", function (source) {
  this.markdownSource = source;
});

Given("macro-encoded limited markdown source is {string}", function (encoded) {
  this.markdownSource = expandMarkdownMacros(encoded);
});

When("I render limited markdown", function () {
  renderLimitedMarkdown(this.markdownTarget, this.markdownSource);
});

Then("limited markdown block count should be {int}", function (count) {
  assert.strictEqual(markdownBlocks(this).length, count);
});

Then("limited markdown block at index {int} tag should be {string}", function (index, tag) {
  assert.strictEqual(markdownBlockAt(this, index).tagName, tag);
});

Then("limited markdown block at index {int} text should be {string}", function (index, text) {
  assert.strictEqual(markdownBlockAt(this, index).textContent, text);
});

Then(
  "limited markdown block at index {int} should contain element {string} with text {string}",
  function (index, tag, text) {
    const block = markdownBlockAt(this, index);
    const matches = [...block.querySelectorAll(tag)].filter(
      (el) => el.textContent === text
    );
    assert(
      matches.length >= 1,
      `expected ${tag} with text "${text}" under block ${index}, got: ${block.innerHTML}`
    );
  }
);

Then(
  "limited markdown block at index {int} should contain link {string} with href {string}",
  function (index, label, href) {
    const block = markdownBlockAt(this, index);
    const links = [...block.querySelectorAll("a")].filter(
      (a) => a.textContent === label && a.getAttribute("href") === href
    );
    assert(
      links.length >= 1,
      `expected link "${label}" -> "${href}" under block ${index}, got: ${block.innerHTML}`
    );
  }
);

Then(
  "limited markdown list item texts at block index {int} should be {string}",
  function (index, expectedCsv) {
    const block = markdownBlockAt(this, index);
    const texts = [...block.querySelectorAll(":scope > li")].map((li) => li.textContent);
    assert.strictEqual(texts.join(", "), expectedCsv);
  }
);

Then(
  "limited markdown task checkbox states at block index {int} should be {string}",
  function (index, expectedCsv) {
    const block = markdownBlockAt(this, index);
    const states = [...block.querySelectorAll(":scope > li input[type=checkbox]")].map((cb) =>
      String(cb.checked)
    );
    assert.strictEqual(states.join(", "), expectedCsv);
  }
);

Then("limited markdown code block text at block index {int} should be:", function (index, expected) {
  const block = markdownBlockAt(this, index);
  const code = block.querySelector("code");
  assert(code, `expected code element in block ${index}`);
  assert.strictEqual(code.textContent, expected);
});

Then("limited markdown table header texts should be {string}", function (expectedCsv) {
  const table = markdownBlockAt(this, 0);
  assert.strictEqual(table.tagName, "TABLE");
  const texts = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
  assert.strictEqual(texts.join(", "), expectedCsv);
});

Then(
  "limited markdown table body cell at row {int} column {int} text should be {string}",
  function (row, column, text) {
    const table = markdownBlockAt(this, 0);
    const tr = table.querySelectorAll("tbody tr")[row];
    assert(tr, `expected table body row ${row}`);
    const cell = tr.querySelectorAll("td")[column];
    assert(cell, `expected table body cell row ${row} column ${column}`);
    assert.strictEqual(cell.textContent, text);
  }
);

Then(
  "limited markdown table body cell at row {int} column {int} should contain element {string} with text {string}",
  function (row, column, tag, text) {
    const table = markdownBlockAt(this, 0);
    const tr = table.querySelectorAll("tbody tr")[row];
    assert(tr, `expected table body row ${row}`);
    const cell = tr.querySelectorAll("td")[column];
    assert(cell, `expected table body cell row ${row} column ${column}`);
    const matches = [...cell.querySelectorAll(tag)].filter((el) => el.textContent === text);
    assert(
      matches.length >= 1,
      `expected ${tag} with text "${text}" in cell row ${row} column ${column}, got: ${cell.innerHTML}`
    );
  }
);

Then("limited markdown table column {int} alignment should be {string}", function (column, align) {
  const table = markdownBlockAt(this, 0);
  const th = table.querySelectorAll("thead th")[column];
  assert(th, `expected table header column ${column}`);
  assert.strictEqual(th.style.textAlign, align);
});

Given("limited markdown task toggle source is:", function (source) {
  this.markdownTaskToggleSource = source;
});

When("I toggle limited markdown task line {int}", function (lineIndex) {
  this.markdownTaskToggleResult = toggleMarkdownTaskLine(
    this.markdownTaskToggleSource,
    lineIndex
  );
});

Then(
  "limited markdown task toggle result line {int} should be {string}",
  function (lineIndex, expected) {
    const lines = this.markdownTaskToggleResult.split("\n");
    assert(
      lineIndex >= 0 && lineIndex < lines.length,
      `expected line index ${lineIndex}, got ${lines.length} line(s)`
    );
    assert.strictEqual(lines[lineIndex], expected);
  }
);
