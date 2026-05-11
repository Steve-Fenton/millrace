@next_action_date_field
Feature: Next action date field
  `createNextActionDateField()` builds the "Next action date" form control used
  by the add-card and edit-card dialogs: a labelled native date input flanked
  by TODAY and CLEAR icon buttons. The input keeps `name="next_action_date"`
  so existing FormData-based callers stay untouched.

  Scenario: builds a labelled date input with today and clear buttons
    When I create a next action date field with initial value ""
    Then the field root should have class "flow-field--next-action-date"
    And the field label text should be "Next action date"
    And the field input should have type "date"
    And the field input should have name "next_action_date"
    And the field today button should have aria-label "Set next action date to today"
    And the field clear button should have aria-label "Clear next action date"
    And the field label "for" should match the input id

  Scenario: input has no spurious value when initial value is empty
    When I create a next action date field with initial value ""
    Then the field input value should be ""
    And the field getValue should be ""

  Scenario: trims whitespace around the initial value
    When I create a next action date field with initial value "  2026-04-01  "
    Then the field input value should be "2026-04-01"
    And the field getValue should be "2026-04-01"

  Scenario: clicking the today button populates today's local YYYY-MM-DD
    When I create a next action date field with initial value ""
    And I click the field today button
    Then the field getValue should equal today's local YYYY-MM-DD
    And the field should have dispatched 1 input event and 1 change event since creation

  Scenario: clicking the clear button empties an existing date
    When I create a next action date field with initial value "2026-05-01"
    And I click the field clear button
    Then the field getValue should be ""
    And the field should have dispatched 1 input event and 1 change event since creation

  Scenario: setValue updates the input and fires input + change events
    When I create a next action date field with initial value ""
    And I call setValue with "2026-12-25"
    Then the field input value should be "2026-12-25"
    And the field getValue should be "2026-12-25"
    And the field should have dispatched 1 input event and 1 change event since creation

  Scenario: setValue trims surrounding whitespace
    When I create a next action date field with initial value ""
    And I call setValue with "  2026-07-04  "
    Then the field input value should be "2026-07-04"
    And the field getValue should be "2026-07-04"
