Feature: localUserIni helpers
  Section serialization, sync mode parsing, and the pending-sync flag.

  Scenario: serializeLocalUserIniFile drops empty values
    When I serialize sections JSON:
      """
      {
        "user": { "owner": "owner@example.com", "mine": "" },
        "preferences": { "sync_mode": "manual" }
      }
      """
    Then the serialized text should equal:
      """
      [user]
      owner = owner@example.com

      [preferences]
      sync_mode = manual
      """

  Scenario: serializeLocalUserIniFile is empty for empty sections
    When I serialize sections JSON:
      """
      {}
      """
    Then the serialized text should be an empty string

  Scenario: serializeLocalUserIniFile orders preferred sections first
    When I serialize sections JSON:
      """
      {
        "preferences": { "sync_mode": "manual" },
        "user": { "owner": "owner@example.com" },
        "flow": { "charts_granularity": "weekly" },
        "extra": { "value": "x" }
      }
      """
    Then the serialized text should equal:
      """
      [user]
      owner = owner@example.com

      [flow]
      charts_granularity = weekly

      [preferences]
      sync_mode = manual

      [extra]
      value = x
      """

  Scenario: serializeLocalUserIniFile drops sections that have no live values
    When I serialize sections JSON:
      """
      {
        "user": { "mine": "  " },
        "flow": {}
      }
      """
    Then the serialized text should be an empty string

  Scenario: serializeLocalUserIniFile collapses multi-line values to a single line
    When I serialize sections JSON:
      """
      { "user": { "owner": "line one\nline two" } }
      """
    Then the serialized text should equal:
      """
      [user]
      owner = line one line two
      """

  Scenario: syncModeFromPreferencesSection treats manual as manual
    When I read sync mode from preferences JSON:
      """
      { "sync_mode": "manual" }
      """
    Then the sync mode should be "manual"

  Scenario: syncModeFromPreferencesSection accepts camelCase key
    When I read sync mode from preferences JSON:
      """
      { "syncMode": " Manual " }
      """
    Then the sync mode should be "manual"

  Scenario: syncModeFromPreferencesSection defaults to automatic
    When I read sync mode from preferences JSON:
      """
      {}
      """
    Then the sync mode should be "automatic"

  Scenario: syncModeFromPreferencesSection treats unknown values as automatic
    When I read sync mode from preferences JSON:
      """
      { "sync_mode": "weird" }
      """
    Then the sync mode should be "automatic"

  Scenario: pendingSyncFromSections recognises 1
    When I read pendingSync from sections JSON:
      """
      { "flow": { "pending_sync": "1" } }
      """
    Then pendingSync should be true

  Scenario: pendingSyncFromSections recognises camelCase pendingSync
    When I read pendingSync from sections JSON:
      """
      { "flow": { "pendingSync": "true" } }
      """
    Then pendingSync should be true

  Scenario: pendingSyncFromSections is false when missing
    When I read pendingSync from sections JSON:
      """
      {}
      """
    Then pendingSync should be false

  Scenario: pendingSyncFromSections is false for "0"
    When I read pendingSync from sections JSON:
      """
      { "flow": { "pending_sync": "0" } }
      """
    Then pendingSync should be false
