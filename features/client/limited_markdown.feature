@limited_markdown
Feature: Limited markdown rendering
  Card descriptions use `renderLimitedMarkdown` for a restricted, safe markdown subset.
  Multiline examples use doc strings; single-line outline cells use {NL} for newlines.

  Scenario: empty source shows placeholder
    Given limited markdown source is:
      """
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "P"
    And limited markdown block at index 0 text should be "Click to add a description (# headings and lists supported)."

  Scenario Outline: headings render expected level and text
    Given macro-encoded limited markdown source is "<source>"
    When I render limited markdown
    Then limited markdown block at index 0 tag should be "<tag>"
    And limited markdown block at index 0 text should be "<text>"

    Examples:
      | case | source    | tag | text  |
      | h1   | # One     | H1  | One   |
      | h2   | ## Two    | H2  | Two   |
      | h3   | ### Three | H3  | Three |

  Scenario: paragraph with inline formatting
    Given limited markdown source is:
      """
      **bold** *italic* ~~strike~~ `code` [link](https://example.com)
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "P"
    And limited markdown block at index 0 should contain element "strong" with text "bold"
    And limited markdown block at index 0 should contain element "em" with text "italic"
    And limited markdown block at index 0 should contain element "s" with text "strike"
    And limited markdown block at index 0 should contain element "code" with text "code"
    And limited markdown block at index 0 should contain link "link" with href "https://example.com/"

  Scenario: unordered list items render as a ul
    Given limited markdown source is:
      """
      - alpha
      - beta
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "UL"
    And limited markdown list item texts at block index 0 should be "alpha, beta"

  Scenario: ordered list items render as an ol
    Given limited markdown source is:
      """
      1. first
      2. second
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "OL"
    And limited markdown list item texts at block index 0 should be "first, second"

  Scenario: task list checkboxes reflect checked state
    Given limited markdown source is:
      """
      - [ ] open
      - [x] done
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "UL"
    And limited markdown task checkbox states at block index 0 should be "false, true"

  Scenario: fenced code block preserves content
    Given limited markdown source is:
      """
      ```js
      const x = 1;
      ```
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "PRE"
    And limited markdown code block text at block index 0 should be:
      """
      const x = 1;
      """

  Scenario: GFM table renders header and body rows
    Given limited markdown source is:
      """
      | A | B |
      | --- | --- |
      | x | y |
      """
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "TABLE"
    And limited markdown table header texts should be "A, B"
    And limited markdown table body cell at row 0 column 0 text should be "x"
    And limited markdown table body cell at row 0 column 1 text should be "y"

  Scenario: table cells support inline markdown
    Given limited markdown source is:
      """
      | Col |
      | --- |
      | **hi** |
      """
    When I render limited markdown
    Then limited markdown table body cell at row 0 column 0 should contain element "strong" with text "hi"

  Scenario: table column alignment follows separator row
    Given limited markdown source is:
      """
      | L | C | R |
      | :--- | :---: | ---: |
      | a | b | c |
      """
    When I render limited markdown
    Then limited markdown table column 0 alignment should be "left"
    And limited markdown table column 1 alignment should be "center"
    And limited markdown table column 2 alignment should be "right"

  Scenario: pipe-only line without separator renders as a paragraph
    Given macro-encoded limited markdown source is "| not a table |"
    When I render limited markdown
    Then limited markdown block count should be 1
    And limited markdown block at index 0 tag should be "P"
    And limited markdown block at index 0 text should be "| not a table |"

  Scenario: toggleMarkdownTaskLine flips a task marker
    Given limited markdown task toggle source is:
      """
      - [ ] todo
      - [x] done
      """
    When I toggle limited markdown task line 0
    Then limited markdown task toggle result line 0 should be "- [x] todo"
    When I toggle limited markdown task line 1
    Then limited markdown task toggle result line 1 should be "- [ ] done"
