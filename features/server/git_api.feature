Feature: Git API surface
  Status and history when no repo exists, sync guards, and route error handling.

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

  Scenario: /api/git/status returns 500 when the repo check throws
    Given an Express app with git routes whose git status check throws
    When I fetch JSON from "/api/git/status"
    Then the response status should be 500
    And the last JSON field "message" should contain "Failed to read git status"

  Scenario: /api/git/sync maps conflicts pipeline result to JSON
    Given an Express app with git routes pretending the data root has git and mocked pipeline "conflicts"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean false
    And the last JSON field "needConflictResolution" should be boolean true

  Scenario: /api/git/sync maps badRequest pipeline result to 400
    Given an Express app with git routes pretending the data root has git and mocked pipeline "bad-request"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 400
    And the last JSON field "message" should be "mock validation"

  Scenario: /api/git/sync maps pullFail pipeline result to 500
    Given an Express app with git routes pretending the data root has git and mocked pipeline "pull-fail"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git pull"

  Scenario: /api/git/sync maps commitFail pipeline result to 500
    Given an Express app with git routes pretending the data root has git and mocked pipeline "commit-fail"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git commit"

  Scenario: /api/git/sync maps pushFail pipeline result to 500
    Given an Express app with git routes pretending the data root has git and mocked pipeline "push-fail"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git push"

  Scenario: /api/git/sync succeeds when the pipeline completes
    Given an Express app with git routes pretending the data root has git and mocked pipeline "success"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: /api/git/sync returns 500 when the serialized runner throws
    Given an Express app with git routes pretending the data root has git and the serialized runner throws
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should be "serialized runner failure"

  Scenario: /api/git/sync returns generic message when the serialized runner throws a non-Error
    Given an Express app with git routes pretending the data root has git and the serialized runner throws a non-Error
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should be "Git sync failed."

  Scenario: default pipeline returns 400 when conflict payloads are sent but nothing is unmerged
    Given an Express app with git routes using default pipeline mocks for "resolution-stale"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/x.ini", "content": "" }] }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "No files are in a conflicted state"

  Scenario: default pipeline returns 400 for an invalid conflict resolution path
    Given an Express app with git routes using default pipeline mocks for "resolution-invalid-path"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/x.ini", "content": "" }] }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Invalid or unsafe path"

  Scenario: default pipeline returns 400 when git cannot map the resolved file path for staging
    Given an Express app with git routes using default pipeline mocks for "resolution-map-git-add-fails"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "" }] }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Could not map path for git add"

  Scenario: default pipeline reports conflicts when files remain unmerged after applying resolutions
    Given an Express app with git routes using default pipeline mocks for "resolution-still-conflicted"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "resolved" }] }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean false
    And the last JSON field "needConflictResolution" should be boolean true

  Scenario: default pipeline maps tasks commit failure after resolutions to 500
    Given an Express app with git routes using default pipeline mocks for "resolution-commit-fails"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "x" }] }
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git commit"

  Scenario: default pipeline maps push failure after resolutions to 500
    Given an Express app with git routes using default pipeline mocks for "resolution-push-fails"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "x" }] }
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git push"

  Scenario: default pipeline continues when both merge commits fail after resolutions
    Given an Express app with git routes using default pipeline mocks for "resolution-both-merge-commits-fail"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "x" }] }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: default pipeline retries merge commit with a message when --no-edit fails
    Given an Express app with git routes using default pipeline mocks for "resolution-merge-msg-fallback"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "x" }] }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: default pipeline completes after applying conflict resolutions
    Given an Express app with git routes using default pipeline mocks for "resolution-full-success"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": "tasks/a.ini", "content": "x" }] }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: default pipeline maps a clean pull failure to 500
    Given an Express app with git routes using default pipeline mocks for "pull-fails-clean"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git pull"

  Scenario: default pipeline maps pull merge conflicts to JSON
    Given an Express app with git routes using default pipeline mocks for "pull-merge-conflicts"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "needConflictResolution" should be boolean true

  Scenario: default pipeline maps unmerged paths after a successful pull to JSON
    Given an Express app with git routes using default pipeline mocks for "post-pull-conflicts"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "needConflictResolution" should be boolean true

  Scenario: default pipeline maps outstanding tasks commit failure on normal sync to 500
    Given an Express app with git routes using default pipeline mocks for "normal-commit-fails"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git commit"

  Scenario: default pipeline maps push failure on normal sync to 500
    Given an Express app with git routes using default pipeline mocks for "normal-push-fails"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "git push"

  Scenario: default pipeline succeeds when pull commit and push complete
    Given an Express app with git routes using default pipeline mocks for "normal-success"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      {}
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true

  Scenario: default pipeline handles conflict entries without a string path
    Given an Express app with git routes using default pipeline mocks for "resolution-invalid-path"
    When I send a POST request to "/api/git/sync" with JSON body:
      """
      { "conflictResolutions": [{ "path": 99, "content": "" }] }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "(empty)"
