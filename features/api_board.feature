Feature: Board API
  The /api/board endpoint returns board metadata and INI text from the configured data root.

  Scenario: /api/board returns the requested board from test fixtures
    Given the flow API test data root is prepared
    When I request the board API for slug "test"
    Then the board API response status should be 200
    And the board API response metadata should be:
      """
      {
        "slug": "test",
        "name": "Integration Test Board",
        "file": "test.ini"
      }
      """
    And the board API response text should be:
      """
      [board]
      name = Integration Test Board
      slug = test

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """

  Scenario: /api/board falls back to catalog board for missing slug
    Given the flow API test data root is prepared
    When I request the board API for slug "missing-board"
    Then the board API response status should be 200
    And the board API response metadata should be:
      """
      {
        "slug": "test",
        "name": "Integration Test Board",
        "file": "test.ini"
      }
      """
