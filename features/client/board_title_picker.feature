@board_title_picker
Feature: Board title picker
  The header board switcher groups aggregate boards first, then normal boards,
  and filters the dropdown instantly as the user types.

  Scenario Outline: boardMatchesPickerFilter matches name or slug case-insensitively
    When I check board picker filter match for board JSON:
      """
      <board>
      """
    And I use board picker filter query "<query>"
    Then the board picker filter match should be <match>

    Examples:
      | board                                                               | query   | match |
      | { "slug": "project", "name": "Project" }                            |         | true  |
      | { "slug": "project", "name": "Project" }                            | project | true  |
      | { "slug": "project", "name": "Project" }                            | PRO     | true  |
      | { "slug": "test-board", "name": "Test Board" }                      | board   | true  |
      | { "slug": "all-boards", "name": "All Boards", "kind": "aggregate" } | demo | false |
      | { "slug": "demo", "name": "Demo" }                                  | xyz     | false |

  Scenario: boardsForTitlePicker groups aggregate boards before normal boards
    When I group boards for the title picker from JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "all-boards", "name": "All Boards", "kind": "aggregate" },
        { "slug": "demo", "name": "Demo" },
        { "slug": "zeta", "name": "Zeta Aggregate", "kind": "aggregate" }
      ]
      """
    Then the grouped board picker aggregate slugs should be "all-boards,zeta"
    And the grouped board picker normal slugs should be "demo,project"

  Scenario: a single board renders as a plain title
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    Then the board title picker should be a plain heading titled "Demo"

  Scenario: multiple boards render aggregate boards, a separator, then normal boards
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "all-boards", "name": "All Boards", "kind": "aggregate" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    Then the board title picker option labels should be "All Boards,Demo,Project"
    And the board title picker separator should be visible

  Scenario: opening the picker focuses the filter input
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    Then the board title picker filter input should be focused

  Scenario: filtering hides non-matching boards
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "all-boards", "name": "All Boards", "kind": "aggregate" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I filter the board title picker with "project"
    Then the visible board title picker option labels should be "Project"
    And the board title picker separator should be hidden

  Scenario: filtering with no matches shows an empty state
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I filter the board title picker with "missing"
    Then the board title picker list should be hidden
    And the board title picker empty message should be visible

  Scenario: selecting another board invokes the picker callback
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I choose board title picker option "Project"
    Then the board title picker selected slug should be "project"

  Scenario Outline: pickActiveSlug prefers a valid stored slug
    Given board picker catalog JSON:
      """
      [
        { "slug": "demo", "name": "Demo" },
        { "slug": "project", "name": "Project" }
      ]
      """
    When I pick the active board slug with stored slug "<stored>"
    Then the picked active board slug should be "<expected>"

    Examples:
      | stored  | expected |
      | project | project  |
      | missing | demo     |
      |         | demo     |

  Scenario: pickActiveSlug falls back when the catalog is empty
    Given board picker catalog JSON:
      """
      []
      """
    When I pick the active board slug with stored slug "demo"
    Then the picked active board slug should be "board"

  Scenario: readStoredActiveBoardSlug trims whitespace
    Given localStorage active board slug is "  demo  "
    When I read the stored active board slug
    Then the stored active board slug should be "demo"

  Scenario: writeStoredActiveBoardSlug persists the slug
    When I write stored active board slug "project"
    Then localStorage active board slug should be "project"

  Scenario: resolveActiveBoardSelection reads the flow API catalog
    Given the flow API returns boards JSON:
      """
      [
        { "slug": "demo", "name": "Demo", "file": "demo.ini" },
        { "slug": "project", "name": "Project", "file": "project.ini", "kind": "aggregate" }
      ]
      """
    And localStorage active board slug is "project"
    When I resolve the active board selection
    Then the resolved board slugs should be "demo,project"
    And the resolved active board slug should be "project"

  Scenario: resolveActiveBoardSelection normalises an invalid stored slug
    Given the flow API returns boards JSON:
      """
      [
        { "slug": "demo", "name": "Demo" },
        { "slug": "project", "name": "Project" }
      ]
      """
    And localStorage active board slug is "missing"
    When I resolve the active board selection
    Then the resolved active board slug should be "demo"
    And localStorage active board slug should be "demo"

  Scenario: resolveActiveBoardSelection falls back when the flow API fails
    Given the flow API returns status 500
    When I resolve the active board selection
    Then the resolved board slugs should be "board"
    And the resolved active board slug should be "board"

  Scenario: resolveActiveBoardSelection falls back when the flow API returns invalid JSON
    Given the flow API returns ok with invalid JSON
    When I resolve the active board selection
    Then the resolved board slugs should be "board"
    And the resolved active board slug should be "board"

  Scenario: resolveActiveBoardSelection skips invalid catalog rows
    Given the flow API returns boards JSON:
      """
      [
        null,
        { "name": "No slug" },
        { "slug": "demo", "name": "  ", "file": "demo.ini", "kind": "aggregate" }
      ]
      """
    When I resolve the active board selection
    Then the resolved board slugs should be "demo"
    And the resolved board names should be "demo"

  Scenario: closing the picker clears the filter
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I filter the board title picker with "project"
    And I close the board title picker
    Then the board title picker panel should be hidden
    And the board title picker filter value should be ""

  Scenario: pressing Escape in the filter closes the picker
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I press Escape in the board title picker filter
    Then the board title picker panel should be hidden
    And the board title picker trigger should be focused

  Scenario: clicking outside the picker closes it
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I mousedown outside the board title picker
    Then the board title picker panel should be hidden

  Scenario: pressing Escape on the picker closes it when the filter is not focused
    Given a board title picker for boards JSON:
      """
      [
        { "slug": "project", "name": "Project" },
        { "slug": "demo", "name": "Demo" }
      ]
      """
    And the board title picker active slug is "demo"
    When I open the board title picker
    And I focus the board title picker trigger
    And I press Escape on the board title picker
    Then the board title picker panel should be hidden
    And the board title picker trigger should be focused

  Scenario: resolveActiveBoardSelection falls back when the flow API returns an empty catalog
    Given the flow API returns boards JSON:
      """
      []
      """
    When I resolve the active board selection
    Then the resolved board slugs should be "board"
    And the resolved active board slug should be "board"

  Scenario: readStoredActiveBoardSlug returns empty when localStorage is unavailable
    Given localStorage read is blocked
    When I read the stored active board slug
    Then the stored active board slug should be ""

  Scenario: writeStoredActiveBoardSlug ignores localStorage write failures
    Given localStorage write is blocked
    When I write stored active board slug "project"
    Then localStorage should have no active board slug
