Feature: Charts and completed work APIs
  Analytics endpoints driven by closed card fixtures.

  Background:
    Given the Millrace integration server has profile "charts"

  Scenario: completed cards lists the fixture row
    When I fetch JSON from "/api/completed-cards?boardSlug=test&page=1&limit=10"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1
    And the first completed card title should be "Chart Done Card"

  Scenario: completion buckets include the fixture completion
    When I fetch JSON from "/api/completion-buckets?boardSlug=test&granularity=daily"
    Then the response status should be 200
    And the last JSON field "buckets" should have array length at least 1
    And some bucket in the last response should have count at least 1

  Scenario: completion swimlane stack returns series and buckets
    When I fetch JSON from "/api/completion-swimlane-stack?boardSlug=test&granularity=daily"
    Then the response status should be 200
    And the last JSON field "series" should have array length at least 1
    And the last JSON field "buckets" should have array length at least 1

  Scenario: cycle time scatter includes the fixture card
    When I fetch JSON from "/api/cycle-time-scatter?boardSlug=test&granularity=daily"
    Then the response status should be 200
    And the last JSON field "count" should equal number 1
    And the last JSON field "points" should have array length at least 1
