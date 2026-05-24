@card_deep_link
Feature: Card deep links and duplicate source links
  Build shareable board URLs for individual cards, parse them on load, and
  append a Source card link when duplicating.

  Scenario: normalizeCardId strips a trailing .ini extension
    When I normalize the card id "FLOW-abc123.ini"
    Then the normalized card id should be "FLOW-abc123"

  Scenario: cardMatchesId matches filename or item id
    When I check whether a card with filename "FLOW-x.ini" matches id "FLOW-x"
    Then the card id match result should be true
    When I check whether a card with id "FLOW-y" matches id "FLOW-y"
    Then the card id match result should be true
    When I check whether a card with filename "FLOW-z.ini" matches id "FLOW-other"
    Then the card id match result should be false

  Scenario: buildCardDeepLinkUrl encodes board slug and card id
    Given the browser location is "http://localhost:7713/index.html"
    When I build a card deep link for board "demo" and card "FLOW-abc123.ini"
    Then the card deep link URL should be "http://localhost:7713/index.html?board=demo&card=FLOW-abc123"

  Scenario: parseCardDeepLinkParams reads board and card query params
    When I parse card deep link params from "?board=project&card=FLOW-copy.ini"
    Then the parsed card deep link board slug should be "project"
    And the parsed card deep link card id should be "FLOW-copy"

  Scenario: parseCardDeepLinkParams returns null without a card param
    When I parse card deep link params from "?board=demo"
    Then there should be no parsed card deep link

  Scenario: clearCardDeepLinkFromUrl removes board and card from the address bar
    Given the browser location is "http://localhost:7713/index.html?board=demo&card=FLOW-abc"
    When I clear the card deep link from the URL
    Then the browser location should be "http://localhost:7713/index.html"

  Scenario: linksWithSourceCardLink appends a Source card deep link
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link for board "demo" and filename "FLOW-src.ini" to links:
      """
      [{"text":"Docs","url":"https://example.com"}]
      """
    Then the links JSON should be:
      """
      [
        {"text":"Docs","url":"https://example.com"},
        {"text":"Source card","url":"http://localhost:7713/index.html?board=demo&card=FLOW-src"}
      ]
      """

  Scenario: findCardEditorContextFromBoard locates a card on the loaded board
    When I find card editor context for card "FLOW-hit" on board "demo" with:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [{"index": 1, "title": "Lane A"}],
        "cardsByColumn": {
          "1": [{"filename": "FLOW-hit.ini", "swimlane": "Lane A"}]
        }
      }
      """
    Then the card editor context filename should be "FLOW-hit.ini"
    And the card editor context column title should be "To do"
    And the card editor context swimlane index should be 1

  Scenario: findCardEditorContextFromBoard returns null when the card is missing
    When I find card editor context for card "FLOW-miss" on board "demo" with:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {"1": []}
      }
      """
    Then there should be no card editor context

  Scenario: queueCardEditorOpenAfterRefresh stores context until taken
    When I queue a card editor open for board "demo" and filename "FLOW-new.ini"
    And I take the pending card editor open context
    Then the pending card editor open filename should be "FLOW-new.ini"
    When I take the pending card editor open context
    Then there should be no pending card editor open context
