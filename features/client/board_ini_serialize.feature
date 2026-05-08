Feature: serializeBoardIniFromModel
  Serialize a BoardModel to tasks/*.ini text: [board], [columns.n], [swimlanes.n],
  [users.n], with indices in sorted order and stable section numbering.

  Scenario: empty model yields board header and column or swimlane comments only
    Given the board model JSON is:
      """
      {}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: board name and slug are written when present
    Given the board model JSON is:
      """
      {"board":{"name":"  Demo  ","slug":"my-board"}}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]
      name = Demo
      slug = my-board

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: columns are ordered by index then renumbered in output sections
    Given the board model JSON is:
      """
      {"board":{},"columns":[{"index":10,"title":"Last"},{"index":2,"title":"First"}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = First

      [columns.2]
      title = Last

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: column wip_limit and is_done are emitted when applicable
    Given the board model JSON is:
      """
      {"board":{},"columns":[{"index":1,"title":"Doing","wipLimit":5},{"index":2,"title":"Done","isDone":true}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Doing
      wip_limit = 5

      [columns.2]
      title = Done
      is_done = true

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: empty column title falls back to Column n
    Given the board model JSON is:
      """
      {"board":{},"columns":[{"index":1,"title":"   "}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Column 1

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: wip_limit is omitted when not a finite non-negative number
    Given the board model JSON is:
      """
      {"board":{},"columns":[{"index":1,"title":"A","wipLimit":-1},{"index":2,"title":"B","wipLimit":null}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = A

      [columns.2]
      title = B

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: swimlanes are ordered by index with default titles
    Given the board model JSON is:
      """
      {"board":{},"columns":[],"swimlanes":[{"index":3,"title":"Z"},{"index":1,"title":""}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      [swimlanes.1]
      title = Lane 1

      [swimlanes.2]
      title = Z

      """

  Scenario: users are ordered by index and inactive users get active = false
    Given the board model JSON is:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[{"index":2,"email":"zed@x.y","name":"Zed","active":false},{"index":1,"email":"a@b.c","name":"Alice"}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      [users.1]
      email = a@b.c
      name = Alice

      [users.2]
      email = zed@x.y
      name = Zed
      active = false

      """

  Scenario: null column title swimlane title and user email or name hit nullish branches
    Given the board model JSON is:
      """
      {"board":{},"columns":[{"index":1,"title":"Named"},{"index":2,"title":null}],"swimlanes":[{"index":1,"title":"Named lane"},{"index":2,"title":null}],"users":[{"index":1,"email":"x@y.z","name":null,"active":true},{"index":2,"email":null,"name":null,"active":false}]}
      """
    When I serialize with serializeBoardIniFromModel
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Named

      [columns.2]
      title = Column 2

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      [swimlanes.1]
      title = Named lane

      [swimlanes.2]
      title = Lane 2

      [users.1]
      email = x@y.z
      name = 

      [users.2]
      email = 
      name = 
      active = false

      """
