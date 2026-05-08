Feature: Card mutations
  Create, update, delete, move, and reorder cards via the HTTP API.

  Scenario: POST creates a card under the board folder
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "title": "Created via API"
      }
      """
    Then the response status should be 200
    And the last JSON field "path" should contain "tasks/test/"
    And the last JSON field "path" should contain ".ini"

  Scenario: create then read update and delete the same card
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "title": "Lifecycle card"
      }
      """
    Then the response status should be 200
    When I remember the last response card filename as the test card
    When I fetch the test card from column 1
    Then the response status should be 200
    And the last JSON field "title" should be "Lifecycle card"
    When I put the test card in column 1 with title "Renamed" and empty owner
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch the test card from column 1
    Then the last JSON field "title" should be "Renamed"
    When I delete the test card from column 1
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch the test card from column 1
    Then the response status should be 404

  Scenario: POST move shifts card to another column
    Given the Millrace integration server has profile "with-open-card"
    When I send a POST request to "/api/cards/move" with JSON body:
      """
      {
        "boardSlug": "test",
        "filename": "FLOW-fix-open.ini",
        "fromColumnIndex": 1,
        "toColumnIndex": 2,
        "swimlaneIndex": 0
      }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: POST reorder swaps order within a column
    Given the Millrace integration server has profile "two-open-cards"
    When I send a POST request to "/api/cards/reorder" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "filenames": ["FLOW-fix-open-2.ini", "FLOW-fix-open.ini"]
      }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch JSON from "/api/column-cards?boardSlug=test&columnIndex=1"
    Then the response status should be 200
    And the first card in "cards" should have title "Second Open Card"
