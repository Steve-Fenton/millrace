Feature: Flow API catalog
  The /api/flow endpoint returns board catalog entries from the configured data root.

  Scenario: /api/flow reads catalog from --data-root test fixtures
    Given the flow API test data root is prepared
    When I request the flow API catalog
    Then the flow API boards JSON should be:
      """
      [
        {
          "file": "test.ini",
          "slug": "test",
          "name": "Integration Test Board"
        }
      ]
      """

  Scenario: /api/flow returns 500 when the board catalog cannot be loaded
    Given an Express app with flow routes that fail loading the catalog
    When I request the flow API catalog
    Then the flow API response status should be 500
    And the flow API JSON field "message" should be:
      """
      Failed to read board catalog (.millrace.ini).
      """
