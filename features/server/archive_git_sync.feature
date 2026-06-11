Feature: Archive git sync
  Pull latest before archiving; commit and push when cards were moved.

  Scenario: archive startup pulls but skips commit when nothing moved
    Given a board with no stale closed cards for archive
    When I run the millrace archive startup with git mocked
    Then an archive git pull should have run
    And archive changes should not be committed or pushed

  Scenario: archive startup skips git when no repository
    Given a board with a stale closed card eligible for archive
    When I run the millrace archive startup with git mocked and no repository
    Then no archive git pull should have run
    And the stale card should be in archive

  Scenario: archive startup pulls before archiving then commits and pushes
    Given a board with a stale closed card eligible for archive
    When I run the millrace archive startup with git mocked
    Then a git pull should have run before the archive check
    And archive changes should be committed and pushed
    And the stale card should be in archive

  Scenario: archive startup skips when Mine does not match Millrace admin
    Given a board with a stale closed card and Mine does not match Millrace admin
    When I run the millrace archive startup with git mocked
    Then no archive git pull should have run
    And the stale card should remain on the board
