Feature: Board INI change summary
  From earlier and later board INI text (as in a git diff), produce short readable
  lines: board name change, column / swimlane add / remove / reorder, WIP and done
  marker tweaks, board user changes, parse failures, and added / removed files.

  Scenario: parse failure on the before text
    When I summarize the board INI diff assuming the earlier version fails to parse
    Then the board diff summary JSON should be:
      """
      ["(Could not parse earlier version)"]
      """

  Scenario: parse failure on the after text
    When I summarize the board INI diff assuming the later version fails to parse
    Then the board diff summary JSON should be:
      """
      ["(Could not parse this version)"]
      """

  Scenario: both raw values are nullish
    Given the earlier board INI text is null
    And the later board INI text is undefined
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      []
      """

  Scenario: new board file in commit
    Given the earlier board INI text is:
      """

      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["New file in this commit."]
      """

  Scenario: board file removed in commit
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """

      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["File removed in this commit."]
      """

  Scenario: only comment / whitespace changed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      ; reordered the file but kept content
      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["(No tracked board changes — whitespace or comments only.)"]
      """

  Scenario: board renamed
    Given the earlier board INI text is:
      """
      [board]
      name = Project
      slug = project

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Roadmap
      slug = project

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Board name: Project → Roadmap"]
      """

  Scenario: column added at the end
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Column added: Doing"]
      """

  Scenario: column removed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Column removed: Doing"]
      """

  Scenario: columns reordered with same set of titles
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = Doing

      [columns.2]
      title = To Do

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Columns reordered: Doing, To Do, Done"]
      """

  Scenario: column WIP limit changed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing
      wip_limit = 1

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing
      wip_limit = 3

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["WIP limit (Doing): 1 → 3"]
      """

  Scenario: column WIP limit removed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing
      wip_limit = 2

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["WIP limit (Doing): 2 → —"]
      """

  Scenario: done marker moves to a different column title
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do
      is_done = true

      [columns.2]
      title = Done
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      [
        "Done marker (To Do): no → yes",
        "Done marker (Done): yes → no"
      ]
      """

  Scenario: swimlane added
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Default
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Default

      [swimlanes.2]
      title = Desserts
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Swimlane added: Desserts"]
      """

  Scenario: swimlanes reordered
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Alpha

      [swimlanes.2]
      title = Beta
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Beta

      [swimlanes.2]
      title = Alpha
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Swimlanes reordered: Beta, Alpha"]
      """

  Scenario: user added and a user removed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = leaving@example.com
      name = Leaving
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = joining@example.com
      name = Joining
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      [
        "User added: joining@example.com",
        "User removed: leaving@example.com"
      ]
      """

  Scenario: user display name changed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice Smith
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["User name (alice@example.com): Alice → Alice Smith"]
      """

  Scenario: user deactivated
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice
      active = false
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["User deactivated: alice@example.com"]
      """

  Scenario: user activated
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice
      inactive = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = alice@example.com
      name = Alice
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["User activated: alice@example.com"]
      """

  Scenario: combination of changes is capped at fourteen lines
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = C1

      [columns.2]
      title = C2

      [columns.3]
      title = C3

      [columns.4]
      title = C4

      [columns.5]
      title = C5

      [columns.6]
      title = C6

      [columns.7]
      title = C7

      [columns.8]
      title = C8

      [columns.9]
      title = C9

      [columns.10]
      title = C10

      [columns.11]
      title = C11

      [columns.12]
      title = C12

      [columns.13]
      title = C13

      [columns.14]
      title = C14

      [columns.15]
      title = C15
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo Renamed
      slug = demo

      [columns.1]
      title = D1

      [columns.2]
      title = D2

      [columns.3]
      title = D3

      [columns.4]
      title = D4

      [columns.5]
      title = D5

      [columns.6]
      title = D6

      [columns.7]
      title = D7

      [columns.8]
      title = D8

      [columns.9]
      title = D9

      [columns.10]
      title = D10

      [columns.11]
      title = D11

      [columns.12]
      title = D12

      [columns.13]
      title = D13

      [columns.14]
      title = D14

      [columns.15]
      title = D15
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should have at most 14 lines

  Scenario: swimlane removed
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Alpha

      [swimlanes.2]
      title = Beta
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [swimlanes.1]
      title = Alpha
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Swimlane removed: Beta"]
      """

  Scenario: column WIP limit added where there was none
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Doing
      wip_limit = 4

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["WIP limit (Doing): — → 4"]
      """

  Scenario: leading BOM on earlier text is ignored when content matches
    Given the earlier board INI text has a UTF-8 BOM prefix and content:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["(No tracked board changes — whitespace or comments only.)"]
      """

  Scenario: duplicate user emails in earlier file collapse to one removal
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = dup@example.com
      name = Dup One

      [users.2]
      email = dup@example.com
      name = Dup Two
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["User removed: dup@example.com"]
      """

  Scenario: board name appears when earlier file had no name key
    Given the earlier board INI text is:
      """
      [board]
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Named later
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["Board name: ∅ → Named later"]
      """

  Scenario: duplicate user emails in later file collapse to one user added
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true

      [users.1]
      email = join@example.com
      name = Join A

      [users.2]
      email = join@example.com
      name = Join B
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["User added: join@example.com"]
      """

  Scenario: duplicate column titles are ignored for attribute map
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = Lane

      [columns.2]
      title = Lane

      [columns.3]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = Lane

      [columns.2]
      title = Lane

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      ["(No tracked board changes — whitespace or comments only.)"]
      """

  Scenario: column added and renamed in the same edit
    Given the earlier board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = To Do

      [columns.2]
      title = Done
      is_done = true
      """
    And the later board INI text is:
      """
      [board]
      name = Demo
      slug = demo

      [columns.1]
      title = Ideas

      [columns.2]
      title = Doing

      [columns.3]
      title = Done
      is_done = true
      """
    When I summarize the board INI diff
    Then the board diff summary JSON should be:
      """
      [
        "Column added: Ideas",
        "Column added: Doing",
        "Column removed: To Do"
      ]
      """
