Feature: Read single task card API
  `GET /api/card` loads one task INI from a column folder under the board slug.

  Scenario: read an existing card
    Given the Millrace integration server has profile "with-open-card"
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-fix-open.ini"
    Then the response status should be 200
    And the last JSON field "title" should be "Open Fixture Card"

  Scenario: invalid card request returns 400
    Given the Millrace integration server has profile "with-open-card"
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1"
    Then the response status should be 400

  Scenario: missing card file returns 404
    Given the Millrace integration server has profile "with-open-card"
    When I fetch JSON from "/api/card?boardSlug=test&columnIndex=1&filename=FLOW-missing.ini"
    Then the response status should be 404
