Feature: Local user preferences API
  Read and patch `tasks/localuser.ini` through `/api/local-user` routes.

  Scenario: defaults then patch local user fields
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/local-user"
    Then the response status should be 200
    And the last JSON field "owner" should be ""
    And the last JSON field "syncMode" should be "automatic"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      {
        "mine": "mine@example.com",
        "chartsGranularity": "weekly",
        "syncMode": "manual"
      }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    And the last JSON field "mine" should be "mine@example.com"
    And the last JSON field "chartsGranularity" should be "weekly"
    And the last JSON field "syncMode" should be "manual"

  Scenario: patch local user preferences
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "owner": "owner@example.com" }
      """
    Then the response status should be 200
    And the last JSON field "ok" should be boolean true
    And the last JSON field "owner" should be "owner@example.com"

  Scenario: PATCH /api/local-user rejects empty body
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      {}
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Expected JSON"

  Scenario: PATCH /api/local-user rejects unknown syncMode
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "syncMode": "weird" }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "syncMode"

  Scenario: PATCH /api/local-user rejects unknown chartsGranularity
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "chartsGranularity": "yearly" }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "chartsGranularity"

  Scenario: PATCH /api/local-user rejects mine without an @
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "mine": "no-at-sign" }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "email"

  Scenario: PATCH /api/local-user accepts empty mine to clear it
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "mine": "first@example.com" }
      """
    Then the response status should be 200
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "mine": "" }
      """
    Then the response status should be 200
    And the last JSON field "mine" should be ""

  Scenario: PATCH /api/local-user supports snake_case field names
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      {
        "charts_granularity": "monthly",
        "sync_mode": "manual"
      }
      """
    Then the response status should be 200
    And the last JSON field "chartsGranularity" should be "monthly"
    And the last JSON field "syncMode" should be "manual"

  Scenario: PATCH /api/local-user/preferences rejects empty body
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      {}
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user/preferences rejects unknown syncMode
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "syncMode": "weird" }
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user/preferences rejects unknown theme
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "theme": "weird" }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "theme"

  Scenario: PATCH /api/local-user/preferences accepts theme light and dark
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "theme": "light" }
      """
    Then the response status should be 200
    And the last JSON field "theme" should be "light"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "theme": "dark" }
      """
    Then the response status should be 200
    And the last JSON field "theme" should be "dark"

  Scenario: PATCH /api/local-user/preferences rejects mine without an @
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "mine": "no-at" }
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user/preferences rejects owner without an @
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "owner": "no-at" }
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user/preferences accepts empty mine and owner to clear
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "mine": "user@example.com", "owner": "owner@example.com" }
      """
    Then the response status should be 200
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "mine": "", "owner": "" }
      """
    Then the response status should be 200
    And the last JSON field "mine" should be ""
    And the last JSON field "owner" should be ""

  Scenario: GET /api/local-user/preferences returns defaults on a fresh root
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/local-user/preferences"
    Then the response status should be 200
    And the last JSON field "syncMode" should be "automatic"
    And the last JSON field "theme" should be "dark"
    And the last JSON field "mine" should be ""
    And the last JSON field "owner" should be ""
    And the last JSON field "lastAutoGitPull" should be ""
    And the last JSON field "lastNpmUpdateCheck" should be ""

  Scenario: GET /api/local-user/preferences returns flow throttle timestamps
    Given the Millrace integration server has profile "flow-board"
    When I write integration tasks localuser.ini:
      """
      [flow]
      last_auto_git_pull = 2026-01-01T12:00:00.000Z
      last_npm_update_check = 2026-02-02T15:30:00.000Z
      """
    When I fetch JSON from "/api/local-user/preferences"
    Then the last JSON field "lastAutoGitPull" should be "2026-01-01T12:00:00.000Z"
    And the last JSON field "lastNpmUpdateCheck" should be "2026-02-02T15:30:00.000Z"

  Scenario: PATCH /api/local-user/preferences clears flow throttle timestamps
    Given the Millrace integration server has profile "flow-board"
    When I write integration tasks localuser.ini:
      """
      [flow]
      last_auto_git_pull = 2026-01-01T12:00:00.000Z
      last_npm_update_check = 2026-02-02T15:30:00.000Z
      """
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "clearLastAutoGitPull": true, "clearLastNpmUpdateCheck": true }
      """
    Then the response status should be 200
    And the last JSON field "lastAutoGitPull" should be ""
    And the last JSON field "lastNpmUpdateCheck" should be ""

  Scenario: PATCH /api/local-user/preferences accepts snake_case clear flags
    Given the Millrace integration server has profile "flow-board"
    When I write integration tasks localuser.ini:
      """
      [flow]
      last_auto_git_pull = 2026-01-01T12:00:00.000Z
      """
    When I send a PATCH request to "/api/local-user/preferences" with JSON body:
      """
      { "clear_last_auto_git_pull": true }
      """
    Then the response status should be 200
    And the last JSON field "lastAutoGitPull" should be ""

  Scenario: GET /api/local-user reflects camelCase chartsGranularity field
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "chartsGranularity": "monthly" }
      """
    Then the response status should be 200
    When I fetch JSON from "/api/local-user"
    Then the last JSON field "chartsGranularity" should be "monthly"

  Scenario: GET /api/local-user returns empty swimlaneCollapse on a fresh root
    Given the Millrace integration server has profile "flow-board"
    When I fetch JSON from "/api/local-user"
    Then the response status should be 200
    And the last JSON field "swimlaneCollapse" should deeply equal JSON:
      """
      {}
      """

  Scenario: PATCH /api/local-user writes swimlaneCollapse keyed by title
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "project", "laneTitle": "Bugs / UX", "mode": "scroll" } }
      """
    Then the response status should be 200
    And the last JSON field "swimlaneCollapse" should deeply equal JSON:
      """
      { "project": { "Bugs / UX": "scroll" } }
      """
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "project", "laneTitle": "Bugs / UX", "mode": "collapsed" } }
      """
    Then the response status should be 200
    And the last JSON field "swimlaneCollapse" should deeply equal JSON:
      """
      { "project": { "Bugs / UX": "collapsed" } }
      """
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "project", "laneTitle": "Bugs / UX", "mode": "open" } }
      """
    Then the response status should be 200
    And the last JSON field "swimlaneCollapse" should deeply equal JSON:
      """
      {}
      """

  Scenario: PATCH /api/local-user replaces a legacy index entry with a title entry
    Given the Millrace integration server has profile "flow-board"
    When I write integration tasks localuser.ini:
      """
      [swimlanes.project]
      1 = scroll
      """
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "project", "laneTitle": "Bugs / UX", "laneIndex": 1, "mode": "collapsed" } }
      """
    Then the response status should be 200
    And the last JSON field "swimlaneCollapse" should deeply equal JSON:
      """
      { "project": { "Bugs / UX": "collapsed" } }
      """

  Scenario: PATCH /api/local-user rejects swimlaneCollapse with no laneTitle
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "demo", "mode": "scroll" } }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "laneTitle"

  Scenario: PATCH /api/local-user rejects swimlaneCollapse with invalid slug
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "../etc", "laneTitle": "Default", "mode": "scroll" } }
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user rejects swimlaneCollapse with unknown mode
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "demo", "laneTitle": "Default", "mode": "fancy" } }
      """
    Then the response status should be 400

  Scenario: PATCH /api/local-user rejects swimlaneCollapse with unsafe laneTitle
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "demo", "laneTitle": "with = equals", "mode": "scroll" } }
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "laneTitle"

  Scenario: PATCH /api/local-user rejects swimlaneCollapse with negative laneIndex
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "swimlaneCollapse": { "boardSlug": "demo", "laneTitle": "Default", "laneIndex": -1, "mode": "scroll" } }
      """
    Then the response status should be 400
