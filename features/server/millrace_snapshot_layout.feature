Feature: Millrace snapshot layout bootstrap
  On every server start, ensure `tasks/.millrace/` exists and migrate legacy snapshot layout.

  Scenario: creates millrace snapshot folder when tasks folder exists
    Given a tasks directory exists without a Millrace snapshot layout
    When I run the millrace snapshot layout bootstrap
    Then the millrace snapshot folder should exist under tasks

  Scenario: migrates legacy snapshots.json into per-board files
    Given a tasks directory exists with legacy millrace snapshots.json
    When I run the millrace snapshot layout bootstrap
    Then legacy snapshots.json should be removed
    And board demo should have migrated snapshots.json
