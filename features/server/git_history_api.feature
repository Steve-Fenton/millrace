Feature: Git history API with a repository
  Commit lists for board definitions and cards when the data root is a Git working tree.

  Scenario: board definition git history returns commits
    Given the Millrace integration server has profile "flow-board" with git history
    When I fetch JSON from "/api/board-definition/git-history?boardSlug=test&limit=10"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean true
    And the last JSON field "path" should contain "tasks/test.ini"
    And the last JSON field "commits" should have array length at least 2

  Scenario: board definition git history falls back to first catalog board for unknown slug
    Given the Millrace integration server has profile "flow-board" with git history
    When I fetch JSON from "/api/board-definition/git-history?boardSlug=does-not-exist"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean true
    And the last JSON field "path" should contain "tasks/test.ini"

  Scenario: card git history returns commits when the card is tracked
    Given the Millrace integration server has profile "with-open-card" with git history
    When I fetch JSON from "/api/card/git-history?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini&limit=5"
    Then the response status should be 200
    And the last JSON field "gitAvailable" should be boolean true
    And the last JSON field "path" should contain "tasks/test/"

  Scenario: card git history returns 400 for invalid query
    Given the Millrace integration server has profile "with-open-card" with git history
    When I fetch JSON from "/api/card/git-history?boardSlug=test&columnIndex=0&filename=FLOW-fix-open.ini"
    Then the response status should be 400

  Scenario: card git history returns 404 when the card is missing
    Given the Millrace integration server has profile "with-open-card" with git history
    When I fetch JSON from "/api/card/git-history?boardSlug=test&columnIndex=1&filename=FLOW-missing.ini"
    Then the response status should be 404
