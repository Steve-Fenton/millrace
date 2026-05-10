Feature: /api/npm-update-check

  Scenario: endpoint returns JSON from the server-side update check
    Given an Express app with mocked npm update check
    When I fetch JSON from "/api/npm-update-check"
    Then the response status should be 200
    And the last JSON response should include updateAvailable true

  Scenario: semverIsNewer treats a patch bump as newer
    Then semverIsNewer compares "0.0.2" and "0.0.1" expecting true

  Scenario: semverIsNewer treats equal versions as not newer
    Then semverIsNewer compares "0.0.1" and "0.0.1" expecting false

  Scenario: semverIsNewer treats a minor bump as newer
    Then semverIsNewer compares "0.1.0" and "0.0.9" expecting true
