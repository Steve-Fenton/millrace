Feature: ensureDefaultTasksLayout
  Creating a minimal tasks layout when the data root has no catalog or no tasks directory.

  Scenario: creates tasks layout when data root is empty
    Given bootstrap unit empty project directory
    When I call ensureDefaultTasksLayout
    Then bootstrap unit tasks demo.ini should contain slug demo
    And bootstrap unit catalog lists demo.ini

  Scenario: adds catalog and demo when tasks directory exists without catalog
    Given bootstrap unit has tasks directory without catalog
    When I call ensureDefaultTasksLayout
    Then bootstrap unit tasks demo.ini should contain slug demo
    And bootstrap unit catalog lists demo.ini
