Feature: Millrace snapshot layout git safety
  Before ensuring snapshot layout, pull latest changes; commit and push when layout files change.

  Scenario: snapshot layout startup skips git when no repository
    Given a tasks directory exists without a Millrace snapshot layout
    When I run the millrace snapshot layout startup with git mocked
    Then no snapshot layout git pull should have run
    And the millrace snapshot folder should exist under tasks

  Scenario: snapshot layout startup pulls before creating layout
    Given a tasks directory exists without a Millrace snapshot layout
    When I run the millrace snapshot layout startup
    Then a git pull should have run before the layout check
    And the millrace snapshot folder should exist under tasks

  Scenario: snapshot layout startup commits and pushes when layout files are added
    Given a tasks directory exists without a Millrace snapshot layout
    When I run the millrace snapshot layout startup
    Then snapshot layout changes should be committed and pushed
