Feature: Cumulative flow chart data
  Build stacked cumulative flow series from snapshots and closed-card completions.

  Scenario: buildCumulativeFlowStack uses snapshot wip counts and cumulative done
    Given a millrace data root with cumulative flow snapshot and completion fixtures
    When I build the weekly cumulative flow stack for board test
    Then the cumulative flow stack should include cumulative done counts by period

  Scenario: cumulative flow API returns series and buckets
    Given the Millrace integration server has profile "charts"
    And the charts profile has cumulative flow snapshot data
    When I fetch JSON from "/api/cumulative-flow-stack?boardSlug=test&granularity=weekly"
    Then the response status should be 200
    And the last JSON field "series" should have array length at least 2
    And the last JSON field "buckets" should have array length at least 1

  Scenario: aggregate cumulative flow merges source snapshots by column type
    Given a millrace data root with aggregate cumulative flow snapshot fixtures
    When I build the weekly cumulative flow stack for board all-boards
    Then the aggregate cumulative flow stack should sum wip counts by column type
