Feature: Board model to tasks INI format
  The client turns an in-memory board model into the text shape stored under tasks/*.ini:
  [board], [columns.n], [swimlanes.n], and [users.n]. Rows are ordered by index;
  output section numbers are stable (1, 2, …) after sorting.

  Scenario: empty model yields board header and guidance comments only
    Given a board model:
      """
      {}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: board name and slug are written when present
    Given a board model:
      """
      {"board":{"name":"  Demo  ","slug":"my-board"}}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]
      name = Demo
      slug = my-board

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: columns are ordered by index then renumbered in output sections
    Given a board model:
      """
      {"board":{},"columns":[{"index":10,"title":"Last"},{"index":2,"title":"First"}]}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = First
      type = in_progress

      [columns.2]
      title = Last
      type = in_progress

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: column wip_limit and type are emitted for each column
    Given a board model:
      """
      {"board":{},"columns":[{"index":1,"title":"Doing","type":"in_progress","wipLimit":5},{"index":2,"title":"Done","type":"done","isDone":true}]}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Doing
      wip_limit = 5
      type = in_progress

      [columns.2]
      title = Done
      type = done

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: empty column title falls back to Column n
    Given a board model:
      """
      {"board":{},"columns":[{"index":1,"title":"   "}]}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Column 1
      type = in_progress

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: wip_limit is omitted when not a finite non-negative number
    Given a board model:
      """
      {"board":{},"columns":[{"index":1,"title":"A","wipLimit":-1},{"index":2,"title":"B","wipLimit":null}]}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = A
      type = in_progress

      [columns.2]
      title = B
      type = in_progress

      ; Swimlanes split the board horizontally (e.g. by team or stream).
      """

  Scenario: swimlanes are ordered by index with default titles
    Given a board model:
      """
      {"board":{},"columns":[],"swimlanes":[{"index":3,"title":"Z"},{"index":1,"title":""}]}
      """
    When I serialize the board model to tasks INI
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
    Given a board model:
      """
      {"board":{},"columns":[],"swimlanes":[],"users":[{"index":2,"email":"zed@x.y","name":"Zed","active":false},{"index":1,"email":"a@b.c","name":"Alice"}]}
      """
    When I serialize the board model to tasks INI
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

  Scenario: null titles and optional user fields use defaults or empty values
    Given a board model:
      """
      {"board":{},"columns":[{"index":1,"title":"Named"},{"index":2,"title":null}],"swimlanes":[{"index":1,"title":"Named lane"},{"index":2,"title":null}],"users":[{"index":1,"email":"x@y.z","name":null,"active":true},{"index":2,"email":null,"name":null,"active":false}]}
      """
    When I serialize the board model to tasks INI
    Then the INI output should be:
      """
      [board]

      ; Columns appear in list order by section index (columns.1, columns.2, …).
      [columns.1]
      title = Named
      type = in_progress

      [columns.2]
      title = Column 2
      type = in_progress

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
