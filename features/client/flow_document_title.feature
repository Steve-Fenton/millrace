@document_title
Feature: Millrace browser tab title
  Flow screens set `document.title` as `Page : Board | Millrace` when a board is
  in scope, otherwise `Page | Millrace`, using trimmed labels.

  Scenario Outline: project-scoped pages include board display name
    Given the document title is cleared
    When I set the flow document title to page "<page>" with board "<board>"
    Then the document title should be "<expected>"

    Examples:
      | page      | board | expected                   |
      | Board     | Demo  | Board : Demo \| Millrace |
      | Charts    | Demo  | Charts : Demo \| Millrace |
      | Completed | Demo  | Completed : Demo \| Millrace |

  Scenario Outline: pages without a project omit the board segment
    Given the document title is cleared
    When I set the flow document title to page "<page>" without a board
    Then the document title should be "<expected>"

    Examples:
      | page        | expected                  |
      | Boards      | Boards \| Millrace       |
      | Preferences | Preferences \| Millrace   |
      | Board       | Board \| Millrace        |

  Scenario: whitespace-only board name is treated as absent
    Given the document title is cleared
    When I set the flow document title to page "Board" with board "   "
    Then the document title should be "Board | Millrace"

  Scenario: empty page label falls back to the brand as the page segment
    Given the document title is cleared
    When I set the flow document title to empty page without a board
    Then the document title should be "Millrace | Millrace"

  Scenario: omitted page label matches empty string behavior
    Given the document title is cleared
    When I set the flow document title with undefined page label without a board
    Then the document title should be "Millrace | Millrace"
