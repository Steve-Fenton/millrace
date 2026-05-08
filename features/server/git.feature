Feature: Git-related API surface
  Status, history without a repo, and sync guard when Git is absent.

  Scenario: git status reports no repository at data root
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/git/status"
    Then the response status should be 200
    And the last JSON field "gitRepo" should be boolean false

  Scenario: board definition git history without repository
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/board-definition/git-history?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean false
    And the last JSON field "commits" should be an empty array

  Scenario: card git history without repository
    Given the Millrace integration server has profile "with-open-card"
    When I fetch JSON from "/api/card/git-history?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean false

  Scenario: git sync rejects missing repository
    Given the Millrace integration server has profile "flow-board"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "No Git repository"
