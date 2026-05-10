# Does not contact registry.npmjs.org: registerNpmUpdateRoutes uses a mocked runNpmUpdateCheck.

Feature: NPM update check HTTP routes
  `GET /api/npm-update-check` and `POST /api/npm-update-run-cycle` (registry calls mocked in tests).

  Scenario: endpoint returns JSON from the server-side update check
    Given an Express app with mocked npm update check
    When I fetch JSON from "/api/npm-update-check"
    Then the response status should be 200
    And the last JSON response should include updateAvailable true

  Scenario: GET returns 500 when the update check throws
    Given an Express app with npm update routes where runNpmUpdateCheck throws
    When I fetch JSON from "/api/npm-update-check"
    Then the response status should be 500
    And the last JSON field "message" should contain "Could not determine NPM update status"

  Scenario: POST install-sync delegates to the install-then-cycle runner
    Given an Express app with npm update routes tracking cycle and install runners
    When I send a POST request to "/api/npm-update-run-cycle" with JSON body:
      """
      { "mode": "install-sync" }
      """
    Then the response status should be 200
    And the last JSON field "via" should be "install-sync"

  Scenario: POST returns 400 when latestVersion is missing
    Given an Express app with npm update routes tracking cycle and install runners
    When I send a POST request to "/api/npm-update-run-cycle" with JSON body:
      """
      {}
      """
    Then the response status should be 400
    And the last JSON field "message" should contain "Expected JSON body with latestVersion"

  Scenario: POST with latestVersion delegates to the cycle runner with deferCycle
    Given an Express app with npm update routes tracking cycle and install runners
    When I send a POST request to "/api/npm-update-run-cycle" with JSON body:
      """
      { "latestVersion": "2.4.6" }
      """
    Then the response status should be 200
    And the last JSON field "cycleVersion" should be "2.4.6"
    And npm route cycle runner should have received latestVersion "2.4.6"

  Scenario: POST accepts latest_version as an alias for latestVersion
    Given an Express app with npm update routes tracking cycle and install runners
    When I send a POST request to "/api/npm-update-run-cycle" with JSON body:
      """
      { "latest_version": "9.9.9" }
      """
    Then the response status should be 200
    And npm route cycle runner should have received latestVersion "9.9.9"

  Scenario: POST returns 500 when the cycle runner throws
    Given an Express app with npm update routes where runProjectCycleAfterUserConfirm throws
    When I send a POST request to "/api/npm-update-run-cycle" with JSON body:
      """
      { "latestVersion": "1.0.0" }
      """
    Then the response status should be 500
    And the last JSON field "message" should contain "Could not run pnpm update/cycle"

  Scenario: semverIsNewer treats a patch bump as newer
    Then semverIsNewer compares "0.0.2" and "0.0.1" expecting true

  Scenario: semverIsNewer treats equal versions as not newer
    Then semverIsNewer compares "0.0.1" and "0.0.1" expecting false

  Scenario: semverIsNewer treats a minor bump as newer
    Then semverIsNewer compares "0.1.0" and "0.0.9" expecting true
