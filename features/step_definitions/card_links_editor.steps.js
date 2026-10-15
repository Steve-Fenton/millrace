import assert from "node:assert";
import { Before, BeforeAll, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import { createLinksEditor } from "../../assets/js/ui/cardLinks.js";

BeforeAll(function () {
  if (!globalThis.document) {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost:7713/",
    });
    globalThis.document = dom.window.document;
  }
  const win = globalThis.document.defaultView;
  globalThis.window = win;
  globalThis.Event = win.Event;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.HTMLAnchorElement = win.HTMLAnchorElement;
});

Before({ tags: "@card_links_editor" }, function () {
  this.linksEditor = null;
});

When(
  "I create a links editor with initial links:",
  function (dataTable) {
    const links = dataTable.hashes().map((h) => ({
      text: h.text ?? "",
      url: h.url ?? "",
    }));
    this.linksEditor = createLinksEditor(links);
    document.body.append(this.linksEditor.root);
  }
);

When("I create a links editor with empty links", function () {
  this.linksEditor = createLinksEditor([]);
  document.body.append(this.linksEditor.root);
});

When("I click the add link button", function () {
  const addBtn = this.linksEditor.root.querySelector(".flow-add-link");
  assert(addBtn, "add link button not found");
  addBtn.click();
});

Then("the links editor should have {int} row", function (expectedCount) {
  const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
  assert.strictEqual(rows.length, expectedCount);
});

Then(
  "row {int} elements should be in order: url input, open link, text input, remove button",
  function (rowIndex) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    assert(row, `row ${rowIndex} not found`);
    const children = Array.from(row.children);
    assert.strictEqual(children.length, 4, `expected 4 children in row, saw ${children.length}`);
    assert(children[0].classList.contains("flow-link-url"), "child 0 should be flow-link-url");
    assert(children[1].classList.contains("flow-link-open"), "child 1 should be flow-link-open");
    assert(children[2].classList.contains("flow-link-text"), "child 2 should be flow-link-text");
    assert(children[3].classList.contains("flow-link-remove"), "child 3 should be flow-link-remove");
  }
);

Then(
  "row {int} open link should have class {string}",
  function (rowIndex, cls) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert(
      openLink.classList.contains(cls),
      `expected open link to have class "${cls}", got: ${openLink.className}`
    );
  }
);

Then(
  "row {int} open link should not have class {string}",
  function (rowIndex, cls) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert(
      !openLink.classList.contains(cls),
      `expected open link not to have class "${cls}"`
    );
  }
);

Then(
  "row {int} open link should have aria-label {string}",
  function (rowIndex, label) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert.strictEqual(openLink.getAttribute("aria-label"), label);
  }
);

Then(
  "row {int} open link should have target {string}",
  function (rowIndex, target) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert.strictEqual(openLink.getAttribute("target"), target);
  }
);

Then(
  "row {int} open link should have rel {string}",
  function (rowIndex, rel) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert.strictEqual(openLink.getAttribute("rel"), rel);
  }
);

Then(
  "row {int} open link should have href {string}",
  function (rowIndex, expectedHref) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    const actualHref = openLink.getAttribute("href") ?? "";
    const cleanActual = actualHref.replace(/\/$/, "");
    const cleanExpected = expectedHref.replace(/\/$/, "");
    assert.strictEqual(cleanActual, cleanExpected);
  }
);

Then(
  "row {int} open link should not have an href attribute",
  function (rowIndex) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert(
      !openLink.hasAttribute("href"),
      `expected open link to have no href, got: ${openLink.getAttribute("href")}`
    );
  }
);

Then(
  "row {int} open link should have aria-disabled {string}",
  function (rowIndex, val) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert.strictEqual(openLink.getAttribute("aria-disabled"), val);
  }
);

Then(
  "row {int} open link should not have an aria-disabled attribute",
  function (rowIndex) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const openLink = row.querySelector(".flow-link-open");
    assert(openLink, "open link not found");
    assert(!openLink.hasAttribute("aria-disabled"));
  }
);

Then(
  "row {int} open link icon should have class {string}",
  function (rowIndex, cls) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const svg = row.querySelector(".flow-link-open svg");
    assert(svg, "svg inside open link not found");
    assert(svg.classList.contains(cls), `expected svg to have class "${cls}"`);
  }
);

Then(
  "row {int} open link icon should have viewBox {string}",
  function (rowIndex, viewBox) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const svg = row.querySelector(".flow-link-open svg");
    assert(svg, "svg inside open link not found");
    assert.strictEqual(svg.getAttribute("viewBox"), viewBox);
  }
);

Then(
  "row {int} open link icon should have stroke-width {string}",
  function (rowIndex, strokeWidth) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const svg = row.querySelector(".flow-link-open svg");
    assert(svg, "svg inside open link not found");
    assert.strictEqual(svg.getAttribute("stroke-width"), strokeWidth);
  }
);

When(
  "I type {string} into row {int} url input",
  function (text, rowIndex) {
    const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
    const row = rows[rowIndex - 1];
    const urlIn = row.querySelector(".flow-link-url");
    assert(urlIn, "url input not found");
    urlIn.value = text;
    urlIn.dispatchEvent(new Event("input", { bubbles: true }));
  }
);

Then("row {int} url input should be empty", function (rowIndex) {
  const rows = this.linksEditor.root.querySelectorAll(".flow-link-row");
  const row = rows[rowIndex - 1];
  const urlIn = row.querySelector(".flow-link-url");
  assert(urlIn, "url input not found");
  assert.strictEqual(urlIn.value, "");
});

Then("getLinks should return {int} link:", function (expectedCount, dataTable) {
  const links = this.linksEditor.getLinks();
  assert.strictEqual(links.length, expectedCount);
  const expected = dataTable.hashes();
  for (let i = 0; i < expected.length; i++) {
    assert.strictEqual(links[i].text, expected[i].text);
    assert.strictEqual(links[i].url, expected[i].url);
  }
});
