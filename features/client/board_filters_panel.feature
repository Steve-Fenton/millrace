@board_filters_panel
Feature: Board filters panel
  The board header filter icon expands a row with search controls. Searching
  filters the visible card list by title and related fields.

  Scenario: filter panel starts closed
    Given a board filters panel that starts closed
    Then the board filters panel should be closed
    And the board filters toggle aria-expanded should be "false"

  Scenario: opening the filter panel reveals search controls
    Given a board filters panel that starts closed
    When I open the board filters panel
    Then the board filters panel should be open
    And the board filters toggle aria-expanded should be "true"
    And the board card search input should be visible

  Scenario: searching filters the card list
    Given board filter cards JSON:
      """
      [
        { "title": "Fix login timeout", "owner": "ada@example.com" },
        { "title": "Update docs", "owner": "grace@example.com" },
        { "title": "Login page polish", "owner": "ada@example.com" }
      ]
      """
    And a board filters panel that starts closed
    When I open the board filters panel
    And I search the board filters for "login"
    Then the board filter search query should be "login"
    And the filtered board card titles should be "Fix login timeout,Login page polish"

  Scenario: clearing search restores all cards
    Given board filter cards JSON:
      """
      [
        { "title": "Fix login timeout" },
        { "title": "Update docs" }
      ]
      """
    And a board filters panel that starts closed
    When I open the board filters panel
    And I search the board filters for "login"
    And I clear the board filters search
    Then the board filter search query should be ""
    And the filtered board card titles should be "Fix login timeout,Update docs"

  Scenario: closing the filter panel collapses the row
    Given a board filters panel that starts closed
    When I open the board filters panel
    And I close the board filters panel
    Then the board filters panel should be closed
    And the board filters toggle aria-expanded should be "false"
