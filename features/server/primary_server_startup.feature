Feature: Primary server pre-listen startup
  Pull latest git changes before bootstrap, column snapshots, and later archive work.

  Scenario: pre-listen startup pulls before bootstrap and snapshots
    When I run primary server pre-listen with mocked steps
    Then the primary server pre-listen order should be:
      """
      ["pull", "bootstrap", "snapshots"]
      """
