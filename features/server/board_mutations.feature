Feature: Board definition mutations
  POST /api/board, PUT /api/board-definition, DELETE /api/board-definition.

  Scenario: POST creates a new board file and catalog entry
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/board" with JSON body:
      """
      { "name": "From API Board" }
      """
    Then the response status should be 200
    And the last JSON field "slug" should be "from-api-board"
    And the last JSON field "file" should be "from-api-board.ini"

  Scenario: PUT rejects invalid board INI
    Given the Millrace integration server has profile "flow-board"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Bad\nslug = test\n"
      }
      """
    Then the response status should be 400

  Scenario: PUT rejects slug mismatch
    Given the Millrace integration server has profile "flow-board"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Integration Test Board\nslug = other\n\n[columns.1]\ntitle = To Do\n\n[columns.2]\ntitle = Done\nis_done = true\n"
      }
      """
    Then the response status should be 400

  Scenario: PUT saves valid board definition
    Given the Millrace integration server has profile "flow-board"
    When I save the default test board definition unchanged
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: DELETE removes a board when catalog has two entries
    Given the Millrace integration server has profile "two-boards"
    When I send a DELETE request to "/api/board-definition?boardSlug=other"
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch JSON from "/api/flow"
    Then the response status should be 200
    And the last JSON field "boards" should have array length at least 1
    And the first board slug in the last response should be "test"

  Scenario: POST /api/board rejects empty board name
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/board" with JSON body:
      """
      { "name": "  " }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Board name"

  Scenario: PUT board-definition rejects blank text
    Given the Millrace integration server has profile "flow-board"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      { "boardSlug": "test", "text": "   " }
      """
    Then the response status should be 400

  Scenario: PUT board-definition rejects multiple done columns
    Given the Millrace integration server has profile "flow-board"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Integration Test Board\nslug = test\n\n[columns.1]\ntitle = Done\nis_done = true\n\n[columns.2]\ntitle = Also Done\nis_done = true\n"
      }
      """
    Then the response status should be 400

  Scenario: DELETE board-definition refuses the only board in the catalog
    Given the Millrace integration server has profile "flow-board"
    When I send a DELETE request to "/api/board-definition?boardSlug=test"
    Then the response status should be 400
    And the last JSON field "message" should contain "only board"

  Scenario: DELETE board-definition returns 404 for unknown slug
    Given the Millrace integration server has profile "two-boards"
    When I send a DELETE request to "/api/board-definition?boardSlug=ghost"
    Then the response status should be 404
