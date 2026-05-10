Feature: Flow board catalog API
  `GET /api/flow` returns catalog entries from `tasks/.millrace.ini` under the data root.

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
