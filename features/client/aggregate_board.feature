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

  Scenario Outline: isAggregateBoard detects aggregate kind case-insensitively
    Given aggregate board model JSON:
      """
      {"board":{"kind":"<kind>"}}
      """
    When I check whether the board model is aggregate
    Then the aggregate boolean result is "<expected>"

    Examples:
      | kind       | expected |
      | aggregate  | true     |
      | AGGREGATE  | true     |
      | normal     | false    |
      |            | false    |

  Scenario: aggregateColumnIndexForSourceColumn maps by column type
    Given aggregate column mapping input as JSON:
      """
      {"sourceColumnIndex":2,"sourceColumns":[{"index":1,"title":"Ideas","type":"options"},{"index":2,"title":"Active","type":"in_progress"}],"aggregateColumns":[{"index":3,"title":"In progress","type":"in_progress"},{"index":5,"title":"Done","type":"done","isDone":true}]}
      """
    When I map a source column to an aggregate column index
    Then the numeric result should be 3

  Scenario: aggregateColumnIndexForSourceColumn returns null for unknown source column
    Given aggregate column mapping input as JSON:
      """
      {"sourceColumnIndex":9,"sourceColumns":[{"index":1,"title":"To do","type":"to_do"}],"aggregateColumns":[{"index":2,"title":"To do","type":"to_do"}]}
      """
    When I map a source column to an aggregate column index
    Then the numeric result should be null

  Scenario: aggregateColumnIndexForSourceColumn returns null when aggregate has no matching type
    Given aggregate column mapping input as JSON:
      """
      {"sourceColumnIndex":1,"sourceColumns":[{"index":1,"title":"To do","type":"to_do"}],"aggregateColumns":[{"index":5,"title":"Done","type":"done","isDone":true}]}
      """
    When I map a source column to an aggregate column index
    Then the numeric result should be null

  Scenario: aggregateColumnIndexForSourceColumn tolerates null column arrays
    Given aggregate column mapping input as JSON:
      """
      {"sourceColumnIndex":1,"sourceColumns":null,"aggregateColumns":null}
      """
    When I map a source column to an aggregate column index
    Then the numeric result should be null

  Scenario: sourceColumnIndexForAggregateColumn maps by column type
    Given aggregate column mapping input as JSON:
      """
      {"aggregateColumnIndex":3,"aggregateColumns":[{"index":3,"title":"In progress","type":"in_progress"},{"index":5,"title":"Done","type":"done","isDone":true}],"sourceColumns":[{"index":7,"title":"Active","type":"in_progress"}]}
      """
    When I map an aggregate column to a source column index
    Then the numeric result should be 7

  Scenario: sourceColumnIndexForAggregateColumn returns null for unknown aggregate column
    Given aggregate column mapping input as JSON:
      """
      {"aggregateColumnIndex":9,"aggregateColumns":[{"index":3,"title":"In progress","type":"in_progress"}],"sourceColumns":[{"index":7,"title":"Active","type":"in_progress"}]}
      """
    When I map an aggregate column to a source column index
    Then the numeric result should be null

  Scenario: sourceColumnIndexForAggregateColumn returns null when source has no matching type
    Given aggregate column mapping input as JSON:
      """
      {"aggregateColumnIndex":3,"aggregateColumns":[{"index":3,"title":"In progress","type":"in_progress"}],"sourceColumns":[{"index":1,"title":"Done","type":"done","isDone":true}]}
      """
    When I map an aggregate column to a source column index
    Then the numeric result should be null

  Scenario: sourceColumnIndexForAggregateColumn tolerates null column arrays
    Given aggregate column mapping input as JSON:
      """
      {"aggregateColumnIndex":3,"aggregateColumns":null,"sourceColumns":null}
      """
    When I map an aggregate column to a source column index
    Then the numeric result should be null

  Scenario: sourceColumnIndexForAggregateViewColumn resolves source column from card slug
    Given aggregate column mapping input as JSON:
      """
      {"card":{"sourceBoardSlug":"demo"},"viewModel":{"board":{"kind":"aggregate"},"columns":[{"index":3,"title":"In progress","type":"in_progress"}]},"sourceColumnDefs":{"demo":[{"index":2,"title":"Doing","type":"in_progress"}]},"aggregateColumnIndex":3}
      """
    When I map an aggregate view column to a source column index
    Then the numeric result should be 2

  Scenario: sourceColumnIndexForAggregateViewColumn returns null without sourceBoardSlug
    Given aggregate column mapping input as JSON:
      """
      {"card":{},"viewModel":{"board":{"kind":"aggregate"},"columns":[{"index":3,"title":"In progress","type":"in_progress"}]},"sourceColumnDefs":{"demo":[{"index":2,"title":"Doing","type":"in_progress"}]},"aggregateColumnIndex":3}
      """
    When I map an aggregate view column to a source column index
    Then the numeric result should be null

  Scenario: sourceColumnIndexForAggregateViewColumn uses standard columns when view model omits columns
    Given aggregate column mapping input as JSON:
      """
      {"card":{"sourceBoardSlug":"demo"},"viewModel":{"board":{"kind":"aggregate"}},"sourceColumnDefs":{"demo":[{"index":4,"title":"Waiting","type":"waiting"}]},"aggregateColumnIndex":4}
      """
    When I map an aggregate view column to a source column index
    Then the numeric result should be 4

  Scenario: sourceColumnIndexForAggregateViewColumn tolerates missing source column defs
    Given aggregate column mapping input as JSON:
      """
      {"card":{"sourceBoardSlug":"demo"},"viewModel":{"board":{"kind":"aggregate"},"columns":[{"index":3,"title":"In progress","type":"in_progress"}]},"aggregateColumnIndex":3}
      """
    When I map an aggregate view column to a source column index
    Then the numeric result should be null

  Scenario: columnWithType finds a column by workflow type
    Given columnWithType lookup input as JSON:
      """
      {"columns":[{"index":2,"title":"To do","type":"to_do"}],"type":"to_do"}
      """
    When I look up a column by type
    Then the looked-up column JSON should be:
      """
      {"index":2,"title":"To do","type":"to_do"}
      """

  Scenario: columnWithType returns undefined for null columns
    Given columnWithType lookup input as JSON:
      """
      {"columns":null,"type":"to_do"}
      """
    When I look up a column by type
    Then the looked-up column should be undefined

  Scenario: enrichAggregateBoardModel builds swimlanes from source board names
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"index":1,"slug":"demo"},{"index":2,"slug":"project"}]},"catalog":[{"slug":"demo","name":"Demo Board"},{"slug":"project","name":"Project"}]}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[{"index":1,"title":"Demo Board"},{"index":2,"title":"Project"}],"users":[],"sources":[{"index":1,"slug":"demo"},{"index":2,"slug":"project"}]}
      """

  Scenario: enrichAggregateBoardModel returns non-aggregate models unchanged
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"normal","slug":"solo"}},"catalog":[{"slug":"solo","name":"Solo"}]}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"normal","slug":"solo"}}
      """

  Scenario: enrichAggregateBoardModel skips blank source slugs and falls back to slug titles
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"index":1,"slug":""},{"index":2,"slug":"missing-name"},{"index":3,"slug":"blank-name"},{"index":4}]},"catalog":[{"slug":"blank-name","name":"   "}]}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[{"index":1,"title":"missing-name"},{"index":2,"title":"blank-name"}],"users":[],"sources":[{"index":1,"slug":""},{"index":2,"slug":"missing-name"},{"index":3,"slug":"blank-name"},{"index":4}]}
      """

  Scenario: enrichAggregateBoardModel treats missing source slug like blank
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"index":1}]},"catalog":null}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[],"users":[],"sources":[{"index":1}]}
      """

  Scenario: enrichAggregateBoardModel tolerates missing sources and catalog
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"}},"catalog":null}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[],"users":[]}
      """

  Scenario: enrichAggregateBoardModel uses slug titles when catalog is null
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"demo"}]},"catalog":null}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[{"index":1,"title":"demo"}],"users":[],"sources":[{"slug":"demo"}]}
      """

  Scenario: enrichAggregateBoardModel merges users from source board models
    Given aggregate enrich input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"demo"},{"slug":"project"}]},"catalog":[{"slug":"demo","name":"Demo"},{"slug":"project","name":"Project"}],"options":{"sourceModels":[{"users":[{"index":1,"email":"a@b.c","name":"Alice"}]},{"users":[{"index":1,"email":"b@c.d","name":"Bob"},{"index":2,"email":"a@b.c","name":"Al"}]}]}}
      """
    When I enrich the aggregate board model
    Then the board model JSON should be:
      """
      {"board":{"kind":"aggregate","slug":"all"},"columns":[{"index":1,"title":"Options","type":"options"},{"index":2,"title":"To do","type":"to_do"},{"index":3,"title":"In progress","type":"in_progress"},{"index":4,"title":"Waiting","type":"waiting"},{"index":5,"title":"Done","type":"done","isDone":true}],"swimlanes":[{"index":1,"title":"Demo"},{"index":2,"title":"Project"}],"users":[{"index":1,"email":"a@b.c","name":"Alice","active":true},{"index":2,"email":"b@c.d","name":"Bob","active":true}],"sources":[{"slug":"demo"},{"slug":"project"}]}
      """

  Scenario: mergeUsersFromSourceBoards dedupes by email and sorts by display name
    Given aggregate source board models as JSON:
      """
      [{"users":[{"index":1,"email":"zed@x.y","name":"Zed"}]},{"users":[{"index":1,"email":"a@b.c","name":"Alice"}]}]
      """
    When I merge users from aggregate source boards
    Then the JSON array result should be:
      """
      [{"index":1,"email":"a@b.c","name":"Alice","active":true},{"index":2,"email":"zed@x.y","name":"Zed","active":true}]
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

  Scenario: validateAggregateBoard allows empty sources when requireSources is false
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[]},"catalog":[],"options":{"requireSources":false}}
      """
    When I validate the aggregate board
    Then the validation message should be null

  Scenario: validateAggregateBoard returns null for non-aggregate boards
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"normal","slug":"solo"},"sources":[]},"catalog":[]}
      """
    When I validate the aggregate board
    Then the validation message should be null

  Scenario: validateAggregateBoard returns null for a valid aggregate board
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"demo"}]},"catalog":[{"slug":"demo","name":"Demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be null

  Scenario: validateAggregateBoard returns null when the board slug is omitted
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate"},"sources":[{"slug":"demo"}]},"catalog":[{"slug":"demo","name":"Demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be null

  Scenario: validateAggregateBoard rejects blank source slugs
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":""}]},"catalog":[{"slug":"demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Each aggregate source must have a slug.
      """

  Scenario: validateAggregateBoard rejects sources with missing slug keys
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"index":1}]},"catalog":[{"slug":"demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Each aggregate source must have a slug.
      """

  Scenario: validateAggregateBoard tolerates null catalog when validating sources
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"demo"}]},"catalog":null}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Aggregate source board not found in catalog: demo.
      """

  Scenario: validateAggregateBoard rejects self as a source
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"all"}]},"catalog":[{"slug":"all","name":"All"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      An aggregate board cannot include itself as a source.
      """

  Scenario: validateAggregateBoard rejects duplicate sources
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"demo"},{"slug":"demo"}]},"catalog":[{"slug":"demo","name":"Demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Duplicate aggregate source board: demo.
      """

  Scenario: validateAggregateBoard rejects unknown catalog slugs
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"missing"}]},"catalog":[{"slug":"demo","name":"Demo"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Aggregate source board not found in catalog: missing.
      """

  Scenario: validateAggregateBoard rejects nested aggregate sources
    Given aggregate validation input as JSON:
      """
      {"model":{"board":{"kind":"aggregate","slug":"all"},"sources":[{"slug":"nested"}]},"catalog":[{"slug":"nested","kind":"aggregate"}]}
      """
    When I validate the aggregate board
    Then the validation message should be:
      """
      Aggregate boards cannot include other aggregate boards (nested).
      """

  Scenario: iniTextIsAggregateBoard detects aggregate INI
    Given aggregate board INI text:
      """
      [board]
      name = Combined
      slug = combined
      kind = aggregate

      [sources.1]
      slug = demo
      """
    When I detect whether the INI text is an aggregate board
    Then the aggregate boolean result is "true"

  Scenario: iniTextIsAggregateBoard returns false for normal boards
    Given aggregate board INI text:
      """
      [board]
      name = Solo
      slug = solo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I detect whether the INI text is an aggregate board
    Then the aggregate boolean result is "false"

  Scenario: iniTextIsAggregateBoard returns false for invalid INI
    Given aggregate board INI text:
      """
      not valid ini
      """
    When I detect whether the INI text is an aggregate board
    Then the aggregate boolean result is "false"

  Scenario: iniTextIsAggregateBoard returns false for null input
    Given the aggregate board INI text is null
    When I detect whether the INI text is an aggregate board
    Then the aggregate boolean result is "false"

  Scenario: iniTextIsAggregateBoard returns false when parsing throws
    When I detect whether the INI text is an aggregate board assuming parse fails
    Then the aggregate boolean result is "false"

  Scenario: iniTextIsAggregateBoard ignores a leading UTF-8 BOM
    Given aggregate board INI text has a UTF-8 BOM prefix and content:
      """
      [board]
      slug = combined
      kind = aggregate
      """
    When I detect whether the INI text is an aggregate board
    Then the aggregate boolean result is "true"

  Scenario: cardStorageBoardSlug uses sourceBoardSlug on aggregate boards
    Given card storage slug input as JSON:
      """
      {"card":{"sourceBoardSlug":"demo"},"viewBoardSlug":"all","model":{"board":{"kind":"aggregate","slug":"all"}}}
      """
    When I resolve the card storage board slug
    Then the aggregate string result should be:
      """
      demo
      """

  Scenario: cardStorageBoardSlug falls back to the view slug without sourceBoardSlug
    Given card storage slug input as JSON:
      """
      {"card":{},"viewBoardSlug":"all","model":{"board":{"kind":"aggregate","slug":"all"}}}
      """
    When I resolve the card storage board slug
    Then the aggregate string result should be:
      """
      all
      """

  Scenario: cardStorageBoardSlug returns the view slug for normal boards
    Given card storage slug input as JSON:
      """
      {"card":{"sourceBoardSlug":"ignored"},"viewBoardSlug":"solo","model":{"board":{"kind":"normal","slug":"solo"}}}
      """
    When I resolve the card storage board slug
    Then the aggregate string result should be:
      """
      solo
      """
