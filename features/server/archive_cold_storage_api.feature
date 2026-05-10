Feature: Archive and cold-storage in completed cards API
  Completed-cards lists archive paths and, with `deep=1`, walks cold-storage folders.

  Scenario: archived cards show up in completed-cards
    Given the Millrace integration server has profile "with-archive-card"
    When I fetch JSON from "/api/completed-cards?boardSlug=test&page=1&limit=20"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1
    And the last JSON field "legacySwimlaneFilters" should be an empty array
    And the first completed card title should be "Archived Card"

  Scenario: completed-cards lists legacy swimlane strings from archived cards
    Given the Millrace integration server has profile "with-archive-legacy-swimlane"
    When I fetch JSON from "/api/completed-cards?boardSlug=test&page=1&limit=20"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1
    And the last JSON field "legacySwimlaneFilters" should deeply equal JSON:
      """
      ["Gamma Lane"]
      """

  Scenario: lane filter matches archived swimlane by raw string
    Given the Millrace integration server has profile "with-archive-legacy-swimlane"
    When I fetch JSON from "/api/completed-cards?boardSlug=test&lane=Gamma%20Lane"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1
    When I fetch JSON from "/api/completed-cards?boardSlug=test&lane=Alpha"
    Then the response status should be 200
    And the last JSON field "total" should equal number 0

  Scenario: cold-storage cards appear only with deep=1
    Given the Millrace integration server has profile "with-cold-storage-card"
    When I fetch JSON from "/api/completed-cards?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "total" should equal number 0
    When I fetch JSON from "/api/completed-cards?boardSlug=test&deep=1"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1
    And the first completed card title should be "Cold Storage Card"

  Scenario: cycle-time scatter ignores cold storage
    Given the Millrace integration server has profile "with-cold-storage-card"
    When I fetch JSON from "/api/cycle-time-scatter?boardSlug=test&granularity=daily"
    Then the response status should be 200
    And the last JSON field "count" should equal number 0

  Scenario: completion-buckets ignores cold storage
    Given the Millrace integration server has profile "with-cold-storage-card"
    When I fetch JSON from "/api/completion-buckets?boardSlug=test&granularity=daily"
    Then the response status should be 200
    And the last JSON field "buckets" should be an empty array
