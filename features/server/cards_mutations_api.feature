Feature: Card mutations API
  Create, update, delete, move, and reorder cards through the REST routes.

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

  Scenario: POST cards rejects empty title
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "title": "  "
      }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Title"

  Scenario: POST cards rejects invalid column index
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 0,
        "swimlaneIndex": 0,
        "title": "Anything"
      }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "column"

  Scenario: POST cards/move rejects invalid filename
    Given the Millrace integration server has profile "with-open-card"
    When I send a POST request to "/api/cards/move" with JSON body:
      """
      {
        "boardSlug": "test",
        "filename": "not-a-card.txt",
        "fromColumnIndex": 1,
        "toColumnIndex": 2
      }
      """
    Then the response status should be 400

  Scenario: POST cards/move returns 404 for missing card
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards/move" with JSON body:
      """
      {
        "boardSlug": "test",
        "filename": "FLOW-missing.ini",
        "fromColumnIndex": 1,
        "toColumnIndex": 2,
        "swimlaneIndex": 0
      }
      """
    Then the response status should be 404

  Scenario: POST cards/move marks closed when moving to a Done column
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
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=2&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "closed" should be ISO 8601

  Scenario: POST cards/move clears closed when moving back from Done
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
    When I send a POST request to "/api/cards/move" with JSON body:
      """
      {
        "boardSlug": "test",
        "filename": "FLOW-fix-open.ini",
        "fromColumnIndex": 2,
        "toColumnIndex": 1,
        "swimlaneIndex": 0
      }
      """
    Then the response status should be 200
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "closed" should be empty or missing

  Scenario: POST cards/reorder rejects empty filenames array
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/cards/reorder" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "filenames": []
      }
      """
    Then the response status should be 400

  Scenario: POST cards/reorder rejects duplicate filenames
    Given the Millrace integration server has profile "two-open-cards"
    When I send a POST request to "/api/cards/reorder" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "filenames": ["FLOW-fix-open.ini", "FLOW-fix-open.ini"]
      }
      """
    Then the response status should be 400

  Scenario: POST cards/reorder rejects mismatched column membership
    Given the Millrace integration server has profile "with-open-card"
    When I send a POST request to "/api/cards/reorder" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "filenames": ["FLOW-fix-open.ini", "FLOW-other.ini"]
      }
      """
    Then the response status should be 400

  Scenario: PUT card rejects invalid filename
    Given the Millrace integration server has profile "with-open-card"
    When I send a PUT request to "/api/card" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "filename": "not-a-card.txt",
        "title": "Renamed",
        "description": "",
        "owner": ""
      }
      """
    Then the response status should be 400

  Scenario: PUT card returns 404 for missing card
    Given the Millrace integration server has profile "flow-board"
    When I send a PUT request to "/api/card" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "filename": "FLOW-missing.ini",
        "title": "Renamed",
        "description": "",
        "owner": ""
      }
      """
    Then the response status should be 404

  Scenario: DELETE card returns 400 on invalid filename
    Given the Millrace integration server has profile "flow-board"
    When I send a DELETE request to "/api/card?boardSlug=test&columnIndex=1&filename=oops.txt"
    Then the response status should be 400

  Scenario: DELETE card returns 404 when missing
    Given the Millrace integration server has profile "flow-board"
    When I send a DELETE request to "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-missing.ini"
    Then the response status should be 404

  Scenario: GET column cards finds a legacy column-folder card
    Given the Millrace integration server has profile "with-legacy-column-card"
    When I fetch JSON from "/api/column-cards?boardSlug=test&columnIndex=1"
    Then the response status should be 200
    And the last JSON field "cards" should be a non-empty array

  Scenario: GET card resolves a legacy column-folder card
    Given the Millrace integration server has profile "with-legacy-column-card"
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-legacy-1.ini"
    Then the response status should be 200
    And the last JSON field "title" should be "Open Fixture Card"

  Scenario: POST cards rejects an inactive board user as owner
    Given the Millrace integration server has profile "with-board-users"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "title": "Inactive owner",
        "owner": "removed@example.com"
      }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "inactive"

  Scenario: PUT card rejects assigning a different inactive board user
    Given the Millrace integration server has profile "with-board-users"
    When I send a POST request to "/api/cards" with JSON body:
      """
      {
        "boardSlug": "test",
        "columnIndex": 1,
        "swimlaneIndex": 0,
        "title": "Owned card",
        "owner": "active@example.com"
      }
      """
    Then the response status should be 200
    When I remember the last response card filename as the test card
    And I put the test card in column 1 with title "Re-owned" and owner "removed@example.com"
    Then the response status should be 400
    And the last JSON field "message" should contain "inactive"
