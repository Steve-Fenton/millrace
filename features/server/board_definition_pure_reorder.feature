Feature: Board definition pure reorder detection
  Helpers tell whether a board edit only reorders columns/swimlanes (same titles)
  versus renames, additions, or removals.

  Scenario: empty columns and swimlanes count as a pure reorder
    When I compare old and new board models for pure reorder:
      """
      {
        "old": { "columns": [], "swimlanes": [] },
        "new": { "columns": [], "swimlanes": [] }
      }
      """
    Then the board change qualifies as a pure column swimlane reorder

  Scenario: re-ordering columns with the same titles is a pure reorder
    When I compare old and new board models for pure reorder:
      """
      {
        "old": {
          "columns": [
            { "index": 1, "title": "To Do" },
            { "index": 2, "title": "Done" }
          ],
          "swimlanes": []
        },
        "new": {
          "columns": [
            { "index": 1, "title": "Done" },
            { "index": 2, "title": "To Do" }
          ],
          "swimlanes": []
        }
      }
      """
    Then the board change qualifies as a pure column swimlane reorder

  Scenario: renaming a column is not a pure reorder
    When I compare old and new board models for pure reorder:
      """
      {
        "old": { "columns": [ { "index": 1, "title": "To Do" } ], "swimlanes": [] },
        "new": { "columns": [ { "index": 1, "title": "Backlog" } ], "swimlanes": [] }
      }
      """
    Then the board change does not qualify as a pure column swimlane reorder

  Scenario: adding a swimlane is not a pure reorder
    When I compare old and new board models for pure reorder:
      """
      {
        "old": { "columns": [ { "index": 1, "title": "To Do" } ], "swimlanes": [] },
        "new": {
          "columns": [ { "index": 1, "title": "To Do" } ],
          "swimlanes": [ { "index": 1, "title": "Default" } ]
        }
      }
      """
    Then the board change does not qualify as a pure column swimlane reorder

  Scenario: removing a duplicate column counts toward the multiset
    When I compare old and new board models for pure reorder:
      """
      {
        "old": {
          "columns": [
            { "index": 1, "title": "To Do" },
            { "index": 2, "title": "To Do" }
          ],
          "swimlanes": []
        },
        "new": { "columns": [ { "index": 1, "title": "To Do" } ], "swimlanes": [] }
      }
      """
    Then the board change does not qualify as a pure column swimlane reorder

  Scenario: multiset counts duplicate column titles
    When I take multiset counts of column titles from JSON:
      """
      [
        { "index": 1, "title": "Backlog" },
        { "index": 2, "title": "Backlog" },
        { "index": 3, "title": "Done" }
      ]
      """
    Then the multiset entry for "backlog" should equal 2
    And the multiset entry for "done" should equal 1
