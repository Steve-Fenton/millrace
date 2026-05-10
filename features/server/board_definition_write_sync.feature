Feature: Board definition sync writes back to task INIs
  When the column titles or counts change on save, existing card INIs are rewritten
  so they continue to resolve to the right column / swimlane.

  Scenario: Renaming a column rewrites existing card column references
    Given the Millrace integration server has profile "with-open-card"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Integration Test Board\nslug = test\n\n[columns.1]\ntitle = Backlog\n\n[columns.2]\ntitle = Done\nis_done = true\n"
      }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "column" should be "Backlog"

  Scenario: Renaming a middle column maps stored titles to the new name at the same index
    Given the Millrace integration server has profile "with-in-progress-card"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Integration Test Board\nslug = test\n\n[columns.1]\ntitle = To Do\n\n[columns.2]\ntitle = Doing\n\n[columns.3]\ntitle = Done\nis_done = true\n"
      }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=2&filename=FLOW-in-progress.ini"
    Then the response status should be 200
    And the last JSON field "column" should be "Doing"

  Scenario: Adding a swimlane rewrites cards to match
    Given the Millrace integration server has profile "with-open-card"
    When I send a PUT request to "/api/board-definition" with JSON body:
      """
      {
        "boardSlug": "test",
        "text": "[board]\nname = Integration Test Board\nslug = test\n\n[columns.1]\ntitle = To Do\n\n[columns.2]\ntitle = Done\nis_done = true\n\n[swimlanes.1]\ntitle = Default\n"
      }
      """
    Then the response status should be 200
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "swimlane" should be "Default"
