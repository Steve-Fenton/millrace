Feature: Aggregate board model helpers
  Virtual boards combine tasks from source boards using standard column types.

  Scenario: sectionsToBoardModel parses aggregate kind and sources
    Given INI-shaped sections as JSON:
      """
      {"board":{"name":"All","slug":"all","kind":"aggregate"},"sources.1":{"slug":"demo"},"sources.2":{"slug":"project"},"columns.1":{"title":"Done","type":"done"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{"name":"All","slug":"all","kind":"aggregate"},"columns":[{"index":1,"title":"Done","type":"done","isDone":true}],"swimlanes":[],"users":[],"sources":[{"index":1,"slug":"demo"},{"index":2,"slug":"project"}]}
      """

  Scenario: aggregateColumnIndexForSourceColumn maps by column type
    Given aggregate column mapping input as JSON:
      """
      {"sourceColumnIndex":2,"sourceColumns":[{"index":1,"title":"Ideas","type":"options"},{"index":2,"title":"Active","type":"in_progress"}],"aggregateColumns":[{"index":3,"title":"In progress","type":"in_progress"},{"index":5,"title":"Done","type":"done","isDone":true}]}
      """
    When I map a source column to an aggregate column index
    Then the numeric result should be 3

  Scenario: enrichAggregateBoardModel builds swimlanes from source board names
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"index":1,"slug":"demo"},{"index":2,"slug":"project"}]},"catalog":[{"slug":"demo","name":"Demo Board"},{"slug":"project","name":"Project"}]}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[{"index":1,"title":"Demo Board"},{"index":2,"title":"Project"}],"sources":[{"index":1,"slug":"demo"},{"index":2,"slug":"project"}]}
      """

  Scenario: validateAggregateBoard requires at least one source
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[]},"catalog":[{"slug":"demo","name":"Demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      An aggregate board must include at least one source board.
      """
