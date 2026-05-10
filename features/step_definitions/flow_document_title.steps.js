import assert from "node:assert";
import {
  Before,
  BeforeAll,
  Given,
  When,
  Then,
} from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import { setFlowDocumentTitle } from "../../assets/js/ui/documentTitle.js";

BeforeAll(function () {
  const dom = new JSDOM(
    "<!DOCTYPE html><html><head><title></title></head><body></body></html>"
  );
  globalThis.document = dom.window.document;
});

Before({ tags: "@document_title" }, function () {
  document.title = "";
});

Given("the document title is cleared", function () {
  document.title = "";
});

When(
  "I set the flow document title to page {string} with board {string}",
  function (page, board) {
    setFlowDocumentTitle(page, board);
  }
);

When(
  "I set the flow document title to page {string} without a board",
  function (page) {
    setFlowDocumentTitle(page);
  }
);

When("I set the flow document title to empty page without a board", function () {
  setFlowDocumentTitle("");
});

When(
  "I set the flow document title with undefined page label without a board",
  function () {
    setFlowDocumentTitle(undefined);
  }
);

Then("the document title should be {string}", function (expected) {
  assert.strictEqual(document.title, expected);
});
