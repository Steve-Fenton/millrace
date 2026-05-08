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
