Feature: catalogRetention reads tasks/.millrace.ini overrides
  Custom retention thresholds picked up from `[millrace]`, with sensible defaults.

  Scenario: defaults when the catalog INI is missing
    Given the integration data root is freshly empty
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 14
    And the retention coldStorageArchiveAfterMonths should equal 12

  Scenario: snake_case overrides are applied
    Given the integration data root has a millrace catalog INI with:
      """
      [millrace]
      archive_closed_after_days = 30
      cold_storage_archive_after_months = 6
      """
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 30
    And the retention coldStorageArchiveAfterMonths should equal 6

  Scenario: camelCase overrides also work
    Given the integration data root has a millrace catalog INI with:
      """
      [millrace]
      archiveClosedAfterDays = 7
      coldStorageArchiveAfterMonths = 24
      """
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 7
    And the retention coldStorageArchiveAfterMonths should equal 24

  Scenario: legacy [flow] section is also read
    Given the integration data root has a millrace catalog INI with:
      """
      [flow]
      archive_closed_after_days = 21
      """
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 21
    And the retention coldStorageArchiveAfterMonths should equal 12

  Scenario: bad numeric values fall back to defaults
    Given the integration data root has a millrace catalog INI with:
      """
      [millrace]
      archive_closed_after_days = abc
      cold_storage_archive_after_months = -3
      """
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 14
    And the retention coldStorageArchiveAfterMonths should equal 12

  Scenario: empty values fall back to defaults
    Given the integration data root has a millrace catalog INI with:
      """
      [millrace]
      archive_closed_after_days =
      cold_storage_archive_after_months =
      """
    When I read the millrace catalog retention settings
    Then the retention archiveClosedAfterDays should equal 14
    And the retention coldStorageArchiveAfterMonths should equal 12
