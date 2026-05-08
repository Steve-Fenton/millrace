Feature: Git history with repository
  Board definition history when the data root is a Git working tree.

  Scenario: board definition git history returns commits
    Given the Millrace integration server has profile "flow-board" with git history
    When I fetch JSON from "/api/board-definition/git-history?boardSlug=test&limit=10"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean true
    And the last JSON field "path" should contain "tasks/test.ini"
    And the last JSON field "commits" should have array length at least 2
