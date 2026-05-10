Feature: Board catalog path and filename helpers
  Slugs, safe filenames, INI truthy parsing, column paths, default board INI text, and IDs.

  Scenario: sanitizeSegment lowercases and replaces non-safe characters
    When I call sanitizeSegment with "  Hello, World!  "
    Then the sanitized value should be "hello-world"

  Scenario: sanitizeSegment falls back to "board" for empty input
    When I call sanitizeSegment with ""
    Then the sanitized value should be "board"

  Scenario: sanitizeSegment falls back to "board" for punctuation-only input
    When I call sanitizeSegment with "***"
    Then the sanitized value should be "board"

  Scenario: boardSlugFromMeta uses the slug
    When I call boardSlugFromMeta with JSON:
      """
      { "slug": "Acme Sprint", "name": "Acme Sprint Name" }
      """
    Then the sanitized value should be "acme-sprint"

  Scenario: boardSlugFromMeta falls back to name when slug is missing
    When I call boardSlugFromMeta with JSON:
      """
      { "name": "Backlog Board" }
      """
    Then the sanitized value should be "backlog-board"

  Scenario: boardSlugFromMeta defaults to "board" when both are missing
    When I call boardSlugFromMeta with JSON:
      """
      {}
      """
    Then the sanitized value should be "board"

  Scenario: safeCardIniFilename strips paths and validates extension
    When I call safeCardIniFilename with "../foo/bar.ini"
    Then the safe card filename should be "bar.ini"

  Scenario: safeCardIniFilename rejects non-INI filenames
    When I call safeCardIniFilename with "card.txt"
    Then the safe card filename should be null

  Scenario: safeCardIniFilename rejects names with disallowed characters
    When I call safeCardIniFilename with "weird name.ini"
    Then the safe card filename should be null

  Scenario: parseIniTruthy recognises common true tokens
    When I call parseIniTruthy with "TRUE"
    Then the truthy result should be true

  Scenario: parseIniTruthy returns false for empty string
    When I call parseIniTruthy with ""
    Then the truthy result should be false

  Scenario: parseIniTruthy returns true for "yes"
    When I call parseIniTruthy with " yes "
    Then the truthy result should be true

  Scenario: parseIniTruthy returns false for "no"
    When I call parseIniTruthy with "no"
    Then the truthy result should be false

  Scenario: columnIndexFromTasksPath finds an index in a POSIX path
    When I call columnIndexFromTasksPath with "/data/tasks/test/columns.3/FLOW-1.ini"
    Then the column index should equal 3

  Scenario: columnIndexFromTasksPath finds an index in a Windows path
    When I call columnIndexFromTasksPath with "C:\\data\\tasks\\test\\columns.5\\FLOW-1.ini"
    Then the column index should equal 5

  Scenario: columnIndexFromTasksPath returns null when no columns segment
    When I call columnIndexFromTasksPath with "/data/tasks/test/FLOW-1.ini"
    Then the column index should be null

  Scenario: laneIndexFromBody returns 0 when board has no swimlanes
    When I call laneIndexFromBody with lane number 5 and swimlanes JSON:
      """
      []
      """
    Then the lane index should equal 0

  Scenario: laneIndexFromBody returns provided lane number when valid
    When I call laneIndexFromBody with lane number 2 and swimlanes JSON:
      """
      [ { "index": 1, "title": "A" }, { "index": 2, "title": "B" } ]
      """
    Then the lane index should equal 2

  Scenario: laneIndexFromBody falls back to default lane when number is invalid
    When I call laneIndexFromBody with lane number 0 and swimlanes JSON:
      """
      [ { "index": 1, "title": "A" }, { "index": 2, "title": "B" } ]
      """
    Then the lane index should equal 1

  Scenario: defaultNewBoardIniText emits standard sections
    When I call defaultNewBoardIniText with name "Demo" and slug "demo"
    Then the generated board INI should contain "name = Demo"
    And the generated board INI should contain "slug = demo"
    And the generated board INI should contain "[columns.1]"
    And the generated board INI should contain "[columns.3]"
    And the generated board INI should contain "is_done = true"
    And the generated board INI should contain "[swimlanes.1]"

  Scenario: defaultNewBoardIniText falls back to slug when name is blank
    When I call defaultNewBoardIniText with name "  " and slug "fallback"
    Then the generated board INI should contain "name = fallback"

  Scenario: newCardId creates a FLOW-prefixed identifier
    When I call newCardId
    Then the generated card id should match "^FLOW-[0-9a-z]+-[0-9a-z]{6}$"
