Feature: Charts and completed-work APIs
  Analytics routes backed by closed-card fixtures (aggregates, buckets, scatter, trends).

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

  Scenario: completion buckets default to weekly granularity
    When I fetch JSON from "/api/completion-buckets?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "granularity" should be "weekly"

  Scenario: completion buckets switches to monthly granularity
    When I fetch JSON from "/api/completion-buckets?boardSlug=test&granularity=monthly"
    Then the response status should be 200
    And the last JSON field "granularity" should be "monthly"

  Scenario: completion swimlane stack defaults to weekly
    When I fetch JSON from "/api/completion-swimlane-stack?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "granularity" should be "weekly"

  Scenario: cycle time scatter switches to monthly
    When I fetch JSON from "/api/cycle-time-scatter?boardSlug=test&granularity=monthly"
    Then the response status should be 200
    And the last JSON field "granularity" should be "monthly"

  Scenario: column swimlane stack returns open-card columns and series
    When I fetch JSON from "/api/column-swimlane-stack?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "series" should have array length at least 1
    And the last JSON field "columns" should have array length at least 1
    And the last JSON field "totalOpen" should equal number 2

  Scenario: card age distribution returns bins for open cards
    When I fetch JSON from "/api/card-age-distribution?boardSlug=test"
    Then the response status should be 200
    And the last JSON field "bins" should have array length at least 1
    And the last JSON field "count" should equal number 2

  Scenario: completed cards filters by mine email
    When I fetch JSON from "/api/completed-cards?boardSlug=test&of=mine&me=charts@example.com&page=1&limit=10"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1

  Scenario: completed cards filters by selected owner
    When I fetch JSON from "/api/completed-cards?boardSlug=test&of=owner&pick=charts@example.com&page=1&limit=10"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1

  Scenario: completed cards search matches the fixture title
    When I fetch JSON from "/api/completed-cards?boardSlug=test&q=chart"
    Then the response status should be 200
    And the last JSON field "total" should equal number 1

  Scenario: completed cards search excludes non-matching titles
    When I fetch JSON from "/api/completed-cards?boardSlug=test&q=zzz"
    Then the response status should be 200
    And the last JSON field "total" should equal number 0

  Scenario: completed cards default page=1 when invalid
    When I fetch JSON from "/api/completed-cards?boardSlug=test&page=-3&limit=abc"
    Then the response status should be 200
    And the last JSON field "page" should equal number 1
    And the last JSON field "pageSize" should equal number 50

  Scenario: completed cards caps page size to 100
    When I fetch JSON from "/api/completed-cards?boardSlug=test&limit=999"
    Then the response status should be 200
    And the last JSON field "pageSize" should equal number 100
