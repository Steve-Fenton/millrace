import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { boardSlugFrom } from "../../assets/js/html/slug.js";

/** Expand table cell macros (see board_slug.feature). */
function expandSlugMacros(s) {
  return String(s).replaceAll("{SP2}", "  ");
}

/**
 * @param {string} token
 * @returns {{ set: boolean, value: string }}
 */
function parseToken(token) {
  if (token === "__omit__") return { set: false, value: "" };
  if (token === "__empty__") return { set: true, value: "" };
  return { set: true, value: token };
}

Given(
  "board meta with slug token {string} and name token {string}",
  function (slugToken, nameToken) {
    /** @type {{ slug?: string, name?: string }} */
    const meta = {};
    const s = parseToken(expandSlugMacros(slugToken));
    const n = parseToken(expandSlugMacros(nameToken));
    if (s.set) meta.slug = s.value;
    if (n.set) meta.name = n.value;
    this.boardMeta = meta;
  }
);

When("I derive the board slug from meta", function () {
  this.derivedSlug = boardSlugFrom(this.boardMeta);
});

Then("the derived slug should be {string}", function (expected) {
  assert.strictEqual(this.derivedSlug, expected);
});
