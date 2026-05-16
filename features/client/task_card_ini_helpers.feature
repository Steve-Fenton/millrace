Feature: Task card INI helpers
  Normalize links, resolve column and swimlane labels for `[item]`, and serialize
  card models to `tasks/*.ini` text.

  Scenario: normalizeLinksForIni returns empty for non-array input
    Given JSON input for link normalization:
      """
      null
      """
    When I normalize links for task card INI
    Then the JSON result should be:
      """
      []
      """

  Scenario: normalizeLinksForIni keeps entries with a URL and trims text
    Given JSON input for link normalization:
      """
      [{ "url": "http://a", "text": " A " }, { "url": "  ", "text": "x" }, "bad", { "url": "http://b" }]
      """
    When I normalize links for task card INI
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
    When I compute the column name for INI output
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
    When I compute the column name for INI output
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
    When I compute the column name for INI output
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
    When I compute the column name for INI output
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
    When I compute the column name for INI output
    Then the string result should be:
      """
      3
      """

  Scenario: columnNameForIniItem fallback uses Column n when the default column title is blank
    Given the columns array JSON is:
      """
      [{"index":4,"title":"  "}]
      """
    And the column index is 99
    When I compute the column name for INI output
    Then the string result should be:
      """
      Column 4
      """

  Scenario: columnNameForIniItem fallback maps null or omitted titles through nullish coalescing
    Given the columns array JSON is:
      """
      [{"index":6,"title":null}]
      """
    And the column index is 100
    When I compute the column name for INI output
    Then the string result should be:
      """
      Column 6
      """

  Scenario: columnNameForIniItem fallback treats missing title like null for coalescing
    Given the columns array JSON is:
      """
      [{"index":8}]
      """
    And the column index is 50
    When I compute the column name for INI output
    Then the string result should be:
      """
      Column 8
      """

  Scenario: swimlaneNameForIniItem is undefined when there are no swimlanes
    Given the swimlanes array JSON is:
      """
      []
      """
    And the swimlane index is 1
    When I compute the swimlane name for INI output
    Then the swimlane name result is undefined

  Scenario: swimlaneNameForIniItem returns the requested lane title
    Given the swimlanes array JSON is:
      """
      [{"index":2,"title":"Stream"}]
      """
    And the swimlane index is 2
    When I compute the swimlane name for INI output
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
    When I compute the swimlane name for INI output
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
    When I compute the swimlane name for INI output
    Then the string result should be:
      """
      Lane 1
      """

  Scenario: swimlaneNameForIniItem maps null primary title through nullish coalescing
    Given the swimlanes array JSON is:
      """
      [{"index":2,"title":null}]
      """
    And the swimlane index is 2
    When I compute the swimlane name for INI output
    Then the string result should be:
      """
      Lane 2
      """

  Scenario: swimlaneNameForIniItem treats missing title like null for coalescing
    Given the swimlanes array JSON is:
      """
      [{"index":3}]
      """
    And the swimlane index is 3
    When I compute the swimlane name for INI output
    Then the string result should be:
      """
      Lane 3
      """

  Scenario: swimlaneNameForIniItem treats non-array swimlanes as empty
    Given the swimlanes array JSON is:
      """
      null
      """
    And the swimlane index is 2
    When I compute the swimlane name for INI output
    Then the swimlane name result is undefined

  Scenario: swimlaneNameForIniItem falls back with Lane n when the default lane title is blank
    Given the swimlanes array JSON is:
      """
      [{"index":5,"title":null}]
      """
    And the swimlane index is 9
    When I compute the swimlane name for INI output
    Then the string result should be:
      """
      Lane 5
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
    When I serialize the full card to INI
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

  Scenario: serializeCardIni stringifies null description and owner
    Given the serializeCardIni fields JSON is:
      """
      {"id":"n","title":"t","columnIndex":1,"description":null,"owner":null,"columns":[{"index":1,"title":"C"}],"swimlanes":[]}
      """
    When I serialize the card model to INI
    Then the card INI output should be:
      """
      [item]
      id = n
      title = t
      description = 
      owner = 
      column = C
      created = 2024-01-15T10:20:30.000Z

      """

  Scenario: serializeFullCardIni handles null title and description for scalarLine and appendDescription
    Given the full card item JSON is:
      """
      {"id":"1","title":null,"description":null}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = 1
      title = 
      description = 

      """

  Scenario: serializeFullCardIni skips empty swimlane column and sort_order in the ordered pass then emits them from the rest loop
    Given the full card item JSON is:
      """
      {"id":"x","title":"y","swimlane":"","column":"","sort_order":"  "}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = x
      title = y
      column = 
      sort_order = 
      swimlane = 

      """

  Scenario: serializeFullCardIni skips rest keys whose value is undefined
    Given the full card item has an own property with undefined value
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = u1

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
    When I serialize the full card to INI
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
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      aaa = 1
      bbb = 2

      """

  Scenario: serializeFullCardIni appends multiline description via the rest loop when the ordered pass skips it
    Given the full card item has a description getter that yields undefined then multiline text
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = g1
      description = second-pass
          body

      """

  Scenario: serializeCardIni writes column swimlane sort_order links and created
    Given the serializeCardIni fields JSON is:
      """
      {"id":"c1","title":"Card","columnIndex":2,"columns":[{"index":2,"title":"Doing"}],"swimlanes":[{"index":1,"title":"Lane1"}],"sortOrder":3.7,"links":[{"url":"http://x","text":"X"}]}
      """
    When I serialize the card model to INI
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
    When I serialize the card model to INI
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
    When I serialize the card model to INI
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

  Scenario: serializeCardIni writes note and next action date after description when both are non-empty
    Given the serializeCardIni fields JSON is:
      """
      {"id":"n1","title":"With note","columnIndex":1,"columns":[{"index":1,"title":"C"}],"swimlanes":[],"note":"Blocked on CI","nextActionDate":"2025-08-01"}
      """
    When I serialize the card model to INI
    Then the card INI output should be:
      """
      [item]
      id = n1
      title = With note
      description = 
      owner = 
      note = Blocked on CI
      next_action_date = 2025-08-01
      column = C
      created = 2024-01-15T10:20:30.000Z

      """

  Scenario: serializeCardIni omits next_action_date when nextActionDate is invalid or missing
    Given the serializeCardIni fields JSON is:
      """
      {"id":"n3","title":"T","columnIndex":1,"columns":[{"index":1,"title":"C"}],"swimlanes":[],"nextActionDate":"not-a-date"}
      """
    When I serialize the card model to INI
    Then the card INI output should be:
      """
      [item]
      id = n3
      title = T
      description = 
      owner = 
      column = C
      created = 2024-01-15T10:20:30.000Z

      """

  Scenario: serializeFullCardIni writes note and next action date in the ordered item fields
    Given the full card item JSON is:
      """
      {"id":"f1","title":"T","description":"Body","note":"Waiting","next_action_date":"2025-06-15"}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = f1
      title = T
      description = Body
      note = Waiting
      next_action_date = 2025-06-15

      """

  Scenario: serializeCardIni adds strategic=yes when strategic is true
    Given the serializeCardIni fields JSON is:
      """
      {"id":"s1","title":"Strategic card","columnIndex":1,"columns":[{"index":1,"title":"C"}],"swimlanes":[],"strategic":true}
      """
    When I serialize the card model to INI
    Then the card INI output should be:
      """
      [item]
      id = s1
      title = Strategic card
      description = 
      owner = 
      column = C
      created = 2024-01-15T10:20:30.000Z
      strategic = yes

      """

  Scenario: serializeCardIni omits strategic when strategic is false
    Given the serializeCardIni fields JSON is:
      """
      {"id":"s2","title":"Normal","columnIndex":1,"columns":[{"index":1,"title":"C"}],"swimlanes":[],"strategic":false}
      """
    When I serialize the card model to INI
    Then the card INI output should be:
      """
      [item]
      id = s2
      title = Normal
      description = 
      owner = 
      column = C
      created = 2024-01-15T10:20:30.000Z

      """

  Scenario: serializeFullCardIni writes strategic after closed
    Given the full card item JSON is:
      """
      {"id":"d1","title":"Done","description":"","owner":"","created":"2024-06-01T12:00:00.000Z","closed":"2024-06-02T12:00:00.000Z","strategic":"yes"}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = d1
      title = Done
      description = 
      owner = 
      created = 2024-06-01T12:00:00.000Z
      closed = 2024-06-02T12:00:00.000Z
      strategic = yes

      """

  Scenario: serializeFullCardIni skips blank scalar fields in the ordered pass then emits them from the rest loop
    Given the full card item JSON is:
      """
      {"id":"e1","title":"X","description":"","owner":"","created":"2024-01-01T00:00:00.000Z","next_action_date":"","strategic":""}
      """
    And the full card links JSON is:
      """
      []
      """
    When I serialize the full card to INI
    Then the card INI output should be:
      """
      [item]
      id = e1
      title = X
      description = 
      owner = 
      created = 2024-01-01T00:00:00.000Z
      next_action_date = 
      strategic = 

      """

  Scenario Outline: normalizeNextActionDate accepts YYYY-MM-DD and rejects everything else
    When I normalize the next action date input "<input>"
    Then the normalized next action date should be "<expected>"

    Examples:
      | case                              | input                | expected   |
      | empty string                      |                      |            |
      | trims surrounding whitespace      |   2025-06-15         | 2025-06-15 |
      | valid YYYY-MM-DD                  | 2026-05-11           | 2026-05-11 |
      | drops trailing time portion       | 2026-05-11T09:00:00Z | 2026-05-11 |
      | rejects shorter date              | 2025-6-1             |            |
      | rejects DD/MM/YYYY                | 11/05/2026           |            |
      | rejects free-text                 | not-a-date           |            |
      | rejects out-of-range month or day | 2026-13-40           |            |

  Scenario Outline: daysUntilNextActionDate counts whole calendar days and isNextActionDateImminent flags <= 2 days
    When I evaluate next action imminence for date "<input>" with today "<today>"
    Then the days until the next action date should be "<daysUntil>"
    And the next action imminence result should be "<expected>"

    Examples:
      | case                  | input      | today      | daysUntil | expected     |
      | three days out        | 2026-05-14 | 2026-05-11 | 3         | not imminent |
      | exactly two days out  | 2026-05-13 | 2026-05-11 | 2         | imminent     |
      | tomorrow              | 2026-05-12 | 2026-05-11 | 1         | imminent     |
      | today                 | 2026-05-11 | 2026-05-11 | 0         | imminent     |
      | yesterday is overdue  | 2026-05-10 | 2026-05-11 | -1        | imminent     |
      | last month is overdue | 2026-04-01 | 2026-05-11 | -40       | imminent     |
      | empty input           |            | 2026-05-11 | null      | not imminent |
      | invalid input         | not-a-date | 2026-05-11 | null      | not imminent |
      | crosses month end     | 2026-06-02 | 2026-05-31 | 2         | imminent     |

  Scenario Outline: shouldFloatNextActionTodayCard is true only for open cards due today
    When I evaluate next action today float with closed "<closed>" next action "<nextAction>" and today "<today>"
    Then the next action today float result should be "<expected>"

    Examples:
      | case                        | closed                     | nextAction | today      | expected |
      | open card due today         |                            | 2026-05-11 | 2026-05-11 | yes      |
      | open card due tomorrow      |                            | 2026-05-12 | 2026-05-11 | no       |
      | open card overdue           |                            | 2026-05-10 | 2026-05-11 | no       |
      | closed card due today       | 2026-05-10T12:00:00.000Z   | 2026-05-11 | 2026-05-11 | no       |
      | open card without next date |                            |            | 2026-05-11 | no       |

  Scenario: sortCardsWithNextActionTodayFirst floats today cards to the top stably
    When I sort cards for next action today display with today "2026-05-11":
      """
      [
        {"id":"a","sort_order":"10","next_action_date":"2026-05-12"},
        {"id":"b","sort_order":"20","next_action_date":"2026-05-11"},
        {"id":"c","sort_order":"30"},
        {"id":"d","sort_order":"40","next_action_date":"2026-05-11"},
        {"id":"e","sort_order":"50","closed":"2026-05-09T00:00:00.000Z","next_action_date":"2026-05-11"}
      ]
      """
    Then the sorted card ids for next action today display should be "b,d,a,c,e"
