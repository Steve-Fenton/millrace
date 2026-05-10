Feature: Default tasks layout bootstrap
  When the data root has no `tasks/` tree or no catalog, create a minimal layout
  with a demo board entry.

  Scenario: creates tasks layout when data root is empty
    Given an empty Millrace data root for bootstrap
    When I run the default tasks layout bootstrap
    Then demo.ini in the bootstrap tasks folder should include slug demo
    And the Millrace catalog should list demo.ini for boards

  Scenario: adds catalog and demo when tasks directory exists without catalog
    Given a tasks directory exists without a Millrace catalog file
    When I run the default tasks layout bootstrap
    Then demo.ini in the bootstrap tasks folder should include slug demo
    And the Millrace catalog should list demo.ini for boards
