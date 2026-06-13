Feature: Millrace users API
  Users stored in `tasks/.millrace.ini` as `[users.N]` sections.

  Scenario: GET /api/millrace-users returns users from catalog INI
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = alice@example.com
      name = Alice
      admin = true

      [users.2]
      email = bob@example.com
      name = Bob
      active = false
      """
    And an Express app with flow routes registered
    When I request GET "/api/millrace-users"
    Then the flow API response status should be 200
    And the flow API JSON field "users" should equal:
      """
      [
        { "email": "alice@example.com", "name": "Alice", "active": true, "admin": true },
        { "email": "bob@example.com", "name": "Bob", "active": false, "admin": false }
      ]
      """

  Scenario: GET /api/millrace-users returns empty list when catalog has no user sections
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      """
    And an Express app with flow routes registered
    When I request GET "/api/millrace-users"
    Then the flow API response status should be 200
    And the flow API JSON field "users" should equal:
      """
      []
      """

  Scenario: GET /api/millrace-users derives admin from legacy admin_email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = alice@example.com

      [users.1]
      email = alice@example.com
      name = Alice
      """
    And an Express app with flow routes registered
    When I request GET "/api/millrace-users"
    Then the flow API response status should be 200
    And the flow API JSON field "users" should equal:
      """
      [
        { "email": "alice@example.com", "name": "Alice", "active": true, "admin": true }
      ]
      """

  Scenario: PATCH /api/millrace-users writes users to catalog INI
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = legacy@example.com
      """
    And an Express app with flow routes registered
    When I PATCH "/api/millrace-users" with JSON:
      """
      {
        "users": [
          { "email": "ops@example.com", "name": "Ops", "active": true, "admin": true },
          { "email": "old@example.com", "name": "Former", "active": false, "admin": false }
        ]
      }
      """
    Then the flow API response status should be 200
    And the millrace catalog INI should contain "email = ops@example.com"
    And the millrace catalog INI should contain "admin = true"
    And the millrace catalog INI should contain "active = false"
    And the millrace catalog INI should not contain "admin_email ="

  Scenario: PATCH /api/millrace-users rejects duplicate emails
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      """
    And an Express app with flow routes registered
    When I PATCH "/api/millrace-users" with JSON:
      """
      {
        "users": [
          { "email": "a@example.com", "name": "A" },
          { "email": "a@example.com", "name": "A again" }
        ]
      }
      """
    Then the flow API response status should be 400
