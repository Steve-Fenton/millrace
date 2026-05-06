Feature: boardModel
  Board INI → model mapping, user lists for the UI, owner rules, and Done-column validation.

  Scenario: ownerDisplayLabel returns empty when there is no owner email
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"","users":[]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      """

  Scenario: ownerDisplayLabel uses the configured display name when the email matches
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"ann@ex.com","users":[{"email":"ann@ex.com","name":"Ann User"}]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      Ann User
      """

  Scenario: ownerDisplayLabel falls back to email when the display name is blank
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"ann@ex.com","users":[{"email":"ann@ex.com","name":"  "}]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      ann@ex.com
      """

  Scenario: ownerDisplayLabel returns the raw owner when the email is not on the board
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"other@ex.com","users":[{"email":"ann@ex.com","name":"Ann"}]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      other@ex.com
      """

  Scenario: ownerDisplayLabel coalesces a nullish owner email and a null user name
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":null,"users":[{"email":"a@a.a","name":"A"}]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      """

  Scenario: ownerDisplayLabel uses an empty list when users is null
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"solo@x.y","users":null}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      solo@x.y
      """

  Scenario: ownerDisplayLabel stringifies a null user name
    Given the ownerDisplayLabel input JSON is:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"a@a.a","name":null}]}
      """
    When I run ownerDisplayLabel from boardModel
    Then the boardModel single-line result should be:
      """
      a@a.a
      """

  Scenario: boardUsersSortedForUi returns empty when users are missing or not an array
    Given the board users array JSON is:
      """
      null
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      []
      """

  Scenario: boardUsersSortedForUi treats a non-array users value as empty
    Given the board users array JSON is:
      """
      0
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      []
      """

  Scenario: boardUsersSortedForUi sorts by email when display names are blank
    Given the board users array JSON is:
      """
      [{"index":1,"email":"b@b.b","name":"   "},{"index":2,"email":"a@a.a","name":"   "}]
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      [{"index":2,"email":"a@a.a","name":"   "},{"index":1,"email":"b@b.b","name":"   "}]
      """

  Scenario: boardUsersSortedForUi filters using nullish coalescing on email
    Given the board users array JSON is:
      """
      [{"email":"keep@k.k","name":"K"},{"email":null,"name":"Drop"}]
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      [{"email":"keep@k.k","name":"K"}]
      """

  Scenario: boardUsersSortedForUi drops entries without an email and sorts by display name
    Given the board users array JSON is:
      """
      [{"index":1,"email":"z@z.z","name":"Zed"},{"index":2,"email":"","name":"No"},{"index":3,"email":"a@a.a","name":"Amy"}]
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      [{"index":3,"email":"a@a.a","name":"Amy"},{"index":1,"email":"z@z.z","name":"Zed"}]
      """

  Scenario: boardUsersSortedForUi tie-breaks equal display labels by email
    Given the board users array JSON is:
      """
      [{"index":1,"email":"z@z.z","name":"Same"},{"index":2,"email":"a@a.a","name":"Same"}]
      """
    When I run boardUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      [{"index":2,"email":"a@a.a","name":"Same"},{"index":1,"email":"z@z.z","name":"Same"}]
      """

  Scenario: boardActiveUsersSortedForUi excludes inactive users
    Given the board users array JSON is:
      """
      [{"index":1,"email":"a@a.a","name":"A","active":false},{"index":2,"email":"b@b.b","name":"B"}]
      """
    When I run boardActiveUsersSortedForUi from boardModel
    Then the boardModel array result JSON should be:
      """
      [{"index":2,"email":"b@b.b","name":"B"}]
      """

  Scenario: boardOwnerEmailsForFilter lists active user emails in display order
    Given the board users array JSON is:
      """
      [{"index":2,"email":"z@z.z","name":"Z","active":false},{"index":1,"email":"a@a.a","name":"Ann"}]
      """
    When I run boardOwnerEmailsForFilter from boardModel
    Then the boardModel array result JSON should be:
      """
      ["a@a.a"]
      """

  Scenario: boardUserEntryForEmail returns undefined for an empty lookup
    Given the boardUserEntryForEmail input JSON is:
      """
      {"users":[{"email":"a@a.a","name":"A"}],"email":""}
      """
    When I run boardUserEntryForEmail from boardModel
    Then the boardModel entry should be undefined

  Scenario: boardUserEntryForEmail finds a user case-insensitively
    Given the boardUserEntryForEmail input JSON is:
      """
      {"users":[{"email":"Pat@Ex.COM","name":"Pat"}],"email":"pat@ex.com"}
      """
    When I run boardUserEntryForEmail from boardModel
    Then the boardModel entry JSON should be:
      """
      {"email":"Pat@Ex.COM","name":"Pat"}
      """

  Scenario: boardUserEntryForEmail coalesces null users and a null email query
    Given the boardUserEntryForEmail input JSON is:
      """
      {"users":null,"email":"x@x.x"}
      """
    When I run boardUserEntryForEmail from boardModel
    Then the boardModel entry should be undefined

  Scenario: boardUserEntryForEmail coalesces a null email key
    Given the boardUserEntryForEmail input JSON is:
      """
      {"users":[{"email":"a@a.a","name":"A"}],"email":null}
      """
    When I run boardUserEntryForEmail from boardModel
    Then the boardModel entry should be undefined

  Scenario: boardUserEntryForEmail matches using nullish email on the user record
    Given the boardUserEntryForEmail input JSON is:
      """
      {"users":[{"email":null,"name":"Ghost"}],"email":"ghost@x.y"}
      """
    When I run boardUserEntryForEmail from boardModel
    Then the boardModel entry should be undefined

  Scenario: canAssignCardOwner allows an empty owner
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"","users":[{"email":"a@a.a","name":"A","active":false}],"previousOwnerEmail":"a@a.a"}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: canAssignCardOwner allows keeping the same owner even when inactive on the board
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"a@a.a","name":"A","active":false}],"previousOwnerEmail":"a@a.a"}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: canAssignCardOwner allows emails not listed on the board
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"outsider@x.y","users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":""}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: canAssignCardOwner blocks assigning an inactive listed user as a new owner
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"a@a.a","users":[{"email":"a@a.a","name":"A","active":false}],"previousOwnerEmail":"b@b.b"}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "false"

  Scenario: canAssignCardOwner coalesces null owner and previous owner strings
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":null,"users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":null}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: canAssignCardOwner omits previousOwnerEmail when checking assignment
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"new@n.n","users":[{"email":"new@n.n","name":"N"}]}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: canAssignCardOwner treats matching previous owner case-insensitively
    Given the canAssignCardOwner input JSON is:
      """
      {"ownerEmail":"A@A.A","users":[{"email":"a@a.a","name":"A"}],"previousOwnerEmail":"a@a.a"}
      """
    When I run canAssignCardOwner from boardModel
    Then the boardModel boolean result is "true"

  Scenario: sectionsToBoardModel builds columns swimlanes and users from parseIni-shaped sections
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"board":{"name":"Demo","slug":"demo"},"columns.2":{"title":"Doing","wip_limit":"3"},"columns.1":{"title":"Done","is_done":"true"},"swimlanes.1":{"title":"Main"},"users.1":{"email":"x@x.com","name":"X","active":"false"}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{"name":"Demo","slug":"demo"},"columns":[{"index":1,"title":"Done","isDone":true},{"index":2,"title":"Doing","wipLimit":3}],"swimlanes":[{"index":1,"title":"Main"}],"users":[{"index":1,"email":"x@x.com","name":"X","active":false}]}
      """

  Scenario: sectionsToBoardModel accepts camelCase wipLimit and is_done synonyms
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"columns.1":{"title":"Wip","wipLimit":"2","is_done":"yes"}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{},"columns":[{"index":1,"title":"Wip","isDone":true,"wipLimit":2}],"swimlanes":[],"users":[]}
      """

  Scenario: sectionsToBoardModel marks users inactive via inactive or explicit active false
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"users.1":{"email":"old@x.y","name":"Old","inactive":"true"},"users.2":{"email":"new@x.y","name":"New","Active":"NO"}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[{"index":1,"email":"old@x.y","name":"Old","active":false},{"index":2,"email":"new@x.y","name":"New","active":false}]}
      """

  Scenario: sectionsToBoardModel skips users with no email and defaults swimlane titles
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"users.1":{"email":"","name":"Ghost"},"swimlanes.9":{"title":null}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[{"index":9,"title":"Lane 9"}],"users":[]}
      """

  Scenario: sectionsToBoardModel defaults a missing column title and user display name
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"columns.3":{"is_done":"true"},"users.1":{"email":"e@e.e","name":null},"users.2":{"email":"f@f.f","name":""}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{},"columns":[{"index":3,"title":"Column 3","isDone":true}],"swimlanes":[],"users":[{"index":1,"email":"e@e.e","name":"e@e.e","active":true},{"index":2,"email":"f@f.f","name":"f@f.f","active":true}]}
      """

  Scenario: sectionsToBoardModel skips users when email key is null or missing
    Given the sections object JSON for sectionsToBoardModel is:
      """
      {"users.1":{"email":null,"name":"NoAddr"},"users.2":{"name":"NoEmailKey"}}
      """
    When I convert sections with sectionsToBoardModel
    Then the boardModel output JSON should be:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[]}
      """

  Scenario: parseBoardIni parses a board definition INI end to end
    Given the board INI text for parseBoardIni is:
      """
      [board]
      name = Demo

      [columns.1]
      title = Done
      is_done = true

      """
    When I parse board INI with parseBoardIni
    Then the boardModel output JSON should be:
      """
      {"board":{"name":"Demo"},"columns":[{"index":1,"title":"Done","isDone":true}],"swimlanes":[],"users":[]}
      """

  Scenario: userPreferenceSyncModeIsAutomatic is false only for manual
    Given the userPreferenceSyncModeIsAutomatic input JSON is:
      """
      {"syncMode":"Manual"}
      """
    When I run userPreferenceSyncModeIsAutomatic from boardModel
    Then the boardModel boolean result is "false"

  Scenario: userPreferenceSyncModeIsAutomatic defaults to true when sync mode is omitted
    Given the userPreferenceSyncModeIsAutomatic input JSON is:
      """
      {}
      """
    When I run userPreferenceSyncModeIsAutomatic from boardModel
    Then the boardModel boolean result is "true"

  Scenario: validateExactlyOneDoneColumn returns null when exactly one column is Done
    Given the validateExactlyOneDoneColumn model JSON is:
      """
      {"columns":[{"index":1,"title":"Todo"},{"index":2,"title":"Done","isDone":true}]}
      """
    When I run validateExactlyOneDoneColumn from boardModel
    Then the validation message should be null

  Scenario: validateExactlyOneDoneColumn reports when no Done column exists
    Given the validateExactlyOneDoneColumn model JSON is:
      """
      {"columns":[{"index":1,"title":"Todo"}]}
      """
    When I run validateExactlyOneDoneColumn from boardModel
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. None are marked.
      """

  Scenario: validateExactlyOneDoneColumn reports when multiple columns are Done
    Given the validateExactlyOneDoneColumn model JSON is:
      """
      {"columns":[{"index":1,"title":"D1","isDone":true},{"index":2,"title":"D2","isDone":true}]}
      """
    When I run validateExactlyOneDoneColumn from boardModel
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. These 2 are marked: D1, D2.
      """

  Scenario: validateExactlyOneDoneColumn treats non-array columns as empty
    Given the validateExactlyOneDoneColumn model JSON is:
      """
      {"columns":null}
      """
    When I run validateExactlyOneDoneColumn from boardModel
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. None are marked.
      """

  Scenario: validateExactlyOneDoneColumn labels unnamed Done columns by index
    Given the validateExactlyOneDoneColumn model JSON is:
      """
      {"columns":[{"index":5,"isDone":true},{"index":7,"isDone":true}]}
      """
    When I run validateExactlyOneDoneColumn from boardModel
    Then the validation message should be:
      """
      The board must have exactly one column marked Done. These 2 are marked: Column 5, Column 7.
      """
