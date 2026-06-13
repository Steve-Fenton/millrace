Feature: Board model from INI and UI helpers
  Map parsed board INI to a board model, sort and filter users for pickers, resolve
  owner labels, validate the Done column, and read preference sync mode.

  Scenario: ownerDisplayLabel returns empty when there is no owner email
    Given owner display label input as JSON:
      """
      {"ownerEmail":"","users":[]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      """

  Scenario: ownerDisplayLabel uses the configured display name when the email matches
    Given owner display label input as JSON:
      """
      {"ownerEmail":"ann@ex.com","users":[{"email":"ann@ex.com","name":"Ann User"}]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      Ann User
      """

  Scenario: ownerDisplayLabel falls back to email when the display name is blank
    Given owner display label input as JSON:
      """
      {"ownerEmail":"ann@ex.com","users":[{"email":"ann@ex.com","name":"  "}]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      ann@ex.com
      """

  Scenario: ownerDisplayLabel returns the raw owner when the email is not on the board
    Given owner display label input as JSON:
      """
      {"ownerEmail":"other@ex.com","users":[{"email":"ann@ex.com","name":"Ann"}]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      other@ex.com
      """

  Scenario: ownerDisplayLabel coalesces a nullish owner email and a null user name
    Given owner display label input as JSON:
      """
      {"ownerEmail":null,"users":[{"email":"a@a.a","name":"A"}]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      """

  Scenario: ownerDisplayLabel uses an empty list when users is null
    Given owner display label input as JSON:
      """
      {"ownerEmail":"solo@x.y","users":null}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      solo@x.y
      """

  Scenario: ownerDisplayLabel stringifies a null user name
    Given owner display label input as JSON:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"a@a.a","name":null}]}
      """
    When I compute the owner display label
    Then the single-line result should be:
      """
      a@a.a
      """

  Scenario: boardUsersSortedForUi returns empty when users are missing or not an array
    Given the board users list as JSON:
      """
      null
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      []
      """

  Scenario: boardUsersSortedForUi treats a non-array users value as empty
    Given the board users list as JSON:
      """
      0
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      []
      """

  Scenario: boardUsersSortedForUi sorts by email when display names are blank
    Given the board users list as JSON:
      """
      [{"index":1,"email":"b@b.b","name":"   "},{"index":2,"email":"a@a.a","name":"   "}]
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      [{"index":2,"email":"a@a.a","name":"   "},{"index":1,"email":"b@b.b","name":"   "}]
      """

  Scenario: boardUsersSortedForUi filters using nullish coalescing on email
    Given the board users list as JSON:
      """
      [{"email":"keep@k.k","name":"K"},{"email":null,"name":"Drop"}]
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      [{"email":"keep@k.k","name":"K"}]
      """

  Scenario: boardUsersSortedForUi drops entries without an email and sorts by display name
    Given the board users list as JSON:
      """
      [{"index":1,"email":"z@z.z","name":"Zed"},{"index":2,"email":"","name":"No"},{"index":3,"email":"a@a.a","name":"Amy"}]
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      [{"index":3,"email":"a@a.a","name":"Amy"},{"index":1,"email":"z@z.z","name":"Zed"}]
      """

  Scenario: boardUsersSortedForUi tie-breaks equal display labels by email
    Given the board users list as JSON:
      """
      [{"index":1,"email":"z@z.z","name":"Same"},{"index":2,"email":"a@a.a","name":"Same"}]
      """
    When I sort board users for the UI
    Then the JSON array result should be:
      """
      [{"index":2,"email":"a@a.a","name":"Same"},{"index":1,"email":"z@z.z","name":"Same"}]
      """

  Scenario: boardActiveUsersSortedForUi excludes inactive users
    Given the board users list as JSON:
      """
      [{"index":1,"email":"a@a.a","name":"A","active":false},{"index":2,"email":"b@b.b","name":"B"}]
      """
    When I sort active board users for the UI
    Then the JSON array result should be:
      """
      [{"index":2,"email":"b@b.b","name":"B"}]
      """

  Scenario: boardOwnerEmailsForFilter lists active user emails in display order
    Given the board users list as JSON:
      """
      [{"index":2,"email":"z@z.z","name":"Z","active":false},{"index":1,"email":"a@a.a","name":"Ann"}]
      """
    When I list owner emails for the owner filter
    Then the JSON array result should be:
      """
      ["a@a.a"]
      """

  Scenario: boardUserEntryForEmail returns undefined for an empty lookup
    Given board user lookup input as JSON:
      """
      {"users":[{"email":"a@a.a","name":"A"}],"email":""}
      """
    When I look up the board user by email
    Then the looked-up user should be undefined

  Scenario: boardUserEntryForEmail finds a user case-insensitively
    Given board user lookup input as JSON:
      """
      {"users":[{"email":"Pat@Ex.COM","name":"Pat"}],"email":"pat@ex.com"}
      """
    When I look up the board user by email
    Then the looked-up user JSON should be:
      """
      {"email":"Pat@Ex.COM","name":"Pat"}
      """

  Scenario: boardUserEntryForEmail coalesces null users and a null email query
    Given board user lookup input as JSON:
      """
      {"users":null,"email":"x@x.x"}
      """
    When I look up the board user by email
    Then the looked-up user should be undefined

  Scenario: boardUserEntryForEmail coalesces a null email key
    Given board user lookup input as JSON:
      """
      {"users":[{"email":"a@a.a","name":"A"}],"email":null}
      """
    When I look up the board user by email
    Then the looked-up user should be undefined

  Scenario: boardUserEntryForEmail matches using nullish email on the user record
    Given board user lookup input as JSON:
      """
      {"users":[{"email":null,"name":"Ghost"}],"email":"ghost@x.y"}
      """
    When I look up the board user by email
    Then the looked-up user should be undefined

  Scenario: canAssignCardOwner allows an empty owner
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"","users":[{"email":"a@a.a","name":"A","active":false}],"previousOwnerEmail":"a@a.a"}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "true"

  Scenario: canAssignCardOwner allows keeping the same owner even when no longer on the board
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"b@b.b","name":"B"}],"previousOwnerEmail":"a@a.a"}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "true"

  Scenario: canAssignCardOwner blocks emails not on the board when access is configured
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"outsider@x.y","users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":""}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "false"

  Scenario: canAssignCardOwner blocks assigning a user not on the board as a new owner
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"b@b.b","name":"B"}],"previousOwnerEmail":"c@c.c"}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "false"

  Scenario: canAssignCardOwner coalesces null owner and previous owner strings
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":null,"users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":null}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "true"

  Scenario: canAssignCardOwner omits previousOwnerEmail when checking assignment
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"new@n.n","users":[{"email":"new@n.n","name":"N"}]}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "true"

  Scenario: canAssignCardOwner treats matching previous owner case-insensitively
    Given card owner assignment input as JSON:
      """
      {"ownerEmail":"A@A.A","users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":"a@a.a"}
      """
    When I check whether the owner assignment is allowed
    Then the boolean result is "true"

  Scenario: sectionsToBoardModel builds columns swimlanes and users from parseIni-shaped sections
    Given INI-shaped sections as JSON:
      """
      {"board":{"name":"Demo","slug":"demo"},"columns.2":{"title":"Doing","wip_limit":"3"},"columns.1":{"title":"Done","is_done":"true"},"swimlanes.1":{"title":"Main"},"users.1":{"email":"x@x.com","name":"X","active":"false"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{"name":"Demo","slug":"demo"},"columns":[{"index":1,"title":"Done","type":"done","isDone":true},{"index":2,"title":"Doing","type":"in_progress","wipLimit":3}],"swimlanes":[{"index":1,"title":"Main"}],"users":[{"index":1,"email":"x@x.com","name":"X","active":false}]}
      """

  Scenario: sectionsToBoardModel accepts camelCase wipLimit and is_done synonyms
    Given INI-shaped sections as JSON:
      """
      {"columns.1":{"title":"Wip","wipLimit":"2","is_done":"yes"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[{"index":1,"title":"Wip","type":"done","isDone":true,"wipLimit":2}],"swimlanes":[],"users":[]}
      """

  Scenario: sectionsToBoardModel omits inactive legacy user sections
    Given INI-shaped sections as JSON:
      """
      {"users.1":{"email":"old@x.y","name":"Old","inactive":"true"},"users.2":{"email":"new@x.y","name":"New","Active":"NO"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[]}
      """

  Scenario: sectionsToBoardModel skips users with no email and defaults swimlane titles
    Given INI-shaped sections as JSON:
      """
      {"users.1":{"email":"","name":"Ghost"},"swimlanes.9":{"title":null}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[{"index":9,"title":"Lane 9"}],"users":[]}
      """

  Scenario: sectionsToBoardModel defaults a missing column title and user display name
    Given INI-shaped sections as JSON:
      """
      {"columns.3":{"is_done":"true"},"users.1":{"email":"e@e.e","name":null},"users.2":{"email":"f@f.f","name":""}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[{"index":3,"title":"Column 3","type":"done","isDone":true}],"swimlanes":[],"users":[{"index":1,"email":"e@e.e","name":"e@e.e","active":true},{"index":2,"email":"f@f.f","name":"f@f.f","active":true}]}
      """

  Scenario: sectionsToBoardModel skips users when email key is null or missing
    Given INI-shaped sections as JSON:
      """
      {"users.1":{"email":null,"name":"NoAddr"},"users.2":{"name":"NoEmailKey"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[]}
      """

  Scenario: parseBoardIni parses a board definition INI end to end
    Given board definition INI text:
      """
      [board]
      name = Demo

      [columns.1]
      title = Done
      is_done = true

      """
    When I parse the board definition INI
    Then the board model JSON should be:
      """
      {"board":{"name":"Demo"},"columns":[{"index":1,"title":"Done","type":"done","isDone":true}],"swimlanes":[],"users":[]}
      """

  Scenario: userPreferenceSyncModeIsAutomatic is false only for manual
    Given user preferences JSON:
      """
      {"syncMode":"Manual"}
      """
    When I detect automatic preference sync
    Then the boolean result is "false"

  Scenario: userPreferenceSyncModeIsAutomatic defaults to true when sync mode is omitted
    Given user preferences JSON:
      """
      {}
      """
    When I detect automatic preference sync
    Then the boolean result is "true"

  Scenario: validateExactlyOneDoneColumn returns null when exactly one column is Done
    Given board model for Done validation as JSON:
      """
      {"columns":[{"index":1,"title":"Todo","type":"to_do"},{"index":2,"title":"Done","type":"done","isDone":true}]}
      """
    When I validate exactly one Done column
    Then the validation message should be null

  Scenario: validateExactlyOneDoneColumn reports when no Done column exists
    Given board model for Done validation as JSON:
      """
      {"columns":[{"index":1,"title":"Todo","type":"to_do"}]}
      """
    When I validate exactly one Done column
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. None are marked.
      """

  Scenario: validateExactlyOneDoneColumn reports when multiple columns are Done
    Given board model for Done validation as JSON:
      """
      {"columns":[{"index":1,"title":"D1","type":"done","isDone":true},{"index":2,"title":"D2","type":"done","isDone":true}]}
      """
    When I validate exactly one Done column
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. These 2 are marked: D1, D2.
      """

  Scenario: validateExactlyOneDoneColumn treats non-array columns as empty
    Given board model for Done validation as JSON:
      """
      {"columns":null}
      """
    When I validate exactly one Done column
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. None are marked.
      """

  Scenario: sectionsToBoardModel reads column type from INI
    Given INI-shaped sections as JSON:
      """
      {"columns.1":{"title":"Ideas","type":"options"},"columns.2":{"title":"Active","type":"in_progress"},"columns.3":{"title":"Blocked","type":"waiting"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[{"index":1,"title":"Ideas","type":"options"},{"index":2,"title":"Active","type":"in_progress"},{"index":3,"title":"Blocked","type":"waiting"}],"swimlanes":[],"users":[]}
      """

  Scenario: sectionsToBoardModel prefers explicit type over legacy is_done
    Given INI-shaped sections as JSON:
      """
      {"columns.1":{"title":"Archive","type":"options","is_done":"true"}}
      """
    When I convert INI sections to a board model
    Then the board model JSON should be:
      """
      {"board":{},"columns":[{"index":1,"title":"Archive","type":"options"}],"swimlanes":[],"users":[]}
      """

  Scenario: validateExactlyOneDoneColumn labels unnamed Done columns by index
    Given board model for Done validation as JSON:
      """
      {"columns":[{"index":5,"isDone":true},{"index":7,"isDone":true}]}
      """
    When I validate exactly one Done column
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. These 2 are marked: Column 5, Column 7.
      """
