Feature: Local user API
  Reads and updates tasks/localuser.ini via HTTP.

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
    And the last JSON field "mine" should be ""
    And the last JSON field "owner" should be ""

  Scenario: GET /api/local-user reflects camelCase chartsGranularity field
    Given the Millrace integration server has profile "flow-board"
    When I send a PATCH request to "/api/local-user" with JSON body:
      """
      { "chartsGranularity": "monthly" }
      """
    Then the response status should be 200
    When I fetch JSON from "/api/local-user"
    Then the last JSON field "chartsGranularity" should be "monthly"
