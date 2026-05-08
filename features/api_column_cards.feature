Feature: Column cards API
  GET /api/column-cards and the nested tasks URL list cards for a board column.

  Scenario: column cards match between query and path routes
    Given the Millrace integration server has profile "with-open-card"
    When I fetch JSON from "/api/column-cards?boardSlug=test&columnIndex=1"
    Then the response status should be 200
    And the JSON at "cards" should be a non-empty array
    And the first card in "cards" should have title "Open Fixture Card"
    When I store the last JSON response as "columnCardsA"
    When I fetch JSON from "/api/tasks/test/columns/1/cards"
    Then the response status should be 200
    And the last JSON response should equal stored "columnCardsA"

  Scenario: invalid column index returns 400
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/column-cards?boardSlug=test&columnIndex=0"
    Then the response status should be 400
