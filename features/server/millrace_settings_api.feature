Feature: Millrace catalog settings API
  Admin settings stored in `tasks/.millrace.ini` under `[millrace]`.

  Scenario: GET /api/millrace-settings returns admin email from catalog INI
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = admin@example.com
      """
    And an Express app with flow routes registered
    When I request GET "/api/millrace-settings"
    Then the flow API response status should be 200
    And the flow API JSON field "admin" should be:
      """
      admin@example.com
      """

  Scenario: PATCH /api/millrace-settings writes admin email to catalog INI
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      """
    And an Express app with flow routes registered
    When I PATCH "/api/millrace-settings" with JSON:
      """
      { "admin": "ops@example.com" }
      """
    Then the flow API response status should be 200
    And the millrace catalog INI should contain "admin_email = ops@example.com"

  Scenario: PATCH /api/millrace-settings rejects invalid email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      """
    And an Express app with flow routes registered
    When I PATCH "/api/millrace-settings" with JSON:
      """
      { "admin": "not-an-email" }
      """
    Then the flow API response status should be 400
