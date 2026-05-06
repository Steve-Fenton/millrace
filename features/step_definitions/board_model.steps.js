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
} from "../../assets/js/boardModel.js";

Given("the ownerDisplayLabel input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmOwnerEmail = o.ownerEmail;
  this.bmUsers = o.users;
});

When("I run ownerDisplayLabel from boardModel", function () {
  this.bmStringResult = ownerDisplayLabel(this.bmOwnerEmail, this.bmUsers);
});

Given("the board users array JSON is:", function (docString) {
  this.bmUsers = JSON.parse(docString.trim());
});

When("I run boardUsersSortedForUi from boardModel", function () {
  this.bmArrayResult = boardUsersSortedForUi(this.bmUsers);
});

When("I run boardActiveUsersSortedForUi from boardModel", function () {
  this.bmArrayResult = boardActiveUsersSortedForUi(this.bmUsers);
});

When("I run boardOwnerEmailsForFilter from boardModel", function () {
  this.bmArrayResult = boardOwnerEmailsForFilter(this.bmUsers);
});

Given("the boardUserEntryForEmail input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmUsers = o.users;
  this.bmEmail = o.email;
});

When("I run boardUserEntryForEmail from boardModel", function () {
  this.bmEntryResult = boardUserEntryForEmail(this.bmUsers, this.bmEmail);
});

Given("the canAssignCardOwner input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmOwnerEmail = o.ownerEmail;
  this.bmUsers = o.users;
  this.bmPreviousOwner = o.previousOwnerEmail;
});

When("I run canAssignCardOwner from boardModel", function () {
  this.bmBoolResult = canAssignCardOwner(
    this.bmOwnerEmail,
    this.bmUsers,
    this.bmPreviousOwner
  );
});

Given("the sections object JSON for sectionsToBoardModel is:", function (docString) {
  this.bmSections = JSON.parse(docString.trim());
});

When("I convert sections with sectionsToBoardModel", function () {
  this.bmModel = sectionsToBoardModel(this.bmSections);
});

Given("the board INI text for parseBoardIni is:", function (docString) {
  this.bmIniText = docString;
});

When("I parse board INI with parseBoardIni", function () {
  this.bmModel = parseBoardIni(this.bmIniText);
});

Given("the userPreferenceSyncModeIsAutomatic input JSON is:", function (docString) {
  const o = JSON.parse(docString.trim());
  this.bmSyncMode = Object.prototype.hasOwnProperty.call(o, "syncMode")
    ? o.syncMode
    : undefined;
});

When("I run userPreferenceSyncModeIsAutomatic from boardModel", function () {
  this.bmBoolResult = userPreferenceSyncModeIsAutomatic(this.bmSyncMode);
});

Given("the validateExactlyOneDoneColumn model JSON is:", function (docString) {
  this.bmModel = JSON.parse(docString.trim());
});

When("I run validateExactlyOneDoneColumn from boardModel", function () {
  this.bmValidationMessage = validateExactlyOneDoneColumn(this.bmModel);
});

Then("the boardModel single-line result should be:", function (docString) {
  assert.strictEqual(this.bmStringResult, docString.trim());
});

Then("the boardModel array result JSON should be:", function (docString) {
  assert.deepStrictEqual(this.bmArrayResult, JSON.parse(docString.trim()));
});

Then("the boardModel entry JSON should be:", function (docString) {
  const expected = JSON.parse(docString.trim());
  assert.deepStrictEqual(this.bmEntryResult, expected);
});

Then("the boardModel entry should be undefined", function () {
  assert.strictEqual(this.bmEntryResult, undefined);
});

Then("the boardModel boolean result is {string}", function (value) {
  assert.strictEqual(this.bmBoolResult, value === "true");
});

Then("the boardModel output JSON should be:", function (docString) {
  assert.deepStrictEqual(this.bmModel, JSON.parse(docString.trim()));
});

Then("the validation message should be null", function () {
  assert.strictEqual(this.bmValidationMessage, null);
});

Then("the validation message should be:", function (docString) {
  assert.strictEqual(this.bmValidationMessage, docString.trim());
});
