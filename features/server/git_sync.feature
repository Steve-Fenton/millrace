Feature: /api/git/sync end-to-end
  Drives the sync route against a real bare upstream + local clone — covers the
  pull / commit / push happy path, the `pendingSync` flag, and the conflict
  resolution payload error branch.

  Scenario: git sync with no pending changes succeeds
    Given the Millrace integration server has profile "flow-board" with a git remote
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: git sync commits a pending tasks change and pushes upstream
    Given the Millrace integration server has profile "flow-board" with a git remote
    When I write extra content to the "test" board INI in the clone
    And I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    When I fetch JSON from "/api/git/status"
    Then the last JSON field "gitRepo" should be boolean true

  Scenario: git sync rejects empty conflict resolution payload when nothing is unmerged
    Given the Millrace integration server has profile "flow-board" with a git remote
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {
        "conflictResolutions": [
          { "path": "tasks/test.ini", "content": "x" }
        ]
      }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "No files are in a conflicted state"
