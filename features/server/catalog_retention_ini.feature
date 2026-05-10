Feature: Catalog retention from tasks `.millrace.ini`
  Read archive/cold-storage thresholds from `[millrace]` (or legacy `[flow]`), with
  defaults when keys are missing or invalid.

  Scenario: defaults when the catalog INI is missing
    Given tasks exist but the catalog INI is absent
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 14
    And months before cold-storage archive should be 12

  Scenario: snake_case overrides are applied
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      archive_closed_after_days = 30
      cold_storage_archive_after_months = 6
      """
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 30
    And months before cold-storage archive should be 6

  Scenario: camelCase overrides also work
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      archiveClosedAfterDays = 7
      coldStorageArchiveAfterMonths = 24
      """
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 7
    And months before cold-storage archive should be 24

  Scenario: legacy [flow] section is also read
    Given the millrace catalog INI under the integration data root contains:
      """
      [flow]
      archive_closed_after_days = 21
      """
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 21
    And months before cold-storage archive should be 12

  Scenario: bad numeric values fall back to defaults
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      archive_closed_after_days = abc
      cold_storage_archive_after_months = -3
      """
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 14
    And months before cold-storage archive should be 12

  Scenario: empty values fall back to defaults
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      archive_closed_after_days =
      cold_storage_archive_after_months =
      """
    When I read retention thresholds from the catalog INI
    Then days before archiving closed cards should be 14
    And months before cold-storage archive should be 12
