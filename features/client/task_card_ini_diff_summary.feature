Feature: Task card INI change summary
  From earlier and later task card INI text (as in a git diff), produce short
  readable lines: field edits, link counts, added/removed files, parse failures,
  and whitespace-only edits.

  Scenario: parse failure on the before text
    When I summarize the task card INI diff assuming the earlier version fails to parse
    Then the diff summary JSON should be:
      """
      ["(Could not parse earlier version)"]
      """

  Scenario: parse failure on the after text
    When I summarize the task card INI diff assuming the later version fails to parse
    Then the diff summary JSON should be:
      """
      ["(Could not parse this version)"]
      """

  Scenario: formatting helpers cover nullish inputs and link fingerprints
    When I verify formatting helpers for task diff output

  Scenario: stubbed parse with null item still diffs links
    When I summarize the task card INI diff with null item and sparse links from stubs
    Then the diff summary JSON should be:
      """
      ["Links: 1 entry → 1 entry"]
      """

  Scenario: stubbed parse with nullish custom field value
    When I summarize the task card INI diff when a custom field goes from null to text
    Then the diff summary JSON should be:
      """
      ["ghost: ∅ → x"]
      """

  Scenario: custom field removed on the after side
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      only_before = x

      """
    And the later task card INI text is:
      """
      [item]
      id = 1

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["only_before: x → ∅"]
      """

  Scenario: custom field added on the after side
    Given the earlier task card INI text is:
      """
      [item]
      id = 1

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      only_after = y

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["only_after: ∅ → y"]
      """

  Scenario: note field added on the after side uses the Note label
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      title = Same

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      title = Same
      note = Waiting on reply

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Note: ∅ → Waiting on reply"]
      """

  Scenario: extra-key pass skips unchanged custom fields
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      keep = same
      chg = old

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      keep = same
      chg = new

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["chg: old → new"]
      """

  Scenario: both sides are empty of meaningful content
    Given the earlier task card INI text is:
      """

      """
    And the later task card INI text is:
      """
        	
      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      []
      """

  Scenario: both raw values are nullish
    Given the earlier task card INI text is null
    And the later task card INI text is undefined
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      []
      """

  Scenario: new task file in commit
    Given the earlier task card INI text is:
      """

      """
    And the later task card INI text is:
      """
      [item]
      id = n1
      title = New

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["New file in this commit."]
      """

  Scenario: task file removed in commit
    Given the earlier task card INI text is:
      """
      [item]
      id = x
      title = Gone

      """
    And the later task card INI text is:
      """

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["File removed in this commit."]
      """

  Scenario: standard field change
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      title = Alpha
      column = todo

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      title = Beta
      column = todo

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Title: Alpha → Beta"]
      """

  Scenario: empty string field becomes non-empty
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      title =

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      title = hello

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Title: ∅ → hello"]
      """

  Scenario: custom item key not in the standard label map
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      tracker = old

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      tracker = new

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["tracker: old → new"]
      """

  Scenario: custom key appears only on the after side
    Given the earlier task card INI text is:
      """
      [item]
      id = 1

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      newonly = 2

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["newonly: ∅ → 2"]
      """

  Scenario: link count changes including none and plural labels
    Given the earlier task card INI text is:
      """
      [item]
      id = 1

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      [link.1]
      text = a
      url = https://example.com/a
      [link.2]
      text = b
      url = https://example.com/b

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Links: none → 2 entries"]
      """

  Scenario: link count drops from two to none
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      [link.1]
      text = a
      url = https://example.com/a
      [link.2]
      text = b
      url = https://example.com/b

      """
    And the later task card INI text is:
      """
      [item]
      id = 1

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Links: 2 entries → none"]
      """

  Scenario: same number of links but fingerprint differs
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      [link.1]
      text = a
      url = https://example.com/a

      """
    And the later task card INI text is:
      """
      [item]
      id = 1
      [link.1]
      text = a
      url = https://example.com/b

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Links: 1 entry → 1 entry"]
      """

  Scenario: only whitespace or comments changed
    Given the earlier task card INI text is:
      """
      [item]
      id = 1

      """
    And the later task card INI text is:
      """
      [item]
      id = 1

      ; comment only

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["(No tracked field changes — whitespace or non-item sections only.)"]
      """

  Scenario: multiline description uses arrow newline glyph and truncates long display
    Given the earlier task card INI text is:
      """
      [item]
      id = 1
      description = short

      """
    And the later task card INI has a multiline description with a long continuation line
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      ["Description: short → line1 ↵ yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy…"]
      """

  Scenario: summary is capped at fourteen lines
    Given the earlier task card INI text is:
      """
      [item]
      id = b
      title = b
      description = b
      owner = b
      swimlane = b
      column = b
      sort_order = b
      created = b
      closed = b
      extra1 = b
      extra2 = b
      extra3 = b
      extra4 = b
      extra5 = b
      extra6 = b
      extra7 = b
      extra8 = b

      """
    And the later task card INI text is:
      """
      [item]
      id = a
      title = a
      description = a
      owner = a
      swimlane = a
      column = a
      sort_order = a
      created = a
      closed = a
      extra1 = a
      extra2 = a
      extra3 = a
      extra4 = a
      extra5 = a
      extra6 = a
      extra7 = a
      extra8 = a

      """
    When I summarize the task card INI diff
    Then the diff summary JSON should be:
      """
      [
        "Title: b → a",
        "Description: b → a",
        "Owner: b → a",
        "Swimlane: b → a",
        "Column: b → a",
        "Sort order: b → a",
        "ID: b → a",
        "Created: b → a",
        "Closed: b → a",
        "extra1: b → a",
        "extra2: b → a",
        "extra3: b → a",
        "extra4: b → a",
        "extra5: b → a"
      ]
      """
