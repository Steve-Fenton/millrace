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

  Scenario: local user matches Millrace admin when Mine equals admin email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = owner@example.com
      """
    And local user Mine is "owner@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should match Millrace admin

  Scenario: local user does not match when Mine differs from admin email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = owner@example.com
      """
    And local user Mine is "other@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should not match Millrace admin

  Scenario: local user is a follower when Mine differs from admin email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = owner@example.com
      """
    And local user Mine is "other@example.com"
    When I check whether the local user is a non-owner Millrace follower
    Then the local user should be a non-owner Millrace follower

  Scenario: local user is a follower when Mine is unset
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = owner@example.com
      """
    When I check whether the local user is a non-owner Millrace follower
    Then the local user should be a non-owner Millrace follower
