Feature: Git sync API end-to-end
  Exercises `/api/git/sync` against a bare upstream and local clone: pull/commit/push,
  pending changes, and rejecting conflict payloads when nothing is unmerged.

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
