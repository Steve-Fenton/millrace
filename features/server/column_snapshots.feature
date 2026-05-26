Feature: Column count snapshots in board snapshots.json
  Capture today's open card counts per column (excluding done) into each board's snapshots.json.

  Scenario: captureTodayColumnSnapshots writes one board key with today's snapshot counts
    Given a millrace data root with a test board and open cards for snapshots
    And the millrace snapshot layout exists
    When I capture today's column snapshots
    Then the test board snapshots.json should include today's snapshot counts

  Scenario: captureTodayColumnSnapshots omits done columns from snapshots
    Given a millrace data root with a test board and open cards for snapshots
    And the millrace snapshot layout exists
    When I capture today's column snapshots
    Then today's test board snapshot should not include a done column

  Scenario: captureTodayColumnSnapshots replaces today's snapshot when run again
    Given a millrace data root with a test board and open cards for snapshots
    And the millrace snapshot layout exists
    And today's column snapshots have already been captured once
    When I capture today's column snapshots again
    Then the test board should have only one snapshot for today
