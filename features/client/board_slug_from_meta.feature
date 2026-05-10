Feature: Board filesystem slug from metadata
  Derive a URL-safe, lowercase slug from board meta: prefer `slug`, then `name`,
  then `board`; trim; swap bad characters for hyphens; collapse empties to `board`.

  Slug and name columns use __omit__ when the property is absent and __empty__
  when it is present as an empty string. The macro {SP2} stands for two spaces
  (so cells need not contain raw leading/trailing spaces).

  Scenario Outline: boardSlugFrom maps meta to a slug
    Given board meta with slug token "<slug>" and name token "<name>"
    When I derive the board slug from meta
    Then the derived slug should be "<expected>"

    Examples:
      | case                          | slug              | name              | expected    |
      | slug trims and lowercases     | My Board          | __omit__          | my-board    |
      | name fallback when slug omit  | __omit__          | Hello World       | hello-world |
      | slug wins over name           | primary           | secondary         | primary     |
      | both omitted uses default     | __omit__          | __omit__          | board       |
      | empty slug falls back to name | __empty__         | Alt Name          | alt-name    |
      | spaces become hyphens         | Foo Bar Baz       | __omit__          | foo-bar-baz |
      | punctuation becomes hyphens   | a!!b              | __omit__          | a-b         |
      | only punctuation is board     | !!!               | __omit__          | board       |
      | underscores preserved         | Test_Board        | __omit__          | test_board  |
      | dots preserved                | v1.2.3            | __omit__          | v1.2.3      |
      | trims surrounding whitespace  | {SP2}hello-world{SP2} | __omit__     | hello-world |
      | trims edge hyphens after norm | --hello--         | __omit__          | hello       |
