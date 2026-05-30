@card_deep_link
Feature: Card deep links and duplicate source links
  Build shareable board URLs for individual cards, parse them on load, and
  append a Source card link when duplicating.

  Scenario: normalizeCardId strips a trailing .ini extension
    When I normalize the card id "FLOW-abc123.ini"
    Then the normalized card id should be "FLOW-abc123"

  Scenario: normalizeCardId treats nullish input as empty
    When I normalize the card id "null"
    Then the normalized card id should be ""

  Scenario: cardFilenameFromId appends .ini to a normalized id
    When I build the card filename from id "FLOW-abc123.ini"
    Then the card filename result should be "FLOW-abc123.ini"

  Scenario: cardFilenameFromId returns empty for a blank id
    When I build the card filename from id ""
    Then the card filename result should be ""

  Scenario: cardMatchesId matches filename or item id
    When I check whether a card with filename "FLOW-x.ini" matches id "FLOW-x"
    Then the card id match result should be true
    When I check whether a card with id "FLOW-y" matches id "FLOW-y"
    Then the card id match result should be true
    When I check whether a card with filename "FLOW-z.ini" matches id "FLOW-other"
    Then the card id match result should be false

  Scenario: cardMatchesId returns false for an empty target id
    When I check whether an empty card matches id ""
    Then the card id match result should be false

  Scenario: buildCardDeepLinkUrl encodes board slug and card id
    Given the browser location is "http://localhost:7713/index.html"
    When I build a card deep link for board "demo" and card "FLOW-abc123.ini"
    Then the card deep link URL should be "http://localhost:7713/index.html?board=demo&card=FLOW-abc123"

  Scenario: buildCardDeepLinkUrl tolerates a missing board slug
    Given the browser location is "http://localhost:7713/index.html"
    When I build a card deep link with JSON payload:
      """
      { "cardId": "FLOW-abc123" }
      """
    Then the card deep link URL should be "http://localhost:7713/index.html?board=&card=FLOW-abc123"

  Scenario: parseCardDeepLinkParams reads board and card query params
    When I parse card deep link params from "?board=project&card=FLOW-copy.ini"
    Then the parsed card deep link board slug should be "project"
    And the parsed card deep link card id should be "FLOW-copy"

  Scenario: parseCardDeepLinkParams omits board slug when the param is missing
    When I parse card deep link params from "?card=FLOW-a"
    Then the parsed card deep link board slug should be undefined
    And the parsed card deep link card id should be "FLOW-a"

  Scenario: parseCardDeepLinkParams returns null without a card param
    When I parse card deep link params from "?board=demo"
    Then there should be no parsed card deep link

  Scenario: parseCardDeepLinkParams returns null for a blank card param
    When I parse card deep link params from "?card=%20%20"
    Then there should be no parsed card deep link

  Scenario: parseCardDeepLinkParams returns null when card normalizes to empty
    When I parse card deep link params from "?card=.ini"
    Then there should be no parsed card deep link

  Scenario: clearCardDeepLinkFromUrl is a no-op when card and board are absent
    Given the browser location is "http://localhost:7713/index.html?foo=1"
    When I clear the card deep link from the URL
    Then the browser location should be "http://localhost:7713/index.html?foo=1"

  Scenario: clearCardDeepLinkFromUrl removes board and card from the address bar
    Given the browser location is "http://localhost:7713/index.html?board=demo&card=FLOW-abc"
    When I clear the card deep link from the URL
    Then the browser location should be "http://localhost:7713/index.html"

  Scenario: clearCardDeepLinkFromUrl preserves unrelated query params
    Given the browser location is "http://localhost:7713/index.html?board=demo&card=FLOW-abc&foo=1"
    When I clear the card deep link from the URL
    Then the browser location should be "http://localhost:7713/index.html?foo=1"

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

  Scenario: linksWithSourceCardLink returns normalized links when source metadata is incomplete
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link with JSON payload:
      """
      {
        "links": null,
        "source": { "boardSlug": "", "filename": "FLOW-src.ini" }
      }
      """
    Then the links JSON should be:
      """
      []
      """

  Scenario: linksWithSourceCardLink skips append when filename is missing
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link with JSON payload:
      """
      {
        "links": [],
        "source": { "boardSlug": "demo" }
      }
      """
    Then the links JSON should be:
      """
      []
      """

  Scenario: linksWithSourceCardLink skips append when board slug is missing
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link with JSON payload:
      """
      {
        "links": [],
        "source": { "filename": "FLOW-src.ini" }
      }
      """
    Then the links JSON should be:
      """
      []
      """

  Scenario: linksWithSourceCardLink normalizes links with missing text and url fields
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link with JSON payload:
      """
      {
        "links": [{}],
        "source": { "boardSlug": "demo", "filename": "FLOW-src.ini" }
      }
      """
    Then the links JSON should be:
      """
      [
        {"text":"","url":""},
        {"text":"Source card","url":"http://localhost:7713/index.html?board=demo&card=FLOW-src"}
      ]
      """

  Scenario: linksWithSourceCardLink trims partial link fields
    Given the browser location is "http://localhost:7713/index.html"
    When I add a source card link with JSON payload:
      """
      {
        "links": [{ "text": " Docs ", "url": " https://example.com " }],
        "source": { "boardSlug": "demo", "filename": "FLOW-src.ini" }
      }
      """
    Then the links JSON should be:
      """
      [
        {"text":"Docs","url":"https://example.com"},
        {"text":"Source card","url":"http://localhost:7713/index.html?board=demo&card=FLOW-src"}
      ]
      """

  Scenario: copyCardDeepLinkToClipboard writes the deep link URL via the clipboard API
    Given the browser location is "http://localhost:7713/index.html"
    And the clipboard API succeeds
    When I copy the card deep link for board "demo" and filename "FLOW-copy.ini"
    Then the copy card deep link result should be true
    And the clipboard should contain "http://localhost:7713/index.html?board=demo&card=FLOW-copy"

  Scenario: copyCardDeepLinkToClipboard falls back to execCommand when clipboard is unavailable
    Given the browser location is "http://localhost:7713/index.html"
    And the clipboard API is unavailable and execCommand copy succeeds
    When I copy the card deep link for board "demo" and filename "FLOW-copy.ini"
    Then the copy card deep link result should be true

  Scenario: copyCardDeepLinkToClipboard reports failure when copy mechanisms fail
    Given the browser location is "http://localhost:7713/index.html"
    And the clipboard API is unavailable and execCommand copy fails
    When I copy the card deep link for board "demo" and filename "FLOW-copy.ini"
    Then the copy card deep link result should be false
    And the flow toast message should be:
      """
      Could not copy link.
      """

  Scenario: copyCardDeepLinkToClipboard rejects incomplete card metadata
    When I copy the card deep link with JSON payload:
      """
      { "boardSlug": "", "filename": "FLOW-copy.ini" }
      """
    Then the copy card deep link result should be false
    And the flow toast message should be:
      """
      Could not copy link for this card.
      """

  Scenario: copyCardDeepLinkToClipboard rejects a missing board slug
    When I copy the card deep link with JSON payload:
      """
      { "filename": "FLOW-copy.ini" }
      """
    Then the copy card deep link result should be false
    And the flow toast message should be:
      """
      Could not copy link for this card.
      """

  Scenario: copyCardDeepLinkToClipboard reports failure when execCommand returns false
    Given the browser location is "http://localhost:7713/index.html"
    And the clipboard API is unavailable and execCommand copy returns false
    When I copy the card deep link for board "demo" and filename "FLOW-copy.ini"
    Then the copy card deep link result should be false
    And the flow toast message should be:
      """
      Could not copy link.
      """

  Scenario: showCopyLinkButtonCopied uses the default restore delay
    Given a copy link button with the default icon
    When I show the copy link button copied state
    Then the copy link button should show the copied icon

  Scenario: showCopyLinkButtonCopied swaps and restores the button icon
    Given a copy link button with the default icon
    When I show the copy link button copied state for 10 ms
    Then the copy link button should show the copied icon
    When I wait for the copy link button restore timer
    Then the copy link button should show the original icon

  Scenario: showCopyLinkButtonCopied restores the default icon when the saved markup was cleared
    Given a copy link button with the default icon
    When I show the copy link button copied state for 10 ms
    And I clear the saved copy link button icon markup
    And I wait for the copy link button restore timer
    Then the copy link button should show the original icon

  Scenario: showCopyLinkButtonCopied ignores non-button elements
    When I show the copy link button copied state on a non-button element
    Then the copy link trigger element should remain unchanged

  Scenario: showCopyLinkButtonCopied clears a previous restore timer
    Given a copy link button with the default icon
    When I show the copy link button copied state for 50 ms
    And I show the copy link button copied state for 10 ms
    And I wait for the copy link button restore timer
    Then the copy link button should show the original icon

  Scenario: showCopyLinkButtonCopied skips restore when the button was removed
    Given a copy link button with the default icon
    When I show the copy link button copied state for 10 ms
    And I remove the copy link button from the document
    And I wait for the copy link button restore timer
    Then the copy link button should no longer be connected

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

  Scenario: findCardEditorContextFromBoard skips non-matching cards in a column
    When I find card editor context for card "FLOW-target" on board "demo" with:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {
          "1": [
            {"filename": "FLOW-other.ini"},
            {"id": "FLOW-target"}
          ]
        }
      }
      """
    Then the card editor context filename should be "FLOW-target.ini"

  Scenario: findCardEditorContextFromBoard treats a missing column map entry as no cards
    When I find card editor context for card "FLOW-hit" on board "demo" with:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {}
      }
      """
    Then there should be no card editor context

  Scenario: findCardEditorContextFromBoard resolves aggregate storage slugs and source columns
    When I find card editor context for card "FLOW-hit" on board "all" with:
      """
      {
        "board": { "kind": "aggregate", "slug": "all" },
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {
          "1": [{
            "id": "FLOW-hit",
            "sourceBoardSlug": "demo",
            "sourceColumnIndex": 2
          }]
        }
      }
      """
    Then the card editor context filename should be "FLOW-hit.ini"
    And the card editor context board slug should be "demo"
    And the card editor context column index should be 2
    And the card editor context swimlane title should be undefined

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

  Scenario: tryOpenCardFromDeepLink opens the editor and clears the URL
    Given the browser location is "http://localhost:7713/index.html?board=demo&card=FLOW-open"
    When I try to open card "FLOW-open" from a deep link on the loaded board:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {
          "1": [{"filename": "FLOW-open.ini"}]
        }
      }
      """
    Then the deep link editor context filename should be "FLOW-open.ini"
    And the browser location should no longer include card or board params

  Scenario: tryOpenCardFromDeepLink derives the board slug when board metadata is missing
    Given the browser location is "http://localhost:7713/index.html?card=FLOW-open"
    When I try to open card "FLOW-open" from a deep link on the loaded board:
      """
      {
        "board": {},
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {
          "1": [{"filename": "FLOW-open.ini"}]
        }
      }
      """
    Then the deep link editor context filename should be "FLOW-open.ini"

  Scenario: tryOpenCardFromDeepLink treats a missing board section like empty metadata
    Given the browser location is "http://localhost:7713/index.html?card=FLOW-open"
    When I try to open card "FLOW-open" from a deep link on the loaded board:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {
          "1": [{"filename": "FLOW-open.ini"}]
        }
      }
      """
    Then the deep link editor context filename should be "FLOW-open.ini"

  Scenario: tryOpenCardFromDeepLink toasts when the card is missing
    Given the browser location is "http://localhost:7713/index.html?board=demo&card=FLOW-miss"
    When I try to open card "FLOW-miss" from a deep link on the loaded board:
      """
      {
        "columns": [{"index": 1, "title": "To do"}],
        "swimlanes": [],
        "cardsByColumn": {"1": []}
      }
      """
    Then there should be no deep link editor context
    And the flow toast message should be:
      """
      Card from link was not found on this board.
      """

  Scenario: queueCardEditorOpenAfterRefresh stores context until taken
    When I queue a card editor open for board "demo" and filename "FLOW-new.ini"
    And I take the pending card editor open context
    Then the pending card editor open filename should be "FLOW-new.ini"
    When I take the pending card editor open context
    Then there should be no pending card editor open context
