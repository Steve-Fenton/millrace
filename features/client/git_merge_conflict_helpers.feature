Feature: Git merge conflict helpers
  Count hunks, read the first conflict (ours/theirs and branch labels), replace it
  with one side, and detect unresolved marker lines. Tables use macros so cells
  avoid raw markers: {NL} newline, {MARK_BEGIN} <<<<<<<, {MARK_MID} =======,
  {MARK_END} >>>>>>>.

  Scenario Outline: counting conflict hunks (lines starting with <<<<<<<)
    Given a conflict document encoded as "<text>"
    When I count conflict hunks in the document
    Then the conflict hunk count should be <n>

    Examples:
      | case            | text                                                                                                                                                                                                 | n |
      | empty           |                                                                                                                                                                                                      | 0 |
      | plain text      | hello world                                                                                                                                                                                          | 0 |
      | one hunk        | {MARK_BEGIN} HEAD{NL}a{NL}{MARK_MID}{NL}b{NL}{MARK_END} tail                                                                                                                                           | 1 |
      | two hunks       | {MARK_BEGIN} A{NL}1{NL}{MARK_MID}{NL}2{NL}{MARK_END} B{NL}{MARK_BEGIN} C{NL}3{NL}{MARK_MID}{NL}4{NL}{MARK_END} D                                                                                       | 2 |
      | only mid line   | x{NL}{MARK_MID}{NL}y                                                                                                                                                                                 | 0 |

  Scenario Outline: reading the first conflict hunk (ours, theirs, labels)
    Given a conflict document encoded as "<text>"
    When I get the first conflict hunk from the document
    Then the first hunk ours text should be encoded as "<ours>"
    And the first hunk theirs text should be encoded as "<theirs>"
    And the first hunk head label should be "<headLabel>"
    And the first hunk their label should be "<theirLabel>"

    Examples:
      | case                | text                                                                                                 | ours | theirs | headLabel | theirLabel |
      | labels stripped     | {MARK_BEGIN}  HEAD  {NL}line-a{NL}{MARK_MID}{NL}line-b{NL}{MARK_END}  branch-x  | line-a | line-b | HEAD | branch-x |
      | multiline sides     | {MARK_BEGIN} H{NL}o1{NL}o2{NL}{MARK_MID}{NL}t1{NL}{MARK_END} T | o1{NL}o2 | t1 | H | T |
      | prefix before hunk  | intro{NL}{MARK_BEGIN} H{NL}a{NL}{MARK_MID}{NL}b{NL}{MARK_END} T | a | b | H | T |

  Scenario: no markers means no first hunk
    Given a conflict document encoded as "just text"
    When I get the first conflict hunk from the document
    Then there is no first conflict hunk

  Scenario: missing middle marker means no first hunk
    Given a conflict document encoded as "{MARK_BEGIN} H{NL}only-ours"
    When I get the first conflict hunk from the document
    Then there is no first conflict hunk

  Scenario: missing closing marker means no first hunk
    Given a conflict document encoded as "{MARK_BEGIN} H{NL}a{NL}{MARK_MID}{NL}b"
    When I get the first conflict hunk from the document
    Then there is no first conflict hunk

  Scenario Outline: replacing the first hunk with ours or theirs
    Given a conflict document encoded as "<text>"
    When I replace the first conflict hunk choosing "<side>"
    Then the document should become encoded as "<expected>"

    Examples:
      | case             | text                                                                                       | side   | expected                          |
      | choose ours      | {MARK_BEGIN} H{NL}keep-ours{NL}{MARK_MID}{NL}keep-theirs{NL}{MARK_END} T | ours   | keep-ours                         |
      | choose theirs    | {MARK_BEGIN} H{NL}keep-ours{NL}{MARK_MID}{NL}keep-theirs{NL}{MARK_END} T | theirs | keep-theirs                       |
      | preserves prefix | before{NL}{MARK_BEGIN} H{NL}a{NL}{MARK_MID}{NL}b{NL}{MARK_END} T | ours | before{NL}a |
      | second hunk stays  | {MARK_BEGIN} H1{NL}o1{NL}{MARK_MID}{NL}t1{NL}{MARK_END} T1{NL}{MARK_BEGIN} H2{NL}o2{NL}{MARK_MID}{NL}t2{NL}{MARK_END} T2 | ours | o1{NL}{MARK_BEGIN} H2{NL}o2{NL}{MARK_MID}{NL}t2{NL}{MARK_END} T2 |

  Scenario: replace leaves plain text unchanged when there is no conflict
    Given a conflict document encoded as "no markers here"
    When I replace the first conflict hunk choosing "ours"
    Then the document should become encoded as "no markers here"

  Scenario Outline: replace leaves malformed hunks unchanged
    Given a conflict document encoded as "<text>"
    When I replace the first conflict hunk choosing "ours"
    Then the document should stay encoded as "<text>"

    Examples:
      | case              | text                                      |
      | missing middle    | {MARK_BEGIN} H{NL}only                      |
      | missing end       | {MARK_BEGIN} H{NL}a{NL}{MARK_MID}{NL}b      |

  Scenario: nullish documents behave like empty strings
    Given the conflict document raw value is null
    When I count conflict hunks in the document
    Then the conflict hunk count should be 0
    When I get the first conflict hunk from the document
    Then there is no first conflict hunk
    When I ask whether the document has conflict marker lines
    Then the answer should be false
    When I replace the first conflict hunk choosing "ours"
    Then the replaced document raw should be null

  Scenario: undefined document behaves like empty for helpers
    Given the conflict document raw value is undefined
    When I count conflict hunks in the document
    Then the conflict hunk count should be 0
    When I replace the first conflict hunk choosing "theirs"
    Then the replaced document raw should be undefined

  Scenario Outline: detecting unresolved conflict marker lines
    Given a conflict document encoded as "<text>"
    When I ask whether the document has conflict marker lines
    Then the answer should be <present>

    Examples:
      | case        | text                                              | present |
      | clean       | hello                                             | false   |
      | begin line  | {MARK_BEGIN} HEAD                                 | true    |
      | middle line | x{NL}{MARK_MID}{NL}y                              | true    |
      | end line    | {MARK_END} branch                                 | true    |
