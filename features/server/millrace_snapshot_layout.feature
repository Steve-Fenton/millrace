Feature: Millrace snapshot layout bootstrap
  On every server start, ensure `tasks/.millrace/` exists with a default `snapshots.json`.

  Scenario: creates millrace snapshot layout when tasks folder exists
    Given a tasks directory exists without a Millrace snapshot layout
    When I run the millrace snapshot layout bootstrap
    Then the millrace snapshot folder should exist under tasks
    And snapshots.json in the millrace snapshot folder should include settings

  Scenario: does not overwrite an existing snapshots.json
    Given a tasks directory exists with a custom millrace snapshots.json
    When I run the millrace snapshot layout bootstrap
    Then snapshots.json in the millrace snapshot folder should still say custom snapshot marker
