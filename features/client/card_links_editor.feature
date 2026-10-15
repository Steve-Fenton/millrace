@card_links_editor
Feature: Card links editor
  `createLinksEditor()` builds the "Links" field in the add-card and edit-card dialogs.
  Each link row contains a URL input, an icon button that opens the link in a new tab,
  a link text input, and an icon button to remove the link.

  Scenario: builds link rows with open-in-new-tab icon button after URL input
    When I create a links editor with initial links:
      | text | url                     |
      | Repo | https://github.com/demo |
    Then the links editor should have 1 row
    And row 1 elements should be in order: url input, open link, text input, remove button
    And row 1 open link should have class "flow-link-open"
    And row 1 open link should have aria-label "Open link in new tab"
    And row 1 open link should have target "_blank"
    And row 1 open link should have rel "noopener noreferrer"
    And row 1 open link should have href "https://github.com/demo"
    And row 1 open link icon should have class "flow-link-open-icon"
    And row 1 open link icon should have viewBox "0 0 24 24"
    And row 1 open link icon should have stroke-width "1.75"

  Scenario: open link href updates dynamically as the URL input changes
    When I create a links editor with empty links
    And I click the add link button
    Then row 1 open link should have class "is-disabled"
    And row 1 open link should have aria-disabled "true"
    And row 1 open link should not have an href attribute
    When I type "https://example.com/docs" into row 1 url input
    Then row 1 open link should not have class "is-disabled"
    And row 1 open link should not have an aria-disabled attribute
    And row 1 open link should have href "https://example.com/docs"

  Scenario: URL input without scheme automatically resolves to https://
    When I create a links editor with initial links:
      | text | url         |
      | Site | example.com |
    Then row 1 open link should have href "https://example.com"

  Scenario: clicking add link creates a row with empty URL and disabled open link
    When I create a links editor with empty links
    And I click the add link button
    Then the links editor should have 1 row
    And row 1 url input should be empty
    And row 1 open link should have class "is-disabled"

  Scenario: getLinks returns valid links and ignores empty URLs
    When I create a links editor with initial links:
      | text  | url                   |
      | Alpha | https://example.com/1 |
      | Beta  |                       |
    Then getLinks should return 1 link:
      | text  | url                   |
      | Alpha | https://example.com/1 |
