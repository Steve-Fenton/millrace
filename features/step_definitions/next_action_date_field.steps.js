import assert from "node:assert";
import { Before, BeforeAll, Then, When } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import { createNextActionDateField } from "../../assets/js/ui/nextActionDateField.js";

BeforeAll(function () {
  /** Reuse the dom another step file may have installed so we don't strand
   *  Element/Event constructors captured against a different JSDOM window. */
  if (!globalThis.document) {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
  }
  /** Always re-pin Event/HTMLElement to the active jsdom window. Node 19+
   *  ships a built-in `Event` global that jsdom's dispatchEvent rejects, so we
   *  override it here even when something is already set. */
  const win = globalThis.document.defaultView;
  globalThis.Event = win.Event;
  globalThis.HTMLElement = win.HTMLElement;
});

Before({ tags: "@next_action_date_field" }, function () {
  this.nextActionField = null;
  this.nextActionInputEventCount = 0;
  this.nextActionChangeEventCount = 0;
});

/** Local YYYY-MM-DD copy of the helper's private `todayLocalYmd` for assertion. */
function expectedTodayLocalYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

When(
  "I create a next action date field with initial value {string}",
  function (initial) {
    this.nextActionField = createNextActionDateField(initial);
    document.body.append(this.nextActionField.root);
    this.nextActionInputEventCount = 0;
    this.nextActionChangeEventCount = 0;
    this.nextActionField.input.addEventListener("input", () => {
      this.nextActionInputEventCount += 1;
    });
    this.nextActionField.input.addEventListener("change", () => {
      this.nextActionChangeEventCount += 1;
    });
  }
);

When("I click the field today button", function () {
  const btn = this.nextActionField.root.querySelector(
    ".flow-next-action-date-today"
  );
  assert(btn, "today button missing from field root");
  btn.click();
});

When("I click the field clear button", function () {
  const btn = this.nextActionField.root.querySelector(
    ".flow-next-action-date-clear"
  );
  assert(btn, "clear button missing from field root");
  btn.click();
});

When("I call setValue with {string}", function (value) {
  this.nextActionField.setValue(value);
});

Then("the field root should have class {string}", function (cls) {
  assert(
    this.nextActionField.root.classList.contains(cls),
    `expected field root to have class "${cls}", got: ${this.nextActionField.root.className}`
  );
});

Then("the field label text should be {string}", function (expected) {
  const lab = this.nextActionField.root.querySelector(".flow-field-label");
  assert(lab, "field label missing");
  assert.strictEqual(lab.textContent, expected);
});

Then("the field input should have type {string}", function (type) {
  assert.strictEqual(this.nextActionField.input.getAttribute("type"), type);
});

Then("the field input should have name {string}", function (name) {
  assert.strictEqual(this.nextActionField.input.name, name);
});

Then(
  "the field today button should have aria-label {string}",
  function (label) {
    const btn = this.nextActionField.root.querySelector(
      ".flow-next-action-date-today"
    );
    assert(btn, "today button missing");
    assert.strictEqual(btn.getAttribute("aria-label"), label);
  }
);

Then(
  "the field clear button should have aria-label {string}",
  function (label) {
    const btn = this.nextActionField.root.querySelector(
      ".flow-next-action-date-clear"
    );
    assert(btn, "clear button missing");
    assert.strictEqual(btn.getAttribute("aria-label"), label);
  }
);

Then("the field label \"for\" should match the input id", function () {
  const lab = this.nextActionField.root.querySelector(".flow-field-label");
  assert(lab, "field label missing");
  const forAttr = lab.getAttribute("for");
  assert(forAttr, "label has no `for` attribute");
  assert.strictEqual(this.nextActionField.input.id, forAttr);
});

Then("the field input value should be {string}", function (expected) {
  assert.strictEqual(this.nextActionField.input.value, expected);
});

Then("the field getValue should be {string}", function (expected) {
  assert.strictEqual(this.nextActionField.getValue(), expected);
});

Then("the field getValue should equal today's local YYYY-MM-DD", function () {
  assert.strictEqual(this.nextActionField.getValue(), expectedTodayLocalYmd());
});

Then(
  "the field should have dispatched {int} input event and {int} change event since creation",
  function (expectedInput, expectedChange) {
    assert.strictEqual(
      this.nextActionInputEventCount,
      expectedInput,
      `expected ${expectedInput} input events, saw ${this.nextActionInputEventCount}`
    );
    assert.strictEqual(
      this.nextActionChangeEventCount,
      expectedChange,
      `expected ${expectedChange} change events, saw ${this.nextActionChangeEventCount}`
    );
  }
);
