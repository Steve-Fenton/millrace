import assert from "node:assert";
import { BeforeAll, Given, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import { el } from "../../assets/js/html/element.js";

/** jsdom `Element` for assertions (not on Node's `globalThis`). */
let ElementCtor;

BeforeAll(function () {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  ElementCtor = dom.window.Element;
});

/** Expand macros from html_element_parse.feature */
function expandElementMacros(s) {
  return String(s)
    .replaceAll("{SP4}", "    ")
    .replaceAll("{NL}", "\n")
    .replaceAll("{LT}", "<")
    .replaceAll("{GT}", ">")
    .replaceAll("{QUOT}", '"');
}

Given("macro-encoded html for el is {string}", function (encoded) {
  this.htmlForEl = expandElementMacros(encoded);
});

When("I parse the macro-encoded HTML", function () {
  this.elResult = el(this.htmlForEl);
});

Then("el should return null", function () {
  assert.strictEqual(this.elResult, null);
});

Then("the el result tag name should be {string}", function (tag) {
  assert(ElementCtor, "Element constructor missing — jsdom BeforeAll must run first");
  assert(this.elResult instanceof ElementCtor, "expected an element");
  assert.strictEqual(this.elResult.tagName, tag);
});

Then("the el result text content should be {string}", function (text) {
  assert(this.elResult instanceof ElementCtor);
  assert.strictEqual(this.elResult.textContent, text);
});

Then(
  "the el result attribute {string} should be {string}",
  function (name, value) {
    assert(this.elResult instanceof ElementCtor);
    assert.strictEqual(this.elResult.getAttribute(name), value);
  }
);
