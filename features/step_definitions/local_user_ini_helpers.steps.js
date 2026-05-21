import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import {
  pendingSyncFromSections,
  serializeLocalUserIniFile,
  syncModeFromPreferencesSection,
  themeFromPreferencesSection,
} from "../../server/localUserIni.js";

When("I serialize sections JSON:", function (doc) {
  const sections = JSON.parse(doc.trim());
  this.serializedIni = serializeLocalUserIniFile(sections);
});

Then("the serialized text should equal:", function (expected) {
  const want = `${expected.trim()}\n`;
  assert.strictEqual(`${this.serializedIni.trim()}\n`, want);
});

Then("the serialized text should be an empty string", function () {
  assert.strictEqual(this.serializedIni, "");
});

When("I read sync mode from preferences JSON:", function (doc) {
  const pref = JSON.parse(doc.trim());
  this.syncMode = syncModeFromPreferencesSection(pref);
});

Then("the sync mode should be {string}", function (expected) {
  assert.strictEqual(this.syncMode, expected);
});

When("I read theme from preferences JSON:", function (doc) {
  const pref = JSON.parse(doc.trim());
  this.theme = themeFromPreferencesSection(pref);
});

Then("the theme should be {string}", function (expected) {
  assert.strictEqual(this.theme, expected);
});

When("I read pendingSync from sections JSON:", function (doc) {
  const sections = JSON.parse(doc.trim());
  this.pendingSync = pendingSyncFromSections(sections);
});

Then("pendingSync should be true", function () {
  assert.strictEqual(this.pendingSync, true);
});

Then("pendingSync should be false", function () {
  assert.strictEqual(this.pendingSync, false);
});
