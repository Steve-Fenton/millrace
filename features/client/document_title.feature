@document_title
Feature: document tab title helper
  setFlowDocumentTitle updates document.title using the Millrace tab conventions.

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
      | Admin       | Admin \| Millrace        |
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
