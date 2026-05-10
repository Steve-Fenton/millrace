Feature: Card column and swimlane index resolution
  Pick default indices from the board and map `item.column` / `item.swimlane`
  text to the right section index (`columns.N`, titles, or bare numbers).

  # --- defaultColumnIndex ---

  Scenario: defaultColumnIndex returns 1 when there are no columns
    Given columns on the board as JSON:
      """
      []
      """
    When I compute the default column index
    Then the resolved index should be 1

  Scenario: defaultColumnIndex returns the smallest column index
    Given columns on the board as JSON:
      """
      [{"index":9,"title":"Last"},{"index":2,"title":"First"}]
      """
    When I compute the default column index
    Then the resolved index should be 2

  # --- resolveCardColumnIndex ---

  Scenario: resolveCardColumnIndex uses default when raw is empty
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":4,"title":"A"},{"index":7,"title":"B"}],"raw":""}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 4

  Scenario: resolveCardColumnIndex uses default when raw is omitted
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":3,"title":"Only"}]}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 3

  Scenario: resolveCardColumnIndex parses columns.N form case-insensitively
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":2,"title":"x"},{"index":5,"title":"y"}],"raw":"COLUMNS.5"}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 5

  Scenario: resolveCardColumnIndex parses bare numeric index when it exists on the board
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":12,"title":"Lane"}],"raw":"12"}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 12

  Scenario: resolveCardColumnIndex falls back when numeric index is not on the board
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":2,"title":"A"}],"raw":"99"}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 2

  Scenario: resolveCardColumnIndex falls back when columns.N names a missing index
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":2,"title":"A"}],"raw":"columns.500"}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 2

  Scenario: resolveCardColumnIndex matches column title case-insensitively
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":8,"title":"In Progress"}],"raw":"  in PROGRESS  "}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 8

  Scenario: resolveCardColumnIndex returns default for unrecognized text
    Given card column resolution input as JSON:
      """
      {"columns":[{"index":1,"title":"A"},{"index":3,"title":"B"}],"raw":"unknown-column"}
      """
    When I resolve the card column index from item text
    Then the resolved index should be 1

  # --- defaultSwimlaneIndex ---

  Scenario: defaultSwimlaneIndex returns 0 when there are no swimlanes
    Given swimlanes on the board as JSON:
      """
      []
      """
    When I compute the default swimlane index
    Then the resolved index should be 0

  Scenario: defaultSwimlaneIndex returns the smallest swimlane index
    Given swimlanes on the board as JSON:
      """
      [{"index":10,"title":"Z"},{"index":4,"title":"A"}]
      """
    When I compute the default swimlane index
    Then the resolved index should be 4

  # --- resolveCardSwimlaneIndex ---

  Scenario: resolveCardSwimlaneIndex uses default when raw is empty
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":6,"title":"S1"},{"index":9,"title":"S2"}],"raw":""}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 6

  Scenario: resolveCardSwimlaneIndex uses default when raw is omitted
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":7,"title":"Only"}]}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 7

  Scenario: resolveCardSwimlaneIndex parses swimlanes.N form case-insensitively
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":1,"title":"a"},{"index":3,"title":"b"}],"raw":"SWIMLANES.3"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 3

  Scenario: resolveCardSwimlaneIndex parses bare numeric index when it exists on the board
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":11,"title":"Main"}],"raw":"11"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 11

  Scenario: resolveCardSwimlaneIndex falls back when numeric index is not on the board
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":5,"title":"X"}],"raw":"44"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 5

  Scenario: resolveCardSwimlaneIndex falls back when swimlanes.N names a missing index
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":2,"title":"Y"}],"raw":"swimlanes.999"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 2

  Scenario: resolveCardSwimlaneIndex matches swimlane title case-insensitively
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":4,"title":"Team Alpha"}],"raw":"team ALPHA"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 4

  Scenario: resolveCardSwimlaneIndex returns default for unrecognized text
    Given card swimlane resolution input as JSON:
      """
      {"swimlanes":[{"index":3,"title":"P"},{"index":8,"title":"Q"}],"raw":"nosuchlane"}
      """
    When I resolve the swimlane index from item text
    Then the resolved index should be 3
