Feature: Aggregate board API
  Aggregate boards combine tasks from selected source boards without their own task folder.

  Scenario: POST creates an aggregate board without a task folder
    Given the Millrace integration server has profile "two-boards"
    When I send a POST request to "/api/board" with JSON body:
      """
      { "name": "Combined", "kind": "aggregate", "sources": ["test"] }
      """
    Then the response status should be 200
    And the last JSON field "slug" should be "combined"
    And the last JSON field "kind" should be "aggregate"
    And the tasks directory for slug "combined" should not exist

  Scenario: POST creates an aggregate board with no sources yet
    Given the Millrace integration server has profile "two-boards"
    When I send a POST request to "/api/board" with JSON body:
      """
      { "name": "Empty Aggregate", "kind": "aggregate" }
      """
    Then the response status should be 200
    And the last JSON field "slug" should be "empty-aggregate"
    And the last JSON field "kind" should be "aggregate"

  Scenario: aggregate column cards merge tasks from source boards by column type
    Given the Millrace integration server has profile "aggregate-board"
    When I fetch JSON from "/api/column-cards?boardSlug=all&columnIndex=2"
    Then the response status should be 200
    And the JSON at "cards" should be a non-empty array
    And the first card in "cards" should have title "Todo On Test"
    And the first card in "cards" should have field "sourceBoardSlug" equal to "test"
    When I fetch JSON from "/api/column-cards?boardSlug=all&columnIndex=3"
    Then the response status should be 200
    And the first card in "cards" should have title "Doing On Other"
    And the first card in "cards" should have field "sourceBoardSlug" equal to "other"

  Scenario: aggregate done column includes recently closed cards from sources
    Given the Millrace integration server has profile "aggregate-board"
    When I fetch JSON from "/api/column-cards?boardSlug=all&columnIndex=5"
    Then the response status should be 200
    And the JSON at "cards" should be a non-empty array
    And the first card in "cards" should have title "Done On Test"
    And the first card in "cards" should have field "sourceBoardSlug" equal to "test"

  Scenario: POST cards rejects aggregate boards
    Given the Millrace integration server has profile "aggregate-board"
    When I send a POST request to "/api/cards" with JSON body:
      """
      { "boardSlug": "all", "columnIndex": 2, "title": "Nope" }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "aggregate board"
