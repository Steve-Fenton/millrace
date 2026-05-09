Feature: boardDefinitionSync helpers
  Pure helpers that detect "pure reorder" board edits vs renames / additions.

  Scenario: multisetsEqual is true for two empty maps
    When I compare boardTitleMultiset for the old and new boards JSON:
      """
      {
        "old": { "columns": [], "swimlanes": [] },
        "new": { "columns": [], "swimlanes": [] }
      }
      """
    Then isPureColumnSwimlaneReorderForTasks should be true

  Scenario: re-ordering columns with the same titles is a pure reorder
    When I compare boardTitleMultiset for the old and new boards JSON:
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
    Then isPureColumnSwimlaneReorderForTasks should be true

  Scenario: renaming a column is not a pure reorder
    When I compare boardTitleMultiset for the old and new boards JSON:
      """
      {
        "old": { "columns": [ { "index": 1, "title": "To Do" } ], "swimlanes": [] },
        "new": { "columns": [ { "index": 1, "title": "Backlog" } ], "swimlanes": [] }
      }
      """
    Then isPureColumnSwimlaneReorderForTasks should be false

  Scenario: adding a swimlane is not a pure reorder
    When I compare boardTitleMultiset for the old and new boards JSON:
      """
      {
        "old": { "columns": [ { "index": 1, "title": "To Do" } ], "swimlanes": [] },
        "new": {
          "columns": [ { "index": 1, "title": "To Do" } ],
          "swimlanes": [ { "index": 1, "title": "Default" } ]
        }
      }
      """
    Then isPureColumnSwimlaneReorderForTasks should be false

  Scenario: removing a duplicate column counts toward the multiset
    When I compare boardTitleMultiset for the old and new boards JSON:
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
    Then isPureColumnSwimlaneReorderForTasks should be false

  Scenario: multiset counts duplicate column titles
    When I take a multiset of columns from JSON:
      """
      [
        { "index": 1, "title": "Backlog" },
        { "index": 2, "title": "Backlog" },
        { "index": 3, "title": "Done" }
      ]
      """
    Then the multiset entry for "backlog" should equal 2
    And the multiset entry for "done" should equal 1
