Feature: archiveAnalytics utilities
  Pure helpers for completed-card analytics: timestamp parsing, bucket starts,
  median / sample standard deviation, swimlane filter resolution, and search match.

  Scenario: parseIsoMs returns null for blank input
    When I call parseIsoMs with ""
    Then the parsed ISO ms should be null

  Scenario: parseIsoMs returns null for whitespace
    When I call parseIsoMs with "   "
    Then the parsed ISO ms should be null

  Scenario: parseIsoMs returns null for unparseable input
    When I call parseIsoMs with "not-a-date"
    Then the parsed ISO ms should be null

  Scenario: parseIsoMs returns ms epoch for ISO string
    When I call parseIsoMs with "2024-01-02T03:04:05.000Z"
    Then the parsed ISO ms should equal 1704164645000

  Scenario: utcDayBucketMs floors to UTC midnight
    When I call utcDayBucketMs with 1704164645000
    Then the bucket ms should equal 1704153600000

  Scenario: utcMonthBucketMs floors to first of month UTC
    When I call utcMonthBucketMs with 1704164645000
    Then the bucket ms should equal 1704067200000

  Scenario: utcWeekBucketStartMs aligns Sunday to previous Monday
    When I call utcWeekBucketStartMs for ISO "2024-03-03T18:00:00.000Z"
    Then the bucket ms should equal the parsed ms of "2024-02-26T00:00:00.000Z"

  Scenario: utcWeekBucketStartMs keeps Monday at start of day
    When I call utcWeekBucketStartMs for ISO "2024-03-04T09:00:00.000Z"
    Then the bucket ms should equal the parsed ms of "2024-03-04T00:00:00.000Z"

  Scenario: utcWeekBucketStartMs aligns mid-week Wednesday backwards
    When I call utcWeekBucketStartMs for ISO "2024-03-06T09:00:00.000Z"
    Then the bucket ms should equal the parsed ms of "2024-03-04T00:00:00.000Z"

  Scenario: bucketStartMsForGranularity defaults to daily
    When I call bucketStartMsForGranularity with granularity "daily" and ISO "2024-01-02T12:34:56.000Z"
    Then the bucket ms should equal the parsed ms of "2024-01-02T00:00:00.000Z"

  Scenario: bucketStartMsForGranularity supports weekly
    When I call bucketStartMsForGranularity with granularity "weekly" and ISO "2024-03-06T09:00:00.000Z"
    Then the bucket ms should equal the parsed ms of "2024-03-04T00:00:00.000Z"

  Scenario: bucketStartMsForGranularity supports monthly
    When I call bucketStartMsForGranularity with granularity "monthly" and ISO "2024-03-06T09:00:00.000Z"
    Then the bucket ms should equal the parsed ms of "2024-03-01T00:00:00.000Z"

  Scenario: medianSample returns null for empty array
    When I call medianSample with values JSON:
      """
      []
      """
    Then the median should be null

  Scenario: medianSample of one number
    When I call medianSample with values JSON:
      """
      [7]
      """
    Then the median should equal 7

  Scenario: medianSample of odd-length array picks middle
    When I call medianSample with values JSON:
      """
      [5, 1, 9, 3, 7]
      """
    Then the median should equal 5

  Scenario: medianSample of even-length array averages middle pair
    When I call medianSample with values JSON:
      """
      [4, 8, 2, 6]
      """
    Then the median should equal 5

  Scenario: sampleStdDev returns null for fewer than two samples
    When I call sampleStdDev with values JSON:
      """
      [42]
      """
    Then the stdDev should be null

  Scenario: sampleStdDev computes sample standard deviation
    When I call sampleStdDev with values JSON:
      """
      [2, 4, 4, 4, 5, 5, 7, 9]
      """
    Then the stdDev should be approximately 2.138 within 0.01

  Scenario: completedRowMatchesSearch is true for empty query
    When I check completedRowMatchesSearch with query "" and row JSON:
      """
      { "title": "X" }
      """
    Then the search match should be true

  Scenario: completedRowMatchesSearch matches title
    When I check completedRowMatchesSearch with query "fix" and row JSON:
      """
      { "title": "Fix the bug", "owner": "" }
      """
    Then the search match should be true

  Scenario: completedRowMatchesSearch matches link text
    When I check completedRowMatchesSearch with query "issue" and row JSON:
      """
      { "title": "T", "links": [ { "text": "tracking issue", "url": "https://x" } ] }
      """
    Then the search match should be true

  Scenario: completedRowMatchesSearch ignores non-object link entries
    When I check completedRowMatchesSearch with query "foo" and row JSON:
      """
      { "title": "T", "links": ["raw-string"] }
      """
    Then the search match should be false

  Scenario: completedRowMatchesSearch returns false for non-match
    When I check completedRowMatchesSearch with query "zzz" and row JSON:
      """
      { "title": "Hello", "owner": "x@y", "id": "FLOW-1" }
      """
    Then the search match should be false

  Scenario: resolveCompletedLaneFilterIndices returns null for blank input
    When I call resolveCompletedLaneFilterIndices with lane "" and swimlanes JSON:
      """
      [ { "index": 1, "title": "Default" } ]
      """
    Then the resolved lane filter should be null

  Scenario: resolveCompletedLaneFilterIndices returns null when board has no swimlanes
    When I call resolveCompletedLaneFilterIndices with lane "1" and swimlanes JSON:
      """
      []
      """
    Then the resolved lane filter should be null

  Scenario: resolveCompletedLaneFilterIndices matches by title (case-insensitive)
    When I call resolveCompletedLaneFilterIndices with lane "Default" and swimlanes JSON:
      """
      [ { "index": 1, "title": "default" }, { "index": 2, "title": "Other" } ]
      """
    Then the resolved lane filter should contain index 1

  Scenario: resolveCompletedLaneFilterIndices matches swimlanes.N key
    When I call resolveCompletedLaneFilterIndices with lane "swimlanes.2" and swimlanes JSON:
      """
      [ { "index": 1, "title": "A" }, { "index": 2, "title": "B" } ]
      """
    Then the resolved lane filter should contain index 2

  Scenario: resolveCompletedLaneFilterIndices accepts a numeric string
    When I call resolveCompletedLaneFilterIndices with lane "2" and swimlanes JSON:
      """
      [ { "index": 1, "title": "A" }, { "index": 2, "title": "B" } ]
      """
    Then the resolved lane filter should contain index 2

  Scenario: resolveCompletedLaneFilterIndices returns null for unknown lane
    When I call resolveCompletedLaneFilterIndices with lane "missing" and swimlanes JSON:
      """
      [ { "index": 1, "title": "A" } ]
      """
    Then the resolved lane filter should be null
