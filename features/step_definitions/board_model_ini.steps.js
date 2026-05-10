import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import {
  boardActiveUsersSortedForUi,
  boardOwnerEmailsForFilter,
  boardUserEntryForEmail,
  boardUsersSortedForUi,
  canAssignCardOwner,
  ownerDisplayLabel,
  parseBoardIni,
  sectionsToBoardModel,
  userPreferenceSyncModeIsAutomatic,
  validateExactlyOneDoneColumn,
} from "../../assets/js/models/boardModel.js";

Given("owner display label input as JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmOwnerEmail = o.ownerEmail;
  this.bmUsers = o.users;
});

When("I compute the owner display label", function () {
  this.bmStringResult = ownerDisplayLabel(this.bmOwnerEmail, this.bmUsers);
});

Given("the board users list as JSON:", function (docString) {
  this.bmUsers = JSON.parse(docString.trim());
});

When("I sort board users for the UI", function () {
  this.bmArrayResult = boardUsersSortedForUi(this.bmUsers);
});

When("I sort active board users for the UI", function () {
  this.bmArrayResult = boardActiveUsersSortedForUi(this.bmUsers);
});

When("I list owner emails for the owner filter", function () {
  this.bmArrayResult = boardOwnerEmailsForFilter(this.bmUsers);
});

Given("board user lookup input as JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmUsers = o.users;
  this.bmEmail = o.email;
});

When("I look up the board user by email", function () {
  this.bmEntryResult = boardUserEntryForEmail(this.bmUsers, this.bmEmail);
});

Given("card owner assignment input as JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmOwnerEmail = o.ownerEmail;
  this.bmUsers = o.users;
  this.bmPreviousOwner = o.previousOwnerEmail;
});

When("I check whether the owner assignment is allowed", function () {
  this.bmBoolResult = canAssignCardOwner(
    this.bmOwnerEmail,
    this.bmUsers,
    this.bmPreviousOwner
  );
});

Given("INI-shaped sections as JSON:", function (docString) {
  this.bmSections = JSON.parse(docString.trim());
});

When("I convert INI sections to a board model", function () {
  this.bmModel = sectionsToBoardModel(this.bmSections);
});

Given("board definition INI text:", function (docString) {
  this.bmIniText = docString;
});

When("I parse the board definition INI", function () {
  this.bmModel = parseBoardIni(this.bmIniText);
});

Given("user preferences JSON:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmSyncMode = Object.prototype.hasOwnProperty.call(o, "syncMode")
    ? o.syncMode
    : undefined;
});

When("I detect automatic preference sync", function () {
  this.bmBoolResult = userPreferenceSyncModeIsAutomatic(this.bmSyncMode);
});

Given("board model for Done validation as JSON:", function (docString) {
  this.bmModel = JSON.parse(docString.trim());
});

When("I validate exactly one Done column", function () {
  this.bmValidationMessage = validateExactlyOneDoneColumn(this.bmModel);
});

Then("the single-line result should be:", function (docString) {
  assert.strictEqual(this.bmStringResult, docString.trim());
});

Then("the JSON array result should be:", function (docString) {
  assert.deepStrictEqual(this.bmArrayResult, JSON.parse(docString.trim()));
});

Then("the looked-up user JSON should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.bmEntryResult, expected);
});

Then("the looked-up user should be undefined", function () {
  assert.strictEqual(this.bmEntryResult, undefined);
});

Then("the boolean result is {string}", function (value) {
  assert.strictEqual(this.bmBoolResult, value === "true");
});

Then("the board model JSON should be:", function (docString) {
  assert.deepStrictEqual(this.bmModel, JSON.parse(docString.trim()));
});

Then("the validation message should be null", function () {
  assert.strictEqual(this.bmValidationMessage, null);
});

Then("the validation message should be:", function (docString) {
  assert.strictEqual(this.bmValidationMessage, docString.trim());
});
