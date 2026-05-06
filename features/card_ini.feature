Feature: cardIni
  Card INI helpers: link normalization, column and swimlane titles for [item],
  and serialization of work items for tasks/*.ini files.

  Scenario: normalizeLinksForIni returns empty for non-array input
    Given the JSON input for normalizeLinksForIni is:
      """
      null
      """
    When I normalize links with normalizeLinksForIni
    Then the JSON result should be:
      """
      []
      """

  Scenario: normalizeLinksForIni keeps entries with a URL and trims text
    Given the JSON input for normalizeLinksForIni is:
      """
      [{ "url": "http://a", "text": " A " }, { "url": "  ", "text": "x" }, "bad", { "url": "http://b" }]
      """
    When I normalize links with normalizeLinksForIni
    Then the JSON result should be:
      """
      [{"text":"A","url":"http://a"},{"text":"","url":"http://b"}]
      """

  Scenario: columnNameForIniItem uses the matching column title
    Given the columns array JSON is:
      """
      [{"index":2,"title":"Doing"},{"index":3,"title":"Done"}]
      """
    And the column index is 2
    When I compute columnNameForIniItem
    Then the string result should be:
      """
      Doing
      """

  Scenario: columnNameForIniItem falls back to the default column when index is unknown
    Given the columns array JSON is:
      """
      [{"index":5,"title":"First"},{"index":9,"title":"Last"}]
      """
    And the column index is 2
    When I compute columnNameForIniItem
    Then the string result should be:
      """
      First
      """

  Scenario: columnNameForIniItem uses Column n when the title is empty
    Given the columns array JSON is:
      """
      [{"index":4,"title":null}]
      """
    And the column index is 4
    When I compute columnNameForIniItem
    Then the string result should be:
      """
      Column 4
      """

  Scenario: columnNameForIniItem with no columns returns the index as text
    Given the columns array JSON is:
      """
      []
      """
    And the column index is 7
    When I compute columnNameForIniItem
    Then the string result should be:
      """
      7
      """

  Scenario: columnNameForIniItem treats non-array columns as empty
    Given the columns array JSON is:
      """
      null
      """
    And the column index is 3
    When I compute columnNameForIniItem
    Then the string result should be:
      """
      3
      """

  Scenario: swimlaneNameForIniItem is undefined when there are no swimlanes
    Given the swimlanes array JSON is:
      """
      []
      """
    And the swimlane index is 1
    When I compute swimlaneNameForIniItem
    Then the swimlane name result is undefined

  Scenario: swimlaneNameForIniItem returns the requested lane title
    Given the swimlanes array JSON is:
      """
      [{"index":2,"title":"Stream"}]
      """
    And the swimlane index is 2
    When I compute swimlaneNameForIniItem
    Then the string result should be:
      """
      Stream
      """

  Scenario: swimlaneNameForIniItem falls back when the index is not an integer lane
    Given the swimlanes array JSON is:
      """
      [{"index":3,"title":"Default"},{"index":5,"title":"Other"}]
      """
    And the swimlane index is 0
    When I compute swimlaneNameForIniItem
    Then the string result should be:
      """
      Default
      """

  Scenario: swimlaneNameForIniItem uses Lane n when the lane title is blank
    Given the swimlanes array JSON is:
      """
      [{"index":1,"title":"  "}]
      """
    And the swimlane index is 1
    When I compute swimlaneNameForIniItem
    Then the string result should be:
      """
      Lane 1
      """

  Scenario: serializeFullCardIni writes multiline description link sections and sorted extra keys
    Given the full card item JSON is:
      """
      {"id":"t1","title":"Hello","description":"line1\nline2\n  indented","owner":"o@o.o","column":"Col A","foo":"zzz","aaa":"extra"}
      """
    And the full card links JSON is:
      """
      [{"text":"L","url":"http://l"}]
      """
    When I serialize with serializeFullCardIni
    Then the card INI output should be:
      """
      [item]
      id = t1
      title = Hello
      description = line1
          line2
          indented
      owner = o@o.o
      column = Col A
      aaa = extra
      foo = zzz

      [link.1]
      text = L
      url = http://l

      """

  Scenario: serializeFullCardIni uses only the first line for scalar fields with embedded newlines
    Given the full card item JSON is:
      """
      {"id":"1","title":"first\nsecond","description":"body"}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize with serializeFullCardIni
    Then the card INI output should be:
      """
      [item]
      id = 1
      title = first
      description = body

      """

  Scenario: serializeFullCardIni writes remaining keys in sorted order when no ordered fields are set
    Given the full card item JSON is:
      """
      {"bbb":"2","aaa":"1"}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize with serializeFullCardIni
    Then the card INI output should be:
      """
      [item]
      aaa = 1
      bbb = 2

      """

  Scenario: serializeCardIni writes column swimlane sort_order links and created
    Given the serializeCardIni fields JSON is:
      """
      {"id":"c1","title":"Card","columnIndex":2,"columns":[{"index":2,"title":"Doing"}],"swimlanes":[{"index":1,"title":"Lane1"}],"sortOrder":3.7,"links":[{"url":"http://x","text":"X"}]}
      """
    When I serialize with serializeCardIni
    Then the card INI output should be:
      """
      [item]
      id = c1
      title = Card
      description = 
      owner = 
      swimlane = Lane1
      column = Doing
      sort_order = 4
      created = 2024-01-15T10:20:30.000Z

      [link.1]
      text = X
      url = http://x

      """

  Scenario: serializeCardIni omits column when columnIndex is invalid and omits swimlane when there are no lanes
    Given the serializeCardIni fields JSON is:
      """
      {"id":"x","title":"T","columnIndex":0,"columns":[{"index":1,"title":"C"}],"swimlanes":[]}
      """
    When I serialize with serializeCardIni
    Then the card INI output should be:
      """
      [item]
      id = x
      title = T
      description = 
      owner = 
      created = 2024-01-15T10:20:30.000Z

      """

  Scenario: serializeCardIni uses an explicit swimlane index when provided
    Given the serializeCardIni fields JSON is:
      """
      {"id":"x","title":"T","columnIndex":1,"swimlaneIndex":5,"columns":[{"index":1,"title":"C"}],"swimlanes":[{"index":3,"title":"Three"},{"index":5,"title":"Five"}]}
      """
    When I serialize with serializeCardIni
    Then the card INI output should be:
      """
      [item]
      id = x
      title = T
      description = 
      owner = 
      swimlane = Five
      column = C
      created = 2024-01-15T10:20:30.000Z

      """
